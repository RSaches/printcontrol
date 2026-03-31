# Spec — Bandeja de Sistema Enriquecida

**Projeto:** PrintControl
**Referência:** `doc/PRD-tray-enrichment.md`
**Data:** 2026-03-30

---

## Visão de Implementação

A implementação se divide em **4 etapas sequenciais**:

1. Gerar os ícones SVG de estado do tray
2. Criar `src/app/tray.rs` — módulo central de lógica
3. Modificar `src/app/state.rs` e `src/app/mod.rs`
4. Refatorar `src/lib.rs` — integrar tray e listeners de eventos

---

## Etapa 1 — Ícones de Estado

### Arquivos a criar

| Arquivo | Estado | Diferencial visual |
|---------|--------|--------------------|
| `src-tauri/icons/tray-normal.svg` | Monitor ativo, sem jobs | Ícone base (igual ao atual 32x32) |
| `src-tauri/icons/tray-printing.svg` | Jobs em andamento | Badge azul no canto inferior direito |
| `src-tauri/icons/tray-error.svg` | Falhas detectadas | Badge vermelho no canto inferior direito |
| `src-tauri/icons/tray-paused.svg` | Monitor pausado | Ícone com opacidade reduzida + `||` |

> Os arquivos PNG 32x32 são gerados a partir dos SVGs via script após criação.
> O Tauri carrega os PNGs em runtime via `Image::from_bytes()`.

### `src-tauri/icons/tray-normal.svg`

Base idêntica ao `32x32.png` existente — impressora simples sem overlay.

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="none">
  <!-- Corpo impressora -->
  <rect x="4" y="11" width="24" height="14" rx="2" fill="#1E40AF"/>
  <!-- Papel saindo -->
  <rect x="9" y="7" width="14" height="7" rx="1" fill="#BFDBFE"/>
  <!-- Slot saída -->
  <rect x="9" y="22" width="14" height="2" rx="1" fill="#93C5FD"/>
  <!-- Luz status verde -->
  <circle cx="22" cy="16" r="2" fill="#22C55E"/>
</svg>
```

### `src-tauri/icons/tray-error.svg`

Mesma base + badge vermelho no canto:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="none">
  <!-- Corpo impressora (igual ao normal) -->
  <rect x="4" y="11" width="24" height="14" rx="2" fill="#1E40AF"/>
  <rect x="9" y="7" width="14" height="7" rx="1" fill="#BFDBFE"/>
  <rect x="9" y="22" width="14" height="2" rx="1" fill="#93C5FD"/>
  <circle cx="22" cy="16" r="2" fill="#22C55E"/>
  <!-- Badge de erro (canto inferior direito) -->
  <circle cx="26" cy="26" r="6" fill="#EF4444"/>
  <text x="26" y="30" font-size="8" text-anchor="middle" fill="white" font-weight="bold">!</text>
</svg>
```

### `src-tauri/icons/tray-paused.svg`

Mesma base com opacidade reduzida + símbolo pause:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="none">
  <g opacity="0.45">
    <rect x="4" y="11" width="24" height="14" rx="2" fill="#1E40AF"/>
    <rect x="9" y="7" width="14" height="7" rx="1" fill="#BFDBFE"/>
    <rect x="9" y="22" width="14" height="2" rx="1" fill="#93C5FD"/>
    <circle cx="22" cy="16" r="2" fill="#22C55E"/>
  </g>
  <!-- Símbolo pause no canto inferior direito -->
  <circle cx="26" cy="26" r="6" fill="#6B7280"/>
  <rect x="23" y="23" width="2.5" height="6" rx="1" fill="white"/>
  <rect x="27" y="23" width="2.5" height="6" rx="1" fill="white"/>
</svg>
```

### `src-tauri/icons/tray-printing.svg`

Badge azul com seta rotacionando (estático — animação não suportada em ícone nativo):

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="none">
  <rect x="4" y="11" width="24" height="14" rx="2" fill="#1E40AF"/>
  <rect x="9" y="7" width="14" height="7" rx="1" fill="#BFDBFE"/>
  <rect x="9" y="22" width="14" height="2" rx="1" fill="#93C5FD"/>
  <circle cx="22" cy="16" r="2" fill="#22C55E"/>
  <!-- Badge azul com seta -->
  <circle cx="26" cy="26" r="6" fill="#3B82F6"/>
  <path d="M23 26 a3 3 0 1 1 3 3" stroke="white" stroke-width="1.5"
        stroke-linecap="round" fill="none"/>
  <path d="M26 29 l1.5 -1.5 l-2 0" fill="white"/>
</svg>
```

