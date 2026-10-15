-- Attachments can now belong to a task or a note, and be images or audio recordings.
-- SQLite can't relax NOT NULL on task_id in place, so the table is rebuilt.
CREATE TABLE attachments_new (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id      INTEGER REFERENCES tasks (id) ON DELETE CASCADE,
    note_id      INTEGER REFERENCES notes (id) ON DELETE CASCADE,
    kind         TEXT    NOT NULL DEFAULT 'image' CHECK (kind IN ('image', 'audio')),
    filename     TEXT    NOT NULL,
    stored_name  TEXT    NOT NULL UNIQUE,
    content_type TEXT    NOT NULL,
    size         INTEGER NOT NULL,
    duration_ms  INTEGER,
    created_at   TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    CHECK ((task_id IS NULL) != (note_id IS NULL))
);

INSERT INTO attachments_new (id, task_id, kind, filename, stored_name, content_type, size, created_at)
SELECT id, task_id, 'image', filename, stored_name, content_type, size, created_at FROM attachments;

DROP TABLE attachments;
ALTER TABLE attachments_new RENAME TO attachments;

CREATE INDEX idx_attachments_task ON attachments (task_id);
CREATE INDEX idx_attachments_note ON attachments (note_id);
