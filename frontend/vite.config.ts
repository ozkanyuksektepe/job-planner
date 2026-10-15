import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // During development the Go server runs on :8080 and serves the API.
    proxy: { '/api': 'http://127.0.0.1:8080' },
  },
  build: {
    // The Go binary embeds this folder (see backend/internal/web).
    outDir: '../backend/internal/web/dist',
    emptyOutDir: true,
    // Served from localhost, so a single larger bundle is fine.
    chunkSizeWarningLimit: 1500,
  },
})
