// Package web serves the React build that is embedded into the binary.
// `npm run build` in frontend/ writes its output to internal/web/dist.
package web

import (
	"embed"
	"io/fs"
	"net/http"
	"path"
	"strings"
)

//go:embed all:dist
var dist embed.FS

// Handler serves static files and falls back to index.html for client-side routes.
func Handler() http.Handler {
	files, _ := fs.Sub(dist, "dist")
	index, err := fs.ReadFile(files, "index.html")
	if err != nil {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "text/plain; charset=utf-8")
			w.Write([]byte("Frontend henüz build edilmedi.\n" +
				"Geliştirme için `make dev` çalıştırıp http://localhost:5173 adresini aç,\n" +
				"ya da `make build` ile tek binary üret.\n"))
		})
	}

	fileServer := http.FileServerFS(files)
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		name := strings.TrimPrefix(path.Clean(r.URL.Path), "/")
		if name != "" && name != "index.html" {
			if f, err := files.Open(name); err == nil {
				f.Close()
				if strings.HasPrefix(name, "assets/") {
					// Vite adds content hashes to asset names, so they can be cached forever.
					w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
				}
				fileServer.ServeHTTP(w, r)
				return
			}
		}
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		w.Header().Set("Cache-Control", "no-cache")
		w.Write(index)
	})
}
