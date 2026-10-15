# jobPlanner

Kişisel kullanım için geliştirilmiş, tamamen **local** çalışan bir görev ve not uygulaması. Günlük işleri planlamak, projelerin görevlerini ve notlarını tek yerde tutmak için tasarlandı.

Tek kullanıcılıdır; giriş sistemi ve sunucu gerektirmez. Uygulama tek bir dosya (binary) olarak çalışır, veriler bilgisayardaki bir SQLite dosyasında saklanır.

## Özellikler

- **Bugün:** Bugüne planlanan, son tarihi bugün olan ya da tarihsiz olup bugün açılan görevler; gecikmiş işler ve günlük ilerleme halkası
- **Gelen Kutusu:** Henüz bir projeye ya da güne atanmamış işler; aklına geleni hızlıca yazıp sonra planlamak için
- **Bu Hafta:** Pazartesi'den Pazar'a gün sütunları. Her görev planlandığı güne (yoksa son tarihine, o da yoksa açıldığı güne) düşer; tamamlananlar işaretli görünür. Önceki haftalardan kalan açık işler solda "Bekleyenler"de durur; görevler sürükleyerek başka güne taşınabilir
- **Panolar:** Kendi adlandırdığın alanlardan (ör. Yapılacaklar, Önemli) oluşan sürükle-bırak panolar. Solda Planlanmamış, en sağda Tamamlananlar; işaretlenen görev otomatik olarak Tamamlananlar'a geçer
- **Projeler:** Renk, açıklama, ilerleme çubuğu, arşivleme; her projenin kendi görevleri ve notları. Görevler liste ya da durum sütunlu kanban panosu olarak görüntülenebilir
- **Etiketler:** Görevlere renkli etiketler; her etiketin kendi sayfası
- **Filtreleme:** Tüm görev listelerinde ve panolarda projeye, önceliğe, duruma ve etikete göre çoklu filtre. Filtreler adres çubuğunda saklanır; filtre açıkken eklenen görev seçili proje, öncelik ve etiketleri otomatik alır
- **Görevler:** Durum (yapılacak / devam ediyor / tamamlandı), öncelik (düşük / orta / yüksek), planlanan gün, son tarih, açıklama
- **Alt görevler:** Görevleri parçalara bölme ve ilerlemeyi takip etme
- **Sesle görev ekleme:** Ekle kutularındaki mikrofon düğmesi, macOS diktesiyle (klavyedeki mikrofon tuşu) konuşarak görev yazmayı kolaylaştırır: tıklayınca kutuya odaklanır ve dikte tuşu ipucunu gösterir
- **Fotoğraflar:** Görevlere fotoğraf ekleme (dosya seçerek, sürükle-bırak ya da ⌘V ile yapıştırarak), büyük görüntüleme ve indirme. PNG, JPEG, GIF ve WebP; fotoğraf başına en fazla 20 MB
- **Notlar:** Notion benzeri zengin metin editörü (başlıklar, listeler, yapılacaklar listesi, alıntı, kod bloğu), Markdown kısayolları ve otomatik kayıt
- **Ses kayıtları:** Görevlere ve notlara mikrofondan ses kaydı (duraklat / devam et, canlı ses seviyesi). Oynatıcıda başlat/duraklat, ilerleme çubuğu, ±10 sn, 0.75x–2x hız, indirme. Ses yazıya çevrilmez ve bilgisayardan dışarı çıkmaz; kayıt başına en fazla 30 dakika
- **Tema:** Açık, koyu ya da sistem temasını takip eden görünüm

## Teknolojiler

