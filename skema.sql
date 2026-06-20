-- Tabel Metode Perhitungan Waktu Sholat
CREATE TABLE IF NOT EXISTS metode_perhitungan (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nama TEXT NOT NULL UNIQUE,
    sudut_subuh REAL NOT NULL,
    sudut_isya REAL NOT NULL
);

-- Tabel Metode Sholat / Madzhab (Penentuan Asar)
CREATE TABLE IF NOT EXISTS metode_sholat (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nama TEXT NOT NULL UNIQUE,
    faktor_ashar REAL NOT NULL
);

-- Masukkan Data Awal (Seed Data)
INSERT OR IGNORE INTO metode_perhitungan (nama, sudut_subuh, sudut_isya) VALUES
('Kemenag RI', 20.0, 18.0),
('Umm al-Qura (Makkah)', 18.5, 18.0),
('Liga Muslim Dunia (MWL)', 18.0, 17.0),
('Univ. Ilmu Islam Karachi', 18.0, 18.0),
('Mesir (EAS)', 19.5, 17.5);

INSERT OR IGNORE INTO metode_sholat (nama, faktor_ashar) VALUES
('Syafi''i / Maliki / Hanbali', 1.0),
('Hanafi', 2.0);
