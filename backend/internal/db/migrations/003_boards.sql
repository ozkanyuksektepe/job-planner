-- Custom boards: user-named columns ("alanlar") that tasks can be placed in.
CREATE TABLE boards (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT    NOT NULL,
    created_at TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE TABLE board_columns (
    id       INTEGER PRIMARY KEY AUTOINCREMENT,
    board_id INTEGER NOT NULL REFERENCES boards (id) ON DELETE CASCADE,
    name     TEXT    NOT NULL,
    position REAL    NOT NULL DEFAULT 0
);

CREATE INDEX idx_board_columns_board ON board_columns (board_id);

-- A task's place on a board. column_id NULL means "on the board but in no column":
-- open tasks then show under "Planlanmamış", done tasks under "Tamamlananlar".
CREATE TABLE board_items (
    board_id   INTEGER NOT NULL REFERENCES boards (id) ON DELETE CASCADE,
    task_id    INTEGER NOT NULL REFERENCES tasks (id) ON DELETE CASCADE,
    column_id  INTEGER REFERENCES board_columns (id) ON DELETE SET NULL,
    sort_order REAL    NOT NULL DEFAULT 0,
    PRIMARY KEY (board_id, task_id)
);

CREATE INDEX idx_board_items_task ON board_items (task_id);
