package store

import (
	"database/sql"
	"errors"
	"strings"
)

type Note struct {
	ID           int64   `json:"id"`
	ProjectID    *int64  `json:"project_id"`
	Title        string  `json:"title"`
	Content      string  `json:"content"` // TipTap document as JSON
	Pinned       bool    `json:"pinned"`
	CreatedAt    string  `json:"created_at"`
	UpdatedAt    string  `json:"updated_at"`
	ProjectName  *string `json:"project_name"`
	ProjectColor *string `json:"project_color"`
}

type NoteInput struct {
	ProjectID *int64 `json:"project_id"`
	Title     string `json:"title"`
	Content   string `json:"content"`
}

const noteSelect = `
SELECT n.id, n.project_id, n.title, n.content, n.pinned, n.created_at, n.updated_at, p.name, p.color
FROM notes n
LEFT JOIN projects p ON p.id = n.project_id`

func scanNote(row interface{ Scan(...any) error }) (Note, error) {
	var n Note
	err := row.Scan(&n.ID, &n.ProjectID, &n.Title, &n.Content, &n.Pinned, &n.CreatedAt, &n.UpdatedAt, &n.ProjectName, &n.ProjectColor)
	return n, err
}

// ListNotes returns all notes, or only a project's notes when projectID is set.
func (s *Store) ListNotes(projectID *int64) ([]Note, error) {
	q := noteSelect
	var args []any
	if projectID != nil {
		q += ` WHERE n.project_id = ?`
		args = append(args, *projectID)
	}
	q += ` ORDER BY n.pinned DESC, n.updated_at DESC, n.id DESC`

	rows, err := s.db.Query(q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []Note{}
	for rows.Next() {
		n, err := scanNote(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, n)
	}
	return out, rows.Err()
}

func (s *Store) GetNote(id int64) (Note, error) {
	n, err := scanNote(s.db.QueryRow(noteSelect+` WHERE n.id = ?`, id))
	if errors.Is(err, sql.ErrNoRows) {
		return n, ErrNotFound
	}
	return n, err
}

func (s *Store) CreateNote(in NoteInput) (Note, error) {
	res, err := s.db.Exec(`INSERT INTO notes (project_id, title, content) VALUES (?, ?, ?)`,
		in.ProjectID, strings.TrimSpace(in.Title), in.Content)
	if err != nil {
		return Note{}, err
	}
	id, _ := res.LastInsertId()
	return s.GetNote(id)
}

func (s *Store) UpdateNote(id int64, p Patch) (Note, error) {
	sets, args, _, err := buildSet(p, map[string]fieldKind{
		"title":      kString,
		"content":    kString,
		"pinned":     kBool,
		"project_id": kNullableID,
	})
	if err != nil {
		return Note{}, err
	}
	if len(sets) > 0 {
		sets = append(sets, "updated_at = "+nowSQL)
		args = append(args, id)
		if err := affectedOrNotFound(s.db.Exec(`UPDATE notes SET `+strings.Join(sets, ", ")+` WHERE id = ?`, args...)); err != nil {
			return Note{}, err
		}
	}
	return s.GetNote(id)
}

func (s *Store) DeleteNote(id int64) error {
	return affectedOrNotFound(s.db.Exec(`DELETE FROM notes WHERE id = ?`, id))
}
