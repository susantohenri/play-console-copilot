# 🚀 Play Console Copilot: Mentor & Detektif Aplikasi

Ekstensi Chrome berbasis Manifest V3 & Side Panel untuk menjelajahi Google Play Console, menerjemahkan analitik teknis menjadi cerita yang mudah dipahami, serta menyusun rencana aksi berprioritas (P1, P2, P3).

---

## 📦 Cara Memasang di Chrome (Cukup 1 Kali di Awal)

1. Buka browser Google Chrome, ketik di URL bar: `chrome://extensions/` lalu tekan **Enter**.
2. Di pojok kanan atas, aktifkan tombol switch **Developer mode** (Mode pengembang).
3. Di pojok kiri atas, klik tombol **Load unpacked** (Muat ekstensi yang belum dibongkar).
4. Pilih folder ini:
   ```text
   c:\Users\webhe\Downloads\MSI\Local Sites\play-console-extension
   ```
5. Ekstensi **Play Console Copilot** akan langsung muncul di daftar ekstensi!

---

## 🎯 Cara Menggunakan

1. **Buka Play Console:** Masuk ke akun [Google Play Console](https://play.google.com/console) dan klik aplikasi kamu (yang sudah dapat 70+ install).
2. **Buka Side Panel:** Klik ikon ekstensi di toolbar browser atau buka bilah samping (Side Panel).
3. **Mulai Jelajah:**
   - Klik tombol **`[🧭 Mulai Jelajahi Play Console]`**.
   - Ekstensi akan otomatis mengunjungi 4 Pos Kunci:
     - 🏪 **Pos 1: Lapak Toko** (`/store-performance`) — Pengunjung, download, conversion rate.
     - ⚡ **Pos 2: Kondisi Mesin** (`/vitals/crashes-anrs`) — Crash rate, ANR, tipe HP bermasalah.
     - 📈 **Pos 3: Retensi** (`/statistics`) — Perangkat aktif vs yang meng-uninstall.
     - 💬 **Pos 4: Suara Pengguna** (`/reviews`) — Bintang & keluhan pengguna.
4. **Baca Cerita & Daftar Prioritas:**
   - 🔴 **P1 (Kritis):** Wajib disentuh hari ini agar user baru tidak kabur.
   - 🟡 **P2 (Penting):** Hal untuk meningkatkan download dan konversi.
   - 🟢 **P3 (Penyempurnaan):** Optimasi ulasan, ukuran aplikasi, dll.
5. **Tanya Jawab Bebas:** Tanyakan apapun di kolom chat bawah (misal: *"Tipe HP apa yang paling banyak crash?"*).

---

## 🔄 SDLC & Siklus Revisi (Anti Ribet)

Jika ada perbaikan kode yang saya lakukan:
* **Kamu TIDAK PERLU hapus/pasang ulang.**
* Cukup buka `chrome://extensions/` lalu klik ikon **🔄 Reload** pada kartu ekstensi Play Console Copilot.
* Atau klik kanan di area Side Panel -> **Inspect** -> tekan `Ctrl + R`. Perubahan langsung aktif dalam 1 detik!
