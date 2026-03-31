// src-tauri/src/app/tray.rs

use crate::app::state::AppState;
use crate::domain::job::PrintJob;
use crate::domain::printer::Printer;
use crate::services::job_manager::JobStats;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use tauri::{
    image::Image,
    menu::{CheckMenuItem, MenuBuilder, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, Manager,
};
use tracing::warn;

// ── IDs fixos dos itens de menu ──────────────────────────────────────────────

pub const TRAY_ID: &str = "main-tray";

const ID_HEADER: &str = "header";
const ID_MONITOR_STATUS: &str = "monitor_status";
const ID_SECTION_STATS: &str = "section_stats";
const ID_STAT_PRINTING: &str = "stat_printing";
const ID_STAT_PENDING: &str = "stat_pending";
const ID_STAT_FAILED: &str = "stat_failed";
const ID_SECTION_RECENT: &str = "section_recent";
const ID_SECTION_PRINTERS: &str = "section_printers";
const ID_MONITOR_TOGGLE: &str = "monitor_toggle";
const ID_OPEN_SETTINGS: &str = "open_settings";
const ID_OPEN: &str = "open";
const ID_QUIT: &str = "quit";

// ── Estado compartilhado do tray ─────────────────────────────────────────────

pub struct TrayHandles {
    pub monitor_paused: AtomicBool,
    pub last_stats: Mutex<JobStats>,
}

impl TrayHandles {
    pub fn new() -> Self {
        Self {
            monitor_paused: AtomicBool::new(false),
            last_stats: Mutex::new(JobStats::default()),
        }
    }

    pub fn is_paused(&self) -> bool {
        self.monitor_paused.load(Ordering::SeqCst)
    }

    pub fn set_paused(&self, paused: bool) {
        self.monitor_paused.store(paused, Ordering::SeqCst);
    }
}

// ── Ícone de estado ──────────────────────────────────────────────────────────

#[derive(Clone, Copy)]
pub enum TrayIconKind {
    Normal,
    Printing,
    Error,
    Paused,
}

// ── Setup inicial ────────────────────────────────────────────────────────────

pub fn setup(app: &tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    let handles = Arc::new(TrayHandles::new());
    app.manage(handles.clone());

    let menu = build_placeholder_menu(app)?;

    TrayIconBuilder::with_id(TRAY_ID)
        .icon(load_icon(app.handle(), TrayIconKind::Normal))
        .menu(&menu)
        .tooltip("PrintControl — Monitor ativo")
        .show_menu_on_left_click(false)
        .on_menu_event({
            let handles = handles.clone();
            move |app, event| {
                handle_menu_event(app, event.id.as_ref(), &handles);
            }
        })
        .on_tray_icon_event(|tray: &tauri::tray::TrayIcon, event: TrayIconEvent| match event {
            // Clique esquerdo → mostrar/focar janela principal
            TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } => {
                show_main_window(tray.app_handle());
            }
            // Clique direito → reconstruir menu com dados frescos antes de exibir
            TrayIconEvent::Click {
                button: MouseButton::Right,
                button_state: MouseButtonState::Up,
                ..
            } => {
                let app = tray.app_handle().clone();
                tauri::async_runtime::spawn(async move {
                    rebuild_menu_async(&app).await;
                });
            }
            _ => {}
        })
        .build(app)?;

    Ok(())
}

// ── Menu placeholder (exibido na primeira abertura) ──────────────────────────

fn build_placeholder_menu(
    app: &tauri::App,
) -> Result<tauri::menu::Menu<tauri::Wry>, tauri::Error> {
    MenuBuilder::new(app)
        .item(&MenuItem::with_id(
            app,
            ID_HEADER,
            "🖨  PrintControl  v0.1.0",
            false,
            None::<&str>,
        )?)
        .item(&MenuItem::with_id(
            app,
            ID_MONITOR_STATUS,
            "● Monitor ativo",
            false,
            None::<&str>,
        )?)
        .separator()
        .item(&MenuItem::with_id(
            app,
            ID_SECTION_STATS,
            "IMPRESSÕES AGORA",
            false,
            None::<&str>,
        )?)
        .item(&MenuItem::with_id(
            app,
            ID_STAT_PRINTING,
            "  Carregando...",
            false,
            None::<&str>,
        )?)
        .separator()
        .item(&MenuItem::with_id(
            app,
            ID_SECTION_PRINTERS,
            "IMPRESSORAS",
            false,
            None::<&str>,
        )?)
        .separator()
        .item(&CheckMenuItem::with_id(
            app,
            ID_MONITOR_TOGGLE,
            "Pausar Monitor",
            true,
            false,
            None::<&str>,
        )?)
        .item(&MenuItem::with_id(
            app,
            ID_OPEN_SETTINGS,
            "Abrir Configurações",
            true,
            None::<&str>,
        )?)
        .separator()
        .item(&MenuItem::with_id(
            app,
            ID_OPEN,
            "Abrir PrintControl",
            true,
            None::<&str>,
        )?)
        .item(&MenuItem::with_id(app, ID_QUIT, "Sair", true, None::<&str>)?)
        .build()
}

