// Package api exposes the store over a JSON HTTP API under /api.
package api

import (
	"encoding/json"
	"errors"
	"io"
	"log"
	"net/http"
	"net/url"
	"os"
	"strconv"
	"strings"

	"jobplanner/internal/store"
)

type Server struct {
	store *store.Store
}

func New(s *store.Store) *Server { return &Server{store: s} }

// Register adds all /api routes to mux.
func (s *Server) Register(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/health", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
	})

	mux.HandleFunc("GET /api/projects", s.listProjects)
	mux.HandleFunc("POST /api/projects", s.createProject)
	mux.HandleFunc("GET /api/projects/{id}", s.getProject)
	mux.HandleFunc("PATCH /api/projects/{id}", s.updateProject)
	mux.HandleFunc("DELETE /api/projects/{id}", s.deleteProject)

	mux.HandleFunc("GET /api/today", s.today)
	mux.HandleFunc("GET /api/tasks", s.listTasks)
	mux.HandleFunc("POST /api/tasks", s.createTask)
	mux.HandleFunc("GET /api/tasks/{id}", s.getTask)
	mux.HandleFunc("PATCH /api/tasks/{id}", s.updateTask)
	mux.HandleFunc("DELETE /api/tasks/{id}", s.deleteTask)

	mux.HandleFunc("GET /api/tasks/{id}/attachments", s.listAttachments)
	mux.HandleFunc("POST /api/tasks/{id}/attachments", s.uploadAttachments)
	mux.HandleFunc("GET /api/attachments/{id}/file", s.attachmentFile)
	mux.HandleFunc("DELETE /api/attachments/{id}", s.deleteAttachment)

	mux.HandleFunc("GET /api/tags", s.listTags)
	mux.HandleFunc("POST /api/tags", s.createTag)
	mux.HandleFunc("GET /api/tags/{id}", s.getTag)
	mux.HandleFunc("PATCH /api/tags/{id}", s.updateTag)
	mux.HandleFunc("DELETE /api/tags/{id}", s.deleteTag)

	mux.HandleFunc("GET /api/boards", s.listBoards)
	mux.HandleFunc("POST /api/boards", s.createBoard)
	mux.HandleFunc("GET /api/boards/{id}", s.getBoard)
	mux.HandleFunc("PATCH /api/boards/{id}", s.renameBoard)
	mux.HandleFunc("DELETE /api/boards/{id}", s.deleteBoard)
	mux.HandleFunc("POST /api/boards/{id}/columns", s.createBoardColumn)
	mux.HandleFunc("PATCH /api/boards/{id}/columns/{columnId}", s.updateBoardColumn)
	mux.HandleFunc("DELETE /api/boards/{id}/columns/{columnId}", s.deleteBoardColumn)
	mux.HandleFunc("PUT /api/boards/{id}/items/{taskId}", s.placeTask)
	mux.HandleFunc("DELETE /api/boards/{id}/items/{taskId}", s.unplaceTask)

	mux.HandleFunc("GET /api/notes", s.listNotes)
	mux.HandleFunc("POST /api/notes", s.createNote)
	mux.HandleFunc("GET /api/notes/{id}", s.getNote)
	mux.HandleFunc("PATCH /api/notes/{id}", s.updateNote)
	mux.HandleFunc("DELETE /api/notes/{id}", s.deleteNote)

	mux.HandleFunc("/api/", func(w http.ResponseWriter, r *http.Request) {
		writeError(w, http.StatusNotFound, "endpoint not found")
	})
}

// --- projects ---

func (s *Server) listProjects(w http.ResponseWriter, r *http.Request) {
	respond(w, http.StatusOK)(s.store.ListProjects(r.URL.Query().Get("status")))
}

func (s *Server) getProject(w http.ResponseWriter, r *http.Request) {
	if id, ok := pathID(w, r); ok {
		respond(w, http.StatusOK)(s.store.GetProject(id))
	}
}

func (s *Server) createProject(w http.ResponseWriter, r *http.Request) {
	var in store.ProjectInput
	if decode(w, r, &in) {
		respond(w, http.StatusCreated)(s.store.CreateProject(in))
	}
}

