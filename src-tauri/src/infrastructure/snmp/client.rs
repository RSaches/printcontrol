// src-tauri/src/infrastructure/snmp/client.rs
#![allow(dead_code)]
use crate::domain::errors::AppError;
use crate::domain::printer::PrinterStatus;

pub struct SnmpClient {
    pub host: String,
    pub community: String,
}

impl SnmpClient {
    pub fn new(host: &str, community: &str) -> Self {
        Self {
            host: host.to_string(),
            community: community.to_string(),
        }
    }

    /// Stub — retorna online por padrão até implementação real na Fase 2.
    pub async fn get_printer_status(
        &self,
        printer_name: &str,
    ) -> Result<PrinterStatus, AppError> {
        tracing::warn!("SNMP não implementado — retornando status padrão para {}", printer_name);
        Ok(PrinterStatus {
            printer_name: printer_name.to_string(),
            is_online: true,
            has_paper: true,
            has_toner: true,
        })
    }
}
