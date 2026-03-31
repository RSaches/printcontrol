-- 002_settings_expansion.sql

INSERT OR IGNORE INTO settings (key, value) VALUES ('notify_on_failed',        'true');
INSERT OR IGNORE INTO settings (key, value) VALUES ('notify_on_monitor_error', 'true');
INSERT OR IGNORE INTO settings (key, value) VALUES ('desktop_notification',    'true');
INSERT OR IGNORE INTO settings (key, value) VALUES ('items_per_page',          '20');
INSERT OR IGNORE INTO settings (key, value) VALUES ('theme',                   'system');
INSERT OR IGNORE INTO settings (key, value) VALUES ('language',                'pt-BR');
INSERT OR IGNORE INTO settings (key, value) VALUES ('history_retention_days',  '90');
INSERT OR IGNORE INTO settings (key, value) VALUES ('auto_start_monitor',      'true');
