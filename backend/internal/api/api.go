// Package api exposes the store over a JSON HTTP API under /api.
package api

import (
	"encoding/json"
	"errors"
	"log"
	"net/http"
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
	f.Inbox = q.Get("inbox") == "1" || q.Get("inbox") == "true"
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
		writeError(w, http.StatusBadRequest, "referenced project or task does not exist")
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
	id, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil || id <= 0 {
		writeError(w, http.StatusBadRequest, "invalid id")
		return 0, false
	}
	return id, true
}

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
