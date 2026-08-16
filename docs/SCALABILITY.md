# Scalability Report

## 1. Current Architecture
*   **Platform:** Vercel (Serverless Functions / Edge).
*   **Database:** Supabase PostgreSQL.
*   **Bot Framework:** grammY (Webhook mode).
*   **Storage:** Supabase Storage.
*   **Message Queues / Background:** Vercel Cron (Basic) & Supabase pg_cron / Edge Functions (jika dibutuhkan).

## 2. Traffic Assumptions & Known Limitations
1.  **Vercel Serverless Limits:**
    *   Maksimal durasi eksekusi biasanya 10s (Hobby) atau 15-60s (Pro).
    *   Jika sebuah pengiriman pesan bot atau notifikasi eksternal gagal (*Timeout* Telegram API), proses akan digantung (*hang*).
2.  **Supabase Connection Pooling:**
    *   Koneksi dari *Serverless* Vercel bersifat sesaat (*stateless*). Jika terjadi lonjakan pengunjung (10,000 *concurrent users*), Vercel akan meluncurkan ribuan instans fungsi yang dapat menghabiskan kuota koneksi database (*Connection Limit Exceeded*).
    *   Supabase PgBouncer / Connection Pooler **wajib** digunakan pada _connection string_ untuk *deployment* Produksi.

## 3. Scalability Options (Next Steps)

*   **Caching Layer Tambahan (Masa Depan):** Jika lalu lintas kueri pembacaan produk sangat intens, pertimbangkan menggunakan Vercel Edge Cache (`stale-while-revalidate`) atau layer Redis mini (seperti Upstash) HANYA untuk katalog statis, BUKAN stok.
*   **Background Jobs (Message Queue):** Untuk skenario *broadcast* masif, *Webhook* sinkron tidak akan memadai. Pindahkan pengiriman pesan *bulk* ke sistem *Message Queue* (mis. Supabase Edge Functions + Webhook asinkron) agar API tidak mengalami kelambatan *response time*.
*   **CDN untuk Frontend:** Vercel otomatis menjadi CDN yang baik, namun pastikan *Static Assets* seperti *icons* dan logo bot memuat secara mandiri dari CDN/Supabase Storage dan bukan dikemas di basis kode Node.js.

## 4. Recommended Next Steps (Skala Pendek)
1.  Ubah URL database di Vercel dari port langsung (5432) ke URL Connection Pooler Supabase (biasanya port 6543) agar mampu menahan ledakan instans Vercel tanpa kehabisan *DB connections*.
2.  Pastikan `checkout_cart` RPC dijalankan secara *Atomic*, sehingga meski diserang 100 *requests/sec*, integritas data tidak akan korup.
