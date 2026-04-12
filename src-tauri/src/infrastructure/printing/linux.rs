// src-tauri/src/infrastructure/printing/linux.rs
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
use std::fs;
use std::process::Command;
use std::time::UNIX_EPOCH;

pub struct LinuxAdapter;

impl LinuxAdapter {
    pub fn new() -> Self {
        Self
    }
}

/// Atributos de um job CUPS obtidos via IPP.
struct CupsJobAttrs {
    pages: Option<i64>,
    paper_format: Option<String>,
}

/// Normaliza o atributo IPP `media` para um nome legível.
///
/// Exemplos de valores CUPS:
///   `iso_a4_210x297mm` → "A4"
///   `iso_a3_297x420mm` → "A3"
///   `na_letter_8.5x11in` → "Carta"
///   `na_legal_8.5x14in` → "Ofício"
fn normalize_cups_media(media: &str) -> String {
    let m = media.to_lowercase();
    if m.contains("iso_a4") || m == "a4" { return "A4".to_string(); }
    if m.contains("iso_a3") || m == "a3" { return "A3".to_string(); }
    if m.contains("iso_a5") || m == "a5" { return "A5".to_string(); }
    if m.contains("iso_a2") || m == "a2" { return "A2".to_string(); }
    if m.contains("iso_a6") || m == "a6" { return "A6".to_string(); }
    if m.contains("iso_b5") || m == "b5" { return "B5".to_string(); }
    if m.contains("iso_b4") || m == "b4" { return "B4".to_string(); }
    if m.contains("na_letter") || m == "letter" { return "Carta".to_string(); }
    if m.contains("na_legal") || m == "legal"   { return "Ofício".to_string(); }
    if m.contains("na_tabloid") || m.contains("11x17") { return "Tabloide".to_string(); }
    // Fallback: remove sufixo de dimensões e retorna o nome em maiúsculas
    let clean = media
        .split('_')
        .take_while(|p| !p.contains('x') && !p.contains("mm") && !p.contains("in"))
        .collect::<Vec<_>>()
        .join(" ");
    if clean.is_empty() { media.to_string() } else { clean.to_uppercase() }
}

/// Consulta o CUPS via IPP (ipptool) e retorna atributos dos jobs ativos.
///
/// Solicita `job-id`, `job-impressions` (páginas) e `media` (formato do papel).
/// Se `ipptool` não estiver instalado ou falhar, retorna HashMap vazio —
/// o monitor continua normalmente com pages/paper_format = None.
fn fetch_cups_job_attrs() -> HashMap<u64, CupsJobAttrs> {
    let test_content = r#"{
OPERATION Get-Jobs
GROUP operation-attributes-tag
ATTR charset attributes-charset utf-8
ATTR language attributes-natural-language en
ATTR uri printer-uri ipp://localhost/
ATTR boolean my-jobs false
ATTR keyword which-jobs not-completed
ATTR keyword requested-attributes job-id,job-impressions,media
}
"#;

    let test_path = std::env::temp_dir().join("printcontrol_attrs.test");
    if fs::write(&test_path, test_content).is_err() {
        return HashMap::new();
    }

    let output = Command::new("ipptool")
        .args(["-v", "ipp://localhost/", test_path.to_str().unwrap_or("")])
        .output();

    let _ = fs::remove_file(&test_path);

    let stdout = match output {
        Ok(o) => String::from_utf8_lossy(&o.stdout).into_owned(),
        Err(_) => return HashMap::new(),
    };

    // Saída ipptool -v (linha por atributo, indentada):
    //   job-id (integer) = 42
    //   job-impressions (integer) = 120
    //   media (keyword) = iso_a4_210x297mm
    let mut map: HashMap<u64, CupsJobAttrs> = HashMap::new();
    let mut current_id: Option<u64> = None;

    for line in stdout.lines() {
        let line = line.trim();

        if line.starts_with("job-id") {
            if let Some(eq) = line.rfind('=') {
                if let Ok(id) = line[eq + 1..].trim().parse::<u64>() {
                    current_id = Some(id);
                    map.entry(id).or_insert(CupsJobAttrs { pages: None, paper_format: None });
                }
            }
        } else if line.starts_with("job-impressions") {
            if let (Some(id), Some(eq)) = (current_id, line.rfind('=')) {
                if let Ok(n) = line[eq + 1..].trim().parse::<i64>() {
                    if n > 0 {
                        map.entry(id).or_insert(CupsJobAttrs { pages: None, paper_format: None }).pages = Some(n);
                    }
                }
            }
        } else if line.starts_with("media") {
            if let (Some(id), Some(eq)) = (current_id, line.rfind('=')) {
                let raw = line[eq + 1..].trim();
                if !raw.is_empty() {
                    let fmt = normalize_cups_media(raw);
                    map.entry(id).or_insert(CupsJobAttrs { pages: None, paper_format: None }).paper_format = Some(fmt);
                }
            }
        }
    }

    map
}

