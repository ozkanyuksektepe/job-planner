package store

import (
	"bytes"
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"unicode/utf8"
)

// Size limits per kind. Audio is larger: ~30 minutes of AAC from Safari is about 30 MB.
const (
	MaxImageSize = 20 << 20
	MaxAudioSize = 100 << 20
)

type mediaType struct {
	kind        string // "image" or "audio"
	contentType string // what we serve the file as
	ext         string
}

// Keyed by http.DetectContentType's result. Only raster images browsers can show (SVG is
// excluded because it can carry scripts) and audio containers browsers record or play.
// Browsers' recorders write WebM / MP4 containers, which the sniffer reports as video.
var mediaTypes = map[string]mediaType{
	"image/png":       {"image", "image/png", ".png"},
	"image/jpeg":      {"image", "image/jpeg", ".jpg"},
	"image/gif":       {"image", "image/gif", ".gif"},
	"image/webp":      {"image", "image/webp", ".webp"},
	"video/webm":      {"audio", "audio/webm", ".webm"},
	"video/mp4":       {"audio", "audio/mp4", ".m4a"},
	"application/ogg": {"audio", "audio/ogg", ".ogg"},
	"audio/mpeg":      {"audio", "audio/mpeg", ".mp3"},
	"audio/wave":      {"audio", "audio/wav", ".wav"},
}

// AttachmentOwner says what an attachment belongs to: a task or a note.
type AttachmentOwner struct {
	column string // "task_id" or "note_id"; never user input
	id     int64
}

func TaskOwner(id int64) AttachmentOwner { return AttachmentOwner{"task_id", id} }
func NoteOwner(id int64) AttachmentOwner { return AttachmentOwner{"note_id", id} }

type Attachment struct {
	ID          int64  `json:"id"`
	TaskID      *int64 `json:"task_id"`
	NoteID      *int64 `json:"note_id"`
	Kind        string `json:"kind"` // "image" or "audio"
	Filename    string `json:"filename"`
	ContentType string `json:"content_type"`
	Size        int64  `json:"size"`
	// Measured by the recorder; browsers' WebM recordings don't carry a duration themselves.
	DurationMs *int64 `json:"duration_ms"`
	CreatedAt  string `json:"created_at"`
	URL        string `json:"url"`

	storedName string
}

const attachmentSelect = `SELECT id, task_id, note_id, kind, filename, stored_name, content_type, size, duration_ms, created_at FROM attachments`

func scanAttachment(row interface{ Scan(...any) error }) (Attachment, error) {
	var a Attachment
	err := row.Scan(&a.ID, &a.TaskID, &a.NoteID, &a.Kind, &a.Filename, &a.storedName, &a.ContentType, &a.Size, &a.DurationMs, &a.CreatedAt)
	a.URL = fmt.Sprintf("/api/attachments/%d/file", a.ID)
	return a, err
}

func (s *Store) ListAttachments(owner AttachmentOwner) ([]Attachment, error) {
	rows, err := s.db.Query(attachmentSelect+` WHERE `+owner.column+` = ? ORDER BY created_at, id`, owner.id)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []Attachment{}
	for rows.Next() {
		a, err := scanAttachment(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, a)
	}
	return out, rows.Err()
}

func (s *Store) getAttachment(id int64) (Attachment, error) {
	a, err := scanAttachment(s.db.QueryRow(attachmentSelect+` WHERE id = ?`, id))
	if errors.Is(err, sql.ErrNoRows) {
		return a, ErrNotFound
	}
	return a, err
}

// AttachmentFile returns the attachment and the path of its file on disk.
func (s *Store) AttachmentFile(id int64) (Attachment, string, error) {
	a, err := s.getAttachment(id)
	if err != nil {
		return a, "", err
	}
	return a, filepath.Join(s.attachmentsDir, a.storedName), nil
}

func (s *Store) checkOwner(owner AttachmentOwner) error {
	var err error
	if owner.column == "note_id" {
		_, err = s.GetNote(owner.id)
	} else {
		_, err = s.GetTask(owner.id)
	}
	return err
}