func (s *Server) updateProject(w http.ResponseWriter, r *http.Request) {
	var p store.Patch
	if id, ok := pathID(w, r); ok && decode(w, r, &p) {
		respond(w, http.StatusOK)(s.store.UpdateProject(id, p))
	}
}

func (s *Server) deleteProject(w http.ResponseWriter, r *http.Request) {
	if id, ok := pathID(w, r); ok {
		respondEmpty(w, s.store.DeleteProject(id))
	}
}

// --- tasks ---

func (s *Server) today(w http.ResponseWriter, r *http.Request) {
	respond(w, http.StatusOK)(s.store.Today(r.URL.Query().Get("date")))
}

func (s *Server) listTasks(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	var f store.TaskFilter
	var ok bool
	if f.ProjectID, ok = queryID(w, q.Get("project_id"), "project_id"); !ok {
		return
	}
	if f.ParentID, ok = queryID(w, q.Get("parent_id"), "parent_id"); !ok {
		return
	}
	if f.TagID, ok = queryID(w, q.Get("tag_id"), "tag_id"); !ok {
		return
	}
	// ?from=YYYY-MM-DD&to=YYYY-MM-DD returns the tasks of a date range (week view).
	if from, to := q.Get("from"), q.Get("to"); from != "" || to != "" {
		respond(w, http.StatusOK)(s.store.TasksInRange(from, to))
		return
	}
	f.Inbox = queryBool(q.Get("inbox"))
	f.BacklogBefore = q.Get("backlog_before")
	respond(w, http.StatusOK)(s.store.ListTasks(f))
}

func (s *Server) getTask(w http.ResponseWriter, r *http.Request) {
	if id, ok := pathID(w, r); ok {
		respond(w, http.StatusOK)(s.store.GetTask(id))
	}
}

func (s *Server) createTask(w http.ResponseWriter, r *http.Request) {
	var in store.TaskInput
	if decode(w, r, &in) {
		respond(w, http.StatusCreated)(s.store.CreateTask(in))
	}
}

func (s *Server) updateTask(w http.ResponseWriter, r *http.Request) {
	var p store.Patch
	if id, ok := pathID(w, r); ok && decode(w, r, &p) {
		respond(w, http.StatusOK)(s.store.UpdateTask(id, p))
	}
}

func (s *Server) deleteTask(w http.ResponseWriter, r *http.Request) {
	if id, ok := pathID(w, r); ok {
		respondEmpty(w, s.store.DeleteTask(id))
	}
}

// --- attachments ---

func (s *Server) listAttachments(w http.ResponseWriter, r *http.Request) {
	if id, ok := pathID(w, r); ok {
		respond(w, http.StatusOK)(s.store.ListAttachments(id))
	}
}

// uploadAttachments accepts multipart/form-data with one or more "file" parts and
// streams each to disk, so large photos are never held in memory.
func (s *Server) uploadAttachments(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(w, r)
	if !ok {
		return
	}
	r.Body = http.MaxBytesReader(w, r.Body, 10*store.MaxAttachmentSize)
	mr, err := r.MultipartReader()
	if err != nil {
		writeError(w, http.StatusBadRequest, "expected multipart/form-data")
		return
	}
	added := []store.Attachment{}
	for {
		part, err := mr.NextPart()
		if errors.Is(err, io.EOF) {
			break
		}
		if err != nil {
			writeError(w, http.StatusBadRequest, "invalid upload")
			return
		}
		if part.FormName() != "file" {
			part.Close()
			continue
		}
		a, err := s.store.AddAttachment(id, part.FileName(), part)
		part.Close()
		if err != nil {
			writeStoreError(w, err)
			return
		}
		added = append(added, a)
	}
	if len(added) == 0 {
		writeError(w, http.StatusBadRequest, "no file uploaded")
		return
	}
	writeJSON(w, http.StatusCreated, added)
}

