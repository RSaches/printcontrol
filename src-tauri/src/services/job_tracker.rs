// src-tauri/src/services/job_tracker.rs
use crate::domain::errors::AppError;
use crate::domain::job::PrintJob;
use crate::domain::job_status::JobStatus;
use crate::services::job_diff::{detect_changed_jobs, detect_new_jobs, detect_removed_jobs, should_mark_as_failed};
use crate::services::job_manager::JobManager;
use std::collections::HashMap;
use std::sync::Arc;
use tracing::{info, warn};

/// Quantos ciclos consecutivos de polling com status FAILED são necessários
/// para confirmar uma falha originada por mudança de status no spooler.
/// Evita que estados de erro transitórios (ex.: handshake de driver) sejam
/// reportados como falha real enquanto o job ainda está sendo impresso.
const FAIL_CONFIRMATION_CYCLES: u32 = 2;

pub struct JobTracker {
    job_manager: Arc<JobManager>,
    /// Conta ciclos consecutivos em que cada job permaneceu com status FAILED
    /// enquanto ainda estava no spooler. Só escalamos para falha confirmada
    /// após FAIL_CONFIRMATION_CYCLES ciclos.
    fail_confirmation: HashMap<String, u32>,
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
        Self {
            job_manager,
            fail_confirmation: HashMap::new(),
        }
    }

    /// Processa diff entre dois snapshots do spooler.
    /// Retorna resultado com novos, falhos e completados.
    pub async fn process_diff(
        &mut self,
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
            // Jobs novos que já aparecem com FAILED são casos legítimos
            // (ex.: impressora offline no momento da submissão). Não aplicamos
            // confirmação aqui porque eles ainda não tinham histórico no spooler.
            if job.status == JobStatus::Failed {
                warn!(
                    "Novo job detectado com falha imediata: {} ({})",
                    job.document_name, job.id
                );
                failed_jobs.push(job.clone());
            } else {
                // Se o job aparece saudável, garante que não há contador pendente.
                self.fail_confirmation.remove(&job.id);
                info!("Novo job detectado: {} ({})", job.document_name, job.id);
            }
        }

        // Detecta mudanças de status em jobs que ainda estão no spooler.
        // Caso principal: PRINTING → FAILED (papel faltando, impressora offline).
        //
        // **Confirmação em múltiplos ciclos**: alguns drivers setam flags de erro
        // transitoriamente. Só escalamos para FAILED após FAIL_CONFIRMATION_CYCLES
        // ciclos consecutivos com status FAILED para evitar falsos positivos.
        for job in &changed {
            self.job_manager.upsert(job).await?;
            if job.status == JobStatus::Failed {
                let count = self.fail_confirmation.entry(job.id.clone()).or_insert(0);
                *count += 1;
                if *count >= FAIL_CONFIRMATION_CYCLES {
                    warn!(
                        "Falha confirmada ({} ciclos) no spooler: {} ({})",
                        count, job.document_name, job.id
                    );
                    failed_jobs.push(job.clone());
                    self.fail_confirmation.remove(&job.id);
                } else {
                    warn!(
                        "Possível falha (ciclo {}/{}), aguardando confirmação: {} ({})",
                        count, FAIL_CONFIRMATION_CYCLES, job.document_name, job.id
                    );
                }
            } else {
                // Status voltou a ser não-FAILED: reset do contador.
                self.fail_confirmation.remove(&job.id);
            }
            changed_jobs.push(job.clone());
        }

        // Jobs que desapareceram do spooler — limpa contadores pendentes e
        // aplica inferência de falha/conclusão.
        for job in &removed {
            self.fail_confirmation.remove(&job.id);
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
