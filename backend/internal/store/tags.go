package store

import (
	"database/sql"
	"encoding/json"
	"errors"
	"strings"
)

type Tag struct {
	ID        int64  `json:"id"`
	Name      string `json:"name"`
	Color     string `json:"color"`
	OpenTasks int    `json:"open_tasks"`
}

// TagRef is the short form of a tag embedded in tasks.
type TagRef struct {
	ID    int64  `json:"id"`
	Name  string `json:"name"`
	Color string `json:"color"`
}

type TagInput struct {
	Name  string `json:"name"`
	Color string `json:"color"`
}

const tagSelect = `
SELECT g.id, g.name, g.color,
       (SELECT COUNT(*) FROM task_tags tt JOIN tasks t ON t.id = tt.task_id
        WHERE tt.tag_id = g.id AND t.status != 'done')
FROM tags g`

func scanTag(row interface{ Scan(...any) error }) (Tag, error) {
	var g Tag
	err := row.Scan(&g.ID, &g.Name, &g.Color, &g.OpenTasks)
	return g, err
}

func (s *Store) ListTags() ([]Tag, error) {
	rows, err := s.db.Query(tagSelect + ` ORDER BY g.name COLLATE NOCASE`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []Tag{}
	for rows.Next() {
		g, err := scanTag(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, g)
	}
	return out, rows.Err()
}

func (s *Store) GetTag(id int64) (Tag, error) {
	g, err := scanTag(s.db.QueryRow(tagSelect+` WHERE g.id = ?`, id))
	if errors.Is(err, sql.ErrNoRows) {
		return g, ErrNotFound
	}
	return g, err
}

// CreateTag is idempotent: creating a tag whose name already exists returns the existing one.
func (s *Store) CreateTag(in TagInput) (Tag, error) {
	in.Name = strings.TrimSpace(strings.TrimPrefix(strings.TrimSpace(in.Name), "#"))
	if in.Name == "" {
		return Tag{}, invalid("name is required")
	}
	if in.Color == "" {
		in.Color = "#64748b"
	}
	var id int64
	err := s.db.QueryRow(`SELECT id FROM tags WHERE name = ?`, in.Name).Scan(&id)
	if errors.Is(err, sql.ErrNoRows) {
		res, err := s.db.Exec(`INSERT INTO tags (name, color) VALUES (?, ?)`, in.Name, in.Color)
		if err != nil {
			return Tag{}, err
		}
		id, _ = res.LastInsertId()
	} else if err != nil {
		return Tag{}, err
	}
	return s.GetTag(id)
}

func (s *Store) UpdateTag(id int64, p Patch) (Tag, error) {
	sets, args, _, err := buildSet(p, map[string]fieldKind{
		"name":  kRequiredString,
		"color": kRequiredString,
	})
	if err != nil {
		return Tag{}, err
	}
	if len(sets) > 0 {
		err := affectedOrNotFound(s.db.Exec(`UPDATE tags SET `+strings.Join(sets, ", ")+` WHERE id = ?`, append(args, id)...))
		if err != nil && strings.Contains(err.Error(), "UNIQUE constraint failed") {
			return Tag{}, invalid("a tag with this name already exists")
		}
		if err != nil {
			return Tag{}, err
		}
	}
	return s.GetTag(id)
}

// DeleteTag removes the tag from all tasks (ON DELETE CASCADE) and deletes it.
func (s *Store) DeleteTag(id int64) error {
	return affectedOrNotFound(s.db.Exec(`DELETE FROM tags WHERE id = ?`, id))
}

// execer is satisfied by both *sql.DB and *sql.Tx.
type execer interface {
	Exec(query string, args ...any) (sql.Result, error)
}

// setTaskTags replaces the task's tags with tagIDs.
func setTaskTags(db execer, taskID int64, tagIDs []int64) error {
	if _, err := db.Exec(`DELETE FROM task_tags WHERE task_id = ?`, taskID); err != nil {
		return err
	}
	for _, tagID := range tagIDs {
		if _, err := db.Exec(`INSERT OR IGNORE INTO task_tags (task_id, tag_id) VALUES (?, ?)`, taskID, tagID); err != nil {
			return err
		}
	}
	return nil
}

// takeTagIDs removes "tag_ids" from a patch and decodes it; ok is false when it was not present.
func takeTagIDs(p Patch) (ids []int64, ok bool, err error) {
	raw, present := p["tag_ids"]
	if !present {
		return nil, false, nil
	}
	delete(p, "tag_ids")
	if string(raw) == "null" {
		return []int64{}, true, nil
	}
	if err := json.Unmarshal(raw, &ids); err != nil {
		return nil, false, invalid("tag_ids must be a list of ids")
	}
	return ids, true, nil
}

// attachTags fills Tags for the given tasks with one extra query.
func (s *Store) attachTags(tasks []Task) error {
	if len(tasks) == 0 {
		return nil
	}
	byID := make(map[int64]*Task, len(tasks))
	placeholders := make([]string, len(tasks))
	args := make([]any, len(tasks))
	for i := range tasks {
		tasks[i].Tags = []TagRef{}
		byID[tasks[i].ID] = &tasks[i]
		placeholders[i] = "?"
		args[i] = tasks[i].ID
	}

	rows, err := s.db.Query(`
		SELECT tt.task_id, g.id, g.name, g.color
		FROM task_tags tt JOIN tags g ON g.id = tt.tag_id
		WHERE tt.task_id IN (`+strings.Join(placeholders, ",")+`)
		ORDER BY g.name COLLATE NOCASE`, args...)
	if err != nil {
		return err
	}
	defer rows.Close()
	for rows.Next() {
		var taskID int64
		var ref TagRef
		if err := rows.Scan(&taskID, &ref.ID, &ref.Name, &ref.Color); err != nil {
			return err
		}
		if t := byID[taskID]; t != nil {
			t.Tags = append(t.Tags, ref)
		}
	}
	return rows.Err()
}
