// src-tauri/src/services/job_tracker.rs
use crate::domain::errors::AppError;
use crate::domain::job::PrintJob;
use crate::domain::job_status::JobStatus;
use crate::services::job_diff::{detect_changed_jobs, detect_new_jobs, detect_removed_jobs, should_mark_as_failed};
use crate::services::job_manager::JobManager;
use std::sync::Arc;
use tracing::{info, warn};

pub struct JobTracker {
    job_manager: Arc<JobManager>,
}

pub struct DiffResult {
    pub new_jobs: Vec<PrintJob>,
    pub failed_jobs: Vec<PrintJob>,
    #[allow(dead_code)]
    pub completed_jobs: Vec<PrintJob>,
    /// Jobs que permaneceram no spooler mas tiveram status alterado
    /// (ex: PRINTING → FAILED por papel faltando ou impressora offline).
    #[allow(dead_code)]
    pub changed_jobs: Vec<PrintJob>,
}

impl JobTracker {
    pub fn new(job_manager: Arc<JobManager>) -> Self {
        Self { job_manager }
    }

    /// Processa diff entre dois snapshots do spooler.
    /// Retorna resultado com novos, falhos e completados.
    pub async fn process_diff(
        &self,
        previous: &[PrintJob],
        current: &[PrintJob],
    ) -> Result<DiffResult, AppError> {
        let new_jobs     = detect_new_jobs(previous, current);
        let removed      = detect_removed_jobs(previous, current);
        let changed      = detect_changed_jobs(previous, current);

        let mut failed_jobs   = Vec::new();
        let mut completed_jobs = Vec::new();
        let mut changed_jobs  = Vec::new();

        // Persiste novos jobs
        for job in &new_jobs {
            self.job_manager.upsert(job).await?;
            info!("Novo job detectado: {} ({})", job.document_name, job.id);
        }

        // Detecta mudanças de status em jobs que ainda estão no spooler
        // Caso principal: PRINTING → FAILED (papel faltando, impressora offline, STOPPED/HELD)
        for job in &changed {
            self.job_manager.upsert(job).await?;
            if job.status == JobStatus::Failed {
                warn!(
                    "Job com falha detectado no spooler (papel/erro): {} ({})",
                    job.document_name, job.id
                );
                failed_jobs.push(job.clone());
            }
            changed_jobs.push(job.clone());
        }

        // Jobs que desapareceram do spooler — aplica inferência de falha/conclusão
        for job in &removed {
            if should_mark_as_failed(job) {
                self.job_manager.mark_as_failed(&job.id).await?;
                warn!("Job cancelado (sumiu da fila como PENDING): {} ({})", job.document_name, job.id);
                failed_jobs.push(job.clone());
            } else {
                // PRINTING | FAILED que sumiu → job concluído com sucesso
                self.job_manager.mark_as_completed(&job.id).await?;
                info!("Job concluído: {} ({})", job.document_name, job.id);
                completed_jobs.push(job.clone());
            }
        }

        Ok(DiffResult {
            new_jobs,
            failed_jobs,
            completed_jobs,
            changed_jobs,
        })
    }
}