### Script de conversão SVG → PNG

**Arquivo:** `src-tauri/scripts/gen-tray-icons.mjs`

```js
// src-tauri/scripts/gen-tray-icons.mjs
// Uso: node src-tauri/scripts/gen-tray-icons.mjs
import { Resvg } from "@resvg/resvg-js";
import { readFileSync, writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const iconsDir  = resolve(__dirname, "../icons");

const ICONS = ["tray-normal", "tray-error", "tray-paused", "tray-printing"];

for (const name of ICONS) {
  const svg = readFileSync(resolve(iconsDir, `${name}.svg`));
  const resvg = new Resvg(svg, { fitTo: { mode: "width", value: 32 } });
  const png = resvg.render().asPng();
  writeFileSync(resolve(iconsDir, `${name}.png`), png);
  console.log(`✓ ${name}.png`);
}
```

---

## Etapa 2 — `src-tauri/src/app/tray.rs` (arquivo novo)

Módulo central que encapsula toda a lógica de construção, atualização e estado da bandeja.

```rust
// src-tauri/src/app/tray.rs

use crate::app::state::AppState;
use crate::domain::job::PrintJob;
use crate::domain::printer::Printer;
use crate::services::job_manager::JobStats;
use std::sync::{Arc, Mutex};
use std::sync::atomic::{AtomicBool, Ordering};
use tauri::{
    image::Image,
    menu::{CheckMenuItem, Menu, MenuBuilder, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIcon, TrayIconBuilder, TrayIconEvent},
    AppHandle, Manager,
};
use tracing::warn;

// ── IDs dos itens de menu ────────────────────────────────────────────────────

pub const TRAY_ID:               &str = "main-tray";

const ID_HEADER:                 &str = "header";
const ID_MONITOR_STATUS:         &str = "monitor_status";
const ID_SECTION_STATS:          &str = "section_stats";
const ID_STAT_PRINTING:          &str = "stat_printing";
const ID_STAT_PENDING:           &str = "stat_pending";
const ID_STAT_FAILED:            &str = "stat_failed";
const ID_SECTION_RECENT:         &str = "section_recent";
const ID_JOB_0:                  &str = "recent_job_0";
const ID_JOB_1:                  &str = "recent_job_1";
const ID_JOB_2:                  &str = "recent_job_2";
const ID_SECTION_PRINTERS:       &str = "section_printers";
// Impressoras têm IDs gerados: "printer_0", "printer_1", ...
const ID_MONITOR_TOGGLE:         &str = "monitor_toggle";
const ID_OPEN_SETTINGS:          &str = "open_settings";
const ID_OPEN:                   &str = "open";
const ID_QUIT:                   &str = "quit";

// ── Estado compartilhado do tray ─────────────────────────────────────────────

/// Handles mantidos para mutação direta de itens sem rebuildar o menu inteiro.
/// Usado para atualizações rápidas por eventos push (tooltip, ícone).
/// O menu completo é reconstruído no clique via `rebuild_menu`.
pub struct TrayHandles {
    pub monitor_paused: AtomicBool,
    pub last_stats:     Mutex<JobStats>,
}

impl TrayHandles {
    pub fn new() -> Self {
        Self {
            monitor_paused: AtomicBool::new(false),
            last_stats: Mutex::new(JobStats {
                total: 0, pending: 0, printing: 0, completed: 0, failed: 0,
            }),
        }
    }

    pub fn is_paused(&self) -> bool {
        self.monitor_paused.load(Ordering::SeqCst)
    }

    pub fn set_paused(&self, paused: bool) {
        self.monitor_paused.store(paused, Ordering::SeqCst);
    }
}

// ── Setup inicial ────────────────────────────────────────────────────────────

/// Ponto de entrada chamado em `lib.rs` dentro do `.setup()`.
/// Cria o tray, registra handlers, gerencia `TrayHandles` em State.
pub fn setup(app: &tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    let handles = Arc::new(TrayHandles::new());
    app.manage(handles.clone());

    let menu = build_initial_menu(app)?;

    TrayIconBuilder::new()
        .id(TRAY_ID)
        .icon(load_icon(app, TrayIconKind::Normal))
        .menu(&menu)
        .tooltip("PrintControl — Monitor ativo")
        .menu_on_left_click(false)   // clique esquerdo abre janela, direito abre menu
        .on_menu_event({
            let handles = handles.clone();
            move |app, event| handle_menu_event(app, event.id.as_ref(), &handles)
        })
        .on_tray_icon_event(|tray, event| {
            match event {
                // Clique esquerdo → mostrar/focar janela
                TrayIconEvent::Click {
                    button: MouseButton::Left,
                    button_state: MouseButtonState::Up,
                    ..
                } => show_main_window(tray.app_handle()),

                // Menu abre → reconstruir com dados frescos
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
            }
        })
        .build(app)?;

    Ok(())
}

// ── Menu inicial (vazio/placeholder) ────────────────────────────────────────

/// Cria o menu com placeholders — será atualizado na primeira abertura.
fn build_initial_menu(app: &tauri::App) -> Result<Menu<tauri::Wry>, tauri::Error> {
    MenuBuilder::new(app)
        .item(&MenuItem::with_id(app, ID_HEADER, "🖨  PrintControl  v0.1.0", false, None::<&str>)?)
        .item(&MenuItem::with_id(app, ID_MONITOR_STATUS, "● Monitor ativo", false, None::<&str>)?)
        .separator()
        .item(&MenuItem::with_id(app, ID_SECTION_STATS, "IMPRESSÕES AGORA", false, None::<&str>)?)
        .item(&MenuItem::with_id(app, ID_STAT_PRINTING, "  ⟳  Carregando...", false, None::<&str>)?)
        .item(&MenuItem::with_id(app, ID_STAT_PENDING,  "  ⏳  Carregando...", false, None::<&str>)?)
        .item(&MenuItem::with_id(app, ID_STAT_FAILED,   "  ✗  Carregando...", false, None::<&str>)?)
        .separator()
        .item(&MenuItem::with_id(app, ID_SECTION_RECENT, "JOBS RECENTES", false, None::<&str>)?)
        .item(&MenuItem::with_id(app, ID_JOB_0, "  Carregando...", false, None::<&str>)?)
        .item(&MenuItem::with_id(app, ID_JOB_1, "  —", false, None::<&str>)?)
        .item(&MenuItem::with_id(app, ID_JOB_2, "  —", false, None::<&str>)?)
        .separator()
        .item(&MenuItem::with_id(app, ID_SECTION_PRINTERS, "IMPRESSORAS", false, None::<&str>)?)
        .separator()
        .item(&CheckMenuItem::with_id(app, ID_MONITOR_TOGGLE, "Pausar Monitor", true, false, None::<&str>)?)
        .item(&MenuItem::with_id(app, ID_OPEN_SETTINGS, "Abrir Configurações", true, None::<&str>)?)
        .separator()
        .item(&MenuItem::with_id(app, ID_OPEN, "Abrir PrintControl", true, None::<&str>)?)
        .item(&MenuItem::with_id(app, ID_QUIT, "Sair", true, None::<&str>)?)
        .build()
}

// ── Rebuild dinâmico (chamado no clique do ícone) ───────────────────────────

/// Busca dados do banco e reconstrói o menu inteiro com informações frescas.
/// Executado em `tauri::async_runtime::spawn` para não bloquear a UI.
pub async fn rebuild_menu_async(app: &AppHandle) {
    let state = match app.try_state::<Arc<AppState>>() {
        Some(s) => s,
        None    => return,
    };
    let handles = match app.try_state::<Arc<TrayHandles>>() {
        Some(h) => h,
        None    => return,
    };

    // Busca paralela: stats + jobs recentes + impressoras
    let (stats_result, jobs_result, printers_result) = tokio::join!(
        state.job_manager.get_stats(),
        state.job_manager.get_all(),
        state.printing_adapter.list_printers(),
    );

    let stats    = stats_result.unwrap_or_default();
    let all_jobs = jobs_result.unwrap_or_default();
    let printers = printers_result.unwrap_or_default();

    // Guarda stats para uso em update_icon_and_tooltip
    if let Ok(mut last) = handles.last_stats.lock() {
        *last = stats.clone();
    }

    let recent: Vec<&PrintJob> = all_jobs.iter().take(3).collect();
    let paused = handles.is_paused();

    if let Some(tray) = app.tray_by_id(TRAY_ID) {
        if let Ok(menu) = build_full_menu(app, &stats, &recent, &printers, paused) {
            let _ = tray.set_menu(Some(menu));
        }
        update_icon_and_tooltip(&tray, &stats, paused);
    }
}

/// Constrói o menu completo com dados reais.
fn build_full_menu(
    app: &AppHandle,
    stats: &JobStats,
    recent: &[&PrintJob],
    printers: &[Printer],
    paused: bool,
) -> Result<Menu<tauri::Wry>, tauri::Error> {
    let monitor_label = if paused {
        "○ Monitor pausado"
    } else {
        "● Monitor ativo"
    };

    // ── Seção: Estatísticas ──────────────────────────────────────────────────
    let has_activity = stats.printing > 0 || stats.pending > 0 || stats.failed > 0;

    let stat_printing_label = format!("  ⟳  {} imprimindo", stats.printing);
    let stat_pending_label  = format!("  ⏳  {} pendente{}", stats.pending,
                                      if stats.pending == 1 { "" } else { "s" });
    let stat_failed_label   = format!("  ✗  {} falha{}", stats.failed,
                                      if stats.failed == 1 { "" } else { "s" });

    // Falhas são clicáveis quando > 0
    let failed_enabled = stats.failed > 0;

    // ── Seção: Jobs recentes ─────────────────────────────────────────────────
    let job_labels: Vec<String> = {
        let mut labels = recent.iter().map(|j| format_job_label(j)).collect::<Vec<_>>();
        while labels.len() < 3 {
            labels.push("  —".to_string());
        }
        labels
    };
    let jobs_enabled: Vec<bool> = recent.iter().map(|_| true).chain(
        std::iter::repeat(false)
    ).take(3).collect();

    // ── Seção: Impressoras ───────────────────────────────────────────────────
    let online_count = printers.iter().filter(|p| p.is_online).count();
    let printer_section_label = if printers.is_empty() {
        "IMPRESSORAS".to_string()
    } else {
        format!("IMPRESSORAS  ({} de {} online)", online_count, printers.len())
    };

    let printer_items: Vec<String> = printers.iter().take(5)
        .map(format_printer_label)
        .collect();

    // ── Construção do menu ───────────────────────────────────────────────────
    let mut builder = MenuBuilder::new(app);

    // Header
    builder = builder
        .item(&MenuItem::with_id(app, ID_HEADER, "🖨  PrintControl  v0.1.0", false, None::<&str>)?)
        .item(&MenuItem::with_id(app, ID_MONITOR_STATUS, monitor_label, false, None::<&str>)?)
        .separator();

    // Estatísticas
    builder = builder
        .item(&MenuItem::with_id(app, ID_SECTION_STATS, "IMPRESSÕES AGORA", false, None::<&str>)?);

    if has_activity {
        builder = builder
            .item(&MenuItem::with_id(app, ID_STAT_PRINTING, &stat_printing_label, stats.printing > 0, None::<&str>)?)
            .item(&MenuItem::with_id(app, ID_STAT_PENDING,  &stat_pending_label,  stats.pending > 0,  None::<&str>)?)
            .item(&MenuItem::with_id(app, ID_STAT_FAILED,   &stat_failed_label,   failed_enabled,     None::<&str>)?);
    } else {
        builder = builder
            .item(&MenuItem::with_id(app, ID_STAT_PRINTING, "  Nenhuma impressão ativa", false, None::<&str>)?);
    }

    builder = builder.separator();

    // Jobs recentes
    builder = builder
        .item(&MenuItem::with_id(app, ID_SECTION_RECENT, "JOBS RECENTES", false, None::<&str>)?);

    if recent.is_empty() {
        builder = builder
            .item(&MenuItem::with_id(app, ID_JOB_0, "  Nenhum job registrado", false, None::<&str>)?);
    } else {
        for (i, (label, enabled)) in job_labels.iter().zip(jobs_enabled.iter()).enumerate() {
            let id = format!("recent_job_{}", i);
            builder = builder
                .item(&MenuItem::with_id(app, &id, label, *enabled, None::<&str>)?);
        }
    }

    builder = builder.separator();

    // Impressoras
    builder = builder
        .item(&MenuItem::with_id(app, ID_SECTION_PRINTERS, &printer_section_label, false, None::<&str>)?);

    if printers.is_empty() {
        builder = builder
            .item(&MenuItem::with_id(app, "printer_none", "  Nenhuma impressora detectada", false, None::<&str>)?);
    } else {
        for (i, label) in printer_items.iter().enumerate() {
            let id = format!("printer_{}", i);
            builder = builder
                .item(&MenuItem::with_id(app, &id, label, true, None::<&str>)?);
        }
    }

    builder = builder.separator();

    // Ações
    builder = builder
        .item(&CheckMenuItem::with_id(app, ID_MONITOR_TOGGLE,
            if paused { "Retomar Monitor" } else { "Pausar Monitor" },
            true, paused, None::<&str>)?)
        .item(&MenuItem::with_id(app, ID_OPEN_SETTINGS, "Abrir Configurações", true, None::<&str>)?)
        .separator()
        .item(&MenuItem::with_id(app, ID_OPEN, "Abrir PrintControl", true, None::<&str>)?)
        .item(&MenuItem::with_id(app, ID_QUIT, "Sair", true, None::<&str>)?);

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
            app.emit("navigate-filter", serde_json::json!({
                "route": "/jobs",
                "status": "PRINTING"
            })).ok();
        }

        ID_STAT_FAILED => {
            show_main_window(app);
            app.emit("navigate-filter", serde_json::json!({
                "route": "/jobs",
                "status": "FAILED"
            })).ok();
        }

        ID_MONITOR_TOGGLE => {
            let app_clone = app.clone();
            let new_paused = !handles.is_paused();
            handles.set_paused(new_paused);

            tauri::async_runtime::spawn(async move {
                toggle_monitor(&app_clone, new_paused).await;
            });
        }

        ID_QUIT => {
            if let Some(worker) = app.try_state::<Arc<crate::workers::monitor::MonitorWorker>>() {
                worker.stop();
            }
            app.exit(0);
        }

        // Jobs recentes: busca o documento pelo índice e navega
        id if id.starts_with("recent_job_") => {
            show_main_window(app);
            app.emit("navigate-filter", serde_json::json!({
                "route": "/jobs"
            })).ok();
        }

        // Impressoras: navega para /printers
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
        None    => return,
    };

    // Persiste preferência em settings
    let _ = state.settings_manager
        .update("auto_start_monitor", if pause { "false" } else { "true" })
        .await;

    if pause {
        if let Some(worker) = app.try_state::<Arc<crate::workers::monitor::MonitorWorker>>() {
            worker.stop();
            tracing::info!("Monitor pausado via tray");
        }
    } else {
        let app_handle = app.clone();
        let worker = Arc::new(crate::workers::monitor::MonitorWorker::new());
        app.manage(worker.clone());
        worker.start(app_handle, state.inner().clone());
        tracing::info!("Monitor retomado via tray");
    }

    // Atualiza ícone imediatamente
    if let Some(tray) = app.tray_by_id(TRAY_ID) {
        let handles = app.try_state::<Arc<TrayHandles>>();
        let stats = handles.as_ref()
            .and_then(|h| h.last_stats.lock().ok().map(|s| s.clone()))
            .unwrap_or_default();
        update_icon_and_tooltip(&tray, &stats, pause);
    }
}

// ── Ícone e tooltip dinâmicos ────────────────────────────────────────────────

#[derive(Clone, Copy)]
pub enum TrayIconKind {
    Normal,
    Printing,
    Error,
    Paused,
}

pub fn update_icon_and_tooltip(tray: &TrayIcon, stats: &JobStats, paused: bool) {
    let kind = match () {
        _ if paused           => TrayIconKind::Paused,
        _ if stats.failed > 0 => TrayIconKind::Error,
        _ if stats.printing > 0 || stats.pending > 0 => TrayIconKind::Printing,
        _                     => TrayIconKind::Normal,
    };

    let tooltip = match kind {
        TrayIconKind::Paused   => "PrintControl — Monitor pausado".to_string(),
        TrayIconKind::Error    => format!("PrintControl — ⚠ {} falha(s) detectada(s)", stats.failed),
        TrayIconKind::Printing => format!("PrintControl — {} imprimindo, {} pendente(s)",
                                          stats.printing, stats.pending),
        TrayIconKind::Normal   => "PrintControl — Monitor ativo".to_string(),
    };

    let _ = tray.set_icon(Some(load_icon_handle(tray.app_handle(), kind)));
    let _ = tray.set_tooltip(Some(tooltip));
}

fn load_icon(app: &tauri::App, kind: TrayIconKind) -> Image<'static> {
    load_icon_handle(app.handle(), kind)
}

fn load_icon_handle(app: &AppHandle, kind: TrayIconKind) -> Image<'static> {
    let name = match kind {
        TrayIconKind::Normal   => "tray-normal.png",
        TrayIconKind::Printing => "tray-printing.png",
        TrayIconKind::Error    => "tray-error.png",
        TrayIconKind::Paused   => "tray-paused.png",
    };

    // Tenta carregar o PNG de estado; se não existir, usa o ícone padrão
    let icons_dir = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("icons");
    let path = icons_dir.join(name);

    if path.exists() {
        if let Ok(bytes) = std::fs::read(&path) {
            if let Ok(img) = Image::from_bytes(&bytes) {
                return img;
            }
        }
    }

    warn!("Ícone '{}' não encontrado, usando ícone padrão", name);
    app.default_window_icon().unwrap().clone()
}

// ── Formatação de labels ─────────────────────────────────────────────────────

fn format_job_label(job: &PrintJob) -> String {
    let status = match job.status.to_string().as_str() {
        "PRINTING"  => "[IMPRIMINDO]",
        "COMPLETED" => "[CONCLUÍDO]",
        "FAILED"    => "[FALHOU]",
        "PENDING"   => "[PENDENTE]",
        other       => other,
    };

    let name = if job.document_name.chars().count() > 28 {
        format!("{}…", job.document_name.chars().take(27).collect::<String>())
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
```

