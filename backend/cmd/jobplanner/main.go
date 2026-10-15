package main

import (
	"context"
	"errors"
	"flag"
	"log"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"syscall"
	"time"

	"jobplanner/internal/api"
	"jobplanner/internal/db"
	"jobplanner/internal/store"
	"jobplanner/internal/web"
)

func main() {
	addr := flag.String("addr", envOr("JOBPLANNER_ADDR", "127.0.0.1:8080"), "listen address")
	dbPath := flag.String("db", envOr("JOBPLANNER_DB", defaultDBPath()), "SQLite database file")
	flag.Parse()

	conn, err := db.Open(*dbPath)
	if err != nil {
		log.Fatalf("open database: %v", err)
	}
	defer conn.Close()

	mux := http.NewServeMux()
	api.New(store.New(conn)).Register(mux)
	mux.Handle("/", web.Handler())

	srv := &http.Server{
		Addr:              *addr,
		Handler:           logRequests(mux),
		ReadHeaderTimeout: 10 * time.Second,
	}

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	go func() {
		log.Printf("jobPlanner http://%s adresinde çalışıyor (db: %s)", *addr, *dbPath)
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Fatalf("server: %v", err)
		}
	}()

	<-ctx.Done()
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	srv.Shutdown(shutdownCtx)
}

// defaultDBPath keeps personal data outside the repository: ~/.jobplanner/jobplanner.db
func defaultDBPath() string {
	home, err := os.UserHomeDir()
	if err != nil {
		return filepath.Join("data", "jobplanner.db")
	}
	return filepath.Join(home, ".jobplanner", "jobplanner.db")
}

func envOr(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func logRequests(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		next.ServeHTTP(w, r)
		if len(r.URL.Path) >= 5 && r.URL.Path[:5] == "/api/" {
			log.Printf("%s %s %s", r.Method, r.URL.RequestURI(), time.Since(start).Round(time.Millisecond))
		}
	})
}
