# CLAUDE.md

Bu dosya, bu repoda çalışan Claude oturumları için proje rehberidir. Kullanıcıya görünen metinler ve açıklamalar Türkçe; kod, tablo, alan ve değişken adları İngilizce.

## Proje

**jobPlanner**: Tek kullanıcılı, tamamen local çalışan görev ve not uygulaması. Kullanıcı günlük işlerini planlıyor, projelerinin görevlerini ve notlarını burada tutuyor.

- Login, çoklu kullanıcı, bulut ya da deploy yok. Uygulama tek binary olarak `127.0.0.1` üzerinde çalışır.
- Arayüz dili **Türkçe**. Tarihler `tr-TR` biçiminde gösterilir.
- GitHub: `ozkanyuksektepe/job-planner` (private), dal `main`.

## Komutlar (repo kökünden)

| Komut | İş |
|---|---|
| `make install` | `frontend/` bağımlılıklarını kurar |
| `make dev` | Go API `:8080` + Vite `:5173` (proxy `/api` → `:8080`). Geliştirmede http://localhost:5173 kullanılır |
| `make build` | Frontend'i `backend/internal/web/dist`'e derler, ardından `bin/jobplanner`'ı üretir |
| `make run` | `build` + binary'yi başlatır (http://127.0.0.1:8080) |

