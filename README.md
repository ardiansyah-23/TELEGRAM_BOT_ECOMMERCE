# Telegram Bot Foundation

Proyek ini adalah fondasi aplikasi Telegram Bot yang modular dan siap di-deploy ke Vercel. 
Dibangun menggunakan TypeScript dan library `grammY`.

## Teknologi yang Digunakan
- **TypeScript**: Bahasa utama dengan strict type-checking.
- **grammY**: Framework Telegram Bot yang modern dan cepat.
- **Vercel**: Platform deployment untuk serverless functions.
- **Node.js**: Runtime environment.

## Struktur Folder
```text
telegram-bot/
├── src/
│   ├── bot/
│   │   ├── commands/   # Handler perintah (/start, /help)
│   │   ├── callbacks/  # Handler inline keyboard callback
│   │   ├── keyboards/  # Definisi struktur keyboard
│   │   ├── middleware/ # Middleware grammY (jika ada nantinya)
│   │   └── index.ts    # Instansiasi bot utama
│   │
│   ├── config/         # Konfigurasi (termasuk validasi env)
│   ├── services/       # Business logic (kosong untuk tahap awal)
│   ├── database/       # Abstraksi database Supabase & skema migration
│   ├── utils/          # Fungsi utilitas
│   └── types/          # Definisi TypeScript kustom

│
├── api/
│   ├── webhook.ts      # Endpoint webhook Vercel
│   └── health.ts       # Endpoint health check
│
├── public/             # File statis (jika diperlukan)
├── .env.example        # Template environment variables
├── vercel.json         # Konfigurasi Vercel
└── tsconfig.json       # Konfigurasi TypeScript
```

## Cara Install
1. Clone atau salin proyek ini.
2. Jalankan perintah instalasi dependensi:
   ```bash
   npm install
   ```

## Environment Variables
Salin file `.env.example` menjadi `.env` dan isi valuenya:
```bash
cp .env.example .env
```
Variabel yang dibutuhkan:
- `BOT_TOKEN`: Token bot dari @BotFather.
- `WEBHOOK_URL`: URL Vercel setelah deployment.
- `SUPABASE_URL`: URL Project Supabase Anda.
- `SUPABASE_ANON_KEY`: Kunci anon Supabase.
- `ADMIN_TELEGRAM_ID`: ID Telegram numerik Anda (untuk akses fitur admin).

**PENTING**: Jangan pernah commit file `.env` yang berisi token asli Anda.

## Supabase Setup & Migration
1. Buat proyek baru di [Supabase](https://supabase.com).
2. Dapatkan `SUPABASE_URL` dan `SUPABASE_ANON_KEY` dari menu Settings -> API.
3. Buka **SQL Editor** di dashboard Supabase Anda.
4. Salin seluruh isi dari file `supabase/migrations/001_initial_schema.sql` dan jalankan (*Run*) di SQL Editor untuk membuat tabel `users` dan `activity_logs`.

## User System & Admin System
- **Auto-register**: Saat user berinteraksi pertama kali (misal mengirim `/start`), middleware akan otomatis mendaftarkannya ke database.
- **Profile**: Data profil selalu diambil segar dari database via command `/profile` atau tombol "Profil".
- **Admin System**: User yang memiliki `telegram_id` sesuai dengan `ADMIN_TELEGRAM_ID` di `.env` akan otomatis mendapat role `admin` saat registrasi awal.
- **Admin Middleware**: Perintah `/admin` dilindungi oleh middleware yang memblokir akses dari user biasa.
- **User Management**: Admin dapat melihat daftar user dengan pagination, mencari user (berdasarkan ID atau username), serta memblokir (Ban/Unban) user secara langsung melalui UI Telegram.
- **Activity Log**: Semua perintah atau interaksi tombol akan dicatat dalam tabel `activity_logs` tanpa menyertakan data rahasia.

## Broadcast & State Management
- **State Management**: Karena Vercel merupakan fungsi *serverless* (stateless), grammY session (dan conversation) disimpan menggunakan Supabase Adapter (`bot_sessions`). Hal ini menjamin input berantai seperti alur Broadcast tidak terhapus antar-request.
- **Broadcast System**: Admin dapat mengakses menu Broadcast. Bot akan memandu admin mengirimkan pesan -> preview -> konfirmasi.
- **⚠️ Broadcast Limitations (Serverless)**: Pada mode sinkron (*synchronous*) di dalam Vercel webhook, proses perulangan (`for loop`) untuk mengirimkan pesan ke puluhan ribu user akan berakibat pada **timeout** (limit Vercel hobby adalah 10-15 detik) dan berpotensi terkena *rate-limit* Telegram (max 30 pesan/detik). Fitur saat ini dibuat secara sinkron dan aman HANYA untuk skala kecil/testing. Pada lingkungan produksi berskala besar, sistem broadcast ini perlu diubah menjadi **Background Queue/Job** (misalnya menggunakan Inngest, Upstash QStash, atau worker terpisah di VPS/Render).

## Cara Menjalankan Development (Local)
Proyek ini diarsiteki untuk mode Webhook di Vercel. Untuk testing webhook secara lokal, Anda bisa menggunakan `vercel dev` setelah menginstal Vercel CLI, atau menggunakan `ngrok`.

Untuk sekedar type-checking:
```bash
npx tsc --noEmit
```

## Cara Deploy ke Vercel
1. Pastikan Anda memiliki akun Vercel dan Vercel CLI (atau hubungkan repository GitHub ini ke Vercel).
2. Jalankan perintah:
   ```bash
   vercel
   ```
3. Tambahkan `BOT_TOKEN` di menu **Settings -> Environment Variables** pada dashboard proyek Vercel Anda.
4. Deploy ke production:
   ```bash
   vercel --prod
   ```

## Cara Menghubungkan Telegram Bot (Set Webhook)
Setelah mendapatkan URL dari Vercel (misal: `https://my-bot.vercel.app`), Anda harus memberitahu Telegram untuk mengirim pembaruan (updates) ke URL webhook tersebut.
Buka browser dan akses URL berikut (ganti `<BOT_TOKEN>` dan `<VERCEL_URL>`):
```
https://api.telegram.org/bot<BOT_TOKEN>/setWebhook?url=<VERCEL_URL>/api/webhook
```

## Cara Testing
1. Deploy bot ke Vercel.
2. Atur webhook.
3. Kunjungi `https://<VERCEL_URL>/api/health` untuk memastikan aplikasi hidup.
4. Buka Telegram, cari bot Anda, dan kirimkan `/start` atau `/help`. Pastikan bot merespons dan inline keyboard dapat ditekan dengan benar.
