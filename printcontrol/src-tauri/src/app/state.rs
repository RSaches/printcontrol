// src-tauri/src/app/state.rs
use crate::infrastructure::printing::PrintingAdapter;
use crate::services::job_manager::JobManager;
use crate::services::settings_manager::SettingsManager;
use std::sync::Arc;

pub struct AppState {
    pub printing_adapter: Arc<dyn PrintingAdapter>,
    pub job_manager: Arc<JobManager>,
    pub settings_manager: Arc<SettingsManager>,
    pub db_path: String,
}
