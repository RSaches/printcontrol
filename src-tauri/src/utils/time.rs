// src-tauri/src/utils/time.rs
#![allow(dead_code)]
use chrono::{DateTime, Utc};

pub fn now_rfc3339() -> String {
    Utc::now().to_rfc3339()
}

pub fn format_display(rfc3339: &str) -> String {
    DateTime::parse_from_rfc3339(rfc3339)
        .map(|dt| dt.format("%d/%m/%Y %H:%M:%S").to_string())
        .unwrap_or_else(|_| rfc3339.to_string())
}