// ── Rebuild dinâmico ─────────────────────────────────────────────────────────

/// Busca dados frescos e reconstrói o menu completo.
/// Executado em async para não bloquear a thread de eventos.
pub async fn rebuild_menu_async(app: &AppHandle) {
    let state = match app.try_state::<Arc<AppState>>() {
        Some(s) => s,
        None => return,
    };
    let handles = match app.try_state::<Arc<TrayHandles>>() {
        Some(h) => h,
        None => return,
    };

    let (stats_result, jobs_result, printers_result, settings_result) = tokio::join!(
        state.job_manager.get_stats(),
        state.job_manager.get_all(),
        state.printing_adapter.list_printers(),
        state.settings_manager.get_all(),
    );

    let stats = stats_result.unwrap_or_default();
    let _all_jobs = jobs_result.unwrap_or_default();
    let printers = printers_result.unwrap_or_default();
    let settings = settings_result.unwrap_or_default();
    let is_en = settings.language == "en-US";

    if let Ok(mut last) = handles.last_stats.lock() {
        *last = stats.clone();
    }

    let paused = handles.is_paused();

    if let Some(tray) = app.tray_by_id(TRAY_ID) {
        match build_full_menu(app, &stats, &printers, paused, is_en) {
            Ok(menu) => {
                let _ = tray.set_menu(Some(menu));
            }
            Err(e) => warn!("Falha ao construir menu do tray: {}", e),
        }
        update_icon_and_tooltip(&tray, &stats, paused);
    }
}

/// Atualiza apenas tooltip e ícone — chamado em resposta a eventos push.
/// Mais barato que rebuild completo.
#[allow(dead_code)]
pub fn update_tray_quick(app: &AppHandle, stats: &JobStats, paused: bool) {
    if let Some(tray) = app.tray_by_id(TRAY_ID) {
        update_icon_and_tooltip(&tray, stats, paused);
    }
}

// ── Construção do menu completo ──────────────────────────────────────────────

