// src-tauri/src/infrastructure/printing/mod.rs
pub mod linux;
#[cfg(target_os = "windows")]
pub mod windows;

use crate::domain::errors::AppError;
use crate::domain::job::PrintJob;
use crate::domain::printer::Printer;
use async_trait::async_trait;

#[async_trait]
pub trait PrintingAdapter: Send + Sync {
    async fn list_jobs(&self) -> Result<Vec<PrintJob>, AppError>;
    async fn list_printers(&self) -> Result<Vec<Printer>, AppError>;
}
