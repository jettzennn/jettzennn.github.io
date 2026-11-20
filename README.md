<div align="center">

# Mitsuyomi — Versi Statis

**Website baca manga, manhwa, dan manhua yang berjalan sepenuhnya di browser.**

![HTML](https://img.shields.io/badge/HTML-5-E34F26?logo=html5&logoColor=white)
![CSS](https://img.shields.io/badge/CSS-3-1572B6?logo=css3&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-Vanilla-F7DF1E?logo=javascript&logoColor=black)
![Hosting](https://img.shields.io/badge/hosting-GitHub%20Pages-222222?logo=github&logoColor=white)

</div>

---

## Tentang

Repositori ini adalah situs **[jettzennn.github.io](https://jettzennn.github.io)** — Mitsuyomi dalam bentuk statis: kumpulan berkas HTML, CSS, dan JavaScript yang disajikan oleh GitHub Pages tanpa server dan tanpa basis data. Browser pengunjung mengambil data komik langsung dari layanan data eksternal, sehingga beranda, pencarian, jelajahi genre, detail komik, dan reader tetap berjalan penuh.

Karena tidak ada server, **fitur akun (daftar/masuk) nonaktif** di versi ini. Versi lengkap dengan server Node.js dan basis data SQLite tersimpan di repositori utama: **[jettzennn/mitsuyomi](https://github.com/jettzennn/mitsuyomi)**.

## Fitur

- Beranda: rilis terbaru, populer, top komik, dan rekomendasi.
- Pencarian dengan hasil terurut judul utama terlebih dahulu + riwayat pencarian.
- Jelajahi 49 genre publik, kartu komik berlabel tipe (🇯🇵 Manga · 🇰🇷 Manhwa · 🇨🇳 Manhua) dan rating.
- Halaman detail lengkap dengan daftar chapter yang bisa difilter dan diurutkan.
- Reader vertikal dengan bilah progres dan navigasi chapter.
- Bookmark dan riwayat baca tersimpan di perangkat pengunjung.

## Cara Kerja

GitHub Pages menyajikan berkas di repositori ini apa adanya. Saat halaman dibuka, JavaScript di sisi klien memanggil layanan data komik, menormalisasi responsnya di browser, lalu merender hasilnya — tidak ada proses build dan tidak ada langkah tambahan.

## Lisensi

Proyek pribadi — seluruh hak cipta dilindungi. Silakan dipakai sebagai referensi belajar.
