# Deployment Procedure

Sistem ini didesain beroperasi secara otomatis via Vercel Edge/Serverless Functions yang menaut pada repositori GitHub.

## 1. Flow Deployment (CI/CD)

**Environment: Preview**
```text
Fitur Branch -> Push ke GitHub -> Memicu CI (ci.yml) -> Vercel Build Preview URL -> Tim Q&A menguji bot dev.
```

**Environment: Production**
```text
Merge ke branch `main` -> GitHub CI Typecheck & Test -> Vercel Deployment -> Bot Telegram merespons pada domain baru.
```

## 2. Langkah-Langkah Manual (Pertama Kali)
1. Tautkan Vercel dengan GitHub repositori: `vercel link`.
2. Isi *Environment Variables* di Dasbor Vercel:
   - `BOT_TOKEN`
   - `SUPABASE_URL`
   - `SUPABASE_KEY_SERVICE_ROLE`
   - Dsb.
3. Setelah URL rilis, lakukan *Set Webhook* API Telegram secara manual:
   `curl "https://api.telegram.org/bot<TOKEN>/setWebhook?url=<VERCEL_DOMAIN>/api/webhook"`

## 3. Deployment Rollback
Vercel mendukung rollback *1-click instant*. Jika rilis *Production* mengalami galat kritis:
1. Buka Vercel Dashboard -> Project -> **Deployments**.
2. Cari deployment versi lawas yang berstatus `Ready` dan stabil.
3. Klik titik tiga (`...`) -> **Promote to Production** / **Rollback**.
4. Dalam hitungan detik, lalu lintas akan dialihkan ke kode lama.
5. Jalankan `RECOVERY_CHECKLIST.md` guna memastikan pangkalan data dan status *webhook* masih sinkron dengan rilis kode versi lawas.

## 4. Database Migration Deployment
Vercel tidak mengeksekusi migrasi DB.
**Aturan Emas**: Selalu aplikasikan file migrasi `.sql` ke Supabase **SEBELUM** melakukan penggabungan (Merge) kode ke branch `main`. Ini menghindari Vercel selesai melakukan _build_ namun DB belum mengenali kolom baru.
