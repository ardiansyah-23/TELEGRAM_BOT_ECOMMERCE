# Laporan Keamanan Internal (Security Report)

## 1. Authentication & Authorization
- **Admin Dashboard**: Menggunakan *Telegram Web App InitData Validation* dengan HMAC-SHA-256. Frontend sama sekali tidak dipercaya; otorisasi selalu diverifikasi *server-side* berdasarkan field `is_admin` dari tabel database (bukan query parameter).
- **Users Web App**: Menggunakan HMAC-SHA-256 validation. *User ID* diklaim aman dari *spoofing*.

## 2. Webhook Security
- **Telegram Webhook**: Dilindungi oleh pengecekan *header* `x-telegram-bot-api-secret-token` yang memvalidasi `WEBHOOK_SECRET`. Menghindari pihak tidak sah dari luar jaringan Telegram mengeksekusi *fake updates*.
- **Payment Webhook (Midtrans)**: Menggunakan algoritma *hashing* SHA-512 `order_id + status_code + gross_amount + serverKey`. Idempotency terjamin melalui pengecekan di dalam kode.

## 3. Database Security
- Seluruh *query* menggunakan klien Supabase yang sudah *parameterized*, sepenuhnya aman dari *SQL Injection* konvensional.
- RLS (*Row Level Security*) diaktifkan pada seluruh tabel krusial untuk melarang akses publik/anonim yang bypass dari API layer Vercel.
- Seluruh *database constraints* telah di-set untuk mem-verifikasi logika internal (misalnya, poin tidak boleh minus, harga tidak boleh kurang dari 0).

## 4. Rate Limiting & Anti-Spam
- Bot dilindungi oleh *in-memory rate limiter* ringan untuk perintah dasar (misal 3 hit/detik).
- Checkout memblokir dobel transaksi dengan RPC dan Unique ID.
- Pembuatan link pembayaran dikunci oleh *constraint status* `pending`.

## 5. Secrets Management
- Semua *secret* wajib dimasukkan melalui Environment Variables dari *Hosting Provider* (misal: Vercel) dan tidak di-*hardcode* di *source code*.

*Laporan ini dihasilkan selama Tahap 11: Security Hardening.*
