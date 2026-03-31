// src-tauri/src/services/job_diff.rs
use crate::domain::job::PrintJob;

/// Retorna jobs que existiam no snapshot anterior mas não estão mais no atual.
/// Esses são candidatos a FAILED se o status não for COMPLETED.
pub fn detect_removed_jobs(
    previous: &[PrintJob],
    current: &[PrintJob],
) -> Vec<PrintJob> {
    previous
        .iter()
        .filter(|old| !current.iter().any(|c| c.id == old.id))
        .cloned()
        .collect()
}

/// Decide se um job que desapareceu da fila ativa deve ser marcado como FAILED.
///
/// `get_active_jobs()` retorna apenas PENDING / PROCESSING / HELD.
/// Quando um job CONCLUI com sucesso, CUPS o remove da fila ativa sem que
/// o vejamos em estado COMPLETED — ele simplesmente some.
///
/// Regra:
/// - PRINTING desapareceu → COMPLETED (CUPS concluiu e removeu da fila ativa)
/// - PENDING desapareceu  → FAILED    (foi cancelado antes de imprimir)
/// - FAILED desapareceu   → COMPLETED (foi retomado após erro e concluiu)
/// - COMPLETED desapareceu→ já terminal, não faz nada
///
/// Erros durante a impressão (papel faltando, offline) são capturados ANTES
/// pelo `detect_changed_jobs` via transição PRINTING → FAILED (CUPS STOPPED/HELD).
pub fn should_mark_as_failed(job: &PrintJob) -> bool {
    use crate::domain::job_status::JobStatus;
    matches!(job.status, JobStatus::Pending)
}

/// Detecta jobs que ainda estão no spooler mas com status diferente do snapshot anterior.
/// Caso de uso: job passa de PRINTING → FAILED enquanto ainda está na fila (papel faltando,
/// impressora offline). O job não some — apenas muda de estado no CUPS.
pub fn detect_changed_jobs(
    previous: &[PrintJob],
    current: &[PrintJob],
) -> Vec<PrintJob> {
    current
        .iter()
        .filter(|curr| {
            previous
                .iter()
                .any(|prev| prev.id == curr.id && prev.status != curr.status)
        })
        .cloned()
        .collect()
}

/// Detecta jobs novos (não existiam no snapshot anterior).
pub fn detect_new_jobs(
    previous: &[PrintJob],
    current: &[PrintJob],
) -> Vec<PrintJob> {
    current
        .iter()
        .filter(|new| !previous.iter().any(|p| p.id == new.id))
        .cloned()
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::domain::job_status::JobStatus;

    fn mock_job(id: &str, status: JobStatus) -> PrintJob {
        PrintJob {
            id: id.to_string(),
            spooler_job_id: Some(1),
            document_name: "test.pdf".to_string(),
            user_name: "user".to_string(),
            printer_name: "HP LaserJet".to_string(),
            status,
            pages: None,
            size_bytes: None,
            created_at: "2026-01-01T00:00:00".to_string(),
            updated_at: "2026-01-01T00:00:00".to_string(),
        }
    }

    #[test]
    fn detects_removed_jobs() {
        let previous = vec![mock_job("1", JobStatus::Printing)];
        let current: Vec<PrintJob> = vec![];
        let removed = detect_removed_jobs(&previous, &current);
        assert_eq!(removed.len(), 1);
        assert_eq!(removed[0].id, "1");
    }

    #[test]
    fn completed_job_not_marked_as_failed() {
        let job = mock_job("1", JobStatus::Completed);
        assert!(!should_mark_as_failed(&job));
    }

    #[test]
    fn printing_job_disappearing_is_completed_not_failed() {
        // CUPS remove jobs completados da fila ativa sem passar por COMPLETED.
        // Job PRINTING que some → COMPLETED, não FAILED.
        let job = mock_job("1", JobStatus::Printing);
        assert!(!should_mark_as_failed(&job));
    }

    #[test]
    fn pending_job_disappearing_is_failed() {
        // Job PENDING que some foi cancelado antes de imprimir.
        let job = mock_job("1", JobStatus::Pending);
        assert!(should_mark_as_failed(&job));
    }

    #[test]
    fn failed_job_disappearing_after_recovery_is_not_refailed() {
        // Job que teve erro (papel faltando) e depois foi retomado e concluiu.
        // Quando some da fila ativa, não deve ser marcado FAILED novamente.
        let job = mock_job("1", JobStatus::Failed);
        assert!(!should_mark_as_failed(&job));
    }

    #[test]
    fn detects_new_jobs() {
        let previous: Vec<PrintJob> = vec![];
        let current = vec![mock_job("42", JobStatus::Pending)];
        let new_jobs = detect_new_jobs(&previous, &current);
        assert_eq!(new_jobs.len(), 1);
        assert_eq!(new_jobs[0].id, "42");
    }

    #[test]
    fn detects_job_transitioning_to_failed_while_in_spooler() {
        // Simula papel faltando: job estava PRINTING, agora está FAILED (CUPS STOPPED)
        let previous = vec![mock_job("1", JobStatus::Printing)];
        let current  = vec![mock_job("1", JobStatus::Failed)];
        let changed = detect_changed_jobs(&previous, &current);
        assert_eq!(changed.len(), 1);
        assert_eq!(changed[0].status, JobStatus::Failed);
    }

    #[test]
    fn no_change_when_status_same() {
        let previous = vec![mock_job("1", JobStatus::Printing)];
        let current  = vec![mock_job("1", JobStatus::Printing)];
        let changed = detect_changed_jobs(&previous, &current);
        assert!(changed.is_empty());
    }

    #[test]
    fn ignores_new_jobs_in_changed_detection() {
        // Job novo não deve aparecer como "mudança de status"
        let previous: Vec<PrintJob> = vec![];
        let current = vec![mock_job("99", JobStatus::Failed)];
        let changed = detect_changed_jobs(&previous, &current);
        assert!(changed.is_empty());
    }
}
