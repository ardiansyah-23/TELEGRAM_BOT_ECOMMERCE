# Migration & Deployment Procedure

Proyek ini tidak mengandalkan VPS, sehingga strategi penyebaran (Deployment) berpusat penuh pada interaksi mulus antara repositori GitHub, sinkronisasi Vercel, dan manajemen skema Supabase PostgreSQL. 

Langkah operasional yang dijabarkan di bawah harus ditaati demi menjaga *Backward Compatibility* serta *Transaction Safety*.

## 1. Aturan Penamaan Migrasi
1. Harus berekstensi `.sql`.
2. Harus diprefiks nomor urut terpadu, contoh:
   - `001_initial_schema.sql`
   - `010_observability.sql`
   - `011_new_feature.sql`
3. Gunakan mode penyusunan deklaratif `CREATE TABLE IF NOT EXISTS` atau `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` sebisa mungkin agar migrasi tahan dari eror bentrok.

## 2. Aturan Keamanan Migrasi (Safety Guardrails)
- **Non-Destructive**: DILARANG KERAS mengeksekusi `DROP COLUMN` atau `DROP TABLE` tanpa alasan migrasi platform arsitektural. Jika fitur usang, utamakan metode **Soft Delete** (`is_active = false` atau `deleted_at = NOW()`). Tabel seperti `products`, `subscription_plans`, dan `campaigns` harus menerapkan pola ini demi merawat riwayat referensial FK di `order_items` dan tagihan.
- **Backward Compatible**: Pastikan kode *backend* lama di Vercel tidak *crash* jika membaca tabel yang skemanya mendadak diperbarui sebelum proses *deployment backend* Vercel selesai mengompilasi.

## 3. Standar Operasional Prosedur (SOP) Deployment

1. **Backup / Check Recovery**  
   Pastikan Anda tidak menaruh `011_destructive_action.sql` pada jam sibuk, periksa apakah Supabase *backup* harian hari tersebut sudah terbentuk.
2. **Review Migration**  
   Analisis sintaks secara manual (Foreign Keys, Indexes, *Transactions locking* via `FOR UPDATE`). 
3. **Test Migration**  
   Jika menggunakan *Staging DB* (atau cabang *Preview*), jalankan skema SQL pada lingkungan non-produksi terlebih dahulu.
4. **Apply Migration**  
   Terapkan struktur tabel baru di produksi (Supabase SQL Editor / CLI Supabase: `npx supabase db push`).
5. **Run Integrity Checks**  
   Pastikan tidak ada eror relasional antara pengguna & tabel baru.
6. **Run Typecheck / Build**  
   Jalankan `npx tsc --noEmit` secara luring untuk memastikan *TypeScript backend* sejajar dengan tipe DB terbaru.
7. **Deploy**  
   *Push* kode aplikasi baru ke cabang `main` GitHub agar Vercel otomatis melakukan *Trigger Build*.
8. **Verify Health**  
   Gunakan dasbor Admin Telegram Web App untuk memverifikasi `api/admin/health` bahwa aplikasi terhubung lancar.
9. **Verify Critical Flows**  
   Cobalah skenario interaksi *Checkout* dan navigasi UI ringan untuk mengonfirmasi bahwa penanganan *state* tidak macet.

## 4. Perlindungan Data Produksi (Data Exposure Prevention)
- Kredensial *Production* (seperti `SUPABASE_KEY_SERVICE_ROLE`, rahasia *Payment Gateway*) DILARANG diduplikasi ke dalam *file* `.env.local` saat *Engineer* meracik fitur baru secara lokal. 
- Usahakan pengujian destruktif tak berjejaring secara fisik ke data pengguna asli produksi. Jangan merusak kredibilitas uang dan inventori stok produksi hanya untuk *"testing"*.
