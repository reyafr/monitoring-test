# Panduan Deploy

Dokumen ini berisi langkah deploying Dashboard Monitoring Issue ke hosting static (Vercel, Netlify, atau server sendiri).

## Ringkasan

| Item | Nilai |
| --- | --- |
| Build command | `npm run build` |
| Output directory | `dist` |
| Node.js minimal | `20.19.0` atau `22.12.0` ke atas |
| Environment variables | `VITE_GOOGLE_SHEETS_API_KEY`, `VITE_GOOGLE_SHEET_ID` (opsional `VITE_GOOGLE_SHEET_GID`) |

## Prasyarat

1. Akun hosting (Vercel, Netlify, atau static hosting milik sendiri).
2. Node.js versi `^20.19.0 || >=22.12.0` sudah terpasang di lokal untuk build.
3. Google Cloud Console project dengan Google Sheets API aktif.
4. Spreadsheet berisi test case dapat diakses oleh service project.

## 1. Menyiapkan Google Sheets

### Akses Spreadsheet

Pada spreadsheet, klik **Share** → **General access** → **Anyone with the link** → **Viewer**.

> Dashboard membaca data langsung dari browser. Spreadsheet privat tidak dapat dibaca tanpa backend proxy.

### API Key

1. Buka [Google Cloud Console](https://console.cloud.google.com) → buat atau pilih project.
2. **APIs & Services** → **Library** → cari **Google Sheets API** → **Enable**.
3. **APIs & Services** → **Credentials** → **Create credentials** → **API key**.
4. **Edit API key**:
   - **API restrictions** → **Google Sheets API**.
   - **Application restrictions** → **Websites** → masukkan domain produksi, misalnya `https://monitoring-test.vercel.app` (tanpa trailing slash).
5. Salin key yang dihasilkan.

> API key akan terlihat oleh pengguna di browser. Batasi akses semaksimal mungkin: restriction API + restriction domain + rotasi berkala.

## 2. Environment Variables

Buat file `.env.local` untuk penggunaan lokal:

```env
VITE_GOOGLE_SHEETS_API_KEY=API_KEY_ANDA
VITE_GOOGLE_SHEET_ID=ID_SPREADSHEET_ANDA
```

File ini **tidak** masuk Git karena sudah di-ignore oleh `.gitignore` (pola `*.local`). Konfigurasi yang sama harus diisi langsung di platform hosting.

| Variabel | Wajib | Keterangan |
| --- | --- | --- |
| `VITE_GOOGLE_SHEETS_API_KEY` | Ya | API key Google Sheets. |
| `VITE_GOOGLE_SHEET_ID` | Ya | ID spreadsheet dari URL `/d/<ID_SPREADSHEET>/edit`. |
| `VITE_GOOGLE_SHEET_GID` | Tidak | Membatasi dashboard pada satu tab sheet (gid internal). Kosongkan untuk membaca seluruh tab. |

## 3. Deploy ke Vercel

1. Push kode ke GitHub (repo: `https://github.com/reyafr/monitoring-test`).
2. Login ke [Vercel](https://vercel.com) → **Add New Project** → import repository `reyafr/monitoring-test`.
3. Konfirmasi pengaturan build:
   - **Framework Preset**: Vite
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
   - **Install Command**: `npm install`
4. Buka **Settings** → **Environment Variables**, tambahkan:
   - `VITE_GOOGLE_SHEETS_API_KEY` → Production dan Preview
   - `VITE_GOOGLE_SHEET_ID` → Production dan Preview
5. Klik **Deploy**.
6. Setelah domain tersedia, masukkan domain tersebut ke **Application restrictions** pada API key, lalu deploy ulang bila perlu.

## 4. Deploy ke Netlify

1. Login ke [Netlify](https://app.netlify.com) → **Add new site** → **Import an existing project** → pilih repo `reyafr/monitoring-test`.
2. Isi pengaturan build:
   - **Build command**: `npm run build`
   - **Publish directory**: `dist`
3. Buka **Site configuration** → **Environment variables**, tambahkan `VITE_GOOGLE_SHEETS_API_KEY` dan `VITE_GOOGLE_SHEET_ID`.
4. Klik **Deploy site**.

## 5. Deploy ke Server Sendiri (Nginx)

```bash
npm ci
npm run build
```

Salin isi folder `dist/` ke document root server, lalu konfigurasi Nginx:

```nginx
server {
  listen 80;
  server_name monitoring.example.com;
  root /var/www/monitoring-test;
  index index.html;

  location / {
    try_files $uri $uri/ /index.html;
  }
}
```

Contoh konfigurasi env untuk build:

```bash
export VITE_GOOGLE_SHEETS_API_KEY=API_KEY_ANDA
export VITE_GOOGLE_SHEET_ID=ID_SPREADSHEET_ANDA
npm run build
```

## 6. Verifikasi Setelah Deploy

1. Buka domain deploy, halaman harus menampilkan KPI dan tabel issue.
2. Buka tab **Rekap per sheet**, pastikan daftar sheet sesuai Expectations spreadsheet.
3. Klik tombol **Refresh data**, pastikan tidak muncul pesan error.
4. Cek browser console untuk memastikan tidak ada error CORS atau permission.

## 7. Pemecahan Masalah

| Gejala | Penyebab | Solusi |
| --- | --- | --- |
| "Konfigurasi Google Sheets belum lengkap di .env.local" | Environment variable belum diisi di platform hosting | Tambahkan kedua variabel, lalu deploy ulang. |
| Banner "Data tidak dapat dimuat" dengan pesan 403 | API key salah, Sheets API belum aktif, atau spreadsheet belum dibagikan publik | Aktifkan Google Sheets API, buat ulang key, pastikan *Anyone with the link → Viewer*. |
| 403 setelah key dibatasi domain | Domain deploy belum terdaftar di **Application restrictions** | Tambahkan domain, deploy ulang. |
| Daftar sheet kosong | Tab tidak memiliki kolom `Test Case ID` | Tab non-test-case otomatis dilewati; pastikan tab memuat kolom `Test Case ID`. |
| Issue terhitung padahal sel kosong | Nilai placeholder `-`, `N/A`, atau `TBD` | Sudah ditangani otomatis pada normalisasi data. |
| Halaman putih setelah deploy | Base path tidak sesuai | Set `base: '/nama-repo/'` pada `vite.config.js` bila di-deploy pada sub-path. |

## 8. Pembaruan Deploy

```bash
git pull
npm ci
npm run lint
npm run build
```

Untuk Vercel dan Netlify, cukup `git push` ke branch `master` karena keduanya melakukan auto-deploy. Pastikan environment variable tetap tersedia setelah deployment berikutnya.
