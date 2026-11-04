-- Validasi struktur database SIBATA (MySQL 8+ / MariaDB)
-- Read-only: tidak membuat, mengubah, atau menghapus database/tabel/data.
-- Jalankan dari client SQL yang memiliki akses ke INFORMATION_SCHEMA.



-- 1) Database tersedia?
SELECT
    @target_db AS database_diperiksa,
    IF(SCHEMA_NAME IS NULL, 'TIDAK ADA', 'ADA') AS status_database
FROM (SELECT SCHEMA_NAME
      FROM INFORMATION_SCHEMA.SCHEMATA
      WHERE SCHEMA_NAME = @target_db) AS found
RIGHT JOIN (SELECT @target_db AS expected_db) AS expected
    ON found.SCHEMA_NAME = expected.expected_db;

-- 2) Daftar tabel wajib dan status keberadaan
SELECT required.table_name AS tabel,
       CASE WHEN actual.TABLE_NAME IS NULL THEN 'HILANG' ELSE 'ADA' END AS status
FROM (
    SELECT 'kabupaten_kota' AS table_name
    UNION ALL SELECT 'wilayah'
    UNION ALL SELECT 'pemilik'
    UNION ALL SELECT 'status_lahan'
    UNION ALL SELECT 'data_sawah'
    UNION ALL SELECT 'infrastruktur'
    UNION ALL SELECT 'sawah_infrastruktur'
    UNION ALL SELECT 'kandidat_lokasi'
) AS required
LEFT JOIN INFORMATION_SCHEMA.TABLES AS actual
    ON actual.TABLE_SCHEMA = @target_db
   AND actual.TABLE_NAME = required.table_name
ORDER BY required.table_name;

-- 3) Kolom wajib: keberadaan dan tipe dasar.
-- Perbedaan tipe/atribut ditampilkan sebagai TIDAK SESUAI.
SELECT expected.table_name AS tabel,
       expected.column_name AS kolom,
       expected.expected_type AS tipe_diharapkan,
       actual.COLUMN_TYPE AS tipe_aktual,
        CASE
           WHEN actual.COLUMN_NAME IS NULL THEN 'HILANG'

           WHEN LOWER(expected.expected_type) = 'int unsigned'
                AND LOWER(actual.DATA_TYPE) = 'int'
                AND LOWER(actual.COLUMN_TYPE) LIKE '%unsigned%'
               THEN 'SESUAI'

           WHEN LOWER(expected.expected_type) = 'tinyint unsigned'
                AND LOWER(actual.DATA_TYPE) = 'tinyint'
                AND LOWER(actual.COLUMN_TYPE) LIKE '%unsigned%'
               THEN 'SESUAI'

           WHEN LOWER(actual.COLUMN_TYPE) = LOWER(expected.expected_type)
               THEN 'SESUAI'

           ELSE 'PERIKSA TIPE'
       END AS status
FROM (
    SELECT 'kabupaten_kota' table_name, 'id' column_name, 'varchar(10)' expected_type
    UNION ALL SELECT 'kabupaten_kota','nama','varchar(100)'
    UNION ALL SELECT 'kabupaten_kota','jenis',"enum('Kabupaten','Kota')"

    UNION ALL SELECT 'wilayah','id','varchar(10)'
    UNION ALL SELECT 'wilayah','kabupaten_kota_id','varchar(10)'
    UNION ALL SELECT 'wilayah','kecamatan','varchar(100)'
    UNION ALL SELECT 'wilayah','desa','varchar(100)'
    UNION ALL SELECT 'wilayah','total_lahan_baku_ha','decimal(10,2)'
    UNION ALL SELECT 'wilayah','risiko_banjir',"enum('Rendah','Sedang','Tinggi')"
    UNION ALL SELECT 'wilayah','risiko_gempa',"enum('Rendah','Sedang','Tinggi')"
    UNION ALL SELECT 'wilayah','risiko_longsor',"enum('Rendah','Sedang','Tinggi')"

    UNION ALL SELECT 'pemilik','id','varchar(10)'
    UNION ALL SELECT 'pemilik','nama','varchar(150)'
    UNION ALL SELECT 'pemilik','jenis',"enum('Perorangan','Kelompok Tani')"
    UNION ALL SELECT 'pemilik','kontak','varchar(30)'

    UNION ALL SELECT 'status_lahan','id','varchar(10)'
    UNION ALL SELECT 'status_lahan','kategori','varchar(100)'
    UNION ALL SELECT 'status_lahan','boleh_alih_fungsi','tinyint(1)'
    UNION ALL SELECT 'status_lahan','dasar_hukum','text'

    UNION ALL SELECT 'data_sawah','id','varchar(10)'
    UNION ALL SELECT 'data_sawah','nomor_persil','varchar(50)'
    UNION ALL SELECT 'data_sawah','pemilik_id','varchar(10)'
    UNION ALL SELECT 'data_sawah','wilayah_id','varchar(10)'
    UNION ALL SELECT 'data_sawah','status_lahan_id','varchar(10)'
    UNION ALL SELECT 'data_sawah','luas_hektar','decimal(8,2)'
    UNION ALL SELECT 'data_sawah','jenis_sawah',"enum('Tadah Hujan','Setengah Teknis','Irigasi Teknis')"
    UNION ALL SELECT 'data_sawah','latitude','decimal(10,8)'
    UNION ALL SELECT 'data_sawah','longitude','decimal(11,8)'

    UNION ALL SELECT 'infrastruktur','id','varchar(10)'
    UNION ALL SELECT 'infrastruktur','nama','varchar(150)'
    UNION ALL SELECT 'infrastruktur','jenis',"enum('Listrik','Fiber Optik','Jalan Tol','Sumber Air','Irigasi','Akses Jalan')"
    UNION ALL SELECT 'infrastruktur','kondisi',"enum('Baik','Rusak Ringan','Butuh Perbaikan')"
    UNION ALL SELECT 'infrastruktur','kapasitas','decimal(10,2)'
    UNION ALL SELECT 'infrastruktur','satuan_kapasitas','varchar(30)'
    UNION ALL SELECT 'infrastruktur','wilayah_id','varchar(10)'
    UNION ALL SELECT 'infrastruktur','latitude','decimal(10,8)'
    UNION ALL SELECT 'infrastruktur','longitude','decimal(11,8)'

    UNION ALL SELECT 'sawah_infrastruktur','sawah_id','varchar(10)'
    UNION ALL SELECT 'sawah_infrastruktur','infrastruktur_id','varchar(10)'
    UNION ALL SELECT 'sawah_infrastruktur','jarak_meter','int unsigned'

    UNION ALL SELECT 'kandidat_lokasi','id','varchar(10)'
    UNION ALL SELECT 'kandidat_lokasi','sawah_id','varchar(10)'
    UNION ALL SELECT 'kandidat_lokasi','nama_blok','varchar(150)'
    UNION ALL SELECT 'kandidat_lokasi','skor_kelayakan','tinyint unsigned'
    UNION ALL SELECT 'kandidat_lokasi','status_penilaian',"enum('Layak','Dipertimbangkan','Tidak Layak')"
    UNION ALL SELECT 'kandidat_lokasi','catatan','text'
    UNION ALL SELECT 'kandidat_lokasi','tanggal_penilaian','date'
) AS expected
LEFT JOIN INFORMATION_SCHEMA.COLUMNS AS actual
    ON actual.TABLE_SCHEMA = @target_db
   AND actual.TABLE_NAME = expected.table_name
   AND actual.COLUMN_NAME = expected.column_name
