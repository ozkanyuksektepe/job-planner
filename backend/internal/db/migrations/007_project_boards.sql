-- Boards now belong to a project and only show that project's tasks.
ALTER TABLE boards ADD COLUMN project_id INTEGER REFERENCES projects (id) ON DELETE CASCADE;

-- Give each existing board the project most of its tasks are in.
UPDATE boards SET project_id = (
    SELECT t.project_id FROM board_items i JOIN tasks t ON t.id = i.task_id
    WHERE i.board_id = boards.id AND t.project_id IS NOT NULL
    GROUP BY t.project_id ORDER BY COUNT(*) DESC, t.project_id LIMIT 1
);

-- A board without project tasks has nowhere to go; its tasks are kept.
DELETE FROM boards WHERE project_id IS NULL;

CREATE INDEX idx_boards_project ON boards (project_id);
