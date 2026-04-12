// src-tauri/src/domain/job.rs
use crate::domain::job_status::JobStatus;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct PrintJob {
    pub id: String,              // tracking_id gerado pelo sistema
    pub spooler_job_id: Option<i64>,
    pub document_name: String,
    pub user_name: String,
    pub printer_name: String,
    pub status: JobStatus,
    pub pages: Option<i64>,
    pub size_bytes: Option<i64>,
    /// Formato de papel reportado pelo spooler (ex: "A4", "A3", "Carta").
    /// None quando o driver não fornece essa informação.
    pub paper_format: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

impl PrintJob {
    /// Gera tracking_id determinístico: nunca confiar só no job_id do spooler.
    pub fn generate_tracking_id(
        spooler_job_id: u64,
        document_name: &str,
        timestamp: &str,
    ) -> String {
        let doc_prefix: String = document_name.chars().take(20).collect();
        format!("{}_{}_{}", spooler_job_id, doc_prefix, timestamp)
    }
}
