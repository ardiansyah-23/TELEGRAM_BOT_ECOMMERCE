# Panduan Pengembang (Development)

Proyek ini adalah perpaduan **Telegram Bot (grammY)** dan **Web App API** yang di-deploy sebagai fungsi *Serverless* di atas infrastruktur Vercel.

## Arsitektur Aplikasi

```text
Request Masuk 
   ├─ Telegram Webhook ──> /api/bot/webhook.ts ──> grammY Handlers (src/bot)
   └─ Web App / Admin ───> /api/twa/*.ts & /api/admin/*.ts 
           │
           ▼
   Layer Layanan (src/services) ───> Logika Bisnis (Kalkulasi, Stok, Pembayaran)
           │
           ▼
   Layer Database (src/database) ──> Interaksi Supabase Client / RPC calls
```

## Konvensi Kode (*Coding Conventions*)
1. **Tidak Ada State Global:** Fungsi harus bersifat *stateless* karena berada dalam *Serverless Environment*.
2. **Atomic Operations:** Gunakan RPC Supabase (`.rpc`) untuk mengubah 2 tabel berbeda sekaligus yang kritis, atau ketika melakukan kalkulasi saldo/stok agar terhindar dari *Race Conditions*.
3. **Pemisahan Lapisan (*Layering*):** Webhook Telegram (`bot/`) dan API Web (`api/`) HANYA boleh bertugas menangani Request HTTP. Segala penghitungan (*math*) wajib dilempar ke `src/services/`.

## Cara Menambah Fitur (Contoh: Menambah Tabel Baru)
1. Buat berkas migrasi SQL baru di `supabase/migrations/` (Misal: `017_new_feature.sql`).
2. Jangan lupa tambahkan aturan kebijakan *Row Level Security* (RLS) di dalam berkas SQL tersebut.
3. Hubungkan migrasi tersebut ke server dengan `npx supabase db push`.
4. Tambahkan *Service* logika bisnis Anda pada `src/services/new_feature.service.ts`.
5. Eksploitasi via fungsi bot Telegram atau Web App.
