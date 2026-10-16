package store

import (
	"database/sql"
	"errors"
	"strings"
)

type Board struct {
	ID        int64  `json:"id"`
	ProjectID int64  `json:"project_id"`
	Name      string `json:"name"`
	CreatedAt string `json:"created_at"`
	OpenTasks int    `json:"open_tasks"`
}

type BoardColumn struct {
	ID       int64   `json:"id"`
	BoardID  int64   `json:"board_id"`
	Name     string  `json:"name"`
	Position float64 `json:"position"`
}

// BoardItem places a task on a board; ColumnID nil means it is in no user column.
type BoardItem struct {
	TaskID    int64   `json:"task_id"`
	ColumnID  *int64  `json:"column_id"`
	SortOrder float64 `json:"sort_order"`
}

// BoardView is everything the board page needs in one response.
type BoardView struct {
	Board
	Columns []BoardColumn `json:"columns"`
	Items   []BoardItem   `json:"items"`
	// The project's tasks placed on the board (any status).
	Tasks []Task `json:"tasks"`
	// The project's open top-level tasks that are not on this board yet.
	Unplaced []Task `json:"unplaced"`
}

type NameInput struct {
	Name string `json:"name"`
}

type BoardInput struct {
	Name      string `json:"name"`
	ProjectID *int64 `json:"project_id"`
}

type PlaceInput struct {
	ColumnID  *int64   `json:"column_id"`
	SortOrder *float64 `json:"sort_order"`
}

const boardSelect = `
SELECT b.id, b.project_id, b.name, b.created_at,
       (SELECT COUNT(*) FROM board_items i JOIN tasks t ON t.id = i.task_id
        WHERE i.board_id = b.id AND t.project_id = b.project_id AND t.status != 'done')
FROM boards b`

func scanBoard(row interface{ Scan(...any) error }) (Board, error) {
	var b Board
	err := row.Scan(&b.ID, &b.ProjectID, &b.Name, &b.CreatedAt, &b.OpenTasks)
	return b, err
}

