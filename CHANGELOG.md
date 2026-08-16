# CHANGELOG

## v1.0.0 - STABLE TEMPORARY RELEASE

Proyek ini dibekukan sementara pada versi `v1.0.0` setelah menyelesaikan siklus `Prompt 1 - 21`.

### Fitur Tersedia & Selesai Diimplementasikan (Prompt 1 - 17, 21)
- **Dasar Sistem:** TypeScript, grammY, Supabase, Vercel Serverless API & Webhook.
- **Manajemen Pengguna:** Registrasi otomatis via Telegram, pengaturan hak akses `admin` dan `user` via RLS.
- **Katalog E-Commerce:** Dukungan Produk, Kategori, Varian Produk, dan Opsi. 
- **Keranjang & Checkout:** Penambahan keranjang via Web App dengan proteksi kompetisi stok (*Atomic Lock* `FOR UPDATE`).
- **Pembayaran:** Integrasi Payment Gateway via Webhook (Prompt 4/5).
- **Notifikasi & Siaran (Broadcast):** Job queueing dan pengiriman notifikasi masif (Prompt 6/7).
- **Inventaris & Manajemen Stok:** Logika pergerakan stok, reservasi pesanan, dan penyesuaian (*adjustment*) (Prompt 17).
- **Sistem Tiket / Dukungan:** Dukungan pengguna/CS langsung via Bot (Prompt 15).
- **Pemantauan & Metrik:** Observability dasar dan dasbor Admin.
- **Kinerja:** Indeks database, pencegahan *N+1 query*, *payload size reduction* (Prompt 21).

### Tertunda (Implementasi Parsial / Dalam Perencanaan)
- Fitur Pengiriman (*Shipping*) - Rancangan selesai, namun kode belum dieksekusi secara utuh.
- Internasionalisasi (*i18n*) - Rancangan arsitektur terjemahan json/db selesai.
- Arsitektur Plugin & Modul - Rancangan selesai.

> *Rilis ini dianggap stabil secara logika inti, namun tertahan dari penambahan fitur lanjutan hingga tahap pengembangan berikutnya.*
