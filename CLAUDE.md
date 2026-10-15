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
  src/components/ui.tsx      ortak primitive'ler: Page, Button, Chip, CountPill, Segmented, Section, PageHeader, ProgressRing…
  src/components/TaskItem.tsx  liste satırı + paylaşılan parçalar: TaskCheckbox, PriorityBadge, TagChip, taskMetaChips()
  src/components/Board.tsx   dnd-kit ile sürükle-bırak sütunlu pano (kanban ve hafta görünümü bunu paylaşır)
  src/components/TagPicker.tsx  görev panelinde etiket seç / oluştur açılır menüsü
  src/components/NameDialog.tsx  tek alanlı isim diyaloğu (pano / alan oluşturma ve yeniden adlandırma)
  src/components/FilterBar.tsx   proje / öncelik / durum / etiket filtre çubuğu
  src/lib/filters.ts         useTaskFilters(): filtre durumu URL'de, apply() ve yeni görev için defaults
  src/pages/                 TodayPage, InboxPage, WeekPage, BoardPage, ProjectPage (tab: tasks|notes, görünüm: liste|pano),
                             TagPage, NotesPage, NotePage
```

Rotalar: `/today`, `/inbox`, `/week`, `/boards/:id`, `/projects/:id`, `/projects/:id/notes`, `/tags/:id`, `/notes`, `/notes/:id`.

Her sayfa içeriğini `<Page width="narrow|wide|full">` ile sarar; pano görünümleri daha geniş alan kullanır.

## Veri modeli ve kurallar

- Tablolar: `projects`, `tasks`, `notes` (`001_init.sql`), `tags`, `task_tags` (`002_tags.sql`), `boards`, `board_columns`, `board_items` (`003_boards.sql`).
- **Panolar (kullanıcı tanımlı):** Pano = kullanıcının adlandırdığı alanlar (`board_columns`). Görevin panodaki yeri `board_items` (pano başına bir satır, kendi `sort_order`'ı). `column_id` NULL: panoda ama alanda değil → açıksa "Planlanmamış"ta, bittiyse "Tamamlananlar"da görünür. "Planlanmamış" sütunu = alanı olmayan açık üyeler + `unplaced` (panoda olmayan, `scheduled_date`'i olmayan açık üst görevler). "Tamamlananlar" = panodaki `done` görevler, `completed_at`'e göre yeniden eskiye. Alan silinince görevler `ON DELETE SET NULL` ile Planlanmamış'a döner; pano silinince görevler silinmez. Bir görev aynı anda proje, etiket ve birden çok panoda olabilir.
- `tasks.parent_id` alt görevler içindir; **yalnızca bir seviye** (alt görevin alt görevi olmaz).
- Alt görev her zaman üst görevin projesindedir. Görevin projesi değişince alt görevleri de taşınır (`UpdateTask`).
- `priority`: 0 yok, 1 düşük, 2 orta, 3 yüksek. `status`: `todo` | `doing` | `done`. `done` olunca `completed_at` set edilir.
- Tarihler (`due_date`, `scheduled_date`) local `YYYY-MM-DD` string'leridir. "Bugün" tarihi **istemciden** gelir (`/api/today?date=`), sunucu saat dilimine güvenilmez. Timestamp'ler UTC ISO 8601.
- Gelen Kutusu = projesi ve `scheduled_date`'i olmayan üst seviye görevler.
- Proje silinince görevleri ve notları da silinir (`ON DELETE CASCADE`). Görev silinince alt görevleri de silinir.
- `notes.content` TipTap JSON'ı string olarak tutar.
- **Etiketler:** isim benzersiz ve büyük/küçük harfe duyarsız; `POST /api/tags` aynı isim varsa mevcut etiketi döndürür. Görevin etiketleri `tag_ids` ile **tamamen değiştirilir** (create ve PATCH'te). Her görev JSON'ında `tags: [{id,name,color}]` gelir (`attachTags` ek bir sorguyla doldurur). Etiket silinince görevler silinmez.
- **Görevin günü (Bugün ve hafta görünümü):** `scheduled_date` → yoksa `due_date` → yoksa (üst görevlerde) `created_at`'in **yerel** günü. Backend'de `taskDaySQL`, frontend'de `taskDay()` (lib/dates.ts); ikisi aynı kalmalı. Bugün listesi = günü bugün olanlar + son tarihi bugün olanlar. Görevlere otomatik `scheduled_date` yazılmaz (Gelen Kutusu bozulmasın diye); oluşturulma günü yalnızca gösterim için kullanılır. Gecikmiş listesi sadece gerçek tarihlere (`scheduled_date` / `due_date`) bakar.
- **Hafta sorguları:** `GET /api/tasks?from=&to=` günü aralığa düşen görevleri tamamlananlar dahil döner (tarihi olan alt görevler de gelir). `?backlog_before=` günü o tarihten önce olan açık üst görevleri döner ("Bekleyenler" sütunu). Bekleyenler'e sürüklemek `scheduled_date`'i temizler. `?tag_id=` alt görevleri de içerir.
- `queryTasks` satırları kapattıktan **sonra** ek sorgu yapar: havuzda tek bağlantı olduğu için açık `rows` varken ikinci sorgu kilitlenir. Yeni sorgu yazarken buna dikkat et.
- **PATCH semantiği:** yalnızca gönderilen alanlar değişir; `null` alanı temizler; bilinmeyen alan 400 döner. Yeni bir güncellenebilir alan eklerken `store` içindeki `buildSet` izin haritasına eklenmeli.
- **Şema değişikliği:** mevcut migration dosyasını asla düzenleme; yeni numaralı dosya ekle (`002_....sql`). Migration'lar sırayla ve bir kez uygulanır.
- Tek kullanıcı olduğundan `SetMaxOpenConns(1)` bilinçli bir tercih; SQLite WAL modunda.

## Frontend kuralları

- Task mutasyonları `['tasks']` ve `['projects']` sorgularını invalid eder (sayaçlar ve listeler güncel kalsın).
- Not editörü içeriğini kendisi yönetir: not güncellenince detay sorgusu **refetch edilmez**, `setQueryData` ile güncellenir; yalnızca listeler invalid edilir. Otomatik kayıt `NotePage` içindeki `useAutosave` ile (700 ms debounce, sayfadan çıkarken flush).
- TipTap v3: `@tiptap/starter-kit`, `@tiptap/extension-list` (TaskList/TaskItem), `@tiptap/extensions` (Placeholder).
- **Board:** `columns` prop'u çağıran tarafta `useMemo` ile üretilmeli; yeni dizi gelince yerel sıralama sunucu verisine sıfırlanır. Bırakınca `onMove({task, columnId, before, after, changedColumn})` çağrılır; yeni sıra `sortOrderBetween(before, after)` ile komşuların ortası olarak hesaplanır. Kanban'da sütun = `status`, hafta görünümünde sütun = gün (`backlog` sütunu "Bekleyenler": tarihi temizler ve `pinned` ile solda sabit durur). Kartlardaki checkbox `onPointerDown`'u durdurur ki tıklama sürüklemeyi başlatmasın.
- Proje görünüm tercihi (liste/pano) `localStorage` `projectView` anahtarında.
- **Filtreler** tamamen istemci tarafında: `useTaskFilters(hidden)` URL parametrelerini okur (`?project=1,none&priority=3&status=todo&tag=2`; aynı filtre içinde VEYA, filtreler arasında VE). Anlamsız olduğu sayfada filtre `hidden` ile gizlenir (proje sayfasında `project`, kanban'da ayrıca `status`, Gelen Kutusu'nda `project`, etiket sayfasında `tag`). `apply` ve `defaults` filtre değişmedikçe kararlıdır, Board `columns` memo'sunda kullanılabilir. Filtre açıkken QuickAdd'e `filter.defaults` verilir ki yeni görev filtreye uysun. Yeni bir görev listesi sayfası eklenirse FilterBar'ı da ekle.
- `BoardPage` checkbox davranışını `TaskCompleteContext` ile devralır: işaretlenen görev panoda değilse `column_id: null` ile panoya eklenir, böylece Tamamlananlar'a düşer; işaret kaldırılınca eski alanına döner. Context yoksa checkbox sadece durumu değiştirir.
- `useMemo` bağımlılıklarına mutasyon nesnesi (`useMutation()` sonucu) koyma; her durum değişiminde yenilenir ve Board'u sıfırlar. Kararlı olan `mutate` fonksiyonunu kullan.
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
- [x] Faz 2: Etiketler, proje kanban görünümü (sürükle-bırak ile durum ve sıra), haftalık planlama (günlere sürükle-bırak), kullanıcı tanımlı panolar (alanlar + Planlanmamış + Tamamlananlar). Liste görünümünde sürükleyerek sıralama ve pano alanlarını sürükleyerek yeniden sıralama henüz yok.
- [ ] Faz 3: `Cmd + K` arama ve hızlı ekleme, klavye kısayolları, otomatik DB yedeği, macOS'ta açılışta otomatik başlatma (launchd)

## Çalışma şekli

- Kullanıcı geliştirici; kararları birlikte veriyoruz. Büyük değişikliklerden önce planı kısaca anlat.
- Commit ve push yalnızca kullanıcı isteyince. Commit mesajları İngilizce.
- Kullanıcı arayüzde yapılan değişiklikleri görmek ister: UI değişikliklerinden sonra build alıp tarayıcıda (geçici DB ile) kontrol et.
