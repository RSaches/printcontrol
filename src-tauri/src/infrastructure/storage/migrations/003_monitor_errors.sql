-- 003_monitor_errors.sql
-- Tabela para persistência de erros do worker de monitoramento

CREATE TABLE IF NOT EXISTS monitor_errors (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    message     TEXT    NOT NULL,
    occurred_at TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_monitor_errors_occurred_at ON monitor_errors (occurred_at DESC);