fn build_full_menu(
    app: &AppHandle,
    stats: &JobStats,
    printers: &[Printer],
    paused: bool,
    is_en: bool,
) -> Result<tauri::menu::Menu<tauri::Wry>, tauri::Error> {
    let monitor_status_label = if paused {
        if is_en { "○ Monitor paused" } else { "○ Monitor pausado" }
    } else {
        if is_en { "● Monitor active" } else { "● Monitor ativo" }
    };

    let has_activity = stats.printing > 0 || stats.pending > 0 || stats.failed > 0;

    // ── Seção impressões ─────────────────────────────────────────────────────
    let stat_printing = if is_en {
        format!("  ⟳  {} printing", stats.printing)
    } else {
        format!("  ⟳  {} imprimindo", stats.printing)
    };
    let stat_pending = if is_en {
        format!("  ⏳  {} pending", stats.pending)
    } else {
        format!("  ⏳  {} pendente{}", stats.pending, if stats.pending == 1 { "" } else { "s" })
    };
    let stat_failed = if is_en {
        format!("  ✗  {} failed", stats.failed)
    } else {
        format!("  ✗  {} falha{}", stats.failed, if stats.failed == 1 { "" } else { "s" })
    };


    // ── Seção impressoras ────────────────────────────────────────────────────
    let online_count = printers.iter().filter(|p| p.is_online).count();
    let printer_section = if printers.is_empty() {
        if is_en { "PRINTERS".to_string() } else { "IMPRESSORAS".to_string() }
    } else {
        if is_en {
            format!("PRINTERS  ({} of {} online)", online_count, printers.len())
        } else {
            format!("IMPRESSORAS  ({} de {} online)", online_count, printers.len())
        }
    };

    // ── Construção ───────────────────────────────────────────────────────────
    let mut builder = MenuBuilder::new(app);

    // Header fixo
    builder = builder
        .item(&MenuItem::with_id(
            app,
            ID_HEADER,
            "🖨  PrintControl  v0.1.0",
            false,
            None::<&str>,
        )?)
        .item(&MenuItem::with_id(
            app,
            ID_MONITOR_STATUS,
            monitor_status_label,
            false,
            None::<&str>,
        )?)
        .separator();

    // Estatísticas
    builder = builder.item(&MenuItem::with_id(
        app,
        ID_SECTION_STATS,
        if is_en { "PRINT JOBS NOW" } else { "IMPRESSÕES AGORA" },
        false,
        None::<&str>,
    )?);

    if has_activity {
        builder = builder
            .item(&MenuItem::with_id(
                app,
                ID_STAT_PRINTING,
                &stat_printing,
                stats.printing > 0,
                None::<&str>,
            )?)
            .item(&MenuItem::with_id(
                app,
                ID_STAT_PENDING,
                &stat_pending,
                stats.pending > 0,
                None::<&str>,
            )?)
            .item(&MenuItem::with_id(
                app,
                ID_STAT_FAILED,
                &stat_failed,
                stats.failed > 0,
                None::<&str>,
            )?);
    } else {
        builder = builder.item(&MenuItem::with_id(
            app,
            ID_STAT_PRINTING,
            if is_en { "  No active print jobs" } else { "  Nenhuma impressão ativa" },
            false,
            None::<&str>,
        )?);
    }


    builder = builder.separator();


    // Impressoras
    builder = builder.item(&MenuItem::with_id(
        app,
        ID_SECTION_PRINTERS,
        &printer_section,
        false,
        None::<&str>,
    )?);

    if printers.is_empty() {
        builder = builder.item(&MenuItem::with_id(
            app,
            "printer_none",
            if is_en { "  No printers detected" } else { "  Nenhuma impressora detectada" },
            false,
            None::<&str>,
        )?);
    } else {
        for (i, printer) in printers.iter().take(5).enumerate() {
            builder = builder.item(&MenuItem::with_id(
                app,
                &format!("printer_{}", i),
                &format_printer_label(printer),
                true,
                None::<&str>,
            )?);
        }
    }

    builder = builder.separator();

    // Ações
    let toggle_label = if paused {
        if is_en { "Resume Monitor" } else { "Retomar Monitor" }
    } else {
        if is_en { "Pause Monitor" } else { "Pausar Monitor" }
    };

    builder = builder
        .item(&CheckMenuItem::with_id(
            app,
            ID_MONITOR_TOGGLE,
            toggle_label,
            true,
            paused,
            None::<&str>,
        )?)
        .item(&MenuItem::with_id(
            app,
            ID_OPEN_SETTINGS,
            if is_en { "Open Settings" } else { "Abrir Configurações" },
            true,
            None::<&str>,
        )?)
        .separator()
        .item(&MenuItem::with_id(
            app,
            ID_OPEN,
            if is_en { "Open PrintControl" } else { "Abrir PrintControl" },
            true,
            None::<&str>,
        )?)
        .item(&MenuItem::with_id(app, ID_QUIT, if is_en { "Quit" } else { "Sair" }, true, None::<&str>)?);

    builder.build()
}

// ── Handler de eventos do menu ───────────────────────────────────────────────

fn handle_menu_event(app: &AppHandle, id: &str, handles: &TrayHandles) {
    match id {
        ID_OPEN => show_main_window(app),

        ID_OPEN_SETTINGS => {
            show_main_window(app);
            app.emit("navigate", "/settings").ok();
        }

        ID_STAT_PRINTING => {
            show_main_window(app);
            app.emit("navigate-filter", serde_json::json!({ "route": "/jobs", "status": "PRINTING" })).ok();
        }

        ID_STAT_PENDING => {
            show_main_window(app);
            app.emit("navigate-filter", serde_json::json!({ "route": "/jobs", "status": "PENDING" })).ok();
        }

        ID_STAT_FAILED => {
            show_main_window(app);
            app.emit("navigate-filter", serde_json::json!({ "route": "/jobs", "status": "FAILED" })).ok();
        }

        ID_MONITOR_TOGGLE => {
            let new_paused = !handles.is_paused();
            handles.set_paused(new_paused);
            let app_clone = app.clone();
            tauri::async_runtime::spawn(async move {
                toggle_monitor(&app_clone, new_paused).await;
            });
        }

        ID_QUIT => {
            if let Some(worker) =
                app.try_state::<Arc<crate::workers::monitor::MonitorWorker>>()
            {
                worker.stop();
            }
            app.exit(0);
        }

        // Jobs recentes → navega para /jobs
        id if id.starts_with("recent_job_") => {
            show_main_window(app);
            app.emit("navigate", "/jobs").ok();
        }

        // Impressoras → navega para /printers
        id if id.starts_with("printer_") => {
            show_main_window(app);
            app.emit("navigate", "/printers").ok();
        }

        _ => {}
    }
}

// ── Ações auxiliares ─────────────────────────────────────────────────────────