---

## Etapa 3 — Modificações em arquivos existentes

### 3.1 `src-tauri/src/app/state.rs`

Adicionar `Default` para `JobStats` (necessário no `TrayHandles`).
Nenhuma mudança estrutural — `TrayHandles` é gerenciado separadamente via `app.manage()`.

**Sem alteração neste arquivo.**

### 3.2 `src-tauri/src/app/mod.rs`

Adicionar exportação do módulo `tray`:

```rust
// src-tauri/src/app/mod.rs
pub mod commands;
pub mod events;
pub mod state;
pub mod tray;       // ← linha adicionada
```

### 3.3 `src-tauri/src/services/job_manager.rs`

Adicionar `Default` em `JobStats` (usado como fallback no `TrayHandles`):

```rust
// Adicionar após a definição da struct JobStats (linha ~19):
impl Default for JobStats {
    fn default() -> Self {
        Self { total: 0, pending: 0, printing: 0, completed: 0, failed: 0 }
    }
}
```

### 3.4 `src-tauri/src/lib.rs` — Refatoração do setup do tray

**Diff das alterações:**

```rust
// ANTES (bloco de tray inline em lib.rs):
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Manager,
};

// ... dentro de .setup():
// Ícone de bandeja do sistema
let open_item = MenuItem::with_id(app, "open", "Abrir PrintControl", true, None::<&str>)?;
let quit_item  = MenuItem::with_id(app, "quit",  "Sair",              true, None::<&str>)?;
let menu = Menu::with_items(app, &[&open_item, &quit_item])?;

TrayIconBuilder::new()
    .icon(app.default_window_icon().unwrap().clone())
    .menu(&menu)
    // ... etc


// DEPOIS (delegando para app::tray):
use tauri::Manager;
// (imports de tray removidos do lib.rs)

// ... dentro de .setup():
app::tray::setup(app)?;   // ← substitui todo o bloco inline
```

