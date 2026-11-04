-- ==============================================================================

-- Buat database jika belum ada (opsional)
-- CREATE DATABASE IF NOT EXISTS sibata_db;
-- USE sibata_db;

-- Nonaktifkan pengecekan foreign key sementara agar pembuatan tabel berjalan mulus
SET FOREIGN_KEY_CHECKS = 0;

-- ------------------------------------------------------------------------------
-- 1. TABEL kabupaten_kota
-- Menyimpan daftar kabupaten/kota tingkat II di Jawa Barat
-- ------------------------------------------------------------------------------
DROP TABLE IF EXISTS kabupaten_kota;
CREATE TABLE kabupaten_kota (
    id VARCHAR(10) NOT NULL,
    nama VARCHAR(100) NOT NULL,
    jenis ENUM('Kabupaten', 'Kota') NOT NULL DEFAULT 'Kabupaten',
    PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ------------------------------------------------------------------------------
-- 2. TABEL wilayah
-- Menyimpan data administratif desa/kecamatan beserta profil risiko bencana alam
-- ------------------------------------------------------------------------------
DROP TABLE IF EXISTS wilayah;
CREATE TABLE wilayah (
    id VARCHAR(10) NOT NULL,
    kabupaten_kota_id VARCHAR(10) NOT NULL,
    kecamatan VARCHAR(100) NOT NULL,
    desa VARCHAR(100) NOT NULL,
    total_lahan_baku_ha DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    risiko_banjir ENUM('Rendah', 'Sedang', 'Tinggi') NOT NULL DEFAULT 'Rendah',
    risiko_gempa ENUM('Rendah', 'Sedang', 'Tinggi') NOT NULL DEFAULT 'Rendah',
    risiko_longsor ENUM('Rendah', 'Sedang', 'Tinggi') NOT NULL DEFAULT 'Rendah',
    PRIMARY KEY (id),
    CONSTRAINT fk_wilayah_kabupaten 
        FOREIGN KEY (kabupaten_kota_id) REFERENCES kabupaten_kota (id) 
        ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ------------------------------------------------------------------------------
-- 3. TABEL pemilik
-- Menyimpan data petani perorangan atau kelompok tani pemilik lahan
-- ------------------------------------------------------------------------------
DROP TABLE IF EXISTS pemilik;
CREATE TABLE pemilik (
    id VARCHAR(10) NOT NULL,
    nama VARCHAR(150) NOT NULL,
    jenis ENUM('Perorangan', 'Kelompok Tani') NOT NULL DEFAULT 'Perorangan',
    kontak VARCHAR(30) DEFAULT NULL,
    PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ------------------------------------------------------------------------------
-- 4. TABEL status_lahan
-- Menyimpan status hukum lahan (penentu utama apakah lahan boleh dialihfungsikan)
-- ------------------------------------------------------------------------------
DROP TABLE IF EXISTS status_lahan;
CREATE TABLE status_lahan (
    id VARCHAR(10) NOT NULL,
    kategori VARCHAR(100) NOT NULL,
    boleh_alih_fungsi BOOLEAN NOT NULL DEFAULT FALSE,
    dasar_hukum TEXT DEFAULT NULL,
    PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ------------------------------------------------------------------------------
-- 5. TABEL data_sawah
-- Tabel fakta fisik setiap petak lahan sawah
-- ------------------------------------------------------------------------------
DROP TABLE IF EXISTS data_sawah;
CREATE TABLE data_sawah (
    id VARCHAR(10) NOT NULL,
    nomor_persil VARCHAR(50) NOT NULL,
    pemilik_id VARCHAR(10) NOT NULL,
    wilayah_id VARCHAR(10) NOT NULL,
    status_lahan_id VARCHAR(10) NOT NULL,
    luas_hektar DECIMAL(8, 2) NOT NULL,
    jenis_sawah ENUM('Tadah Hujan', 'Setengah Teknis', 'Irigasi Teknis') NOT NULL DEFAULT 'Tadah Hujan',
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_nomor_persil (nomor_persil),
    CONSTRAINT fk_sawah_pemilik 
        FOREIGN KEY (pemilik_id) REFERENCES pemilik (id) 
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_sawah_wilayah 
        FOREIGN KEY (wilayah_id) REFERENCES wilayah (id) 
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_sawah_status 
        FOREIGN KEY (status_lahan_id) REFERENCES status_lahan (id) 
        ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ------------------------------------------------------------------------------
-- 6. TABEL infrastruktur
-- Fasilitas penting di sekitar lahan (Gardu Listrik, Fiber Optik, Tol, Sumber Air)
-- ------------------------------------------------------------------------------
DROP TABLE IF EXISTS infrastruktur;
CREATE TABLE infrastruktur (
    id VARCHAR(10) NOT NULL,
    nama VARCHAR(150) NOT NULL,
    jenis ENUM('Listrik', 'Fiber Optik', 'Jalan Tol', 'Sumber Air', 'Irigasi', 'Akses Jalan') NOT NULL,
    kondisi ENUM('Baik', 'Rusak Ringan', 'Butuh Perbaikan') NOT NULL DEFAULT 'Baik',
    kapasitas DECIMAL(10, 2) DEFAULT NULL,
    satuan_kapasitas VARCHAR(30) DEFAULT NULL,
    wilayah_id VARCHAR(10) NOT NULL,
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT fk_infrastruktur_wilayah 
        FOREIGN KEY (wilayah_id) REFERENCES wilayah (id) 
        ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ------------------------------------------------------------------------------
-- 7. TABEL sawah_infrastruktur (Junction Table Many-to-Many)
-- Menghubungkan petak sawah ke fasilitas infrastruktur beserta jaraknya
-- ------------------------------------------------------------------------------
DROP TABLE IF EXISTS sawah_infrastruktur;
CREATE TABLE sawah_infrastruktur (
    sawah_id VARCHAR(10) NOT NULL,
    infrastruktur_id VARCHAR(10) NOT NULL,
    jarak_meter INT UNSIGNED NOT NULL,
    PRIMARY KEY (sawah_id, infrastruktur_id),
    CONSTRAINT fk_si_sawah 
        FOREIGN KEY (sawah_id) REFERENCES data_sawah (id) 
        ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_si_infra 
        FOREIGN KEY (infrastruktur_id) REFERENCES infrastruktur (id) 
        ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ------------------------------------------------------------------------------
-- 8. TABEL kandidat_lokasi
-- Hasil akhir evaluasi kelayakan lahan sebagai lokasi data center AI
-- ------------------------------------------------------------------------------
DROP TABLE IF EXISTS kandidat_lokasi;
CREATE TABLE kandidat_lokasi (
    id VARCHAR(10) NOT NULL,
    sawah_id VARCHAR(10) NOT NULL,
    nama_blok VARCHAR(150) NOT NULL,
    skor_kelayakan TINYINT UNSIGNED NOT NULL DEFAULT 0,
    status_penilaian ENUM('Layak', 'Dipertimbangkan', 'Tidak Layak') NOT NULL DEFAULT 'Dipertimbangkan',
    catatan TEXT DEFAULT NULL,
    tanggal_penilaian DATE NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_kandidat_sawah (sawah_id),
    CONSTRAINT fk_kandidat_sawah 
        FOREIGN KEY (sawah_id) REFERENCES data_sawah (id) 
        ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Aktifkan kembali pengecekan foreign key
SET FOREIGN_KEY_CHECKS = 1;