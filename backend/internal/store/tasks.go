package store

import (
	"database/sql"
	"errors"
	"strings"
)

type Task struct {
	ID            int64   `json:"id"`
	ProjectID     *int64  `json:"project_id"`
	ParentID      *int64  `json:"parent_id"`
	Title         string  `json:"title"`
	Description   string  `json:"description"`
	Status        string  `json:"status"`
	Priority      int     `json:"priority"`
	DueDate       *string `json:"due_date"`
	ScheduledDate *string `json:"scheduled_date"`
	SortOrder     float64 `json:"sort_order"`
	CompletedAt   *string `json:"completed_at"`
	CreatedAt     string  `json:"created_at"`
	UpdatedAt     string  `json:"updated_at"`

	// Derived fields for display.
	ProjectName  *string `json:"project_name"`
	ProjectColor *string `json:"project_color"`
	ParentTitle  *string `json:"parent_title"`
	SubtaskCount int     `json:"subtask_count"`
	SubtaskDone  int     `json:"subtask_done"`
}

type TaskInput struct {
	ProjectID     *int64  `json:"project_id"`
	ParentID      *int64  `json:"parent_id"`
	Title         string  `json:"title"`
	Description   string  `json:"description"`
	Status        string  `json:"status"`
	Priority      int     `json:"priority"`
	DueDate       *string `json:"due_date"`
	ScheduledDate *string `json:"scheduled_date"`
}

// TaskFilter selects tasks for ListTasks. With no ParentID only top-level tasks are returned.
type TaskFilter struct {
	ProjectID *int64
	ParentID  *int64
	Inbox     bool // no project and no scheduled date
}

const taskSelect = `
SELECT t.id, t.project_id, t.parent_id, t.title, t.description, t.status, t.priority,
       t.due_date, t.scheduled_date, t.sort_order, t.completed_at, t.created_at, t.updated_at,
       p.name, p.color, pt.title,
       (SELECT COUNT(*) FROM tasks s WHERE s.parent_id = t.id),
       (SELECT COUNT(*) FROM tasks s WHERE s.parent_id = t.id AND s.status = 'done')
FROM tasks t
LEFT JOIN projects p ON p.id = t.project_id
LEFT JOIN tasks pt ON pt.id = t.parent_id`

func scanTask(row interface{ Scan(...any) error }) (Task, error) {
	var t Task
	err := row.Scan(&t.ID, &t.ProjectID, &t.ParentID, &t.Title, &t.Description, &t.Status, &t.Priority,
		&t.DueDate, &t.ScheduledDate, &t.SortOrder, &t.CompletedAt, &t.CreatedAt, &t.UpdatedAt,
		&t.ProjectName, &t.ProjectColor, &t.ParentTitle, &t.SubtaskCount, &t.SubtaskDone)
	return t, err
}

