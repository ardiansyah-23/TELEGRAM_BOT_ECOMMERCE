# Skema Database (v1.0.0)

Dokumentasi ini merangkum tabel-tabel utama yang berada di dalam basis data Supabase PostgreSQL. Struktur ini tunduk pada perlindungan *Row Level Security* (RLS).

## 1. Modul Pengguna (Users)
*   `users`: Menyimpan profil pengguna. Relasi `telegram_id` berfungsi sebagai identitas utama (Primary Key).
*   `memberships`: Mencatat tier loyalitas (*Bronze, Silver, Gold*).
*   `points`: Mencatat saldo loyalitas dari transaksi.
*   `referrals`: Sistem kode afiliasi.

## 2. Modul Katalog Produk (E-Commerce)
*   `categories`: Grup produk.
*   `products`: Data barang induk (Katalog).
*   `product_variants`: SKU spesifik berdasarkan atribut (Misal: Kaos Merah Ukuran L).
*   `product_options` & `product_option_values`: Opsi dinamis.

## 3. Modul Pesanan & Pembayaran (Orders)
*   `cart` & `cart_items`: Penyimpanan keranjang belanja pengguna (*Temporary*).
*   `orders`: Induk transaksi.
*   `order_items`: Detail barang dalam 1 pesanan.
*   `payments`: Status penagihan (terhubung dengan Midtrans/Webhook Provider eksternal).
*   `coupons`: Potongan harga aktif.

## 4. Modul Inventaris & Stok (Inventory)
*   `inventories`: Mencatat stok total, dan *reserved_quantity* (stok tertahan saat *checkout* belum dibayar).
*   `inventory_movements`: Log keluar masuk barang secara absolut.
*   `inventory_reservations`: Log reservasi (akan dilepas jika pembayaran gagal).

## 5. Modul Tiket Dukungan (Support)
*   `support_tickets`: Laporan atau komplain pengguna.
*   `ticket_messages`: Pesan obrolan di dalam satu tiket.
*   `faq`: Basis pengetahuan balasan otomatis bot.

## 6. Modul Siaran & Notifikasi
*   `broadcasts`: Catatan siaran kampanye (*Marketing*).
*   `logs`: Audit log internal (*Admin actions*).

---
*(Tabel lain seperti `shipping` atau `translations` mungkin ada namun belum dilibatkan dalam logika aplikasi penuh pada rilis v1.0.0)*