fn show_main_window(app: &AppHandle) {
    if let Some(win) = app.get_webview_window("main") {
        let _ = win.show();
        let _ = win.set_focus();
    }
}

async fn toggle_monitor(app: &AppHandle, pause: bool) {
    let state = match app.try_state::<Arc<AppState>>() {
        Some(s) => s,
        None => return,
    };

    // Persiste preferência
    let _ = state
        .settings_manager
        .update("auto_start_monitor", if pause { "false" } else { "true" })
        .await;

    if pause {
        if let Some(worker) =
            app.try_state::<Arc<crate::workers::monitor::MonitorWorker>>()
        {
            worker.stop();
            tracing::info!("Monitor pausado via tray");
        }
    } else {
        let app_handle = app.clone();
        let state_arc = state.inner().clone();
        let worker = Arc::new(crate::workers::monitor::MonitorWorker::new());
        app.manage(worker.clone());
        worker.start(app_handle, state_arc);
        tracing::info!("Monitor retomado via tray");
    }

    // Atualiza ícone imediatamente
    if let Some(tray) = app.tray_by_id(TRAY_ID) {
        let handles = app.try_state::<Arc<TrayHandles>>();
        let stats = handles
            .as_ref()
            .and_then(|h| h.last_stats.lock().ok().map(|s| s.clone()))
            .unwrap_or_default();
        update_icon_and_tooltip(&tray, &stats, pause);
    }
}

// ── Ícone e tooltip ──────────────────────────────────────────────────────────

pub fn update_icon_and_tooltip(
    tray: &tauri::tray::TrayIcon,
    stats: &JobStats,
    paused: bool,
) {
    let kind = if paused {
        TrayIconKind::Paused
    } else if stats.failed > 0 {
        TrayIconKind::Error
    } else if stats.printing > 0 || stats.pending > 0 {
        TrayIconKind::Printing
    } else {
        TrayIconKind::Normal
    };

    let tooltip = match kind {
        TrayIconKind::Paused => "PrintControl — Monitor pausado".to_string(),
        TrayIconKind::Error => format!(
            "PrintControl — ⚠ {} falha(s) detectada(s)",
            stats.failed
        ),
        TrayIconKind::Printing => format!(
            "PrintControl — {} imprimindo, {} pendente(s)",
            stats.printing, stats.pending
        ),
        TrayIconKind::Normal => "PrintControl — Monitor ativo".to_string(),
    };

    let _ = tray.set_icon(Some(load_icon(tray.app_handle(), kind)));
    let _ = tray.set_tooltip(Some(tooltip));
}

fn load_icon(app: &AppHandle, kind: TrayIconKind) -> Image<'static> {
    let name = match kind {
        TrayIconKind::Normal => "tray-normal.png",
        TrayIconKind::Printing => "tray-printing.png",
        TrayIconKind::Error => "tray-error.png",
        TrayIconKind::Paused => "tray-paused.png",
    };

    let icons_dir = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("icons");
    let path = icons_dir.join(name);

    if path.exists() {
        if let Ok(dyn_img) = image::open(&path) {
            let rgba = dyn_img.to_rgba8();
            let (width, height) = rgba.dimensions();
            let bytes = rgba.into_raw();
            return Image::new_owned(bytes, width, height);
        }
    }

    warn!("Ícone de tray '{}' não encontrado, usando ícone padrão", name);
    // Converte o ícone padrão (referência) para Image<'static> via new_owned
    let default = app.default_window_icon().unwrap();
    Image::new_owned(
        default.rgba().to_vec(),
        default.width(),
        default.height(),
    )
}

// ── Formatação ───────────────────────────────────────────────────────────────

fn format_job_label(job: &PrintJob, is_en: bool) -> String {
    let status_str = job.status.to_string();
    let status = match status_str.as_str() {
        "PRINTING" => if is_en { "[PRINTING]" } else { "[IMPRIMINDO]" },
        "COMPLETED" => if is_en { "[COMPLETED]" } else { "[CONCLUÍDO]" },
        "FAILED" => if is_en { "[FAILED]" } else { "[FALHOU]" },
        "PENDING" => if is_en { "[PENDING]" } else { "[PENDENTE]" },
        other => other,
    };

    let max = 26;
    let name = if job.document_name.chars().count() > max {
        format!(
            "{}…",
            job.document_name.chars().take(max - 1).collect::<String>()
        )
    } else {
        job.document_name.clone()
    };

    format!("  {}  {}", name, status)
}

fn format_printer_label(printer: &Printer) -> String {
    let dot = if printer.is_online { "●" } else { "○" };
    let suffix = if printer.is_online { "" } else { "  [offline]" };
    format!("  {}  {}{}", dot, printer.name, suffix)
}