| Katman | Teknoloji |
|---|---|
| Backend | Go (standart `net/http`) |
| Veritabanı | SQLite ([modernc.org/sqlite](https://pkg.go.dev/modernc.org/sqlite), CGO gerektirmez) |
| Frontend | React, TypeScript, Vite |
| Arayüz | Tailwind CSS, lucide ikonları, Inter yazı tipi |
| Veri yönetimi | TanStack Query |
| Sürükle-bırak | dnd-kit |
| Not editörü | TipTap |

Frontend build edildikten sonra `go:embed` ile Go binary'sinin içine gömülür. Bu yüzden uygulamayı çalıştırmak için tek bir dosya yeterlidir.

## Gereksinimler

- [Go](https://go.dev/dl/) 1.27 veya üstü
- [Node.js](https://nodejs.org/) 20 veya üstü (npm ile birlikte)
- `make` (macOS'ta Xcode Command Line Tools ile gelir)

macOS'ta Homebrew ile Go kurulumu:

```bash
brew install go
```

## Kurulum ve çalıştırma

Projeyi klonla ve frontend bağımlılıklarını kur:

```bash
git clone https://github.com/ozkanyuksektepe/job-planner.git
cd job-planner
make install
```

Uygulamayı derleyip başlat:

```bash
make run
```

Ardından tarayıcıda **http://127.0.0.1:8080** adresini aç. Durdurmak için terminalde `Ctrl + C`.

Daha önce derlediysen binary'yi doğrudan da çalıştırabilirsin:

```bash
./bin/jobplanner
```

### Make komutları

| Komut | Açıklama |
|---|---|
| `make install` | Frontend bağımlılıklarını kurar |
| `make run` | Derler ve uygulamayı `127.0.0.1:8080` adresinde başlatır |
| `make build` | Frontend'i derler ve tek binary'yi `bin/jobplanner` olarak üretir |
| `make dev` | Geliştirme modu: Go API'si (`:8080`) ve Vite (`:5173`) birlikte çalışır |
| `make clean` | Build çıktılarını siler |

## Geliştirme

```bash
make dev
```

Bu komutla **http://localhost:5173** adresini aç. Frontend'de yaptığın değişiklikler sayfayı yenilemeden anında görünür. Vite, `/api` isteklerini Go sunucusuna yönlendirir. Go tarafında bir değişiklik yaptığında `make dev` komutunu yeniden başlatman gerekir.

## Veriler ve yedekleme

Veritabanı varsayılan olarak proje klasörünün **dışında** tutulur. Böylece kodu silsen ya da yeniden klonlasan bile verilerin etkilenmez:

```
~/.jobplanner/jobplanner.db       veritabanı
~/.jobplanner/attachments/        fotoğraflar ve ses kayıtları
```

- `.jobplanner` gizli bir klasördür. Finder'da görmek için `Cmd + Shift + .` tuşlarına bas ya da terminalde `open ~/.jobplanner` komutunu çalıştır.
- Klasörde `jobplanner.db-wal` ve `jobplanner.db-shm` dosyaları da bulunur. Bunlar SQLite'ın çalışma dosyalarıdır, silme.
- **Yedek almak için** uygulamayı durdur ve `~/.jobplanner` klasörünün **tamamını** kopyala (veritabanı dosyaları ve `attachments` klasörü birlikte).
- Veritabanını incelemek için [DB Browser for SQLite](https://sqlitebrowser.org/) kullanılabilir. Elle düzenleme yapmadan önce uygulamayı durdur.
- `.db` dosyaları `.gitignore` ile hariç tutulur; kişisel verilerin repoya gönderilmez.

## Ayarlar

Uygulama parametrelerle ya da ortam değişkenleriyle yapılandırılabilir:

| Parametre | Ortam değişkeni | Varsayılan | Açıklama |
|---|---|---|---|
| `-addr` | `JOBPLANNER_ADDR` | `127.0.0.1:8080` | Dinlenecek adres ve port |
| `-db` | `JOBPLANNER_DB` | `~/.jobplanner/jobplanner.db` | Veritabanı dosyasının yolu |

Örnek:

```bash
./bin/jobplanner -addr 127.0.0.1:9090 -db ./data/jobplanner.db
```

Uygulama varsayılan olarak yalnızca `127.0.0.1` üzerinden dinler; ağdaki diğer cihazlar erişemez.

## Proje yapısı

```
job-planner/
├── Makefile
├── backend/
│   ├── cmd/jobplanner/        # main: sunucuyu başlatır
│   └── internal/
│       ├── api/               # HTTP handler'ları (/api/...)
│       ├── db/                # SQLite bağlantısı ve migration'lar
│       │   └── migrations/    # SQL şema dosyaları
│       ├── store/             # Veritabanı sorguları (projeler, görevler, notlar)
│       └── web/               # Gömülü frontend'i sunar
└── frontend/
    └── src/
        ├── components/        # Ortak bileşenler (görev satırı, görev paneli, editör…)
        ├── pages/             # Sayfalar (Bugün, Gelen Kutusu, Proje, Notlar)
        ├── lib/               # API istemcisi, React Query hook'ları, tarih ve tema yardımcıları
        └── index.css          # Tasarım token'ları (renkler, açık/koyu tema)
```

Renk paletini değiştirmek için `frontend/src/index.css` dosyasındaki `:root` (açık tema) ve `.dark` (koyu tema) bloklarını düzenlemek yeterlidir.

## API

Tüm uç noktalar JSON alıp döndürür ve `/api` altındadır.

| Metot | Yol | Açıklama |
|---|---|---|
| `GET` | `/api/today?date=YYYY-MM-DD` | Günün görevleri ve gecikmiş görevler |
| `GET` | `/api/projects?status=active\|archived` | Projeleri listeler |
| `POST` | `/api/projects` | Proje oluşturur |
| `GET` `PATCH` `DELETE` | `/api/projects/{id}` | Proje detayı, güncelleme, silme (görevleri ve notlarıyla birlikte) |
| `GET` | `/api/tasks?project_id=&parent_id=&tag_id=&inbox=1` | Görevleri listeler |
| `GET` | `/api/tasks?from=YYYY-MM-DD&to=YYYY-MM-DD` | Günü bu aralığa düşen görevler, tamamlananlar dahil (gün: planlanan gün, yoksa son tarih, yoksa açıldığı gün) |
| `GET` | `/api/tasks?backlog_before=YYYY-MM-DD` | Günü bu tarihten önce olan açık görevler (Bekleyenler) |
| `POST` | `/api/tasks` | Görev ya da alt görev oluşturur |
| `GET` `PATCH` `DELETE` | `/api/tasks/{id}` | Görev detayı, güncelleme, silme (alt görevleriyle birlikte) |
| `GET` | `/api/tasks/{id}/attachments`, `/api/notes/{id}/attachments` | Görevin / notun fotoğraf ve ses kayıtlarını listeler |
| `POST` | `/api/tasks/{id}/attachments`, `/api/notes/{id}/attachments` | Dosya yükler (`multipart/form-data`: bir ya da daha çok `file`; ses için önce isteğe bağlı `duration_ms`) |
| `GET` | `/api/attachments/{id}/file` | Dosyayı döndürür (ileri sarma için Range desteğiyle) |
| `DELETE` | `/api/attachments/{id}` | Eki siler |
| `GET` `POST` | `/api/tags` | Etiketleri listeler / oluşturur (aynı isim varsa mevcut etiketi döndürür) |
| `GET` `PATCH` `DELETE` | `/api/tags/{id}` | Etiket detayı, güncelleme, silme (görevler silinmez) |
| `GET` `POST` | `/api/boards` | Panoları listeler / oluşturur |
| `GET` `PATCH` `DELETE` | `/api/boards/{id}` | Pano detayı (alanlar, yerleşimler, görevler), yeniden adlandırma, silme |
| `POST` | `/api/boards/{id}/columns` | Panoya alan ekler |
| `PATCH` `DELETE` | `/api/boards/{id}/columns/{columnId}` | Alanı yeniden adlandırır / siler (görevler Planlanmamış'a döner) |
| `PUT` `DELETE` | `/api/boards/{id}/items/{taskId}` | Görevi panoda bir alana yerleştirir / panodan çıkarır |
| `GET` | `/api/notes?project_id=` | Notları listeler |
| `POST` | `/api/notes` | Not oluşturur |
| `GET` `PATCH` `DELETE` | `/api/notes/{id}` | Not detayı, güncelleme, silme |

`PATCH` istekleri yalnızca gönderilen alanları günceller. Örneğin bir görevi tamamlamak için:

```bash
curl -X PATCH http://127.0.0.1:8080/api/tasks/1 -d '{"status":"done"}'
```

Görevin etiketleri `tag_ids` ile tamamen değiştirilir: `{"tag_ids": [1, 3]}`.

## Yol haritası

- [x] **Faz 1:** Bugün ekranı, Gelen Kutusu, projeler, görevler, alt görevler, zengin metinli notlar, açık/koyu tema
- [x] **Faz 2:** Etiketler, proje kanban görünümü, haftalık planlama, kendi alanlarınla panolar (hepsinde sürükle-bırak)
- [ ] **Faz 3:** `Cmd + K` ile arama ve hızlı ekleme, klavye kısayolları, otomatik veritabanı yedeği, bilgisayar açılınca otomatik başlatma
