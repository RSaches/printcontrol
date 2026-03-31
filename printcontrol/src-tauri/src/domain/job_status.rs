// src-tauri/src/domain/job_status.rs
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(rename_all = "SCREAMING_SNAKE_CASE")]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum JobStatus {
    Pending,
    Printing,
    Completed,
    Failed,
}

impl JobStatus {
    /// Valida se a transição de estado é permitida pela máquina de estados.
    #[allow(dead_code)]
    pub fn can_transition_to(&self, next: &JobStatus) -> bool {
        matches!(
            (self, next),
            (JobStatus::Pending, JobStatus::Printing)
                | (JobStatus::Printing, JobStatus::Completed)
                | (JobStatus::Printing, JobStatus::Failed)
                | (JobStatus::Pending, JobStatus::Failed)
        )
    }

    #[allow(dead_code)]
    pub fn is_terminal(&self) -> bool {
        matches!(self, JobStatus::Completed | JobStatus::Failed)
    }
}

impl std::fmt::Display for JobStatus {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            JobStatus::Pending => write!(f, "PENDING"),
            JobStatus::Printing => write!(f, "PRINTING"),
            JobStatus::Completed => write!(f, "COMPLETED"),
            JobStatus::Failed => write!(f, "FAILED"),
        }
    }
}