// ListBoards lists all boards, or only one project's when projectID is set.
func (s *Store) ListBoards(projectID *int64) ([]Board, error) {
	q, args := boardSelect, []any{}
	if projectID != nil {
		q += ` WHERE b.project_id = ?`
		args = append(args, *projectID)
	}
	rows, err := s.db.Query(q+` ORDER BY b.created_at, b.id`, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []Board{}
	for rows.Next() {
		b, err := scanBoard(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, b)
	}
	return out, rows.Err()
}

func (s *Store) getBoard(id int64) (Board, error) {
	b, err := scanBoard(s.db.QueryRow(boardSelect+` WHERE b.id = ?`, id))
	if errors.Is(err, sql.ErrNoRows) {
		return b, ErrNotFound
	}
	return b, err
}

func (s *Store) GetBoard(id int64) (BoardView, error) {
	b, err := s.getBoard(id)
	if err != nil {
		return BoardView{}, err
	}
	v := BoardView{Board: b, Columns: []BoardColumn{}, Items: []BoardItem{}}

	if v.Columns, err = s.boardColumns(id); err != nil {
		return BoardView{}, err
	}

	rows, err := s.db.Query(`SELECT task_id, column_id, sort_order FROM board_items WHERE board_id = ? ORDER BY sort_order`, id)
	if err != nil {
		return BoardView{}, err
	}
	for rows.Next() {
		var it BoardItem
		if err := rows.Scan(&it.TaskID, &it.ColumnID, &it.SortOrder); err != nil {
			rows.Close()
			return BoardView{}, err
		}
		v.Items = append(v.Items, it)
	}
	rows.Close()

	// Items of tasks that moved to another project stay in board_items but are not shown.
	if v.Tasks, err = s.queryTasks(taskSelect+`
		WHERE t.project_id = ? AND t.id IN (SELECT task_id FROM board_items WHERE board_id = ?)
		ORDER BY t.sort_order, t.id`, b.ProjectID, id); err != nil {
		return BoardView{}, err
	}
	if v.Unplaced, err = s.queryTasks(taskSelect+`
		WHERE t.project_id = ? AND t.parent_id IS NULL AND t.status != 'done'
		  AND t.id NOT IN (SELECT task_id FROM board_items WHERE board_id = ?)
		ORDER BY t.sort_order, t.id`, b.ProjectID, id); err != nil {
		return BoardView{}, err
	}
	return v, nil
}

func (s *Store) boardColumns(boardID int64) ([]BoardColumn, error) {
	rows, err := s.db.Query(`SELECT id, board_id, name, position FROM board_columns WHERE board_id = ? ORDER BY position, id`, boardID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []BoardColumn{}
	for rows.Next() {
		var c BoardColumn
		if err := rows.Scan(&c.ID, &c.BoardID, &c.Name, &c.Position); err != nil {
			return nil, err
		}
		out = append(out, c)
	}
	return out, rows.Err()
}

func requiredName(name string) (string, error) {
	name = strings.TrimSpace(name)
	if name == "" {
		return "", invalid("name is required")
	}
	return name, nil
}

func (s *Store) CreateBoard(in BoardInput) (Board, error) {
	name, err := requiredName(in.Name)
	if err != nil {
		return Board{}, err
	}
	if in.ProjectID == nil {
		return Board{}, invalid("project_id is required")
	}
	if _, err := s.GetProject(*in.ProjectID); errors.Is(err, ErrNotFound) {
		return Board{}, invalid("project %d does not exist", *in.ProjectID)
	} else if err != nil {
		return Board{}, err
	}
	res, err := s.db.Exec(`INSERT INTO boards (project_id, name) VALUES (?, ?)`, *in.ProjectID, name)
	if err != nil {
		return Board{}, err
	}
	id, _ := res.LastInsertId()
	return s.getBoard(id)
}

func (s *Store) RenameBoard(id int64, in NameInput) (Board, error) {
	name, err := requiredName(in.Name)
	if err != nil {
		return Board{}, err
	}
	if err := affectedOrNotFound(s.db.Exec(`UPDATE boards SET name = ? WHERE id = ?`, name, id)); err != nil {
		return Board{}, err
	}
	return s.getBoard(id)
}

// DeleteBoard removes the board, its columns and placements; tasks are kept.
func (s *Store) DeleteBoard(id int64) error {
	return affectedOrNotFound(s.db.Exec(`DELETE FROM boards WHERE id = ?`, id))
}

func (s *Store) CreateBoardColumn(boardID int64, in NameInput) (BoardColumn, error) {
	name, err := requiredName(in.Name)
	if err != nil {
		return BoardColumn{}, err
	}
	res, err := s.db.Exec(`
		INSERT INTO board_columns (board_id, name, position)
		VALUES (?, ?, (SELECT COALESCE(MAX(position), 0) + 1 FROM board_columns WHERE board_id = ?))`,
		boardID, name, boardID)
	if err != nil {
		return BoardColumn{}, err
	}
	id, _ := res.LastInsertId()
	return s.getBoardColumn(boardID, id)
}

func (s *Store) getBoardColumn(boardID, id int64) (BoardColumn, error) {
	var c BoardColumn
	err := s.db.QueryRow(`SELECT id, board_id, name, position FROM board_columns WHERE id = ? AND board_id = ?`, id, boardID).
		Scan(&c.ID, &c.BoardID, &c.Name, &c.Position)
	if errors.Is(err, sql.ErrNoRows) {
		return c, ErrNotFound
	}
	return c, err
}

func (s *Store) UpdateBoardColumn(boardID, id int64, p Patch) (BoardColumn, error) {
	sets, args, _, err := buildSet(p, map[string]fieldKind{
		"name":     kRequiredString,
		"position": kFloat,
	})
	if err != nil {
		return BoardColumn{}, err
	}
	if len(sets) > 0 {
		args = append(args, id, boardID)
		if err := affectedOrNotFound(s.db.Exec(`UPDATE board_columns SET `+strings.Join(sets, ", ")+` WHERE id = ? AND board_id = ?`, args...)); err != nil {
			return BoardColumn{}, err
		}
	}
	return s.getBoardColumn(boardID, id)
}

// DeleteBoardColumn removes a column; its tasks stay on the board without a column (ON DELETE SET NULL).
func (s *Store) DeleteBoardColumn(boardID, id int64) error {
	return affectedOrNotFound(s.db.Exec(`DELETE FROM board_columns WHERE id = ? AND board_id = ?`, id, boardID))
}

// PlaceTask puts a task of the board's project on the board (or moves it) into a column at a sort position.
func (s *Store) PlaceTask(boardID, taskID int64, in PlaceInput) (BoardItem, error) {
	b, err := s.getBoard(boardID)
	if err != nil {
		return BoardItem{}, err
	}
	var projectID *int64
	if err := s.db.QueryRow(`SELECT project_id FROM tasks WHERE id = ?`, taskID).Scan(&projectID); errors.Is(err, sql.ErrNoRows) {
		return BoardItem{}, ErrNotFound
	} else if err != nil {
		return BoardItem{}, err
	}
	if projectID == nil || *projectID != b.ProjectID {
		return BoardItem{}, invalid("task is not in this board's project")
	}
	if in.ColumnID != nil {
		if _, err := s.getBoardColumn(boardID, *in.ColumnID); errors.Is(err, ErrNotFound) {
			return BoardItem{}, invalid("column does not belong to this board")
		} else if err != nil {
			return BoardItem{}, err
		}
	}
	var order float64
	if in.SortOrder != nil {
		order = *in.SortOrder
	} else if err := s.db.QueryRow(`SELECT COALESCE(MAX(sort_order), 0) + 1 FROM board_items WHERE board_id = ?`, boardID).Scan(&order); err != nil {
		return BoardItem{}, err
	}

	_, err = s.db.Exec(`
		INSERT INTO board_items (board_id, task_id, column_id, sort_order) VALUES (?, ?, ?, ?)
		ON CONFLICT (board_id, task_id) DO UPDATE SET column_id = excluded.column_id, sort_order = excluded.sort_order`,
		boardID, taskID, in.ColumnID, order)
	if err != nil {
		return BoardItem{}, err
	}
	return BoardItem{TaskID: taskID, ColumnID: in.ColumnID, SortOrder: order}, nil
}

// UnplaceTask takes a task off the board; the task itself is kept.
func (s *Store) UnplaceTask(boardID, taskID int64) error {
	return affectedOrNotFound(s.db.Exec(`DELETE FROM board_items WHERE board_id = ? AND task_id = ?`, boardID, taskID))
}
