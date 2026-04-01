// src-tauri/src/services/monitor_error_manager.rs
use crate::domain::errors::AppError;
use serde::Serialize;
use sqlx::SqlitePool;

#[derive(Debug, Clone, Serialize)]
pub struct MonitorErrorEntry {
    pub id:          i64,
    pub message:     String,
    pub occurred_at: String,
}

#[derive(Debug, Serialize)]
pub struct PaginatedErrors {
    pub errors:   Vec<MonitorErrorEntry>,
    pub total:    i64,
    pub page:     i64,
    pub per_page: i64,
}

pub struct MonitorErrorManager {
    pool: SqlitePool,
}

impl MonitorErrorManager {
    pub fn new(pool: SqlitePool) -> Self {
        Self { pool }
    }

    /// Persiste um novo erro do monitor.
    pub async fn insert(&self, message: &str) -> Result<(), AppError> {
        sqlx::query("INSERT INTO monitor_errors (message) VALUES (?)")
            .bind(message)
            .execute(&self.pool)
            .await
            .map_err(AppError::from)?;
        Ok(())
    }

    /// Retorna erros paginados, mais recentes primeiro.
    pub async fn get_paginated(
        &self,
        page: i64,
        per_page: i64,
    ) -> Result<PaginatedErrors, AppError> {
        let page     = page.max(1);
        let per_page = per_page.clamp(1, 200);
        let offset   = (page - 1) * per_page;

        let total: i64 = sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM monitor_errors")
            .fetch_one(&self.pool)
            .await
            .map_err(AppError::from)?;

        let rows = sqlx::query(
            "SELECT id, message, occurred_at FROM monitor_errors ORDER BY occurred_at DESC LIMIT ? OFFSET ?"
        )
        .bind(per_page)
        .bind(offset)
        .fetch_all(&self.pool)
        .await
        .map_err(AppError::from)?;

        use sqlx::Row;
        let errors = rows
            .into_iter()
            .map(|r| MonitorErrorEntry {
                id:          r.get("id"),
                message:     r.get("message"),
                occurred_at: r.get("occurred_at"),
            })
            .collect();

        Ok(PaginatedErrors { errors, total, page, per_page })
    }

    /// Remove todos os erros do banco. Retorna o número de linhas excluídas.
    pub async fn clear_all(&self) -> Result<i64, AppError> {
        let result = sqlx::query("DELETE FROM monitor_errors")
            .execute(&self.pool)
            .await
            .map_err(AppError::from)?;
        Ok(result.rows_affected() as i64)
    }
}
