// src-tauri/src/lib.rs
mod app;
mod domain;
mod infrastructure;
mod services;
mod utils;
mod workers;

use app::commands;
use app::state::AppState;
use infrastructure::storage::sqlite::create_pool;
use services::monitor_error_manager::MonitorErrorManager;
use services::settings_manager::SettingsManager;
use std::sync::Arc;
use tauri::Manager;
use tauri_plugin_log::{Target, TargetKind};
use workers::monitor::MonitorWorker;

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_process::init())
        .plugin(
            tauri_plugin_log::Builder::new()
                .targets([
                    Target::new(TargetKind::Stdout),
                    Target::new(TargetKind::LogDir {
                        file_name: Some("printcontrol".into()),
                    }),
                ])
                .level(log::LevelFilter::Info)
                .build(),
        )
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .setup(|app| {
            let app_handle = app.handle().clone();

            tauri::async_runtime::block_on(async {
                let (pool, db_path) = create_pool(&app_handle)
                    .await
                    .expect("Falha ao inicializar banco de dados");

                #[cfg(target_os = "windows")]
                let adapter = Arc::new(
                    infrastructure::printing::windows::WindowsAdapter::new()
                );

                #[cfg(target_os = "linux")]
                let adapter = Arc::new(
                    infrastructure::printing::linux::LinuxAdapter::new()
                );

                let job_manager = Arc::new(
                    services::job_manager::JobManager::new(pool.clone())
                );

                let settings_manager = Arc::new(
                    SettingsManager::new(pool.clone())
                );

                let monitor_error_manager = Arc::new(
                    MonitorErrorManager::new(pool.clone())
                );

                let auto_start = settings_manager
                    .get_all()
                    .await
                    .map(|s| s.auto_start_monitor)
                    .unwrap_or(true);

                let state = Arc::new(AppState {
                    printing_adapter: adapter,
                    job_manager,
                    settings_manager: settings_manager.clone(),
                    monitor_error_manager,
                    db_path,
                });

                app.manage(state.clone());

                if auto_start {
                    // Armazena o worker em estado gerenciado para permitir
                    // graceful shutdown via on_window_event
                    let worker = Arc::new(MonitorWorker::new());
                    app.manage(worker.clone());
                    worker.start(app_handle.clone(), state);
                }

                Ok::<(), Box<dyn std::error::Error>>(())
            })?;

            // Preenche o menu da bandeja com dados reais logo após o boot,
            app::tray::setup(app)?;

            // Preenche o menu da bandeja com dados reais logo após o boot,
            // substituindo os placeholders "Carregando..."
            let tray_handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                // Pequeno delay para garantir que AppState já foi gerenciado
                tokio::time::sleep(std::time::Duration::from_millis(500)).await;
                app::tray::rebuild_menu_async(&tray_handle).await;
            });

            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                // Previne o fechamento real da janela e apenas a esconde,
                // mantendo o processo e o monitoramento rodando em background.
                api.prevent_close();
                window.hide().unwrap();
                
                // Opcional: Logar que a janela foi escondida
                tracing::info!("Janela escondida (minimizar para bandeja)");
            }
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_jobs,
            commands::get_jobs_paginated,
            commands::get_jobs_by_period,
            commands::get_printers,
            commands::get_job_stats,
            commands::get_settings,
            commands::update_setting,
            commands::reset_settings,
            commands::clear_history,
            commands::get_db_path,
            commands::get_monitor_errors,
            commands::clear_monitor_errors,
            commands::get_printer_health_scores,
        ])
        .run(tauri::generate_context!())
        .expect("Erro ao executar aplicacao PrintControl");
}


