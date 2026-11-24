# Product Requirements Document (PRD): LWS (Last War Scanner)

*   **Nama Proyek:** `lws` (Last War Scanner)
*   **Versi Dokumen:** 1.0 (Fase 1 — MVP)
*   **Repositori:** `https://github.com/StevenLiem01/lws`
*   **Status:** Ready for Implementation

---

## 1. Overview & Goals

### 1.1 Latar Belakang & Tujuan
**LWS** adalah sistem intelijen peta berbasis web (*web dashboard*) untuk *Last War: Survival* yang dirancang secara *decoupled* (memisahkan proses pengumpulan data dari antarmuka pengguna). Fokus utama Fase 1 adalah menyajikan data target **Unshielded** dan **Shield Expiring** dengan *countdown* akurat berbasis *exact UTC timestamp* (Jalur A), dilengkapi *graceful error handling* agar dashboard tetap stabil meskipun proses *scanning* mengalami gangguan.

### 1.2 Ruang Lingkup (*Scope*)
*   **In-Scope (Fase 1 — MVP):**
    1.  **Unshielded Targets:** Daftar *base* tanpa *shield* aktif, lengkap dengan filter (HQ Level, Tag Aliansi, pencarian nama) dan tombol *copy* koordinat `(x, y)` sekali klik.
    2.  **Shield Expiring (Exact Countdown):** Daftar *base* dengan *shield* aktif yang diurutkan dari waktu habis tercepat, menggunakan *live countdown* di sisi *client* berdasarkan UTC *timestamp*.
    3.  **Scanner Health & Graceful Error Handling:** Indikator status *worker* (`idle`, `scanning`, `rate_limited`, `error`), waktu *scan* terakhir, *retry* dengan *exponential backoff*, dan *circuit breaker*.
    4.  **Mock Data Seeder:** Skrip pengisi data simulasi untuk memvalidasi seluruh *use-case* dan *end-to-end testing* sebelum integrasi *live collector*.
*   **Out-of-Scope (Fase 2 — Roadmap Mendatang):**
    *   Pemindaian **Secret Tasks (Plunderable)** skala 1 server, diikuti perluasan *Cross-Server*.
    *   Integrasi bot Discord dan *in-game coordinate delivery*.
    *   Sistem autentikasi pengguna publik / multi-tenant (Fase 1 ditujukan untuk penggunaan personal/internal).

### 1.3 User Scenarios
1.  **Mencari Target Terbuka:** Pengguna membuka dashboard, memilih `server_id`, masuk ke tab **Unshielded**, memfilter `HQ >= 25` dan mengecualikan/mencari aliansi tertentu, lalu menyalin koordinat `(x, y)` dengan satu klik.
2.  **Memantau Shield Akan Habis:** Pengguna membuka tab **Shield Expiring**, melihat urutan *base* yang *shield*-nya habis paling cepat beserta penanda warna urgensi (`< 15 menit` merah, `< 1 jam` kuning), dan melihat *countdown* berjalan *real-time* tanpa perlu *refresh* halaman.
3.  **Menghadapi Gangguan Scanner:** Ketika *worker* terkena *rate limit* atau *offline*, pengguna tetap dapat melihat data *scan* terakhir disertai *banner* peringatan jelas (misal: *"Scanner sedang jeda (Rate Limited) — Data terakhir 14 menit lalu"*).

---

## 2. Tech Stack Selection

| Lapisan | Teknologi & Versi | Peran & Alasan Pemilihan |
| :--- | :--- | :--- |
| **Frontend (Web Dashboard)** | **Next.js (App Router) + React + TypeScript + Tailwind CSS** (Node.js `v22.18.0`, npm `10.9.3`) | Mendukung rendering cepat, *strong typing*, desain responsif *dark-mode*, serta perhitungan *live countdown* lokal di browser. |
| **Backend API** | **Python `3.11.9` + FastAPI + SQLAlchemy + Pydantic v2 + Uvicorn** | Validasi skema ketat, performa tinggi untuk *batch upsert*, serta dokumentasi OpenAPI otomatis di `/docs`. |
| **Database** | **PostgreSQL (Supabase — Region Singapore `ap-southeast-1`)** | Optimal untuk *indexing* filter kombinasi (`server_id`, `hq_level`, `is_shielded`, `shield_expires_at`). Diakses langsung via **Session Pooler URI** (port `5432`), dengan *Supabase Data API* dinonaktifkan demi keamanan. |
| **Worker / Collector** | **Python `3.11.9`** (proses terpisah di folder `worker/`) | Terisolasi dari web; menjalankan *mock seeder* (tahap uji) dan *live collector* (Jalur A) dengan *retry/backoff* serta *circuit breaker*. |
| **Testing & Quality** | **Pytest + HTTPX** (Backend), **Playwright / Vitest** (Frontend E2E) | Memastikan seluruh *test-case* API, logika *countdown*, dan *error state* UI lulus otomatis. |
| **IDE & Version Control** | **Antigravity IDE**, **Git `2.51.0`**, **GitHub (`StevenLiem01/lws`)** | Lingkungan pengembangan terpusat dalam satu *monorepo*. |
| **Hosting (Free-Tier)** | **Vercel** (Frontend), **Render / Railway** (Backend), **PC Lokal / VPS** (Worker) | Biaya operasional Rp 0 untuk skala Fase 1. |