Doğrulama:
- Backend: `cd backend && go vet ./... && go build ./...`
- Frontend: `cd frontend && npm run build` (içinde `tsc -b` var; tip hatası build'i durdurur)

Go Homebrew ile kurulu: `/opt/homebrew/bin/go`. Shell'de bulunamazsa `export PATH="$PATH:/opt/homebrew/bin"`.

## Mimari

```
backend/  (Go modülü: jobplanner)
  cmd/jobplanner/main.go     flag'ler: -addr (JOBPLANNER_ADDR), -db (JOBPLANNER_DB)
  internal/db/               SQLite açma + gömülü migration'lar (schema_migrations tablosu)
  internal/store/            tüm SQL; Project / Task / Note tipleri, Patch, ValidationError, ErrNotFound
  internal/api/              net/http (Go 1.22+ desenleri: "GET /api/tasks/{id}"); store hatalarını HTTP koduna çevirir
  internal/web/              //go:embed all:dist; SPA fallback (bilinmeyen yol → index.html)
frontend/ (Vite + React 19 + TS + Tailwind v4)
  src/lib/api.ts             tipler + fetch istemcisi
  src/lib/hooks.ts           TanStack Query hook'ları ve query key'leri
  src/lib/dates.ts           local YYYY-MM-DD yardımcıları, tr-TR formatlama
  src/lib/theme.ts           açık/koyu/sistem tema (localStorage 'theme', <html class="dark">)
  src/lib/useTaskPanel.ts    görev detay paneli URL'de (?task=ID) tutulur
  src/components/ui.tsx      ortak primitive'ler: Button, Chip, CountPill, Segmented, Section, PageHeader, ProgressRing…
  src/pages/                 TodayPage, InboxPage, ProjectPage (tab: tasks|notes), NotesPage, NotePage
```

Rotalar: `/today`, `/inbox`, `/projects/:id`, `/projects/:id/notes`, `/notes`, `/notes/:id`.

## Veri modeli ve kurallar

- Tablolar: `projects`, `tasks`, `notes` (şema: `backend/internal/db/migrations/001_init.sql`).
- `tasks.parent_id` alt görevler içindir; **yalnızca bir seviye** (alt görevin alt görevi olmaz).
- Alt görev her zaman üst görevin projesindedir. Görevin projesi değişince alt görevleri de taşınır (`UpdateTask`).
- `priority`: 0 yok, 1 düşük, 2 orta, 3 yüksek. `status`: `todo` | `doing` | `done`. `done` olunca `completed_at` set edilir.
- Tarihler (`due_date`, `scheduled_date`) local `YYYY-MM-DD` string'leridir. "Bugün" tarihi **istemciden** gelir (`/api/today?date=`), sunucu saat dilimine güvenilmez. Timestamp'ler UTC ISO 8601.
- Gelen Kutusu = projesi ve `scheduled_date`'i olmayan üst seviye görevler.
- Proje silinince görevleri ve notları da silinir (`ON DELETE CASCADE`). Görev silinince alt görevleri de silinir.
- `notes.content` TipTap JSON'ı string olarak tutar.
- **PATCH semantiği:** yalnızca gönderilen alanlar değişir; `null` alanı temizler; bilinmeyen alan 400 döner. Yeni bir güncellenebilir alan eklerken `store` içindeki `buildSet` izin haritasına eklenmeli.
- **Şema değişikliği:** mevcut migration dosyasını asla düzenleme; yeni numaralı dosya ekle (`002_....sql`). Migration'lar sırayla ve bir kez uygulanır.
- Tek kullanıcı olduğundan `SetMaxOpenConns(1)` bilinçli bir tercih; SQLite WAL modunda.

## Frontend kuralları

- Task mutasyonları `['tasks']` ve `['projects']` sorgularını invalid eder (sayaçlar ve listeler güncel kalsın).
- Not editörü içeriğini kendisi yönetir: not güncellenince detay sorgusu **refetch edilmez**, `setQueryData` ile güncellenir; yalnızca listeler invalid edilir. Otomatik kayıt `NotePage` içindeki `useAutosave` ile (700 ms debounce, sayfadan çıkarken flush).
- TipTap v3: `@tiptap/starter-kit`, `@tiptap/extension-list` (TaskList/TaskItem), `@tiptap/extensions` (Placeholder).
- Onay diyalogları şimdilik `window.confirm`.

## Tasarım dili (kullanıcı onayladı, korunmalı)

- Inter yazı tipi; gri `canvas` zemin üzerinde sol menü, sağda yuvarlatılmış ve kenarlıklı `surface` içerik alanı (Linear/Notion tarzı).
- **Renkler yalnızca token'larla:** `bg-surface`, `bg-surface-2`, `bg-canvas`, `bg-hover`, `border-line`, `text-fg`, `text-fg-muted`, `text-fg-faint`, `bg-accent`, `bg-accent-soft`, `text-accent-fg`. Token'lar `frontend/src/index.css` içindeki `:root` ve `.dark` bloklarında. Ham renk (`zinc-…`, `indigo-…`) eklemekten kaçın; her yeni stil karanlık modda da çalışmalı.
- Yeni UI, `components/ui.tsx` primitive'lerini kullanmalı; yeni stil icat etmeden önce oraya bak.
- Kullanıcı, bilgiyi yalnızca renkle değil **etiketli badge (`Chip`)** ile göstermeyi tercih ediyor. Örnek: öncelik, görev satırının sağında "Düşük / Orta / Yüksek" badge'i (sky / orange / rose); görev kutucuğu nötr.
- Paneller ve diyaloglar: `rounded-2xl`, `animate-slide-in` / `animate-pop` / `animate-fade-in`.

## Kişisel veriler ve test

- Gerçek veritabanı: `~/.jobplanner/jobplanner.db` (proje dışında, `.gitignore` `*.db`'yi hariç tutar). Kullanıcı bunu DB Browser for SQLite ile inceliyor.
- **Testleri asla gerçek veritabanına karşı yapma.** Binary'yi geçici bir DB ve başka bir portla çalıştır: `./bin/jobplanner -addr 127.0.0.1:18080 -db <geçici-dizin>/test.db`.
- `backend/internal/web/dist/` ve `bin/` git'e girmez. `go:embed` için `dist` klasörü var olmalı: `make dev` bunu `.gitkeep` ile, `make build` ise önce frontend'i derleyerek sağlar.

## Yol haritası

- [x] Faz 1: Bugün, Gelen Kutusu, projeler, görevler, alt görevler, zengin notlar, açık/koyu tema, öncelik badge'leri
- [ ] Faz 2: Kanban görünümü (Todo/Doing/Done), sürükle-bırak (dnd-kit), haftalık planlama, etiketler
- [ ] Faz 3: `Cmd + K` arama ve hızlı ekleme, klavye kısayolları, otomatik DB yedeği, macOS'ta açılışta otomatik başlatma (launchd)

## Çalışma şekli

- Kullanıcı geliştirici; kararları birlikte veriyoruz. Büyük değişikliklerden önce planı kısaca anlat.
- Commit ve push yalnızca kullanıcı isteyince. Commit mesajları İngilizce.
- Kullanıcı arayüzde yapılan değişiklikleri görmek ister: UI değişikliklerinden sonra build alıp tarayıcıda (geçici DB ile) kontrol et.
