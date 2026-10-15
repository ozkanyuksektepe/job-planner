-- Images attached to tasks. Files live on disk next to the database (attachments/<stored_name>).
CREATE TABLE attachments (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id      INTEGER NOT NULL REFERENCES tasks (id) ON DELETE CASCADE,
    filename     TEXT    NOT NULL,
    stored_name  TEXT    NOT NULL UNIQUE,
    content_type TEXT    NOT NULL,
    size         INTEGER NOT NULL,
    created_at   TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE INDEX idx_attachments_task ON attachments (task_id);