**Arquivo `lib.rs` completo após a refatoração:**

```rust
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
use services::settings_manager::SettingsManager;
use std::sync::Arc;
use tauri::Manager;
use workers::monitor::MonitorWorker;

pub fn run() {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::from_default_env()
                .add_directive("printcontrol=debug".parse().unwrap()),
        )
        .init();

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .setup(|app| {
            let app_handle = app.handle().clone();

            tauri::async_runtime::block_on(async {
                let (pool, db_path) = create_pool(&app_handle)
                    .await
                    .expect("Falha ao inicializar banco de dados");

                #[cfg(target_os = "linux")]
                let adapter = Arc::new(
                    infrastructure::printing::linux::LinuxAdapter::new()
                );

                #[cfg(target_os = "windows")]
                let adapter = Arc::new(
                    infrastructure::printing::windows::WindowsAdapter::new()
                );

                let job_manager = Arc::new(
                    services::job_manager::JobManager::new(pool.clone())
                );

                let settings_manager = Arc::new(
                    SettingsManager::new(pool.clone())
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
                    db_path,
                });

                app.manage(state.clone());

                if auto_start {
                    let worker = Arc::new(MonitorWorker::new());
                    app.manage(worker.clone());
                    worker.start(app_handle, state);
                }

                Ok::<(), Box<dyn std::error::Error>>(())
            })?;

            // ── Tray enriquecido ─────────────────────────────────────────────
            app::tray::setup(app)?;

            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { .. } = event {
                if let Some(worker) = window.app_handle().try_state::<Arc<MonitorWorker>>() {
                    worker.stop();
                    tracing::info!("MonitorWorker encerrado via CloseRequested");
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_jobs,
            commands::get_jobs_by_period,
            commands::get_printers,
            commands::get_job_stats,
            commands::get_settings,
            commands::update_setting,
            commands::reset_settings,
            commands::clear_history,
            commands::get_db_path,
        ])
        .run(tauri::generate_context!())
        .expect("Erro ao executar aplicacao PrintControl");
}
```

