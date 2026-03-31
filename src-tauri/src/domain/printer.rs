// src-tauri/src/domain/printer.rs
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Printer {
    pub id: String,
    pub name: String,
    pub is_online: bool,
    pub location: Option<String>,
}

#[allow(dead_code)]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PrinterStatus {
    pub printer_name: String,
    pub is_online: bool,
    pub has_paper: bool,
    pub has_toner: bool,
}