ORDER BY expected.table_name, expected.column_name;

-- 4) Primary key dan unique key yang diharapkan.
-- Hasil menampilkan indeks yang ada; bandingkan dengan indeks wajib di bawah.
SELECT TABLE_NAME AS tabel,
       INDEX_NAME AS nama_indeks,
       NON_UNIQUE AS tidak_unik,
       GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX) AS kolom
FROM INFORMATION_SCHEMA.STATISTICS
WHERE TABLE_SCHEMA = @target_db
  AND TABLE_NAME IN (
      'kabupaten_kota','wilayah','pemilik','status_lahan','data_sawah',
      'infrastruktur','sawah_infrastruktur','kandidat_lokasi'
  )
GROUP BY TABLE_NAME, INDEX_NAME, NON_UNIQUE
ORDER BY TABLE_NAME, INDEX_NAME;

-- Indeks yang harus ada:
-- PRIMARY KEY: kabupaten_kota(id), wilayah(id), pemilik(id), status_lahan(id),
-- data_sawah(id), infrastruktur(id), sawah_infrastruktur(sawah_id,infrastruktur_id),
-- kandidat_lokasi(id)
-- UNIQUE: data_sawah(nomor_persil), kandidat_lokasi(sawah_id)

-- 5) Foreign key yang ada pada tabel wajib.
-- Bandingkan nama kolom dan tabel referensi dengan skema yang diharapkan.
SELECT kcu.TABLE_NAME AS tabel,
       kcu.CONSTRAINT_NAME AS nama_constraint,
       kcu.COLUMN_NAME AS kolom,
       kcu.REFERENCED_TABLE_NAME AS tabel_referensi,
       kcu.REFERENCED_COLUMN_NAME AS kolom_referensi,
       rc.UPDATE_RULE AS aturan_update,
       rc.DELETE_RULE AS aturan_delete
FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE AS kcu
LEFT JOIN INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS AS rc
    ON rc.CONSTRAINT_SCHEMA = kcu.CONSTRAINT_SCHEMA
   AND rc.CONSTRAINT_NAME = kcu.CONSTRAINT_NAME
   AND rc.TABLE_NAME = kcu.TABLE_NAME
WHERE kcu.TABLE_SCHEMA = @target_db
  AND kcu.REFERENCED_TABLE_NAME IS NOT NULL
  AND kcu.TABLE_NAME IN (
      'wilayah','data_sawah','infrastruktur','sawah_infrastruktur','kandidat_lokasi'
  )
ORDER BY kcu.TABLE_NAME, kcu.CONSTRAINT_NAME, kcu.ORDINAL_POSITION;

-- 6) Engine dan charset tabel.
SELECT TABLE_NAME AS tabel,
       ENGINE AS engine,
       TABLE_COLLATION AS collation
FROM INFORMATION_SCHEMA.TABLES
WHERE TABLE_SCHEMA = @target_db
  AND TABLE_TYPE = 'BASE TABLE'
ORDER BY TABLE_NAME;

-- Catatan:
-- Pastikan koneksi memiliki akses ke INFORMATION_SCHEMA.
-- Bagian kolom memeriksa tipe kolom wajib, tetapi bukan seluruh atribut
-- seperti NULL/NOT NULL, DEFAULT, urutan kolom, atau semua aturan indeks/FK.