---

## Etapa 4 — Frontend: navegação via eventos do tray

O tray emite eventos `"navigate"` e `"navigate-filter"` que a janela principal precisa ouvir para aplicar filtros automaticamente.

### 4.1 `src/hooks/useTrayNavigation.ts` (arquivo novo)

```typescript
// src/hooks/useTrayNavigation.ts
import { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { useNavigate } from "react-router-dom";
import { useJobStore } from "../store/jobStore";
import type { JobStatus } from "../types";

interface NavigateFilterPayload {
  route: string;
  status?: JobStatus;
}

/**
 * Ouve eventos emitidos pela bandeja do sistema e aplica
 * navegação + filtros na janela principal.
 */
export function useTrayNavigation() {
  const navigate   = useNavigate();
  const { setFilter } = useJobStore();

  useEffect(() => {
    // Navegação simples (sem filtro)
    const unlistenNavigate = listen<string>("navigate", (event) => {
      navigate(event.payload);
    });

    // Navegação com filtro de status
    const unlistenFilter = listen<NavigateFilterPayload>("navigate-filter", (event) => {
      const { route, status } = event.payload;
      if (status) {
        setFilter("status", status);
      }
      navigate(route);
    });

    return () => {
      unlistenNavigate.then((fn) => fn());
      unlistenFilter.then((fn) => fn());
    };
  }, [navigate, setFilter]);
}
```

