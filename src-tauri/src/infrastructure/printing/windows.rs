// src-tauri/src/infrastructure/printing/windows.rs
#![cfg(target_os = "windows")]
use crate::domain::errors::AppError;
use crate::domain::job::PrintJob;
use crate::domain::job_status::JobStatus;
use crate::domain::printer::Printer;
use crate::infrastructure::printing::PrintingAdapter;
use async_trait::async_trait;
use chrono::Utc;
use printers::common::base::printer::PrinterState;
use serde::Deserialize;
use std::os::windows::process::CommandExt;
use std::process::Command;

pub struct WindowsAdapter;

impl WindowsAdapter {
    pub fn new() -> Self {
        Self
    }
}

// ---------------------------------------------------------------------------
// Flags do Windows Spooler (Winspool.h — JOB_STATUS_*)
// Usamos bitmask: um job pode ter múltiplos flags simultaneamente.
// ---------------------------------------------------------------------------
const JOB_STATUS_ERROR: u32             = 0x0002;
const JOB_STATUS_DELETING: u32          = 0x0004;
const JOB_STATUS_PRINTING: u32          = 0x0010;
const JOB_STATUS_OFFLINE: u32           = 0x0020;
const JOB_STATUS_PAPEROUT: u32          = 0x0040;
const JOB_STATUS_PRINTED: u32           = 0x0080;
const JOB_STATUS_DELETED: u32           = 0x0100;
const JOB_STATUS_BLOCKED_DEVQ: u32      = 0x0200;
const JOB_STATUS_USER_INTERVENTION: u32 = 0x0400;
const JOB_STATUS_COMPLETE: u32          = 0x1000;

/// Representa um job retornado via WMI (Win32_PrintJob).
#[derive(Debug, Deserialize)]
#[serde(rename_all = "PascalCase")]
struct WmiPrintJob {
    job_id: Option<u64>,
    document: Option<String>,
    printer_name: Option<String>,
    owner: Option<String>,
    status_mask: Option<u32>,
    total_pages: Option<u64>,
    size: Option<u64>,
    /// Unix timestamp (segundos) do momento em que o job foi submetido.
    submitted_unix: Option<i64>,
}

/// Consulta todos os jobs ativos via WMI (Win32_PrintJob).
///
/// **Por que WMI em vez do crate `printers`?**
/// O crate mapeia `Status=0` (estado Normal/Queued) para `UNKNOWN` e o filtra
/// em `get_active_jobs()`. Isso torna jobs recém-submetidos e todos os jobs em
/// lote que aguardam na fila completamente invisíveis ao monitor.
/// O WMI retorna TODOS os jobs na fila, incluindo os de `Status=0`.
///
/// **Duas consultas WMI por ciclo:**
/// Quando um lote de jobs é submetido, parte deles pode ser registrada no WMI
/// alguns milissegundos após a primeira consulta. Uma segunda consulta com 250ms
/// de intervalo (dentro do mesmo processo PowerShell) captura esses jobs extras
/// sem o overhead de iniciar um segundo processo.
fn fetch_wmi_jobs() -> Vec<WmiPrintJob> {
    // O script usa $_.JobId diretamente (propriedade nativa de Win32_PrintJob)
    // em vez de parsear o campo Name, evitando falhas quando o nome da
    // impressora contém vírgulas ou quando o formato é inesperado.
    // Cada job é processado em try/catch individual: um job problemático não
    // cancela os demais.
    // A segunda consulta (após 250 ms) captura jobs de lote submetidos após a
    // primeira consulta mas antes do próximo ciclo de polling.
    let script = r#"
try {
    function ConvertJob($j) {
        try {
            $jobId   = [uint64]$j.JobId
            $pName   = ($j.Name -replace ",\s*$($jobId)\s*$", "").Trim()
            $subUnix = if ($j.TimeSubmitted) {
                [DateTimeOffset]::new($j.TimeSubmitted).ToUnixTimeSeconds()
            } else { 0 }
            [PSCustomObject]@{
                JobId         = $jobId
                Document      = if ($j.Document) { $j.Document } else { '' }
                PrinterName   = $pName
                Owner         = if ($j.Owner)    { $j.Owner }    else { 'unknown' }
                StatusMask    = if ($null -ne $j.StatusMask) { [uint32]$j.StatusMask } else { [uint32]0 }
                TotalPages    = $j.TotalPages
                Size          = $j.Size
                SubmittedUnix = $subUnix
            }
        } catch { $null }
    }

    $seen = @{}

    # Primeira consulta
    Get-CimInstance -ClassName Win32_PrintJob -ErrorAction SilentlyContinue |
        ForEach-Object { $r = ConvertJob $_; if ($r) { $seen[$r.JobId] = $r } }

    # Segunda consulta após 250 ms para capturar jobs de lote
    Start-Sleep -Milliseconds 250
    Get-CimInstance -ClassName Win32_PrintJob -ErrorAction SilentlyContinue |
        ForEach-Object { $r = ConvertJob $_; if ($r -and -not $seen.ContainsKey($r.JobId)) { $seen[$r.JobId] = $r } }

    $jobs = @($seen.Values)
    if ($jobs.Count -gt 0) { $jobs | ConvertTo-Json -Compress -Depth 3 } else { '[]' }
} catch { '[]' }
"#;

    let output = Command::new("powershell")
        .args(["-NoProfile", "-NonInteractive", "-Command", script])
        .creation_flags(0x08000000) // CREATE_NO_WINDOW
        .output();

    let stdout = match output {
        Ok(o) if o.status.success() => String::from_utf8_lossy(&o.stdout).trim().to_string(),
        _ => return vec![],
    };

    let value: serde_json::Value = match serde_json::from_str(&stdout) {
        Ok(v) => v,
        Err(_) => return vec![],
    };

    // Normaliza: objeto único (1 job) vira array de um elemento
    let arr = match value {
        serde_json::Value::Array(a) => a,
        obj @ serde_json::Value::Object(_) => vec![obj],
        _ => return vec![],
    };

    arr.into_iter()
        .filter_map(|v| serde_json::from_value::<WmiPrintJob>(v).ok())
        .collect()
}

