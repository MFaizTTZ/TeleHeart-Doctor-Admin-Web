# TeleHeart Web – Dokter + Admin

Prototipe Next.js App Router / TypeScript untuk tugas kuliah. Dua peran: dokter dan admin.

## Cara jalan di VS Code (Windows PowerShell)

1. Ekstrak ZIP, masuk ke folder **teleheart-web** (yang berisi `package.json`).
2. Buka terminal VS Code, jalankan `npm install`.
3. Jalankan `npm run dev`.
4. Buka http://localhost:3000/login .
5. Pilih peran **Admin** atau **Dokter**, isi email/password demo, tekan masuk.

Demo admin: `admin@teleheart.demo` / `demo123`
Demo dokter: `dokter@teleheart.demo` / `demo123`

Login adalah simulasi: aplikasi menerima isian apa pun asalkan tidak kosong. Jangan gunakan sebagai autentikasi nyata. Pilihan peran disimpan di localStorage. Untuk mengganti peran, klik **Keluar**, lalu login kembali.

## Fitur admin
- Ringkasan jumlah akun pasien/dokter dan penugasan.
- Tambah akun simulasi, cari, aktif/nonaktif, hapus.
- Pilih dokter untuk masing-masing pasien.
- Perubahan akun/penugasan tersimpan di localStorage browser, **belum sinkron dengan halaman dokter** maupun aplikasi Android.

## Catatan teknis
- Frontend Next.js menggunakan Node.js, **tidak perlu menyalakan Apache/MySQL XAMPP**.
- Saat nanti backend XAMPP/PHP/MySQL tersedia, ganti data lokal dengan API dan terapkan autentikasi server, otorisasi peran, serta pembatasan akses pasien di backend.
- Semua data pasien dan pengukuran bersifat fiktif.