func (s *Server) attachmentFile(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(w, r)
	if !ok {
		return
	}
	a, path, err := s.store.AttachmentFile(id)
	if err != nil {
		writeStoreError(w, err)
		return
	}
	f, err := os.Open(path)
	if err != nil {
		writeStoreError(w, store.ErrNotFound)
		return
	}
	defer f.Close()
	info, err := f.Stat()
	if err != nil {
		writeStoreError(w, err)
		return
	}
	w.Header().Set("Content-Type", a.ContentType)
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.Header().Set("Content-Disposition", "inline; filename*=UTF-8''"+url.PathEscape(a.Filename))
	// Stored files never change, so the browser can keep them.
	w.Header().Set("Cache-Control", "private, max-age=31536000, immutable")
	http.ServeContent(w, r, "", info.ModTime(), f)
}

func (s *Server) deleteAttachment(w http.ResponseWriter, r *http.Request) {
	if id, ok := pathID(w, r); ok {
		respondEmpty(w, s.store.DeleteAttachment(id))
	}
}

// --- tags ---

func (s *Server) listTags(w http.ResponseWriter, r *http.Request) {
	respond(w, http.StatusOK)(s.store.ListTags())
}

func (s *Server) getTag(w http.ResponseWriter, r *http.Request) {
	if id, ok := pathID(w, r); ok {
		respond(w, http.StatusOK)(s.store.GetTag(id))
	}
}

func (s *Server) createTag(w http.ResponseWriter, r *http.Request) {
	var in store.TagInput
	if decode(w, r, &in) {
		respond(w, http.StatusCreated)(s.store.CreateTag(in))
	}
}

func (s *Server) updateTag(w http.ResponseWriter, r *http.Request) {
	var p store.Patch
	if id, ok := pathID(w, r); ok && decode(w, r, &p) {
		respond(w, http.StatusOK)(s.store.UpdateTag(id, p))
	}
}

func (s *Server) deleteTag(w http.ResponseWriter, r *http.Request) {
	if id, ok := pathID(w, r); ok {
		respondEmpty(w, s.store.DeleteTag(id))
	}
}

// --- boards ---

func (s *Server) listBoards(w http.ResponseWriter, r *http.Request) {
	respond(w, http.StatusOK)(s.store.ListBoards())
}

func (s *Server) getBoard(w http.ResponseWriter, r *http.Request) {
	if id, ok := pathID(w, r); ok {
		respond(w, http.StatusOK)(s.store.GetBoard(id))
	}
}

func (s *Server) createBoard(w http.ResponseWriter, r *http.Request) {
	var in store.NameInput
	if decode(w, r, &in) {
		respond(w, http.StatusCreated)(s.store.CreateBoard(in))
	}
}

func (s *Server) renameBoard(w http.ResponseWriter, r *http.Request) {
	var in store.NameInput
	if id, ok := pathID(w, r); ok && decode(w, r, &in) {
		respond(w, http.StatusOK)(s.store.RenameBoard(id, in))
	}
}

func (s *Server) deleteBoard(w http.ResponseWriter, r *http.Request) {
	if id, ok := pathID(w, r); ok {
		respondEmpty(w, s.store.DeleteBoard(id))
	}
}

func (s *Server) createBoardColumn(w http.ResponseWriter, r *http.Request) {
	var in store.NameInput
	if id, ok := pathID(w, r); ok && decode(w, r, &in) {
		respond(w, http.StatusCreated)(s.store.CreateBoardColumn(id, in))
	}
}

func (s *Server) updateBoardColumn(w http.ResponseWriter, r *http.Request) {
	var p store.Patch
	id, ok := pathID(w, r)
	if !ok {
		return
	}
	if columnID, ok := pathParamID(w, r, "columnId"); ok && decode(w, r, &p) {
		respond(w, http.StatusOK)(s.store.UpdateBoardColumn(id, columnID, p))
	}
}

func (s *Server) deleteBoardColumn(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(w, r)
	if !ok {
		return
	}
	if columnID, ok := pathParamID(w, r, "columnId"); ok {
		respondEmpty(w, s.store.DeleteBoardColumn(id, columnID))
	}
}