/// Mapeia o bitmask do Spooler para JobStatus usando verificação de flags.
///
/// Comportamento por flag (do mais prioritário ao menos):
/// - DELETING | DELETED                      → Failed  (cancelamento explícito)
/// - OFFLINE | PAPEROUT | BLOCKED | INTERV.  → Failed  (erro de hardware —
///   notifica o usuário; se resolver e o job sumir, será marcado COMPLETED)
/// - PRINTED | COMPLETE                      → Completed
/// - PRINTING                                → Printing
///   **PRINTING tem prioridade sobre ERROR**: muitos drivers do Windows setam
///   o bit ERROR (0x0002) transitoriamente enquanto o job está sendo enviado
///   à impressora. Se checarmos ERROR antes de PRINTING, um job saudável seria
///   imediatamente classificado como Failed.
/// - ERROR (sem PRINTING)                    → Failed  (erro genuíno em fila)
/// - Status=0 / SPOOLING / PAUSED / outros   → Pending (aguardando)
fn map_status_mask(mask: u32) -> JobStatus {
    // Cancelamento/exclusão explícita — sempre Failed, independente de outros bits.
    if mask & (JOB_STATUS_DELETING | JOB_STATUS_DELETED) != 0 {
        return JobStatus::Failed;
    }
    // Erros de hardware que impedem fisicamente a impressão.
    if mask
        & (JOB_STATUS_OFFLINE
            | JOB_STATUS_PAPEROUT
            | JOB_STATUS_BLOCKED_DEVQ
            | JOB_STATUS_USER_INTERVENTION)
        != 0
    {
        return JobStatus::Failed;
    }
    // Job concluído.
    if mask & (JOB_STATUS_PRINTED | JOB_STATUS_COMPLETE) != 0 {
        return JobStatus::Completed;
    }
    // PRINTING tem prioridade sobre ERROR: drivers podem setar ERROR
    // transitoriamente durante a impressão ativa (ex.: handshake com driver).
    if mask & JOB_STATUS_PRINTING != 0 {
        return JobStatus::Printing;
    }
    // ERROR sozinho (sem PRINTING) → falha genuína na fila.
    if mask & JOB_STATUS_ERROR != 0 {
        return JobStatus::Failed;
    }
    // Status=0 (Normal/Queued), SPOOLING(8), PAUSED(1) → aguardando impressão
    JobStatus::Pending
}

#[async_trait]
impl PrintingAdapter for WindowsAdapter {
    async fn list_jobs(&self) -> Result<Vec<PrintJob>, AppError> {
        tokio::task::spawn_blocking(|| -> Result<Vec<PrintJob>, AppError> {
            let wmi_jobs = fetch_wmi_jobs();
            let now = Utc::now().to_rfc3339();
            let mut jobs = Vec::new();

            for j in wmi_jobs {
                let job_id       = j.job_id.unwrap_or(0);
                let document     = j.document.unwrap_or_default();
                let printer_name = j.printer_name.unwrap_or_default();
                let owner        = j.owner.unwrap_or_else(|| "unknown".to_string());
                let mask         = j.status_mask.unwrap_or(0);
                let status       = map_status_mask(mask);

                // Usa o timestamp de submissão do job para gerar um tracking_id
                // estável (o mesmo valor em todos os ciclos de polling).
                let submitted_ts = j.submitted_unix.unwrap_or(0).to_string();
                let tracking_id =
                    PrintJob::generate_tracking_id(job_id, &document, &submitted_ts);

                // created_at reflete o momento real de submissão do job.
                let created_at = chrono::DateTime::from_timestamp(
                    j.submitted_unix.unwrap_or(0),
                    0,
                )
                .map(|dt| dt.to_rfc3339())
                .unwrap_or_else(|| now.clone());

                jobs.push(PrintJob {
                    id: tracking_id,
                    spooler_job_id: Some(job_id as i64),
                    document_name: document,
                    user_name: owner,
                    printer_name,
                    status,
                    pages: j.total_pages.map(|p| p as i64),
                    size_bytes: j.size.map(|s| s as i64),
                    created_at,
                    updated_at: now.clone(),
                });
            }

            Ok(jobs)
        })
        .await
        .map_err(|e| AppError::Unknown(e.to_string()))?
    }

    async fn list_printers(&self) -> Result<Vec<Printer>, AppError> {
        tokio::task::spawn_blocking(|| -> Result<Vec<Printer>, AppError> {
            let all_printers = printers::get_printers();

            let result = all_printers
                .into_iter()
                .map(|p| {
                    let is_online = matches!(
                        p.state,
                        PrinterState::READY | PrinterState::PRINTING
                    );
                    Printer {
                        id: p.system_name.clone(),
                        name: p.name.clone(),
                        is_online,
                        location: if p.location.is_empty() {
                            None
                        } else {
                            Some(p.location.clone())
                        },
                    }
                })
                .collect();

            Ok(result)
        })
        .await
        .map_err(|e| AppError::Unknown(e.to_string()))?
    }
}