---

## 3. Data Model / Schema

Seluruh *timestamp* wajib disimpan dalam format **UTC (`TIMESTAMPTZ`)**.

### 3.1 Tabel `map_bases`
Menyimpan kondisi terakhir setiap *base* pemain hasil pemindaian peta.

| Kolom | Tipe Data | Constraint | Deskripsi |
| :--- | :--- | :--- | :--- |
| `server_id` | `INTEGER` | `PRIMARY KEY (1)` | ID server tempat *base* berada. |
| `uid` | `VARCHAR(32)` | `PRIMARY KEY (2)` | ID unik pemain (16 digit string). |
| `name` | `VARCHAR(100)` | `NOT NULL` | Nama tampilan pemain. |
| `alliance_tag` | `VARCHAR(16)` | `NULL` | Tag aliansi (misal `FRY`), `NULL` jika tanpa aliansi. |
| `hq_level` | `SMALLINT` | `NOT NULL, CHECK (hq_level >= 1)` | Level Headquarters pemain. |
| `x` | `SMALLINT` | `NOT NULL, CHECK (x BETWEEN 0 AND 999)` | Koordinat X peta. |
| `y` | `SMALLINT` | `NOT NULL, CHECK (y BETWEEN 0 AND 999)` | Koordinat Y peta. |
| `is_shielded` | `BOOLEAN` | `NOT NULL, DEFAULT FALSE` | Status *shield* saat *scan* terakhir. |
| `shield_expires_at` | `TIMESTAMPTZ` | `NULL` | Waktu kedaluwarsa *shield* (UTC). `NULL` jika tidak memiliki *shield*. |
| `last_scanned_at` | `TIMESTAMPTZ` | `NOT NULL` | Waktu terakhir data *base* ini diperbarui oleh *worker*. |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL, DEFAULT NOW()` | Waktu baris pertama kali dicatat. |
| `updated_at` | `TIMESTAMPTZ` | `NOT NULL, DEFAULT NOW()` | Waktu baris terakhir diubah. |

**Indexes:**
*   `idx_map_bases_server_shield`: `(server_id, is_shielded, shield_expires_at)`
*   `idx_map_bases_server_hq`: `(server_id, hq_level DESC)`
*   `idx_map_bases_alliance`: `(server_id, alliance_tag)`

### 3.2 Tabel `scanner_status`
Menyimpan status kesehatan dan riwayat sinkronisasi *worker* per server.

| Kolom | Tipe Data | Constraint | Deskripsi |
| :--- | :--- | :--- | :--- |
| `server_id` | `INTEGER` | `PRIMARY KEY` | ID server yang dipindai. |
| `status` | `VARCHAR(20)` | `NOT NULL` | Enum: `idle`, `scanning`, `rate_limited`, `error`. |
| `last_success_at` | `TIMESTAMPTZ` | `NULL` | Waktu terakhir *scan* berhasil 100%. |
| `last_attempt_at` | `TIMESTAMPTZ` | `NOT NULL` | Waktu percobaan *scan* terakhir (berhasil atau gagal). |
| `bases_scanned` | `INTEGER` | `NOT NULL, DEFAULT 0` | Jumlah *base* yang berhasil disimpan pada *scan* terakhir. |
| `consecutive_failures` | `SMALLINT` | `NOT NULL, DEFAULT 0` | Penghitung kegagalan beruntun untuk *circuit breaker*. |
| `error_message` | `TEXT` | `NULL` | Pesan error ringkas jika status `rate_limited` atau `error`. |
| `updated_at` | `TIMESTAMPTZ` | `NOT NULL, DEFAULT NOW()` | Waktu status terakhir diperbarui. |

### 3.3 Aturan Klasifikasi Data (Single Source of Truth)
*   **Unshielded:** `is_shielded = FALSE` **ATAU** `shield_expires_at IS NULL` **ATAU** `shield_expires_at <= NOW()`.
*   **Shield Expiring:** `is_shielded = TRUE` **DAN** `shield_expires_at > NOW()`, diurutkan berdasarkan `shield_expires_at ASC`.

---

## 4. API Specification

*   **Base URL (Dev):** `http://localhost:8000`
*   **Format:** `application/json` (seluruh *timestamp* menggunakan ISO-8601 UTC, contoh: `2026-11-24T12:30:00Z`).
*   **Autentikasi:**
    *   Endpoint publik dashboard (`/health`, `/api/*`): Tanpa autentikasi di Fase 1 (CORS dibatasi ke origin Frontend).
    *   Endpoint internal worker (`/internal/*`): Wajib menyertakan header `X-Internal-Secret: <INTERNAL_API_SECRET>`. Jika tidak valid/hilang, kembalikan `401 Unauthorized`.

