// src-tauri/src/infrastructure/storage/sqlite.rs
use crate::domain::errors::AppError;
use sqlx::sqlite::{SqliteConnectOptions, SqliteJournalMode, SqlitePoolOptions, SqliteSynchronous};
use sqlx::SqlitePool;
use tauri::AppHandle;
use tauri::Manager;

pub async fn create_pool(app_handle: &AppHandle) -> Result<(SqlitePool, String), AppError> {
    let db_path = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| AppError::Unknown(e.to_string()))?
        .join("printcontrol.db");

    // Garante que o diretório de dados existe
    if let Some(parent) = db_path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| AppError::Unknown(e.to_string()))?;
    }

    let pool = SqlitePoolOptions::new()
        .max_connections(5)
        .connect_with(
            SqliteConnectOptions::new()
                .filename(&db_path)
                .create_if_missing(true)
                .journal_mode(SqliteJournalMode::Wal)
                .synchronous(SqliteSynchronous::Normal)
                // Impressoras são detectadas dinamicamente pelo spooler; a integridade
                // referencial entre jobs e printers é gerenciada pela aplicação via
                // auto-upsert em job_manager::upsert(). Desabilitar FK enforcement
                // evita falhas quando um job chega antes de a impressora ser registrada.
                .foreign_keys(false),
        )
        .await
        .map_err(AppError::from)?;

    sqlx::migrate!("./src/infrastructure/storage/migrations")
        .run(&pool)
        .await
        .map_err(|e| AppError::DatabaseError(e.to_string()))?;

    let db_path_str = db_path.to_string_lossy().to_string();
    tracing::info!("Banco de dados inicializado em: {:?}", db_path);
    Ok((pool, db_path_str))
}
