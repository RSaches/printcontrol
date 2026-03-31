// src-tauri/src/infrastructure/printing/windows.rs
#![cfg(target_os = "windows")]
use crate::domain::errors::AppError;
use crate::domain::job::PrintJob;
use crate::domain::job_status::JobStatus;
use crate::domain::printer::Printer;
use crate::infrastructure::printing::PrintingAdapter;
use async_trait::async_trait;
use chrono::Utc;
use printers::common::base::job::PrinterJobState;
use printers::common::base::printer::PrinterState;
use std::collections::HashMap;
use std::os::windows::process::CommandExt;
use std::process::Command;
use std::time::UNIX_EPOCH;

pub struct WindowsAdapter;

impl WindowsAdapter {
    pub fn new() -> Self {
        Self
    }
}

/// Executa PowerShell para obter mapa de job_id -> username via Win32 Spooler.
/// Usa Get-PrintJob (disponivel desde Windows 8 / Server 2012).
///
/// Retorna JSON no formato: [{"Id": 1, "UserName": "joao"}, ...]
/// ou objeto unico se houver apenas um job.
fn fetch_usernames_windows() -> HashMap<u64, String> {
    let mut map = HashMap::new();

    let script = "Get-PrintJob -ComputerName $env:COMPUTERNAME |                   Select-Object Id, UserName |                   ConvertTo-Json -Compress";

    let output = Command::new("powershell")
        .args(["-NoProfile", "-NonInteractive", "-Command", script])
        .creation_flags(0x08000000) // CREATE_NO_WINDOW
        .output();

    let output = match output {
        Ok(o) if o.status.success() => o,
        _ => return map,
    };

    let stdout = String::from_utf8_lossy(&output.stdout);
    let value: serde_json::Value = match serde_json::from_str(stdout.trim()) {
        Ok(v) => v,
        Err(_) => return map,
    };

    // Normaliza: objeto unico vira array de um elemento
    let arr = match value {
        serde_json::Value::Array(a) => a,
        obj @ serde_json::Value::Object(_) => vec![obj],
        _ => return map,
    };

    for item in arr {
        if let (Some(id), Some(username)) = (item["Id"].as_u64(), item["UserName"].as_str()) {
            map.insert(id, username.to_string());
        }
    }

    map
}

#[async_trait]
impl PrintingAdapter for WindowsAdapter {
    async fn list_jobs(&self) -> Result<Vec<PrintJob>, AppError> {
        tokio::task::spawn_blocking(|| -> Result<Vec<PrintJob>, AppError> {
            // Obtém mapa job_id -> username antes de iterar as impressoras
            let usernames = fetch_usernames_windows();

            let all_printers = printers::get_printers();
            let mut jobs = Vec::new();

            for printer in &all_printers {
                for j in printer.get_active_jobs() {
                    let created_ts = j
                        .created_at
                        .duration_since(UNIX_EPOCH)
                        .unwrap_or_default()
                        .as_secs();
                    let created_at = format!("{}", created_ts);
                    let now = Utc::now().to_rfc3339();

                    let tracking_id = PrintJob::generate_tracking_id(
                        j.id,
                        &j.name,
                        &created_at,
                    );

                    let user_name = usernames
                        .get(&(j.id as u64))
                        .cloned()
                        .unwrap_or_else(|| String::from("unknown"));

                    jobs.push(PrintJob {
                        id: tracking_id,
                        spooler_job_id: Some(j.id as i64),
                        document_name: j.name.clone(),
                        user_name,
                        printer_name: j.printer_name.clone(),
                        status: map_windows_status(&j.state),
                        pages: None,
                        size_bytes: None,
                        created_at: now.clone(),
                        updated_at: now,
                    });
                }
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

fn map_windows_status(state: &PrinterJobState) -> JobStatus {
    match state {
        PrinterJobState::PROCESSING => JobStatus::Printing,
        PrinterJobState::COMPLETED  => JobStatus::Completed,
        PrinterJobState::CANCELLED  => JobStatus::Failed,
        PrinterJobState::PENDING    => JobStatus::Pending,
        _                           => JobStatus::Pending,
    }
}
