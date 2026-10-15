// Package store holds all database access for projects, tasks and notes.
package store

import (
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"sort"
	"strings"
	"time"
)

// ErrNotFound is returned when a row with the requested id does not exist.
var ErrNotFound = errors.New("not found")

// ValidationError is returned for bad input; the API maps it to 400.
type ValidationError struct{ Msg string }

func (e *ValidationError) Error() string { return e.Msg }

func invalid(format string, a ...any) error {
	return &ValidationError{Msg: fmt.Sprintf(format, a...)}
}

// nowSQL is the SQLite expression used for created_at / updated_at values.
const nowSQL = "strftime('%Y-%m-%dT%H:%M:%SZ', 'now')"

type Store struct{ db *sql.DB }

func New(db *sql.DB) *Store { return &Store{db: db} }

// Patch is a partial update decoded from JSON: only the keys present are changed.
type Patch map[string]json.RawMessage

type fieldKind int

const (
	kString         fieldKind = iota // any string
	kRequiredString                  // non-empty string
	kDate                            // "YYYY-MM-DD" or null
	kInt                             // integer
	kNullableID                      // integer id or null
	kFloat                           // number
	kBool                            // stored as 0/1
)

// buildSet turns a Patch into "col = ?" clauses for the allowed fields.
// It also returns the decoded values so callers can apply extra rules.
func buildSet(p Patch, allowed map[string]fieldKind) ([]string, []any, map[string]any, error) {
	keys := make([]string, 0, len(p))
	for k := range p {
		keys = append(keys, k)
	}
	sort.Strings(keys)

	var sets []string
	var args []any
	vals := map[string]any{}
	for _, k := range keys {
		kind, ok := allowed[k]
		if !ok {
			return nil, nil, nil, invalid("unknown field %q", k)
		}
		v, err := decodeField(k, kind, p[k])
		if err != nil {
			return nil, nil, nil, err
		}
		sets = append(sets, k+" = ?")
		args = append(args, v)
		vals[k] = v
	}
	return sets, args, vals, nil
}

func decodeField(name string, kind fieldKind, raw json.RawMessage) (any, error) {
	isNull := string(raw) == "null"
	switch kind {
	case kString, kRequiredString:
		var s string
		if err := json.Unmarshal(raw, &s); err != nil {
			return nil, invalid("%s must be a string", name)
		}
		if kind == kRequiredString {
			s = strings.TrimSpace(s)
			if s == "" {
				return nil, invalid("%s is required", name)
			}
		}
		return s, nil
	case kDate:
		if isNull {
			return nil, nil
		}
		var s string
		if err := json.Unmarshal(raw, &s); err != nil {
			return nil, invalid("%s must be a date string", name)
		}
		if s == "" {
			return nil, nil
		}
		if err := checkDate(s); err != nil {
			return nil, invalid("%s: %v", name, err)
		}
		return s, nil
	case kInt:
		var n int
		if err := json.Unmarshal(raw, &n); err != nil {
			return nil, invalid("%s must be an integer", name)
		}
		return n, nil
	case kNullableID:
		if isNull {
			return nil, nil
		}
		var n int64
		if err := json.Unmarshal(raw, &n); err != nil {
			return nil, invalid("%s must be an id or null", name)
		}
		return n, nil
	case kFloat:
		var f float64
		if err := json.Unmarshal(raw, &f); err != nil {
			return nil, invalid("%s must be a number", name)
		}
		return f, nil
	case kBool:
		var b bool
		if err := json.Unmarshal(raw, &b); err != nil {
			return nil, invalid("%s must be a boolean", name)
		}
		if b {
			return 1, nil
		}
		return 0, nil
	}
	return nil, invalid("unsupported field %q", name)
}

func checkDate(s string) error {
	if _, err := time.Parse("2006-01-02", s); err != nil {
		return errors.New("expected YYYY-MM-DD")
	}
	return nil
}

// checkOptionalDate validates a *string date coming from a create request.
func checkOptionalDate(name string, s *string) (*string, error) {
	if s == nil || *s == "" {
		return nil, nil
	}
	if err := checkDate(*s); err != nil {
		return nil, invalid("%s: %v", name, err)
	}
	return s, nil
}

func affectedOrNotFound(res sql.Result, err error) error {
	if err != nil {
		return err
	}
	n, err := res.RowsAffected()
	if err != nil {
		return err
	}
	if n == 0 {
		return ErrNotFound
	}
	return nil
}
