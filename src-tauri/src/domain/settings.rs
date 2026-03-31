// src-tauri/src/domain/settings.rs
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppSettings {
    // Monitoramento
    pub poll_interval_secs: u64,
    pub job_timeout_mins: u64,
    pub auto_start_monitor: bool,
    // Histórico
    pub history_retention_days: u64,
    // Notificações
    pub notify_on_failed: bool,
    pub notify_on_monitor_error: bool,
    pub desktop_notification: bool,
    // Interface
    pub items_per_page: u64,
    pub theme: String,
    pub language: String,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            poll_interval_secs: 2,
            job_timeout_mins: 5,
            auto_start_monitor: true,
            history_retention_days: 90,
            notify_on_failed: true,
            notify_on_monitor_error: true,
            desktop_notification: true,
            items_per_page: 20,
            theme: "system".to_string(),
            language: "pt-BR".to_string(),
        }
    }
}

impl AppSettings {
    /// Converte o struct em pares chave-valor para persistência.
    pub fn to_key_value_pairs(&self) -> Vec<(&'static str, String)> {
        vec![
            ("poll_interval_secs",       self.poll_interval_secs.to_string()),
            ("job_timeout_mins",         self.job_timeout_mins.to_string()),
            ("auto_start_monitor",       self.auto_start_monitor.to_string()),
            ("history_retention_days",   self.history_retention_days.to_string()),
            ("notify_on_failed",         self.notify_on_failed.to_string()),
            ("notify_on_monitor_error",  self.notify_on_monitor_error.to_string()),
            ("desktop_notification",     self.desktop_notification.to_string()),
            ("items_per_page",           self.items_per_page.to_string()),
            ("theme",                    self.theme.clone()),
            ("language",                 self.language.clone()),
        ]
    }
}
