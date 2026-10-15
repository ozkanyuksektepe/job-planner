package store

import (
	"database/sql"
	"errors"
	"strings"
)

type Project struct {
	ID          int64  `json:"id"`
	Name        string `json:"name"`
	Description string `json:"description"`
	Color       string `json:"color"`
	Status      string `json:"status"`
	CreatedAt   string `json:"created_at"`
	UpdatedAt   string `json:"updated_at"`
	OpenTasks   int    `json:"open_tasks"`
	DoneTasks   int    `json:"done_tasks"`
}

type ProjectInput struct {
	Name        string `json:"name"`
	Description string `json:"description"`
	Color       string `json:"color"`
}

const projectSelect = `
SELECT p.id, p.name, p.description, p.color, p.status, p.created_at, p.updated_at,
       (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id AND t.parent_id IS NULL AND t.status != 'done'),
       (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id AND t.parent_id IS NULL AND t.status = 'done')
FROM projects p`

func scanProject(row interface{ Scan(...any) error }) (Project, error) {
	var p Project
	err := row.Scan(&p.ID, &p.Name, &p.Description, &p.Color, &p.Status, &p.CreatedAt, &p.UpdatedAt, &p.OpenTasks, &p.DoneTasks)
	return p, err
}

// ListProjects returns projects, optionally filtered by status ("active" / "archived").
func (s *Store) ListProjects(status string) ([]Project, error) {
	q := projectSelect
	var args []any
	if status != "" {
		q += ` WHERE p.status = ?`
		args = append(args, status)
	}
	q += ` ORDER BY p.status, p.name COLLATE NOCASE`

	rows, err := s.db.Query(q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []Project{}
	for rows.Next() {
		p, err := scanProject(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, p)
	}
	return out, rows.Err()
}

func (s *Store) GetProject(id int64) (Project, error) {
	p, err := scanProject(s.db.QueryRow(projectSelect+` WHERE p.id = ?`, id))
	if errors.Is(err, sql.ErrNoRows) {
		return p, ErrNotFound
	}
	return p, err
}

func (s *Store) CreateProject(in ProjectInput) (Project, error) {
	in.Name = strings.TrimSpace(in.Name)
	if in.Name == "" {
		return Project{}, invalid("name is required")
	}
	if in.Color == "" {
		in.Color = "#6366f1"
	}
	res, err := s.db.Exec(`INSERT INTO projects (name, description, color) VALUES (?, ?, ?)`,
		in.Name, in.Description, in.Color)
	if err != nil {
		return Project{}, err
	}
	id, _ := res.LastInsertId()
	return s.GetProject(id)
}

func (s *Store) UpdateProject(id int64, p Patch) (Project, error) {
	sets, args, vals, err := buildSet(p, map[string]fieldKind{
		"name":        kRequiredString,
		"description": kString,
		"color":       kRequiredString,
		"status":      kRequiredString,
	})
	if err != nil {
		return Project{}, err
	}
	if st, ok := vals["status"]; ok && st != "active" && st != "archived" {
		return Project{}, invalid("status must be active or archived")
	}
	if len(sets) > 0 {
		sets = append(sets, "updated_at = "+nowSQL)
		args = append(args, id)
		err := affectedOrNotFound(s.db.Exec(`UPDATE projects SET `+strings.Join(sets, ", ")+` WHERE id = ?`, args...))
		if err != nil {
			return Project{}, err
		}
	}
	return s.GetProject(id)
}

// DeleteProject removes the project together with its tasks and notes (ON DELETE CASCADE).
func (s *Store) DeleteProject(id int64) error {
	return affectedOrNotFound(s.db.Exec(`DELETE FROM projects WHERE id = ?`, id))
}
