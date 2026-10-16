-- Top-level tasks are now listed newest first: new ones get a sort_order below every other
-- top-level task. Reorder the existing ones once so the oldest has -1 and the newest -N.
-- Subtasks keep their order (they are only compared with their siblings).
UPDATE tasks
SET sort_order = -1 - (
    SELECT COUNT(*) FROM tasks o
    WHERE o.parent_id IS NULL
      AND (o.created_at < tasks.created_at OR (o.created_at = tasks.created_at AND o.id < tasks.id))
)
WHERE parent_id IS NULL;
