# Disaster Recovery Plan

Panduan ini ditujukan untuk merespons insiden *downtime*, korupsi data, atau kesalahan *deployment* yang melumpuhkan sebagian atau seluruh sistem produksi Telegram Bot.

## 1. Identifikasi Insiden & Penghentian Operasi Berisiko
Saat sebuah anomali kritikal (seperti *payment webhook loop* atau *stock decrement error*) ditemukan:
1. **Stop Traffic Utama**: Jika masalah sangat membahayakan keuangan (*Money Integrity*), segera ubah nilai `maintenance_mode` di tabel `system_settings` menjadi `true`. Ini akan memblokir perintah baru dari seluruh pengguna.
2. **Matikan Endpoint Webhook**: (Opsional tapi direkomendasikan jika API Vercel bermasalah) Cabut sementara *webhook* dari Telegram menggunakan API Telegram: `https://api.telegram.org/bot<TOKEN>/deleteWebhook`.

## 2. Check Database Integrity (Supabase)
Periksa log Supabase di bagian **Logs / Postgres Logs** atau lihat `system_logs`.
Jika kerusakan bersifat modifikasi data (*Destructive changes*):
- Karena project ini berada pada Supabase Free Tier, fitur **Point-in-Time Recovery (PITR) tidak tersedia**.
- Backup harian hanya mencakup *Logical Backup* (dump penuh otomatis sekali sehari di Supabase Free).

## 3. Identifikasi Backup & Restore
Jika tabel rusak parah (misal tak sengaja `DROP TABLE` di production):
1. Masuk ke **Database -> Backups** di *dashboard* Supabase.
2. Pilih iterasi harian terakhir yang sehat.
3. Lakukan **Restore**. Proses ini akan menimpa DB produksi dengan DB semalam (ada potensi kehilangan data pesanan antara waktu *backup* semalam hingga detik insiden terjadi).

## 4. Manual Recovery (Alternatif Skala Kecil)
Jika hanya *subset* tabel yang korup (seperti hilangnya 10 *campaign* terakhir), hindari *full restore*.
1. Periksa histori `activity_logs`.
2. Gunakan CSV Export mingguan jika ada (diunduh sebelumnya oleh Admin).
3. Buat skrip *patch* SQL (seperti *backfill*) dan eksekusi di SQL Editor.

## 5. Verifikasi Keberhasilan Pasca-Pemulihan
Jika DB sukses di-*restore*, Anda **harus** menjalankan `RECOVERY_CHECKLIST.md` sebelum menyalakan ulang lalu lintas publik. Ini menjamin Telegram API Token dan Payment Webhook masih sinkron dengan keadaan kode yang terbaru.

## 6. Lanjutkan Lalu Lintas (Resume Traffic)
Setelah semua verifikasi lolos:
1. Pasang ulang Webhook: `https://api.telegram.org/bot<TOKEN>/setWebhook?url=<VERCEL_URL>...`
2. Ubah `maintenance_mode` menjadi `false`.
3. Informasikan kepada pengguna melalui Telegram Broadcast bahwa sistem sudah kembali pulih (opsional).
