// src-tauri/src/services/settings_manager.rs
use crate::domain::errors::AppError;
use crate::domain::settings::AppSettings;
use sqlx::SqlitePool;

pub struct SettingsManager {
    pool: SqlitePool,
}

impl SettingsManager {
    pub fn new(pool: SqlitePool) -> Self {
        Self { pool }
    }

    /// Retorna todas as configurações como struct tipada.
    pub async fn get_all(&self) -> Result<AppSettings, AppError> {
        let rows: Vec<(String, String)> =
            sqlx::query_as("SELECT key, value FROM settings")
                .fetch_all(&self.pool)
                .await
                .map_err(AppError::from)?;

        let mut s = AppSettings::default();

        for (key, value) in rows {
            match key.as_str() {
                "poll_interval_secs" => {
                    if let Ok(v) = value.parse() { s.poll_interval_secs = v; }
                }
                "job_timeout_mins" => {
                    if let Ok(v) = value.parse() { s.job_timeout_mins = v; }
                }
                "auto_start_monitor" => {
                    s.auto_start_monitor = value == "true";
                }
                "history_retention_days" => {
                    if let Ok(v) = value.parse() { s.history_retention_days = v; }
                }
                "notify_on_failed" => {
                    s.notify_on_failed = value == "true";
                }
                "notify_on_monitor_error" => {
                    s.notify_on_monitor_error = value == "true";
                }
                "desktop_notification" => {
                    s.desktop_notification = value == "true";
                }
                "items_per_page" => {
                    if let Ok(v) = value.parse() { s.items_per_page = v; }
                }
                "theme" => {
                    s.theme = value;
                }
                "language" => {
                    s.language = value;
                }
                _ => {}
            }
        }

        Ok(s)
    }

    /// Atualiza ou insere uma configuração por chave.
    pub async fn update(&self, key: &str, value: &str) -> Result<(), AppError> {
        sqlx::query(
            "INSERT INTO settings (key, value) VALUES (?, ?)
             ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        )
        .bind(key)
        .bind(value)
        .execute(&self.pool)
        .await
        .map(|_| ())
        .map_err(AppError::from)
    }

    /// Restaura todos os valores padrão.
    pub async fn reset_defaults(&self) -> Result<AppSettings, AppError> {
        let defaults = AppSettings::default();
        for (key, value) in defaults.to_key_value_pairs() {
            self.update(key, &value).await?;
        }
        Ok(defaults)
    }

    /// Lê o intervalo de polling; retorna padrão em caso de erro.
    pub async fn get_poll_interval(&self) -> u64 {
        self.get_value("poll_interval_secs")
            .await
            .and_then(|v| v.parse().ok())
            .unwrap_or(2)
    }

    /// Lê o timeout de jobs travados; retorna padrão em caso de erro.
    pub async fn get_timeout_mins(&self) -> u64 {
        self.get_value("job_timeout_mins")
            .await
            .and_then(|v| v.parse().ok())
            .unwrap_or(5)
    }

    /// Lê o período de retenção de histórico em dias; retorna padrão em caso de erro.
    pub async fn get_history_retention_days(&self) -> u64 {
        self.get_value("history_retention_days")
            .await
            .and_then(|v| v.parse().ok())
            .unwrap_or(90)
    }

    async fn get_value(&self, key: &str) -> Option<String> {
        let row: Option<(String,)> =
            sqlx::query_as("SELECT value FROM settings WHERE key = ?")
                .bind(key)
                .fetch_optional(&self.pool)
                .await
                .ok()
                .flatten();
        row.map(|(v,)| v)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    async fn setup() -> SettingsManager {
        let pool = sqlx::SqlitePool::connect("sqlite::memory:")
            .await
            .expect("pool in-memory");
        sqlx::migrate!("./src/infrastructure/storage/migrations")
            .run(&pool)
            .await
            .expect("migrations");
        SettingsManager::new(pool)
    }

    #[tokio::test]
    async fn get_all_returns_defaults_after_migration() {
        let mgr = setup().await;
        let s = mgr.get_all().await.unwrap();
        assert_eq!(s.poll_interval_secs, 2);
        assert_eq!(s.job_timeout_mins, 5);
        assert!(s.auto_start_monitor);
        assert_eq!(s.history_retention_days, 90);
        assert!(s.notify_on_failed);
        assert!(s.notify_on_monitor_error);
        assert!(s.desktop_notification);
        assert_eq!(s.items_per_page, 20);
        assert_eq!(s.theme, "system");
        assert_eq!(s.language, "pt-BR");
    }

    #[tokio::test]
    async fn update_persists_and_get_all_reflects_change() {
        let mgr = setup().await;
        mgr.update("poll_interval_secs", "10").await.unwrap();
        let s = mgr.get_all().await.unwrap();
        assert_eq!(s.poll_interval_secs, 10);
    }

    #[tokio::test]
    async fn reset_defaults_restores_original_values() {
        let mgr = setup().await;
        mgr.update("poll_interval_secs", "30").await.unwrap();
        mgr.update("theme", "dark").await.unwrap();
        let restored = mgr.reset_defaults().await.unwrap();
        assert_eq!(restored.poll_interval_secs, 2);
        assert_eq!(restored.theme, "system");
        // Confirma também via get_all
        let s = mgr.get_all().await.unwrap();
        assert_eq!(s.poll_interval_secs, 2);
    }

    #[tokio::test]
    async fn get_poll_interval_returns_default_without_db_row() {
        // Apaga o valor do banco para simular linha ausente
        let pool = sqlx::SqlitePool::connect("sqlite::memory:")
            .await
            .unwrap();
        sqlx::migrate!("./src/infrastructure/storage/migrations")
            .run(&pool)
            .await
            .unwrap();
        sqlx::query("DELETE FROM settings WHERE key = 'poll_interval_secs'")
            .execute(&pool)
            .await
            .unwrap();
        let mgr = SettingsManager::new(pool);
        assert_eq!(mgr.get_poll_interval().await, 2);
    }

    #[tokio::test]
    async fn update_boolean_setting() {
        let mgr = setup().await;
        mgr.update("auto_start_monitor", "false").await.unwrap();
        let s = mgr.get_all().await.unwrap();
        assert!(!s.auto_start_monitor);
    }

    #[tokio::test]
    async fn get_history_retention_days_default() {
        let mgr = setup().await;
        assert_eq!(mgr.get_history_retention_days().await, 90);
    }
}
