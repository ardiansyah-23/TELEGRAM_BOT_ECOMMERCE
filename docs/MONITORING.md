# Sistem Monitoring & Analitik (Tahap 12)

Dokumentasi ini menjelaskan arsitektur *observability* dan analitik di dalam *Telegram Bot E-Commerce* ini. Sistem dirancang ringan, minim *dependencies*, dan memaksimalkan Vercel serta Supabase.

## 1. System Health (`/api/admin/health`)
Health Service memantau 4 komponen inti:
- **Database**: Menguji latensi kueri baca sederhana (`SELECT 1` dari `users`). Degradasi terjadi jika > 1 detik.
- **Telegram API**: Memanggil `bot.api.getMe()` untuk mengonfirmasi konektivitas jaringan ke Telegram.
- **Payment Provider (Midtrans)**: Memberikan respons statis karena Midtrans tidak memiliki endpoint publik (bebas autokentikasi) murni untuk *ping*.
- **Cron Jobs**: Membaca rekam jejak eksekusi cron terakhir di tabel `system_health`. Jika lebih dari 15 menit cron tidak berjalan, maka dinyatakan *unhealthy*.

## 2. Centralized Logging
Semua log yang krusial (terutama pesan peringatan dan *error*) diarahkan menggunakan kelas `Logger` (`src/utils/logger.ts`). Fitur utamanya:
- Menggantikan atau melampirkan `request_id` (sebagai UUID) ke dalam *payload* log untuk *tracing* transaksi.
- Melakukan sanitasi token secara otomatis (misalnya `bot_token` atau string lain yang mengandung "secret" diubah menjadi `***`).
- Menyimpan ke konsol Vercel dan ke tabel Supabase `system_logs` (agar dapat dibaca lewat Admin Dashboard).

## 3. Analitik (Bot & User)
- **Bot Events**: Tabel `bot_events` menyimpan semua riwayat interaksi pengguna dengan bot (Command seperti `/start` dan penekanan *Inline Keyboard Callback*). Pesan teks pribadi tidak disimpan demi menjaga ranah privasi.
- **Admin Stats Aggregation**: File `api/admin/stats.ts` di Vercel menangani fungsi hitung dinamis (`COUNT`) atas pesanan, pendapatan (*Revenue* berstatus 'paid'), pekerjaan cron yang tertunda, dsb.

## 4. Retensi Data
Saat ini, tidak terdapat pembersihan log otomatis secara *cron* agar struktur tidak terlalu membebani kuota Vercel Function. Jika tabel `system_logs` dan `bot_events` membesar melebihi 100k+ baris, admin disarankan menjalankan *SQL Query* *cleanup* manual di Supabase SQL Editor:
```sql
DELETE FROM system_logs WHERE created_at < NOW() - INTERVAL '30 days';
```

## 5. Troubleshooting (Pemecahan Masalah)
1. **Cron 🔴 Unhealthy**:
   - Periksa tab *Logs* di Vercel untuk mendeteksi *timeout execution* atau kesalahan `CRON_SECRET`.
2. **Database 🔴 Unhealthy**:
   - Pastikan koneksi Supabase tidak di-*pause*. Proyek gratis otomatis ter-pause setelah 1 minggu *idle*.
3. **Log tidak muncul di Admin Dashboard**:
   - Pastikan RLS (Row Level Security) mengizinkan penyisipan melalui kunci akses *Service Role* Vercel. Klien anonim diblokir dari semua tabel monitoring.