### 4.1 `GET /health`
Mengecek kesiapan layanan Backend dan konektivitas ke PostgreSQL.
*   **Response `200 OK`:**
```json
{
  "status": "ok",
  "database": "connected",
  "server_time_utc": "2026-11-24T01:38:00Z"
}
```
*   **Response `503 Service Unavailable`:** Jika koneksi database gagal.

### 4.2 `GET /api/servers`
Mengembalikan daftar server yang pernah dipindai beserta ringkasan status *scanner*.
*   **Response `200 OK`:**
```json
{
  "servers": [
    {
      "server_id": 1349,
      "status": "idle",
      "last_success_at": "2026-11-24T01:30:00Z",
      "bases_scanned": 1240,
      "error_message": null
    }
  ]
}
```

### 4.3 `GET /api/targets`
Mengambil daftar *base* untuk tab **Unshielded** atau **Shield Expiring** dengan filter dan paginasi.
*   **Query Parameters:**
    *   `server_id` (`integer`, **required**)
    *   `tab` (`string`, **required**, enum: `unshielded` | `expiring`)
    *   `min_hq` (`integer`, optional, min: `1`, max: `40`)
    *   `max_hq` (`integer`, optional, min: `1`, max: `40`)
    *   `alliance_tag` (`string`, optional, case-insensitive exact/partial match)
    *   `search` (`string`, optional, cari berdasarkan `name` atau `alliance_tag`, case-insensitive)
    *   `sort_by` (`string`, optional, default: `hq_desc` untuk `unshielded`, `expires_asc` untuk `expiring`; enum: `hq_desc`, `hq_asc`, `expires_asc`, `name_asc`)
    *   `page` (`integer`, optional, default: `1`, min: `1`)
    *   `limit` (`integer`, optional, default: `50`, min: `1`, max: `200`)
*   **Response `200 OK`:**
```json
{
  "server_id": 1349,
  "tab": "expiring",
  "server_time_utc": "2026-11-24T01:38:00Z",
  "total": 84,
  "page": 1,
  "limit": 50,
  "items": [
    {
      "uid": "1109037525001351",
      "name": "WardenOfTheNorth",
      "alliance_tag": "FRY",
      "hq_level": 30,
      "x": 512,
      "y": 388,
      "is_shielded": true,
      "shield_expires_at": "2026-11-24T01:49:12Z",
      "last_scanned_at": "2026-11-24T01:35:00Z"
    }
  ]
}
```
*   **Status Codes:** `200 OK`, `422 Unprocessable Entity` (parameter tidak valid), `500 Internal Server Error`.

### 4.4 `GET /api/scanner/status/{server_id}`
Mengambil detail kesehatan *scanner* untuk satu server.
*   **Response `200 OK`:**
```json
{
  "server_id": 1349,
  "status": "rate_limited",
  "last_success_at": "2026-11-24T01:20:00Z",
  "last_attempt_at": "2026-11-24T01:35:00Z",
  "bases_scanned": 1240,
  "consecutive_failures": 2,
  "error_message": "Upstream returned 429 Too Many Requests. Cooling down for 300s."
}
```
*   **Status Codes:** `200 OK`, `404 Not Found` (server belum pernah dipindai).

