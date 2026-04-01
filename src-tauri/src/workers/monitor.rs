// src-tauri/src/workers/monitor.rs
use crate::app::events::{EVENT_JOB_FAILED, EVENT_JOB_NEW, EVENT_JOB_UPDATE, EVENT_MONITOR_ERROR};
use crate::app::tray;
use crate::app::state::AppState;
use crate::domain::job::PrintJob;
use crate::services::job_tracker::JobTracker;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Duration;
use tauri::{AppHandle, Emitter};
use tauri_plugin_notification::NotificationExt;
use tracing::{error, info, warn};

pub struct MonitorWorker {
    is_running: Arc<AtomicBool>,
}

impl MonitorWorker {
    pub fn new() -> Self {
        Self {
            is_running: Arc::new(AtomicBool::new(false)),
        }
    }

    /// Inicia o worker em task separada via tauri::async_runtime::spawn.
    /// NÃO bloqueia a thread principal do Tauri.
    pub fn start(&self, app_handle: AppHandle, state: Arc<AppState>) {
        let is_running = self.is_running.clone();
        is_running.store(true, Ordering::SeqCst);

        tauri::async_runtime::spawn(async move {
            info!("Monitor de impressão iniciado");

            let mut tracker = JobTracker::new(state.job_manager.clone());
            let mut previous_jobs: Vec<PrintJob> = vec![];

            // Reconcilia jobs ativos do banco com o estado atual do spooler
            if let Ok(active) = state.job_manager.get_active_jobs().await {
                previous_jobs = active;
                info!("{} jobs ativos reconciliados do banco", previous_jobs.len());
            }

            // Contador de ciclos para espaçar a limpeza de histórico (1x/hora).
            // poll padrão = 2s → 1800 ciclos ≈ 1 hora.
            let mut cleanup_ticks: u64 = 0;
            // Roda a limpeza logo na primeira iteração para garantir que jobs
            // expirados sejam removidos ao reiniciar, sem esperar 1 hora.
            let mut run_cleanup_now = true;

            while is_running.load(Ordering::SeqCst) {
                let poll_secs = state.settings_manager.get_poll_interval().await;
                let timeout_mins = state.settings_manager.get_timeout_mins().await;

                // Limpeza de histórico: roda na primeira iteração e depois a cada hora.
                let ticks_per_hour = (3600 / poll_secs.max(1)).max(1);
                if run_cleanup_now || cleanup_ticks % ticks_per_hour == 0 {
                    run_cleanup_now = false;
                    let retention_days = state.settings_manager.get_history_retention_days().await;
                    match state.job_manager.delete_old_jobs(retention_days).await {
                        Ok(0) => {}
                        Ok(n) => {
                            info!("Limpeza automática: {} job(s) removidos (>{} dias)", n, retention_days);
                        }
                        Err(e) => {
                            warn!("Erro na limpeza automática de histórico: {}", e);
                        }
                    }
                }
                cleanup_ticks = cleanup_ticks.wrapping_add(1);

                // Lê as preferências de notificação uma única vez por ciclo.
                let settings = state.settings_manager.get_all().await.ok();
                let desktop_notif = settings.as_ref().map(|s| s.desktop_notification).unwrap_or(true);
                let notify_failed = settings.as_ref().map(|s| s.notify_on_failed).unwrap_or(true);
                let notify_error  = settings.as_ref().map(|s| s.notify_on_monitor_error).unwrap_or(true);

                // Marca jobs travados como FAILED e emite evento com o PrintJob completo.
                match state.job_manager.mark_timed_out_jobs(timeout_mins).await {
                    Ok(timed_out_ids) => {
                        for id in timed_out_ids {
                            // Busca o job completo para que o frontend possa
                            // atualizar o cache sem precisar de refetch.
                            match state.job_manager.get_by_id(&id).await {
                                Ok(Some(job)) => {
                                    if desktop_notif && notify_failed {
                                        notify_job_failed(&app_handle, &job.document_name);
                                    }
                                    app_handle.emit(EVENT_JOB_UPDATE, &job).ok();
                                    app_handle.emit(EVENT_JOB_FAILED, &job).ok();
                                }
                                Ok(None) => {
                                    // Job removido entre o mark e o get — improvável mas seguro.
                                    warn!("Job com timeout não encontrado após marcar: {}", id);
                                }
                                Err(e) => {
                                    error!("Erro ao buscar job após timeout: {}", e);
                                    // Emite ID bruto como fallback para invalidar a query.
                                    app_handle.emit(EVENT_JOB_FAILED, &id).ok();
                                }
                            }
                        }
                    }
                    Err(e) => {
                        error!("Erro ao verificar jobs com timeout: {}", e);
                    }
                }

                match state.printing_adapter.list_jobs().await {
                    Ok(current_jobs) => {
                        match tracker.process_diff(&previous_jobs, &current_jobs).await {
                            Ok(diff) => {
                                for job in &diff.new_jobs {
                                    app_handle.emit(EVENT_JOB_NEW, job).ok();
                                }
                                for job in &diff.failed_jobs {
                                    if desktop_notif && notify_failed {
                                        notify_job_failed(&app_handle, &job.document_name);
                                    }
                                    app_handle.emit(EVENT_JOB_UPDATE, job).ok();
                                    app_handle.emit(EVENT_JOB_FAILED, job).ok();
                                }
                                // Atualiza o menu do tray sempre que houver mudança
                                // de jobs (novo, falha ou conclusão) para que o
                                // menu esteja fresco ao próximo clique direito.
                                let tray_changed = !diff.new_jobs.is_empty()
                                    || !diff.failed_jobs.is_empty()
                                    || !diff.completed_jobs.is_empty();
                                if tray_changed {
                                    tray::rebuild_menu_async(&app_handle).await;
                                }
                            }
                            Err(e) => {
                                let msg = e.to_string();
                                error!("Erro ao processar diff: {}", msg);
                                state.monitor_error_manager.insert(&msg).await.ok();
                                if desktop_notif && notify_error {
                                    notify_monitor_error(&app_handle, &msg);
                                }
                                app_handle.emit(EVENT_MONITOR_ERROR, msg).ok();
                            }
                        }
                        previous_jobs = current_jobs;
                    }
                    Err(e) => {
                        let msg = e.to_string();
                        error!("Erro ao listar jobs do spooler: {}", msg);
                        state.monitor_error_manager.insert(&msg).await.ok();
                        if desktop_notif && notify_error {
                            notify_monitor_error(&app_handle, &msg);
                        }
                        app_handle.emit(EVENT_MONITOR_ERROR, msg).ok();
                    }
                }

                tokio::time::sleep(Duration::from_secs(poll_secs)).await;
            }

            info!("Monitor de impressão encerrado");
        });
    }

    pub fn stop(&self) {
        self.is_running.store(false, Ordering::SeqCst);
    }
}

fn notify_job_failed(app: &AppHandle, document_name: &str) {
    if let Err(e) = app
        .notification()
        .builder()
        .title("PrintControl — Job com falha")
        .body(document_name)
        .show()
    {
        warn!("Não foi possível enviar notificação desktop: {}", e);
    }
}

fn notify_monitor_error(app: &AppHandle, message: &str) {
    if let Err(e) = app
        .notification()
        .builder()
        .title("PrintControl — Erro no monitor")
        .body(message)
        .show()
    {
        warn!("Não foi possível enviar notificação desktop: {}", e);
    }
}
