# Panduan Operasional Sistem (Operations)

Panduan ini mendeskripsikan cara mengoperasikan Bot dan Web App dalam mode lokal maupun produksi.

## 1. Menjalankan Server Lokal (Development)
Sistem ini menggunakan arsitektur Vercel (Fungsi Serverless).
```bash
# Pastikan dependensi diinstal
npm install

# Jalankan server lokal
npx vercel dev
```

## 2. Mengekspos Webhook ke Telegram (Lokal)
Agar Bot menerima pesan, gunakan `ngrok`:
```bash
ngrok http 3000
```
Lalu atur URL webhook ke `https://<URL-NGROK-ANDA>/api/bot/webhook` melalui API Telegram.

## 3. Database Migration
```bash
npx supabase link --project-ref [PROYEK-ID-ANDA]
npx supabase db push
```

## 4. Deployment (Production)
Untuk menyebarkan aplikasi ke produksi di Vercel:
```bash
npx vercel --prod
```
Pastikan _Environment Variables_ di dasbor Vercel Production Anda mencakup:
- `TELEGRAM_BOT_TOKEN`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- Variabel Midtrans (jika digunakan)