/// Executa `lpstat -W not-completed` e retorna um mapa de job_id -> username.
///
/// Formato de cada linha:
///   printer_name-JOB_ID   username   size_bytes   date_string
///   Ex: "HP_LaserJet-42   joaosilva   1024   Sun 29 Mar 2026 10:00:00"
///
/// O campo JOB_ID e obtido pelo ultimo segmento apos o ultimo '-' no primeiro token.
fn fetch_usernames_linux() -> HashMap<u64, String> {
    let mut map = HashMap::new();

    let output = Command::new("lpstat")
        .args(["-W", "not-completed"])
        .output();

    let output = match output {
        Ok(o) if o.status.success() => o,
        _ => return map,
    };

    for line in String::from_utf8_lossy(&output.stdout).lines() {
        let parts: Vec<&str> = line.split_whitespace().collect();
        // Precisa de pelo menos "printer-id" e "username"
        if parts.len() < 2 {
            continue;
        }
        // Extrai o ID numerico: ultimo fragmento apos '-'
        if let Some(dash_pos) = parts[0].rfind('-') {
            if let Ok(job_id) = parts[0][dash_pos + 1..].parse::<u64>() {
                map.insert(job_id, parts[1].to_string());
            }
        }
    }

    map
}

#[async_trait]
impl PrintingAdapter for LinuxAdapter {
    async fn list_jobs(&self) -> Result<Vec<PrintJob>, AppError> {
        tokio::task::spawn_blocking(|| -> Result<Vec<PrintJob>, AppError> {
            // Obtém mapa job_id -> username antes de iterar as impressoras
            let usernames = fetch_usernames_linux();
            // Tenta obter atributos dos jobs (páginas e formato) via IPP (best-effort)
            let cups_attrs = fetch_cups_job_attrs();

            let all_printers = printers::get_printers();
            let mut jobs = Vec::new();

            for printer in &all_printers {
                for j in printer.get_active_jobs() {
                    // Converte o SystemTime do CUPS para RFC3339.
                    // Usar o timestamp real evita IDs duplicados ao reenviar
                    // o mesmo documento e garante ordenação correta na UI.
                    let created_at = j
                        .created_at
                        .duration_since(UNIX_EPOCH)
                        .ok()
                        .and_then(|d| {
                            chrono::DateTime::from_timestamp(d.as_secs() as i64, 0)
                        })
                        .map(|dt| dt.to_rfc3339())
                        .unwrap_or_else(|| Utc::now().to_rfc3339());

                    let now = Utc::now().to_rfc3339();

                    let tracking_id = PrintJob::generate_tracking_id(
                        j.id,
                        &j.name,
                        &created_at,
                    );

                    let user_name = usernames
                        .get(&j.id)
                        .cloned()
                        .unwrap_or_else(|| String::from("unknown"));

                    let attrs = cups_attrs.get(&j.id);
                    jobs.push(PrintJob {
                        id: tracking_id,
                        spooler_job_id: Some(j.id as i64),
                        document_name: j.name.clone(),
                        user_name,
                        printer_name: j.printer_name.clone(),
                        status: map_cups_status(&j.state),
                        pages: attrs.and_then(|a| a.pages),
                        size_bytes: None,
                        paper_format: attrs.and_then(|a| a.paper_format.clone()),
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
            // `lpstat -e` lista apenas impressoras habilitadas (aceitando jobs).
            // É locale-independent e mais confiável que checar PrinterState,
            // que pode retornar UNKNOWN em alguns setups CUPS do Linux.
            let enabled = fetch_enabled_printers();
            let all_printers = printers::get_printers();

            let result = all_printers
                .into_iter()
                .map(|p| {
                    // Usa system_name para bater com a saída do lpstat
                    let is_online = if !enabled.is_empty() {
                        enabled.contains(&p.system_name)
                    } else {
                        // Fallback: confia no PrinterState se lpstat falhar
                        matches!(p.state, PrinterState::READY | PrinterState::PRINTING)
                    };
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

/// Executa `lpstat -e` e retorna o conjunto de nomes de impressoras habilitadas.
///
/// `lpstat -e` lista uma impressora por linha com seu system_name se ela estiver
/// habilitada (aceitando jobs). É locale-independent — não depende de parsing
/// de strings como "is idle" ou "está ociosa".
fn fetch_enabled_printers() -> std::collections::HashSet<String> {
    let mut set = std::collections::HashSet::new();

    let output = Command::new("lpstat").arg("-e").output();
    let output = match output {
        Ok(o) => o,
        Err(_) => return set,
    };

    for line in String::from_utf8_lossy(&output.stdout).lines() {
        let name = line.trim().to_string();
        if !name.is_empty() {
            set.insert(name);
        }
    }

    set
}

fn map_cups_status(state: &PrinterJobState) -> JobStatus {
    match state {
        PrinterJobState::PROCESSING => JobStatus::Printing,
        PrinterJobState::COMPLETED  => JobStatus::Completed,
        PrinterJobState::CANCELLED  => JobStatus::Failed,
        PrinterJobState::PENDING    => JobStatus::Pending,
        // PAUSED cobre dois casos no CUPS:
        //   IPP 4 = HELD (usuário pausou manualmente)
        //   IPP 6 = STOPPED (erro: papel faltando, impressora offline, etc.)
        // Em ambos o job está travado — para o PrintControl é uma falha.
        PrinterJobState::PAUSED     => JobStatus::Failed,
        // UNKNOWN = crate não conseguiu determinar estado = falha defensiva
        PrinterJobState::UNKNOWN    => JobStatus::Failed,
    }
}
