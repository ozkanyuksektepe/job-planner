BIN  := bin/jobplanner
DIST := backend/internal/web/dist

.PHONY: install dev dev-api dev-web build run clean

## install: install frontend dependencies
install:
	cd frontend && npm install

# go:embed needs the dist folder to exist even before the first frontend build.
$(DIST)/.gitkeep:
	@mkdir -p $(DIST) && touch $@

## dev: run Go API (:8080) and Vite (:5173) together, open http://localhost:5173
dev: $(DIST)/.gitkeep
	@$(MAKE) -j2 dev-api dev-web

dev-api: $(DIST)/.gitkeep
	cd backend && go run ./cmd/jobplanner

dev-web:
	cd frontend && npm run dev

## build: build the frontend and embed it into a single binary at bin/jobplanner
build:
	cd frontend && npm run build
	cd backend && go build -o ../$(BIN) ./cmd/jobplanner

## run: build and start the app at http://127.0.0.1:8080
run: build
	./$(BIN)

clean:
	rm -rf bin $(DIST)