// AddAttachment stores an uploaded image or audio recording. The type is detected from the
// content, not from the file name or the client's Content-Type. durationMs is optional.
func (s *Store) AddAttachment(owner AttachmentOwner, filename string, durationMs *int64, r io.Reader) (Attachment, error) {
	if err := s.checkOwner(owner); err != nil {
		return Attachment{}, err
	}

	head := make([]byte, 512)
	n, err := io.ReadFull(r, head)
	if err != nil && !errors.Is(err, io.ErrUnexpectedEOF) && !errors.Is(err, io.EOF) {
		return Attachment{}, err
	}
	head = head[:n]
	mt, ok := mediaTypes[http.DetectContentType(head)]
	if !ok {
		return Attachment{}, invalid("only images (PNG, JPEG, GIF, WebP) or audio recordings can be attached")
	}
	limit := int64(MaxImageSize)
	if mt.kind == "audio" {
		limit = MaxAudioSize
	} else {
		durationMs = nil
	}
	if durationMs != nil && *durationMs < 0 {
		durationMs = nil
	}

	if err := os.MkdirAll(s.attachmentsDir, 0o755); err != nil {
		return Attachment{}, err
	}
	stored := randomName() + mt.ext
	path := filepath.Join(s.attachmentsDir, stored)
	f, err := os.OpenFile(path, os.O_WRONLY|os.O_CREATE|os.O_EXCL, 0o644)
	if err != nil {
		return Attachment{}, err
	}
	size, err := io.Copy(f, io.LimitReader(io.MultiReader(bytes.NewReader(head), r), limit+1))
	if cerr := f.Close(); err == nil {
		err = cerr
	}
	if err == nil && size > limit {
		err = invalid("files of this kind must be at most %d MB", limit>>20)
	}
	if err != nil {
		os.Remove(path)
		return Attachment{}, err
	}

	res, err := s.db.Exec(`INSERT INTO attachments (`+owner.column+`, kind, filename, stored_name, content_type, size, duration_ms)
		VALUES (?, ?, ?, ?, ?, ?, ?)`,
		owner.id, mt.kind, cleanFilename(filename, mt.ext), stored, mt.contentType, size, durationMs)
	if err != nil {
		os.Remove(path)
		return Attachment{}, err
	}
	id, _ := res.LastInsertId()
	return s.getAttachment(id)
}

func (s *Store) DeleteAttachment(id int64) error {
	a, err := s.getAttachment(id)
	if err != nil {
		return err
	}
	if err := affectedOrNotFound(s.db.Exec(`DELETE FROM attachments WHERE id = ?`, id)); err != nil {
		return err
	}
	if err := os.Remove(filepath.Join(s.attachmentsDir, a.storedName)); err != nil && !errors.Is(err, os.ErrNotExist) {
		log.Printf("remove attachment file: %v", err)
	}
	return nil
}

// CleanupAttachments deletes files whose rows are gone, e.g. after a task or project was
// deleted (the rows go with ON DELETE CASCADE, the files don't).
func (s *Store) CleanupAttachments() error {
	entries, err := os.ReadDir(s.attachmentsDir)
	if errors.Is(err, os.ErrNotExist) {
		return nil
	}
	if err != nil {
		return err
	}

	rows, err := s.db.Query(`SELECT stored_name FROM attachments`)
	if err != nil {
		return err
	}
	known := map[string]bool{}
	for rows.Next() {
		var name string
		if err := rows.Scan(&name); err != nil {
			rows.Close()
			return err
		}
		known[name] = true
	}
	rows.Close()

	for _, e := range entries {
		if e.Type().IsRegular() && !known[e.Name()] {
			if err := os.Remove(filepath.Join(s.attachmentsDir, e.Name())); err != nil {
				log.Printf("cleanup attachment %s: %v", e.Name(), err)
			}
		}
	}
	return nil
}

// cleanupAfterDelete is called after rows that may own attachments were deleted.
func (s *Store) cleanupAfterDelete() {
	if err := s.CleanupAttachments(); err != nil {
		log.Printf("cleanup attachments: %v", err)
	}
}

func randomName() string {
	b := make([]byte, 16)
	rand.Read(b)
	return hex.EncodeToString(b)
}

// cleanFilename keeps the user's file name for display only; it is never used as a path.
func cleanFilename(name, ext string) string {
	name = strings.TrimSpace(filepath.Base(strings.ReplaceAll(name, "\\", "/")))
	if name == "" || name == "." || name == "/" {
		name = "foto" + ext
	}
	for utf8.RuneCountInString(name) > 200 {
		_, size := utf8.DecodeLastRuneInString(name)
		name = name[:len(name)-size]
	}
	return name
}