### 4.5 `POST /internal/ingest` *(Protected)*
Menerima *batch* data hasil *scan* dari *worker*, melakukan *bulk upsert* ke `map_bases`, dan memperbarui `scanner_status` menjadi `idle` dengan `consecutive_failures = 0`.
*   **Headers:** `X-Internal-Secret: <secret>`
*   **Request Body:**
```json
{
  "server_id": 1349,
  "scanned_at": "2026-11-24T01:35:00Z",
  "bases": [
    {
      "uid": "1109037525001351",
      "name": "WardenOfTheNorth",
      "alliance_tag": "FRY",
      "hq_level": 30,
      "x": 512,
      "y": 388,
      "is_shielded": true,
      "shield_expires_at": "2026-11-24T01:49:12Z"
    }
  ]
}
```
*   **Response `200 OK`:**
```json
{
  "accepted": true,
  "server_id": 1349,
  "upserted_count": 1
}
```
*   **Status Codes:** `200 OK`, `401 Unauthorized`, `422 Unprocessable Entity`.

### 4.6 `POST /internal/scanner/status` *(Protected)*
Dipanggil oleh *worker* untuk melaporkan perubahan status (`scanning`, `rate_limited`, `error`).
*   **Headers:** `X-Internal-Secret: <secret>`
*   **Request Body:**
```json
{
  "server_id": 1349,
  "status": "rate_limited",
  "error_message": "Rate limit hit on block (400, 400). Retrying in 300s."
}
```
*   **Response `200 OK`:** Mengembalikan objek `scanner_status` terbaru.

---

## 5. Component Architecture

### 5.1 Struktur Direktori Monorepo (`lws/`)
```text
lws/
├── .gitignore
├── .env.example
├── README.md
├── backend/
│   ├── requirements.txt
│   └── app/
│       ├── main.py
│       ├── config.py
│       ├── database.py
│       ├── models.py
│       ├── schemas.py
│       ├── security.py
│       └── routers/
│           ├── health.py
│           ├── targets.py
│           └── internal.py
├── frontend/
│   ├── package.json
│   ├── next.config.ts
│   ├── tailwind.config.ts
│   └── src/
│       ├── app/
│       │   ├── layout.tsx
│       │   ├── page.tsx
│       │   └── globals.css
│       ├── components/
│       │   ├── HeaderBar.tsx
│       │   ├── ScannerStatusBanner.tsx
│       │   ├── FilterBar.tsx
│       │   ├── TargetTabs.tsx
│       │   ├── TargetTable.tsx
│       │   ├── ShieldCountdown.tsx
│       │   └── CopyCoordButton.tsx
│       ├── hooks/
│       │   ├── useTargets.ts
│       │   └── useClockOffset.ts
│       └── lib/
│           ├── api.ts
│           └── types.ts
└── worker/
    ├── requirements.txt
    ├── seeder.py
    ├── client.py
    └── resilience.py
```

### 5.2 Hirarki Komponen UI & State Management
```text
DashboardPage (page.tsx)
├── HeaderBar (ServerSelector + ManualRefreshButton + LastUpdatedLabel)
├── ScannerStatusBanner (Kondisional: tampil jelas saat status != idle atau data > 30 menit)
├── TargetTabs (Tab "Unshielded" | Tab "Shield Expiring" + Counter)
├── FilterBar (SearchInput, AllianceFilter, MinHQ/MaxHQ, SortDropdown)
└── TargetTable
    └── TargetRow
        ├── ShieldCountdown (Real-time timer dari UTC timestamp + warna urgensi)
        └── CopyCoordButton (Salin "(x, y)" ke clipboard + feedback "Copied")
```

*   **State Management:**
    *   Filter aktif (`server_id`, `tab`, `min_hq`, `alliance_tag`, `search`, `page`) disinkronkan dengan **URL Query Parameters** agar tampilan bisa di-*refresh* atau di-*share* tanpa kehilangan filter.
    *   **Clock Skew Compensation (`useClockOffset`):** Saat halaman memuat data dari `/api/targets`, frontend menghitung selisih `server_time_utc - Date.now()` untuk menghindari *countdown* meleset akibat jam lokal perangkat pengguna yang tidak akurat.
    *   **Single Shared Ticker:** Satu interval global (`1000ms`) menggerakkan seluruh komponen `ShieldCountdown` agar tidak membebani memori browser saat merender ratusan baris.
    *   **Auto-Transition UX:** Ketika *countdown* di tab **Shield Expiring** mencapai `00:00:00`, status baris otomatis berubah menjadi badge **`EXPIRED (Unshielded)`** secara instan tanpa menunggu *refresh* server.

### 5.3 Arsitektur Ketahanan Worker (`worker/resilience.py`)
*   **Retry + Exponential Backoff:** Percobaan ulang otomatis dengan jeda meningkat (`2s → 4s → 8s → 16s` + *jitter* acak) untuk *network timeout* sementara.
*   **Circuit Breaker:** Jika `consecutive_failures >= 3` atau menerima status `429`, *worker* otomatis memanggil `POST /internal/scanner/status` dengan status `rate_limited` / `error` dan masuk mode *cooldown* (misal 5–15 menit) sebelum mencoba kembali.

