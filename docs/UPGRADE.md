# Panduan Upgrade (Unfreezing)

Proyek ini telah dibekukan sementara (*Temporary Freeze*) pada rilis `v1.0.0`. Panduan ini menjelaskan cara melanjutkan pengembangan dengan aman tanpa merusak apa yang sudah ada.

## CARA MELANJUTKAN PROJECT SETELAH FREEZE

1. **Pull Latest Code:** Pastikan Anda memiliki kode terbaru dari repositori Github.
2. **Check Current Version:** Buka `CHANGELOG.md` dan pastikan Anda berada di versi yang tepat (Misal `v1.0.0`).
3. **Read CHANGELOG & ROADMAP:** Ketahui fitur apa yang sudah ada dan apa yang menjadi target selanjutnya.
4. **Read Relevant Prompt:** Baca instruksi pada Prompt selanjutnya (misal Prompt 23).
5. **Audit Current Implementation:** Jangan ubah kode secara membabi buta. Gunakan `docs/ARCHITECTURE.md` atau `docs/DATABASE.md` sebagai acuan.
6. **Create Feature Branch:** (Jika menggunakan Git) Buat cabang baru misal `git checkout -b feature/prompt-23`.
7. **Implement Next Prompt:** Lakukan *coding* dengan prinsip menjaga **Backward Compatibility** (Kontrak API tidak boleh berubah kecuali diberi versi baru).
8. **Run Tests:** `npm run typecheck` dan `npm run test:unit`.
9. **Run Build:** `npm run build`
10. **Deploy Preview:** Terapkan di lingkungan *Test* Vercel (bukan Production).
11. **Test:** Lakukan *Smoke Test* (keranjang belanja, login admin).
12. **Deploy Production:** Sebarkan jika semua tes berhasil.

> **PENTING:** Anda tidak perlu mengulang dari Prompt 1. Basis kode `v1.0.0` sudah cukup tangguh untuk ditambahkan fitur baru di atasnya secara inkremental.
