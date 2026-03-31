-- migrations/001_initial.sql

CREATE TABLE IF NOT EXISTS printers (
    id         TEXT PRIMARY KEY,
    name       TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS jobs (
    id              TEXT PRIMARY KEY,
    spooler_job_id  INTEGER,
    document_name   TEXT NOT NULL,
    user_name       TEXT NOT NULL,
    printer_name    TEXT NOT NULL,
    status          TEXT NOT NULL DEFAULT 'PENDING'
                        CHECK(status IN ('PENDING','PRINTING','COMPLETED','FAILED')),
    pages           INTEGER,
    size_bytes      INTEGER,
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (printer_name) REFERENCES printers(name)
);

CREATE INDEX IF NOT EXISTS idx_jobs_status     ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_created_at ON jobs(created_at);
CREATE INDEX IF NOT EXISTS idx_jobs_printer    ON jobs(printer_name);

CREATE TABLE IF NOT EXISTS settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

-- Configurações padrão
INSERT OR IGNORE INTO settings (key, value) VALUES ('poll_interval_secs', '2');
INSERT OR IGNORE INTO settings (key, value) VALUES ('job_timeout_mins',   '5');
