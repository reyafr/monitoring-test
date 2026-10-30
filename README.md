# QA Issue Monitoring Dashboard

Dashboard monitoring issue testing dengan sumber data Google Sheets. Dibangun mobile-first menggunakan React, Vite, dan Tailwind CSS.

## Fitur

- **Kategori per nama sheet**: dropdown untuk memilih tab spreadsheet, seluruh KPI, chart, dan tabel issue mengikuti pilihan tersebut.
- **Rekap per sheet**: tabel ringkasan jumlah test case, issue, issue fixed, lolos retest, dan pass rate untuk setiap tab. Klik baris untuk memfilter dashboard.
- **KPI monitoring**: total test case, issue ditemukan, issue fixed, dan issue yang lolos retest.
- **Visualisasi**: progress bar penyelesaian dan pie chart distribusi status DEV.
- **Daftar issue**: pencarian, filter status DEV dan PIC DEV, sorting ID test case, pagination, serta panel detail issue.
- **Tampilan responsif**: daftar issue berubah dari kartu pada mobile ke tabel pada tablet/desktop.
- **State handling**: loading, error, dan empty state, plus tombol refresh data.

## Menjalankan proyek

```bash
npm install
npm run dev
```

Build untuk production:

```bash
npm run build
npm run preview
```

Perintah lain: `npm run lint` (Oxlint).

## Konfigurasi Environment

Buat file `.env.local` di root project:

```env
VITE_GOOGLE_SHEETS_API_KEY=API_KEY_ANDA
VITE_GOOGLE_SHEET_ID=ID_SPREADSHEET_ANDA
```

| Variabel | Keterangan |
| --- | --- |
| `VITE_GOOGLE_SHEETS_API_KEY` | API key dari Google Cloud Console dengan batasan API Google Sheets. |
| `VITE_GOOGLE_SHEET_ID` | ID spreadsheet, diambil dari URL `/d/<ID>/edit`. |
| `VITE_GOOGLE_SHEET_GID` | Opsional. Membatasi dashboard pada satu tab saja (gid internal sheet). |

Spreadsheet harus dapat dibaca publik (*Anyone with the link → Viewer*), dan API key harus dibatasi pada API Google Sheets.

> API key pada frontend dapat terlihat oleh pengguna. Untuk spreadsheet privat, gunakan backend proxy dengan service account.

## Struktur Data

Dashboard membaca seluruh tab spreadsheet sekaligus. Tab hanya dianggap tabel test case bila header-nya memuat kolom `Test Case ID`, sehingga tab non-data seperti `summary` atau catatan otomatis dilewati.

Perbedaan nama kolom antar tab ditangani secara otomatis, misalnya `Scenario ID` vs `Column 1`, `PIC DEV` vs `PIC Dev`, dan `Status QA` vs `Status`. Nilai placeholder seperti `-`, `N/A`, dan `TBD` diperlakukan sebagai kosong agar tidak terhitung sebagai issue.

## Struktur Project

```
src/
├── App.jsx                  # Komponen dashboard
├── index.css                # Entry point Tailwind CSS
├── main.jsx                 # Root React
└── services/
    └── googleSheets.js      # Pengambilan dan normalisasi data Google Sheets
```