func (s *Store) queryTasks(q string, args ...any) ([]Task, error) {
	rows, err := s.db.Query(q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []Task{}
	for rows.Next() {
		t, err := scanTask(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, t)
	}
	return out, rows.Err()
}

func (s *Store) ListTasks(f TaskFilter) ([]Task, error) {
	var where []string
	var args []any
	if f.ParentID != nil {
		where = append(where, "t.parent_id = ?")
		args = append(args, *f.ParentID)
	} else {
		where = append(where, "t.parent_id IS NULL")
	}
	if f.ProjectID != nil {
		where = append(where, "t.project_id = ?")
		args = append(args, *f.ProjectID)
	}
	if f.Inbox {
		where = append(where, "t.project_id IS NULL AND t.scheduled_date IS NULL")
	}

	q := taskSelect + ` WHERE ` + strings.Join(where, " AND ") +
		` ORDER BY t.status = 'done', t.sort_order, t.id`
	return s.queryTasks(q, args...)
}

// TodayView groups the tasks relevant for a given day.
type TodayView struct {
	Date    string `json:"date"`
	Overdue []Task `json:"overdue"`
	Today   []Task `json:"today"`
}

// Today returns tasks scheduled or due on date, plus unfinished tasks from earlier days.
// date comes from the client so "today" follows the browser's local time zone.
func (s *Store) Today(date string) (TodayView, error) {
	if err := checkDate(date); err != nil {
		return TodayView{}, invalid("date: %v", err)
	}
	today, err := s.queryTasks(taskSelect+`
		WHERE (t.scheduled_date = ? OR t.due_date = ?)
		ORDER BY t.status = 'done', t.priority DESC, t.sort_order, t.id`, date, date)
	if err != nil {
		return TodayView{}, err
	}
	overdue, err := s.queryTasks(taskSelect+`
		WHERE t.status != 'done'
		  AND (t.scheduled_date < ? OR t.due_date < ?)
		  AND COALESCE(t.scheduled_date, '') != ? AND COALESCE(t.due_date, '') != ?
		ORDER BY COALESCE(t.due_date, t.scheduled_date), t.priority DESC, t.id`, date, date, date, date)
	if err != nil {
		return TodayView{}, err
	}
	return TodayView{Date: date, Overdue: overdue, Today: today}, nil
}

func (s *Store) GetTask(id int64) (Task, error) {
	t, err := scanTask(s.db.QueryRow(taskSelect+` WHERE t.id = ?`, id))
	if errors.Is(err, sql.ErrNoRows) {
		return t, ErrNotFound
	}
	return t, err
}

func validStatus(s string) bool { return s == "todo" || s == "doing" || s == "done" }

func (s *Store) CreateTask(in TaskInput) (Task, error) {
	in.Title = strings.TrimSpace(in.Title)
	if in.Title == "" {
		return Task{}, invalid("title is required")
	}
	if in.Status == "" {
		in.Status = "todo"
	}
	if !validStatus(in.Status) {
		return Task{}, invalid("status must be todo, doing or done")
	}
	if in.Priority < 0 || in.Priority > 3 {
		return Task{}, invalid("priority must be between 0 and 3")
	}
	var err error
	if in.DueDate, err = checkOptionalDate("due_date", in.DueDate); err != nil {
		return Task{}, err
	}
	if in.ScheduledDate, err = checkOptionalDate("scheduled_date", in.ScheduledDate); err != nil {
		return Task{}, err
	}

	// Subtasks always live in their parent's project.
	if in.ParentID != nil {
		parent, err := s.GetTask(*in.ParentID)
		if errors.Is(err, ErrNotFound) {
			return Task{}, invalid("parent task not found")
		} else if err != nil {
			return Task{}, err
		}
		if parent.ParentID != nil {
			return Task{}, invalid("subtasks cannot have their own subtasks")
		}
		in.ProjectID = parent.ProjectID
	}

	res, err := s.db.Exec(`
		INSERT INTO tasks (project_id, parent_id, title, description, status, priority,
		                   due_date, scheduled_date, sort_order, completed_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM tasks),
		        CASE WHEN ? THEN `+nowSQL+` END)`,
		in.ProjectID, in.ParentID, in.Title, in.Description, in.Status, in.Priority,
		in.DueDate, in.ScheduledDate, in.Status == "done")
	if err != nil {
		return Task{}, err
	}
	id, _ := res.LastInsertId()
	return s.GetTask(id)
}

func (s *Store) UpdateTask(id int64, p Patch) (Task, error) {
	sets, args, vals, err := buildSet(p, map[string]fieldKind{
		"title":          kRequiredString,
		"description":    kString,
		"status":         kRequiredString,
		"priority":       kInt,
		"due_date":       kDate,
		"scheduled_date": kDate,
		"project_id":     kNullableID,
		"sort_order":     kFloat,
	})
	if err != nil {
		return Task{}, err
	}
	if st, ok := vals["status"]; ok {
		if !validStatus(st.(string)) {
			return Task{}, invalid("status must be todo, doing or done")
		}
		if st == "done" {
			sets = append(sets, "completed_at = COALESCE(completed_at, "+nowSQL+")")
		} else {
			sets = append(sets, "completed_at = NULL")
		}
	}
	if pr, ok := vals["priority"]; ok && (pr.(int) < 0 || pr.(int) > 3) {
		return Task{}, invalid("priority must be between 0 and 3")
	}
	if len(sets) == 0 {
		return s.GetTask(id)
	}

	tx, err := s.db.Begin()
	if err != nil {
		return Task{}, err
	}
	defer tx.Rollback()

	sets = append(sets, "updated_at = "+nowSQL)
	if err := affectedOrNotFound(tx.Exec(`UPDATE tasks SET `+strings.Join(sets, ", ")+` WHERE id = ?`, append(args, id)...)); err != nil {
		return Task{}, err
	}
	// Moving a task to another project takes its subtasks along.
	if pid, ok := vals["project_id"]; ok {
		if _, err := tx.Exec(`UPDATE tasks SET project_id = ?, updated_at = `+nowSQL+` WHERE parent_id = ?`, pid, id); err != nil {
			return Task{}, err
		}
	}
	if err := tx.Commit(); err != nil {
		return Task{}, err
	}
	return s.GetTask(id)
}

// DeleteTask removes the task and its subtasks (ON DELETE CASCADE).
func (s *Store) DeleteTask(id int64) error {
	return affectedOrNotFound(s.db.Exec(`DELETE FROM tasks WHERE id = ?`, id))
}