### 4.2 `src/App.tsx` — Registrar o hook

```tsx
// src/App.tsx (trecho relevante — adicionar dentro do componente roteado)
import { useTrayNavigation } from "./hooks/useTrayNavigation";

function AppLayout() {
  useTrayNavigation();   // ← adicionar esta linha
  // ... resto do layout
}
```

---

## Resumo de arquivos

| # | Arquivo | Ação | Etapa |
|---|---------|------|-------|
| 1 | `src-tauri/icons/tray-normal.svg` | Criar | 1 |
| 2 | `src-tauri/icons/tray-error.svg` | Criar | 1 |
| 3 | `src-tauri/icons/tray-paused.svg` | Criar | 1 |
| 4 | `src-tauri/icons/tray-printing.svg` | Criar | 1 |
| 5 | `src-tauri/scripts/gen-tray-icons.mjs` | Criar | 1 |
| 6 | `src-tauri/src/app/tray.rs` | Criar | 2 |
| 7 | `src-tauri/src/app/mod.rs` | Modificar (1 linha) | 3 |
| 8 | `src-tauri/src/services/job_manager.rs` | Modificar (impl Default) | 3 |
| 9 | `src-tauri/src/lib.rs` | Modificar (remover tray inline, chamar `tray::setup`) | 3 |
| 10 | `src/hooks/useTrayNavigation.ts` | Criar | 4 |
| 11 | `src/App.tsx` | Modificar (registrar hook) | 4 |

---

## Ordem de execução recomendada

```
1. Criar SVGs → gerar PNGs via script
2. Criar tray.rs
3. Aplicar modificações nos arquivos existentes (mod.rs, job_manager.rs, lib.rs)
4. cargo check → corrigir erros de compilação
5. Criar useTrayNavigation.ts
6. Modificar App.tsx
7. pnpm tauri dev → testar visualmente
```
