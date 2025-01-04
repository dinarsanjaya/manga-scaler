# Scraping Komik Fansub (komiku.id)

Tools ini adalah sebuah alat untuk melakukan scraping komik dari situs **[komiku.id](https://komiku.id)** dan melakukan auto scaling gambar komik menggunakan **[waifu2x-ncnn-vulkan](https://github.com/nihui/waifu2x-ncnn-vulkan)** agar resolusi gambar tidak low (sakit mata). Oh iya, juga tidak lupa menyediakan viewer untuk membaca komik yang sudah di simpan.

## Fitur
- Scraping komik dari **komiku.id**.
- Auto scaling kualitas gambar komik menggunakan **waifu2x**.
- Web viewer untuk membaca komik yang telah di simpan.

## Perisiapan

### 1. Cara Kerja 
Tools ini akan melakukan scraping komik dengan url komik dari komiku, lalu melakukan scaling otomatis gambar komik menggunakan **[waifu2x-ncnn-vulkan](https://github.com/nihui/waifu2x-ncnn-vulkan)**. 
Pastikan folder waifu2x sudah diatur di file .env.

#### Persiapan:

- Pastikan kamu telah menginstal **[Bun](https://bun.sh)** untuk menjalankan proyek ini.
- waifu2x-ncnn-vulkan: Unduh dan setup **[waifu2x-ncnn-vulkan](https://github.com/nihui/waifu2x-ncnn-vulkan)** sesuai dokumentasinya.

#### Pengaturan:
- Download relase waifu2x sesuai OS yang digunakan.
- Folder waifu2x: Tentukan path folder waifu2x di file .env
- Folder penyimpanan defaultnya: komik/

#### Struktur Folder
```plaintext
📁 manga-scaler/
├── scrap.ts        # Script untuk scraping komik
├── index.ts        # Script untuk menjalankan viewer
├── komik/          # Folder default penyimpanan komik
├── .env            # File untuk konfigurasi folder waifu2x
```

#### Install Dependensi
``` bash
bun install
```

### 2. Scraping Komik
Untuk menjalankan proses scraping, gunakan perintah berikut:
```bash
bun run scrap

#atau

bun scrap.ts
```
Kemudian paste URL awal komik (bukan dichapter, tapi di list chapter). Pilih chapter untuk memulai download. Misal 5 atau 5.1 atau 5-1 sesuai chapter list komik.

### 3. Menjalankan Web Viewer
Untuk menjalankan viewer komik, gunakan salah satu dari perintah berikut:
```bash
bun .

# atau

bun index.ts

# atau

bun serve
```

#### Kontribusi
Jika kamu menemukan bug atau memiliki ide untuk fitur baru, jangan ragu untuk membuat issue atau pull request! Atau bisa juga langsung modifikasi sendiri.

### Lisensi
**MIT License**.