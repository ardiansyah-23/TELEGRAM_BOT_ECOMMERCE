# Recovery Checklist

Gunakan daftar centang (checklist) ini pasca-insiden untuk memastikan sistem stabil sebelum membuka kembali akses bagi pelanggan.

## Fase 1: Pra-Pemulihan (Identification)
- [ ] **Identify incident:** Tentukan apakah masalah bersumber dari Database, Vercel (Timeout/Build), Telegram API, atau Payment Gateway.
- [ ] **Check application health:** Buka dashboard Admin, periksa panel `System Health`.
- [ ] **Check database health:** Pastikan RLS masih menyala dan tabel tidak terkunci (`AccessExclusiveLock`).
- [ ] **Identify recovery point:** Tentukan waktu *backup* terakhir yang aman untuk di-*restore* (jika kerusakan butuh *restore*).

## Fase 2: Tindakan Pemulihan (Recovery)
- [ ] **Restore if required:** Kembalikan *database* dari *backup* harian Supabase, jika mutlak diperlukan.
- [ ] **Check recent migration:** Cek apakah migrasi terakhir yang menyebabkan kerusakan. Jika ya, *rollback* kode dan struktur DB.
- [ ] **Run integrity checks:** Periksa log Vercel apakah masih dibanjiri *Error* baru yang sama.

## Fase 3: Pasca-Pemulihan (Verification)
- [ ] **Verify critical tables:** Jalankan query manual untuk memastikan `users`, `products`, `orders` utuh.
- [ ] **Verify payment consistency:** Cocokkan Dasbor *Payment Gateway* (seperti Midtrans) dengan status `orders` hari ini. Jika ada *payment* berstatus *Settled* di Gateway tapi di sistem `pending` akibat *downtime*, lakukan update manual.
- [ ] **Verify order consistency:** Pastikan pesanan yang tertunda tidak membuat stok bernilai negatif.
- [ ] **Check Telegram webhook:** Panggil ulang `setWebhook` dan pastikan tidak muncul eror SSL/Timeout.
- [ ] **Check payment webhook:** Lakukan simulasi pembayaran satu produk murah untuk menstimulasi masuknya notifikasi webhook dan mengubah status `pending` ke `paid`.
- [ ] **Check cron / scheduler:** Pantau 15 menit ke depan apakah pekerjaan-pekerjaan tertunda pada tabel `scheduled_jobs` berhasil di-*claim* dan dieksekusi.
- [ ] **Verify Admin Dashboard:** Pastikan statistik seperti jumlah *Revenue* dan metrik lainnya akurat.

Jika semua tahapan di atas telah mendapatkan status (✅) *Checked*, **sistem dijamin siap beroperasi normal**.
