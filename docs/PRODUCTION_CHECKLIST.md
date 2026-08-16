# Production Checklist

Sebelum memproklamirkan bahwa peluncuran ke publik (*Production Launch*) berhasil, periksa daftar validasi ini:

- [ ] **CI passing**: Indikator GitHub Actions berwarna Hijau (Semua langkah berhasil).
- [ ] **Tests passing**: Laporan cakupan *Unit Test* Vitest lolos tanpa satupun failur.
- [ ] **Build passing**: Vercel sukses melakukan instalasi NPM dan kompilasi *TypeScript* (`tsc`).
- [ ] **Preview tested**: *Staging* atau pratinjau Vercel sebelumnya telah dicoba interaksinya melalui *Bot Test*.
- [ ] **Production environment configured**: Tidak ada rahasia (secrets) lingkungan pratinjau (seperti Stripe Sandbox/Midtrans Sandbox) yang tertinggal di dasbor Vercel *Production*.
- [ ] **Database migration reviewed**: Berkas skema `.sql` terakhir sudah didorong (di-*push*) ke SQL Editor Supabase.
- [ ] **Backup/recovery checked**: *Automated Backup* Supabase hari ini aktif.
- [ ] **Deployment completed**: URL Production Vercel merespons kode `200` pada rute `api/admin/health`.
- [ ] **Health check passed**: Statistik metrik basis data dan RAM pada panel kesehatan stabil.
- [ ] **Telegram webhook verified**: Perintah `/start` direspons di bawah 1 detik tanpa indikasi *timeout*.
- [ ] **Payment webhook verified**: Simulasi *Checkout* berhasil (tidak terjadi _infinite loop_).
- [ ] **Cron verified**: URL `/api/cron` berhasil dipanggil oleh infrastruktur penjadwal luar (seperti Vercel Cron/Upstash) tanpa eror.
- [ ] **Admin Dashboard verified**: Laman Admin terautentikasi dan data bagan termuat dengan presisi.
- [ ] **User Web App verified**: Telegram Web App peluncuran pertama kali berjalan mulus tanpa masalah CORS.
- [ ] **Smoke test passed**: *Checkout* barang uji coba hingga status *pending* lalu batalkan (*Cancel*) berhasil mengubah status stok kembali tanpa korupsi data.