func (s *Server) placeTask(w http.ResponseWriter, r *http.Request) {
	var in store.PlaceInput
	id, ok := pathID(w, r)
	if !ok {
		return
	}
	if taskID, ok := pathParamID(w, r, "taskId"); ok && decode(w, r, &in) {
		respond(w, http.StatusOK)(s.store.PlaceTask(id, taskID, in))
	}
}

func (s *Server) unplaceTask(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(w, r)
	if !ok {
		return
	}
	if taskID, ok := pathParamID(w, r, "taskId"); ok {
		respondEmpty(w, s.store.UnplaceTask(id, taskID))
	}
}

// --- notes ---

func (s *Server) listNotes(w http.ResponseWriter, r *http.Request) {
	if pid, ok := queryID(w, r.URL.Query().Get("project_id"), "project_id"); ok {
		respond(w, http.StatusOK)(s.store.ListNotes(pid))
	}
}

func (s *Server) getNote(w http.ResponseWriter, r *http.Request) {
	if id, ok := pathID(w, r); ok {
		respond(w, http.StatusOK)(s.store.GetNote(id))
	}
}

func (s *Server) createNote(w http.ResponseWriter, r *http.Request) {
	var in store.NoteInput
	if decode(w, r, &in) {
		respond(w, http.StatusCreated)(s.store.CreateNote(in))
	}
}

func (s *Server) updateNote(w http.ResponseWriter, r *http.Request) {
	var p store.Patch
	if id, ok := pathID(w, r); ok && decode(w, r, &p) {
		respond(w, http.StatusOK)(s.store.UpdateNote(id, p))
	}
}

func (s *Server) deleteNote(w http.ResponseWriter, r *http.Request) {
	if id, ok := pathID(w, r); ok {
		respondEmpty(w, s.store.DeleteNote(id))
	}
}

// --- helpers ---

// respond returns a func that writes either the value or the mapped error,
// so handlers can pass a store call's (value, error) pair straight in.
func respond(w http.ResponseWriter, status int) func(any, error) {
	return func(v any, err error) {
		if err != nil {
			writeStoreError(w, err)
			return
		}
		writeJSON(w, status, v)
	}
}

func respondEmpty(w http.ResponseWriter, err error) {
	if err != nil {
		writeStoreError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func writeStoreError(w http.ResponseWriter, err error) {
	var ve *store.ValidationError
	switch {
	case errors.Is(err, store.ErrNotFound):
		writeError(w, http.StatusNotFound, "not found")
	case errors.As(err, &ve):
		writeError(w, http.StatusBadRequest, ve.Msg)
	case strings.Contains(err.Error(), "FOREIGN KEY constraint failed"):
		writeError(w, http.StatusBadRequest, "referenced record does not exist")
	default:
		log.Printf("internal error: %v", err)
		writeError(w, http.StatusInternalServerError, "internal error")
	}
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(v)
}

func writeError(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, map[string]string{"error": msg})
}

func decode(w http.ResponseWriter, r *http.Request, v any) bool {
	r.Body = http.MaxBytesReader(w, r.Body, 5<<20)
	if err := json.NewDecoder(r.Body).Decode(v); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON body")
		return false
	}
	return true
}

func pathID(w http.ResponseWriter, r *http.Request) (int64, bool) {
	return pathParamID(w, r, "id")
}

func pathParamID(w http.ResponseWriter, r *http.Request, name string) (int64, bool) {
	id, err := strconv.ParseInt(r.PathValue(name), 10, 64)
	if err != nil || id <= 0 {
		writeError(w, http.StatusBadRequest, "invalid "+name)
		return 0, false
	}
	return id, true
}

func queryBool(raw string) bool { return raw == "1" || raw == "true" }

// queryID parses an optional numeric query parameter; empty means "not set".
func queryID(w http.ResponseWriter, raw, name string) (*int64, bool) {
	if raw == "" {
		return nil, true
	}
	id, err := strconv.ParseInt(raw, 10, 64)
	if err != nil || id <= 0 {
		writeError(w, http.StatusBadRequest, "invalid "+name)
		return nil, false
	}
	return &id, true
}