---

## 6. Acceptance Criteria & Test Plan

Fase 1 dinyatakan **SELESAI 100%** dan siap lanjut ke Fase 2 (*Secret Tasks*) apabila seluruh kriteria dan *test-case* di bawah ini lulus tanpa kegagalan.

### 6.1 Acceptance Criteria (Kriteria Kelulusan)
1.  **Integritas Data:** `POST /internal/ingest` mampu menyimpan/memperbarui 1.000 baris `map_bases` dalam satu *request* secara idempoten (tidak ada duplikasi `(server_id, uid)`).
2.  **Keamanan Endpoint Internal:** Permintaan ke `/internal/*` tanpa atau dengan `X-Internal-Secret` yang salah wajib ditolak dengan `401 Unauthorized`.
3.  **Akurasi Klasifikasi & Countdown:**
    *   *Base* dengan `shield_expires_at` di masa lalu otomatis muncul di tab **Unshielded** dan tidak muncul di tab **Shield Expiring**.
    *   *Countdown* berkurang setiap detik secara konsisten dan berubah warna sesuai ambang batas (`< 15 menit`: merah, `15–59 menit`: kuning, `>= 60 menit`: netral).
    *   Saat *countdown* menyentuh `00:00:00`, label otomatis berubah menjadi `EXPIRED`.
4.  **Filter & Interaksi UI:** Seluruh kombinasi filter (`min_hq`, `alliance_tag`, `search`) menghasilkan data akurat; tombol *Copy Koordinat* menyalin format `(x, y)` ke *clipboard*.
5.  **Graceful Error Handling:** Ketika `scanner_status` bernilai `rate_limited` atau `error`, atau ketika Backend tidak dapat dihubungi, UI tidak *crash* (*white screen*), tetap menampilkan data *cache*/terakhir yang tersedia, serta memunculkan *banner* status yang informatif.

### 6.2 Matriks Test Plan (Backend, Worker, & E2E)

| ID | Kategori | Skenario Uji (*Test Case*) | Hasil yang Diharapkan |
| :--- | :--- | :--- | :--- |
| **TC-01** | Backend Auth | Kirim `POST /internal/ingest` tanpa header `X-Internal-Secret`. | HTTP `401 Unauthorized`, tidak ada perubahan di DB. |
| **TC-02** | Backend Ingest | Kirim *batch* 50 *base* via `seeder.py`, lalu kirim ulang *uid* sama dengan `hq_level` & `shield_expires_at` baru. | HTTP `200 OK`; baris ter-update (upsert), jumlah total tetap 50. |
| **TC-03** | Backend Query | Panggil `GET /api/targets?server_id=1349&tab=unshielded&min_hq=25`. | Hanya mengembalikan *base* tanpa *shield* atau *shield* kedaluwarsa dengan `hq_level >= 25`. |
| **TC-04** | Backend Query | Panggil `GET /api/targets?server_id=1349&tab=expiring`. | Hanya mengembalikan *base* ber-*shield* aktif, terurut `shield_expires_at ASC`. |
| **TC-05** | E2E Countdown | Seed 1 *base* dengan `shield_expires_at = NOW() + 5 detik`, buka tab **Shield Expiring**. | *Countdown* tampil merah, berkurang tiap detik (`00:00:05` → `00:00:00`), lalu berubah menjadi badge `EXPIRED`. |
| **TC-06** | E2E Filter & Copy | Ketik nama pemain di `SearchInput`, lalu klik tombol *Copy Koordinat*. | Tabel terfilter sesuai nama; *clipboard* berisi `(x, y)` dan muncul konfirmasi visual. |
| **TC-07** | E2E Graceful Error | Set `scanner_status` menjadi `rate_limited` via API internal, lalu buka dashboard. | *Banner* peringatan *Rate Limited* tampil di atas tabel; daftar *base* terakhir tetap dapat dibaca dan difilter. |
| **TC-08** | E2E Empty & Offline | Buka server yang belum punya data, lalu simulasikan Backend dimatikan. | Menampilkan *empty state* yang rapi (bukan crash) dan *error fallback* dengan tombol *Retry* saat Backend mati. |
| **TC-09** | Worker Resilience | Simulasikan error `429` sebanyak 3 kali berturut-turut pada `worker`. | *Worker* berhenti melakukan *retry* agresif, melaporkan status `rate_limited` ke Backend, dan masuk fase *cooldown*. |