// src-tauri/src/app/commands.rs
use crate::app::state::AppState;
use crate::domain::job::PrintJob;
use crate::domain::printer::Printer;
use crate::domain::settings::AppSettings;
use crate::services::job_manager::{JobStats, PaginatedJobs, PrinterFormatStat, PrinterHealthScore};
use crate::services::monitor_error_manager::PaginatedErrors;
use std::sync::Arc;
use tauri::State;

#[tauri::command]
pub async fn get_jobs(
    state: State<'_, Arc<AppState>>,
) -> Result<Vec<PrintJob>, String> {
    state.job_manager.get_all().await.map_err(|e| e.to_string())
}

/// Retorna jobs paginados com filtros opcionais de status, impressora, busca e datas.
#[tauri::command]
pub async fn get_jobs_paginated(
    state: State<'_, Arc<AppState>>,
    page: i64,
    per_page: i64,
    status: Option<String>,
    search: Option<String>,
    printer_name: Option<String>,
    date_from: Option<String>,
    date_to: Option<String>,
) -> Result<PaginatedJobs, String> {
    state
        .job_manager
        .get_paginated(
            page,
            per_page,
            status.as_deref(),
            search.as_deref(),
            printer_name.as_deref(),
            date_from.as_deref(),
            date_to.as_deref(),
        )
        .await
        .map_err(|e| e.to_string())
}

/// Retorna estatísticas de uso por formato de papel para uma impressora.
#[tauri::command]
pub async fn get_printer_format_stats(
    state: State<'_, Arc<AppState>>,
    printer_name: String,
) -> Result<Vec<PrinterFormatStat>, String> {
    state
        .job_manager
        .get_printer_format_stats(&printer_name)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_jobs_by_period(
    state: State<'_, Arc<AppState>>,
    from: String,
    to: String,
) -> Result<Vec<PrintJob>, String> {
    state
        .job_manager
        .get_by_period(&from, &to)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_printers(
    state: State<'_, Arc<AppState>>,
) -> Result<Vec<Printer>, String> {
    state
        .printing_adapter
        .list_printers()
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_job_stats(
    state: State<'_, Arc<AppState>>,
) -> Result<JobStats, String> {
    state.job_manager.get_stats().await.map_err(|e| e.to_string())
}

/// Retorna todas as configurações como struct tipada.
#[tauri::command]
pub async fn get_settings(
    state: State<'_, Arc<AppState>>,
) -> Result<AppSettings, String> {
    state
        .settings_manager
        .get_all()
        .await
        .map_err(|e| e.to_string())
}

/// Atualiza uma configuração por chave.
#[tauri::command]
pub async fn update_setting(
    state: State<'_, Arc<AppState>>,
    key: String,
    value: String,
) -> Result<(), String> {
    state
        .settings_manager
        .update(&key, &value)
        .await
        .map_err(|e| e.to_string())
}

/// Restaura todas as configurações para os valores padrão.
#[tauri::command]
pub async fn reset_settings(
    state: State<'_, Arc<AppState>>,
) -> Result<AppSettings, String> {
    state
        .settings_manager
        .reset_defaults()
        .await
        .map_err(|e| e.to_string())
}

/// Deleta jobs mais antigos que `days` dias. Retorna a quantidade deletada.
#[tauri::command]
pub async fn clear_history(
    state: State<'_, Arc<AppState>>,
    days: u64,
) -> Result<u64, String> {
    state
        .job_manager
        .delete_old_jobs(days)
        .await
        .map_err(|e| e.to_string())
}

/// Retorna o caminho absoluto do arquivo de banco de dados.
#[tauri::command]
pub async fn get_db_path(
    state: State<'_, Arc<AppState>>,
) -> Result<String, String> {
    Ok(state.db_path.clone())
}

/// Retorna erros do monitor paginados, mais recentes primeiro.
#[tauri::command]
pub async fn get_monitor_errors(
    state: State<'_, Arc<AppState>>,
    page: i64,
    per_page: i64,
) -> Result<PaginatedErrors, String> {
    state
        .monitor_error_manager
        .get_paginated(page, per_page)
        .await
        .map_err(|e| e.to_string())
}

/// Retorna o score de saúde calculado para cada impressora (últimos 30 dias).
#[tauri::command]
pub async fn get_printer_health_scores(
    state: State<'_, Arc<AppState>>,
) -> Result<Vec<PrinterHealthScore>, String> {
    state
        .job_manager
        .get_health_scores()
        .await
        .map_err(|e| e.to_string())
}

/// Remove todos os erros do log do monitor.
#[tauri::command]
pub async fn clear_monitor_errors(
    state: State<'_, Arc<AppState>>,
) -> Result<i64, String> {
    state
        .monitor_error_manager
        .clear_all()
        .await
        .map_err(|e| e.to_string())
}
