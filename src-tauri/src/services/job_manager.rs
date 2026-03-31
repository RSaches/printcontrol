// src-tauri/src/services/job_manager.rs
use crate::domain::errors::AppError;
use crate::domain::job::PrintJob;
use crate::domain::job_status::JobStatus;
use serde::{Deserialize, Serialize};
use sqlx::SqlitePool;

pub struct JobManager {
    pool: SqlitePool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JobStats {
    pub total: i64,
    pub pending: i64,
    pub printing: i64,
    pub completed: i64,
    pub failed: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PaginatedJobs {
    pub jobs: Vec<PrintJob>,
    pub total: i64,
    pub page: i64,
    pub per_page: i64,
}

impl Default for JobStats {
    fn default() -> Self {
        Self { total: 0, pending: 0, printing: 0, completed: 0, failed: 0 }
    }
}

impl JobManager {
    pub fn new(pool: SqlitePool) -> Self {
        Self { pool }
    }

    pub async fn get_by_id(&self, id: &str) -> Result<Option<PrintJob>, AppError> {
        sqlx::query_as!(
            PrintJob,
            r#"SELECT
                id as "id!",
                spooler_job_id,
                document_name as "document_name!",
                user_name as "user_name!",
                printer_name as "printer_name!",
                status as "status!: JobStatus",
                pages,
                size_bytes,
                created_at as "created_at!",
                updated_at as "updated_at!"
            FROM jobs
            WHERE id = ?"#,
            id
        )
        .fetch_optional(&self.pool)
        .await
        .map_err(AppError::from)
    }

    /// Retorna jobs com filtros opcionais de status e busca textual, paginados.
    /// Usa sqlx não-macro para permitir WHERE dinâmico.
    pub async fn get_paginated(
        &self,
        page: i64,
        per_page: i64,
        status: Option<&str>,
        search: Option<&str>,
    ) -> Result<PaginatedJobs, AppError> {
        let page = page.max(1);
        let per_page = per_page.clamp(1, 500);
        let offset = (page - 1) * per_page;

        // Monta cláusula WHERE dinamicamente.
        let mut where_parts: Vec<&str> = Vec::new();
        if status.is_some() { where_parts.push("status = ?"); }
        if search.is_some() {
            where_parts.push(
                "(document_name LIKE ? OR user_name LIKE ? OR printer_name LIKE ?)"
            );
        }
        let where_clause = if where_parts.is_empty() {
            String::new()
        } else {
            format!("WHERE {}", where_parts.join(" AND "))
        };

        // Pré-computa o LIKE para evitar múltiplos format! dentro dos binds.
        let search_like = search.map(|s| format!("%{}%", s));

        // — COUNT —
        let count_sql = format!("SELECT COUNT(*) FROM jobs {}", where_clause);
        let mut count_q = sqlx::query_scalar::<_, i64>(&count_sql);
        if let Some(s) = status       { count_q = count_q.bind(s); }
        if let Some(ref l) = search_like {
            count_q = count_q.bind(l).bind(l).bind(l);
        }
        let total: i64 = count_q
            .fetch_one(&self.pool)
            .await
            .map_err(AppError::from)?;

        // — DATA —
        let data_sql = format!(
            r#"SELECT id, spooler_job_id, document_name, user_name, printer_name,
                      status, pages, size_bytes, created_at, updated_at
               FROM jobs {}
               ORDER BY created_at DESC
               LIMIT ? OFFSET ?"#,
            where_clause
        );
        let mut data_q = sqlx::query(&data_sql);
        if let Some(s) = status       { data_q = data_q.bind(s); }
        if let Some(ref l) = search_like {
            data_q = data_q.bind(l).bind(l).bind(l);
        }
        let rows = data_q
            .bind(per_page)
            .bind(offset)
            .fetch_all(&self.pool)
            .await
            .map_err(AppError::from)?;

        let jobs = rows
            .into_iter()
            .map(|row| {
                use sqlx::Row;
                let status_str: String = row.get("status");
                let status = match status_str.as_str() {
                    "PENDING"   => JobStatus::Pending,
                    "PRINTING"  => JobStatus::Printing,
                    "COMPLETED" => JobStatus::Completed,
                    _           => JobStatus::Failed,
                };
                PrintJob {
                    id:             row.get("id"),
                    spooler_job_id: row.get("spooler_job_id"),
                    document_name:  row.get("document_name"),
                    user_name:      row.get("user_name"),
                    printer_name:   row.get("printer_name"),
                    status,
                    pages:          row.get("pages"),
                    size_bytes:     row.get("size_bytes"),
                    created_at:     row.get("created_at"),
                    updated_at:     row.get("updated_at"),
                }
            })
            .collect();

        Ok(PaginatedJobs { jobs, total, page, per_page })
    }

    pub async fn get_all(&self) -> Result<Vec<PrintJob>, AppError> {
        sqlx::query_as!(
            PrintJob,
            r#"SELECT
                id as "id!",
                spooler_job_id,
                document_name as "document_name!",
                user_name as "user_name!",
                printer_name as "printer_name!",
                status as "status!: JobStatus",
                pages,
                size_bytes,
                created_at as "created_at!",
                updated_at as "updated_at!"
            FROM jobs
            ORDER BY created_at DESC"#
        )
        .fetch_all(&self.pool)
        .await
        .map_err(AppError::from)
    }

    pub async fn get_by_period(
        &self,
        from: &str,
        to: &str,
    ) -> Result<Vec<PrintJob>, AppError> {
        let rows = sqlx::query(
            r#"SELECT id, spooler_job_id, document_name, user_name, printer_name,
                       status, pages, size_bytes, created_at, updated_at
               FROM jobs
               WHERE datetime(created_at) BETWEEN datetime(?) AND datetime(?)
               ORDER BY created_at DESC"#
        )
        .bind(from)
        .bind(to)
        .fetch_all(&self.pool)
        .await
        .map_err(AppError::from)?;

        let jobs = rows
            .into_iter()
            .map(|row| {
                use sqlx::Row;
                let status_str: String = row.get("status");
                let status = match status_str.as_str() {
                    "PENDING"   => JobStatus::Pending,
                    "PRINTING"  => JobStatus::Printing,
                    "COMPLETED" => JobStatus::Completed,
                    _           => JobStatus::Failed,
                };
                PrintJob {
                    id:             row.get("id"),
                    spooler_job_id: row.get("spooler_job_id"),
                    document_name:  row.get("document_name"),
                    user_name:      row.get("user_name"),
                    printer_name:   row.get("printer_name"),
                    status,
                    pages:          row.get("pages"),
                    size_bytes:     row.get("size_bytes"),
                    created_at:     row.get("created_at"),
                    updated_at:     row.get("updated_at"),
                }
            })
            .collect();

        Ok(jobs)
    }

    pub async fn upsert(&self, job: &PrintJob) -> Result<(), AppError> {
        // Auto-registra a impressora antes de inserir o job.
        // Garante consistência mesmo com FK enforcement desabilitado,
        // e mantém a tabela `printers` populada para o comando get_printers.
        sqlx::query!(
            "INSERT OR IGNORE INTO printers (id, name, created_at) \
             VALUES (?, ?, datetime('now'))",
            job.printer_name,
            job.printer_name,
        )
        .execute(&self.pool)
        .await
        .map_err(AppError::from)?;

        sqlx::query!(
            r#"INSERT INTO jobs
                (id, spooler_job_id, document_name, user_name, printer_name,
                 status, pages, size_bytes, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
               ON CONFLICT(id) DO UPDATE SET
                 status = excluded.status,
                 updated_at = excluded.updated_at"#,
            job.id,
            job.spooler_job_id,
            job.document_name,
            job.user_name,
            job.printer_name,
            job.status,
            job.pages,
            job.size_bytes,
            job.created_at,
            job.updated_at
        )
        .execute(&self.pool)
        .await
        .map(|_| ())
        .map_err(AppError::from)
    }

    pub async fn mark_as_failed(&self, id: &str) -> Result<(), AppError> {
        let now = chrono::Utc::now().to_rfc3339();
        sqlx::query!(
            "UPDATE jobs SET status = 'FAILED', updated_at = ? WHERE id = ?",
            now,
            id
        )
        .execute(&self.pool)
        .await
        .map(|_| ())
        .map_err(AppError::from)
    }

    pub async fn mark_as_completed(&self, id: &str) -> Result<(), AppError> {
        let now = chrono::Utc::now().to_rfc3339();
        sqlx::query!(
            "UPDATE jobs SET status = 'COMPLETED', updated_at = ? WHERE id = ?",
            now,
            id
        )
        .execute(&self.pool)
        .await
        .map(|_| ())
        .map_err(AppError::from)
    }

    pub async fn get_stats(&self) -> Result<JobStats, AppError> {
        let row = sqlx::query!(
            r#"SELECT
                COUNT(*) as total,
                SUM(CASE WHEN status = 'PENDING'   THEN 1 ELSE 0 END) as pending,
                SUM(CASE WHEN status = 'PRINTING'  THEN 1 ELSE 0 END) as printing,
                SUM(CASE WHEN status = 'COMPLETED' THEN 1 ELSE 0 END) as completed,
                SUM(CASE WHEN status = 'FAILED'    THEN 1 ELSE 0 END) as failed
            FROM jobs"#
        )
        .fetch_one(&self.pool)
        .await
        .map_err(AppError::from)?;

        Ok(JobStats {
            total: row.total,
            pending: row.pending.unwrap_or(0),
            printing: row.printing.unwrap_or(0),
            completed: row.completed.unwrap_or(0),
            failed: row.failed.unwrap_or(0),
        })
    }

    /// Deleta jobs mais antigos que `days` dias. Retorna a quantidade deletada.
    pub async fn delete_old_jobs(&self, days: u64) -> Result<u64, AppError> {
        if days == 0 {
            let result = sqlx::query("DELETE FROM jobs")
                .execute(&self.pool)
                .await
                .map_err(AppError::from)?;
            return Ok(result.rows_affected());
        }

        let cutoff = format!("-{} days", days);
        let result = sqlx::query(
            "DELETE FROM jobs WHERE unixepoch(datetime(created_at)) < unixepoch(datetime('now', ?))"
        )
        .bind(&cutoff)
        .execute(&self.pool)
        .await
        .map_err(AppError::from)?;
        Ok(result.rows_affected())
    }

    /// Marca como FAILED jobs que estão PRINTING/PENDING há mais de `timeout_mins` minutos.
    pub async fn mark_timed_out_jobs(&self, timeout_mins: u64) -> Result<Vec<String>, AppError> {
        let cutoff = format!("-{} minutes", timeout_mins);
        let now = chrono::Utc::now().to_rfc3339();
        let rows: Vec<(String,)> = sqlx::query_as(
            "SELECT id FROM jobs WHERE status IN ('PENDING', 'PRINTING') AND datetime(created_at) < datetime('now', ?)"
        )
        .bind(&cutoff)
        .fetch_all(&self.pool)
        .await
        .map_err(AppError::from)?;

        let ids: Vec<String> = rows.into_iter().map(|(id,)| id).collect();

        if !ids.is_empty() {
            sqlx::query(
                "UPDATE jobs SET status = 'FAILED', updated_at = ? WHERE status IN ('PENDING', 'PRINTING') AND datetime(created_at) < datetime('now', ?)"
            )
            .bind(&now)
            .bind(&cutoff)
            .execute(&self.pool)
            .await
            .map_err(AppError::from)?;
        }

        Ok(ids)
    }

    /// Reconcilia jobs PENDING/PRINTING no DB com o spooler ao reiniciar.
    pub async fn get_active_jobs(&self) -> Result<Vec<PrintJob>, AppError> {
        sqlx::query_as!(
            PrintJob,
            r#"SELECT
                id as "id!",
                spooler_job_id,
                document_name as "document_name!",
                user_name as "user_name!",
                printer_name as "printer_name!",
                status as "status!: JobStatus",
                pages,
                size_bytes,
                created_at as "created_at!",
                updated_at as "updated_at!"
            FROM jobs
            WHERE status IN ('PENDING', 'PRINTING')"#
        )
        .fetch_all(&self.pool)
        .await
        .map_err(AppError::from)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::domain::job_status::JobStatus;

    async fn setup() -> JobManager {
        let pool = sqlx::SqlitePool::connect("sqlite::memory:")
            .await
            .expect("pool in-memory");
        sqlx::migrate!("./src/infrastructure/storage/migrations")
            .run(&pool)
            .await
            .expect("migrations");
        JobManager::new(pool)
    }

    fn mock_job(id: &str, status: JobStatus, created_at: &str) -> PrintJob {
        PrintJob {
            id: id.to_string(),
            spooler_job_id: Some(1),
            document_name: format!("doc_{}.pdf", id),
            user_name: "usuario".to_string(),
            printer_name: "Impressora-Teste".to_string(),
            status,
            pages: Some(2),
            size_bytes: Some(1024),
            created_at: created_at.to_string(),
            updated_at: created_at.to_string(),
        }
    }

    #[tokio::test]
    async fn upsert_and_get_by_id() {
        let mgr = setup().await;
        let job = mock_job("job-1", JobStatus::Pending, "2026-01-01T00:00:00+00:00");
        mgr.upsert(&job).await.unwrap();

        let found = mgr.get_by_id("job-1").await.unwrap();
        assert!(found.is_some());
        let found = found.unwrap();
        assert_eq!(found.id, "job-1");
        assert_eq!(found.document_name, "doc_job-1.pdf");
        assert_eq!(found.status, JobStatus::Pending);
    }

    #[tokio::test]
    async fn get_by_id_returns_none_for_unknown() {
        let mgr = setup().await;
        let result = mgr.get_by_id("inexistente").await.unwrap();
        assert!(result.is_none());
    }

    #[tokio::test]
    async fn upsert_updates_status_on_conflict() {
        let mgr = setup().await;
        let mut job = mock_job("job-2", JobStatus::Pending, "2026-01-01T00:00:00+00:00");
        mgr.upsert(&job).await.unwrap();

        job.status = JobStatus::Printing;
        job.updated_at = "2026-01-01T00:01:00+00:00".to_string();
        mgr.upsert(&job).await.unwrap();

        let found = mgr.get_by_id("job-2").await.unwrap().unwrap();
        assert_eq!(found.status, JobStatus::Printing);
    }

    #[tokio::test]
    async fn mark_as_failed_changes_status() {
        let mgr = setup().await;
        let job = mock_job("job-3", JobStatus::Printing, "2026-01-01T00:00:00+00:00");
        mgr.upsert(&job).await.unwrap();
        mgr.mark_as_failed("job-3").await.unwrap();

        let found = mgr.get_by_id("job-3").await.unwrap().unwrap();
        assert_eq!(found.status, JobStatus::Failed);
    }

    #[tokio::test]
    async fn mark_as_completed_changes_status() {
        let mgr = setup().await;
        let job = mock_job("job-4", JobStatus::Printing, "2026-01-01T00:00:00+00:00");
        mgr.upsert(&job).await.unwrap();
        mgr.mark_as_completed("job-4").await.unwrap();

        let found = mgr.get_by_id("job-4").await.unwrap().unwrap();
        assert_eq!(found.status, JobStatus::Completed);
    }

    #[tokio::test]
    async fn get_active_jobs_returns_only_pending_and_printing() {
        let mgr = setup().await;
        mgr.upsert(&mock_job("a1", JobStatus::Pending,   "2026-01-01T00:00:00+00:00")).await.unwrap();
        mgr.upsert(&mock_job("a2", JobStatus::Printing,  "2026-01-01T00:00:00+00:00")).await.unwrap();
        mgr.upsert(&mock_job("a3", JobStatus::Completed, "2026-01-01T00:00:00+00:00")).await.unwrap();
        mgr.upsert(&mock_job("a4", JobStatus::Failed,    "2026-01-01T00:00:00+00:00")).await.unwrap();

        let active = mgr.get_active_jobs().await.unwrap();
        assert_eq!(active.len(), 2);
        assert!(active.iter().all(|j| {
            j.status == JobStatus::Pending || j.status == JobStatus::Printing
        }));
    }

    #[tokio::test]
    async fn mark_timed_out_jobs_marks_old_active_jobs() {
        let mgr = setup().await;
        // Job antigo (1 hora atrás) — deve ser marcado como FAILED
        let old_ts = "2020-01-01T00:00:00+00:00";
        mgr.upsert(&mock_job("old-1", JobStatus::Pending,  old_ts)).await.unwrap();
        mgr.upsert(&mock_job("old-2", JobStatus::Printing, old_ts)).await.unwrap();
        // Job recente — não deve ser afetado
        let now_ts = chrono::Utc::now().to_rfc3339();
        mgr.upsert(&mock_job("recent", JobStatus::Pending, &now_ts)).await.unwrap();

        let failed_ids = mgr.mark_timed_out_jobs(5).await.unwrap();
        assert_eq!(failed_ids.len(), 2);
        assert!(failed_ids.contains(&"old-1".to_string()));
        assert!(failed_ids.contains(&"old-2".to_string()));

        assert_eq!(
            mgr.get_by_id("recent").await.unwrap().unwrap().status,
            JobStatus::Pending
        );
    }

    #[tokio::test]
    async fn delete_old_jobs_removes_expired() {
        let mgr = setup().await;
        mgr.upsert(&mock_job("old", JobStatus::Completed, "2020-01-01T00:00:00+00:00")).await.unwrap();
        let now_ts = chrono::Utc::now().to_rfc3339();
        mgr.upsert(&mock_job("new", JobStatus::Completed, &now_ts)).await.unwrap();

        let deleted = mgr.delete_old_jobs(30).await.unwrap();
        assert_eq!(deleted, 1);
        assert!(mgr.get_by_id("old").await.unwrap().is_none());
        assert!(mgr.get_by_id("new").await.unwrap().is_some());
    }

    #[tokio::test]
    async fn get_stats_returns_correct_counts() {
        let mgr = setup().await;
        mgr.upsert(&mock_job("s1", JobStatus::Pending,   "2026-01-01T00:00:00+00:00")).await.unwrap();
        mgr.upsert(&mock_job("s2", JobStatus::Printing,  "2026-01-01T00:00:00+00:00")).await.unwrap();
        mgr.upsert(&mock_job("s3", JobStatus::Completed, "2026-01-01T00:00:00+00:00")).await.unwrap();
        mgr.upsert(&mock_job("s4", JobStatus::Completed, "2026-01-01T00:00:00+00:00")).await.unwrap();
        mgr.upsert(&mock_job("s5", JobStatus::Failed,    "2026-01-01T00:00:00+00:00")).await.unwrap();

        let stats = mgr.get_stats().await.unwrap();
        assert_eq!(stats.total, 5);
        assert_eq!(stats.pending, 1);
        assert_eq!(stats.printing, 1);
        assert_eq!(stats.completed, 2);
        assert_eq!(stats.failed, 1);
    }

    #[tokio::test]
    async fn get_paginated_first_page() {
        let mgr = setup().await;
        for i in 0..5u8 {
            let ts = format!("2026-01-0{}T00:00:00+00:00", i + 1);
            mgr.upsert(&mock_job(&format!("p{}", i), JobStatus::Completed, &ts)).await.unwrap();
        }

        let result = mgr.get_paginated(1, 2, None, None).await.unwrap();
        assert_eq!(result.total, 5);
        assert_eq!(result.jobs.len(), 2);
        assert_eq!(result.page, 1);
        assert_eq!(result.per_page, 2);
    }

    #[tokio::test]
    async fn get_paginated_with_status_filter() {
        let mgr = setup().await;
        mgr.upsert(&mock_job("f1", JobStatus::Failed,    "2026-01-01T00:00:00+00:00")).await.unwrap();
        mgr.upsert(&mock_job("f2", JobStatus::Failed,    "2026-01-02T00:00:00+00:00")).await.unwrap();
        mgr.upsert(&mock_job("f3", JobStatus::Completed, "2026-01-03T00:00:00+00:00")).await.unwrap();

        let result = mgr.get_paginated(1, 10, Some("FAILED"), None).await.unwrap();
        assert_eq!(result.total, 2);
        assert!(result.jobs.iter().all(|j| j.status == JobStatus::Failed));
    }

    #[tokio::test]
    async fn get_paginated_with_search_filter() {
        let mgr = setup().await;
        // Cria jobs com document_name específico para busca
        let mut job = mock_job("srch1", JobStatus::Completed, "2026-01-01T00:00:00+00:00");
        job.document_name = "relatorio_anual.pdf".to_string();
        mgr.upsert(&job).await.unwrap();

        let mut job2 = mock_job("srch2", JobStatus::Completed, "2026-01-02T00:00:00+00:00");
        job2.document_name = "nota_fiscal.pdf".to_string();
        mgr.upsert(&job2).await.unwrap();

        let result = mgr.get_paginated(1, 10, None, Some("relatorio")).await.unwrap();
        assert_eq!(result.total, 1);
        assert_eq!(result.jobs[0].document_name, "relatorio_anual.pdf");
    }
}
