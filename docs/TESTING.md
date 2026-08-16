# Testing Architecture

Proyek ini telah mengadopsi kerangka pengujian otomatis berbasis **Vitest**. Strategi pengujian dibagi berdasarkan *scope* komponen untuk meminimalisasi durasi CI (Continuous Integration) namun tetap mempertahankan reliabilitas logika.

## 1. Unit Testing
Lokasi: `tests/unit/`
Fokus utama Unit Testing:
- Logika kalkulasi mandiri (harga, poin, masa berlaku membership).
- Logika bebas *side-effect* (tanpa memanggil API eksternal atau database).
Contoh: `tests/unit/calculation.test.ts`.

## 2. Integration Testing
*Belum diimplementasi penuh pada tahap ini, namun dipersiapkan.*
Fokus utama:
- Interaksi antar-modul internal (e.g. `OrderService` ke `NotificationService`).
- Interaksi lokal ke basis data Supabase *Local*.
**Catatan**: JANGAN gunakan database *Production* untuk pengujian tipe ini. Gunakan *Supabase Local CLI* (`supabase start`).

## 3. E2E Testing (Batasan)
- Karena aplikasi ini berlandaskan pada antarmuka *Telegram Bot*, E2E murni (UI clicking) tidak dapat direplika dengan mudah.
- Sebagai alternatif, pengujian E2E dilakukan pada lapisan API `/api/webhook` dan web app Vercel.

## 4. Security Testing
- **Validasi Signature**: Pengujian Webhook API harus menyertakan skenario masuknya muatan data tanpa parameter _signature_ yang benar.
- Pengujian terhadap pengubahan *role* (pengguna awam mengakses `api/admin`).

## 5. Test Commands
Eksekusi dari _root_ proyek:
- `npm run test` : Menjalankan Vitest sekali jalan (mode *run*).
- `npm run test:unit` : Mengeksekusi secara spesifik di `tests/unit`.
- `npm run test:coverage` : Menghasilkan matriks cakupan kode (Code Coverage).

## 6. Test Environment
Buat fail `.env.test.example` yang menyerupai berkas kredensial tetapi diisi dengan parameter palsu (`BOT_TOKEN=123:test`). **Dilarang memasukkan rahasia Vercel & Midtrans asli**.
