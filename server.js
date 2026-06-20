const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Database SQLite
const dbPath = process.env.DATABASE_PATH || path.join(__dirname, 'falakiyah.db');
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) console.error('Gagal membuka database:', err.message);
  else console.log('Terhubung ke database SQLite.');
});

// Jalankan Skema Database
db.serialize(() => {
  const skemaSql = fs.readFileSync(path.join(__dirname, 'skema.sql'), 'utf8');
  db.exec(skemaSql, (err) => {
    if (err) console.error('Gagal menjalankan skema SQL:', err.message);
    else console.log('Skema database siap.');
  });
});

// --- RUMUS MATEMATIKA FALAKIYAH (MINIMALIS) ---
const rad = (d) => (d * Math.PI) / 180;
const deg = (r) => (r * 180) / Math.PI;

// Hari Julian (JD)
function dapatkanJD(tahun, bulan, hari) {
  if (bulan <= 2) {
    tahun -= 1;
    bulan += 12;
  }
  let A = Math.floor(tahun / 100);
  let B = 2 - A + Math.floor(A / 4);
  return Math.floor(365.25 * (tahun + 4716)) + Math.floor(30.6001 * (bulan + 1)) + hari + B - 1524.5;
}

// Deklinasi & Perataan Waktu Matahari
function hitungMatahari(jd) {
  let D = jd - 2451545.0;
  let g = 357.529 + 0.98560028 * D;
  let q = 280.459 + 0.98564736 * D;
  let L = q + 1.915 * Math.sin(rad(g)) + 0.020 * Math.sin(rad(2 * g));
  let e = 23.439 - 0.00000036 * D;
  let dd = deg(Math.asin(Math.sin(rad(e)) * Math.sin(rad(L))));
  let RA = deg(Math.atan2(Math.cos(rad(e)) * Math.sin(rad(L)), Math.cos(rad(L)))) / 15;
  RA = RA < 0 ? RA + 24 : RA;
  let U = D / 36525.0;
  let L_mean = (280.46607 + 36000.7698 * U) % 360;
  let ET = (L_mean / 15) - RA;
  if (ET > 20) ET -= 24;
  if (ET < -20) ET += 24;
  return { deklinasi: dd, perataanWaktu: ET };
}

// Jadwal Sholat
function hitungJadwalSholat(tanggalStr, lintang, bujur, zonaWaktu, sudutSubuh, sudutIsya, faktorAshar, ketinggian = 0) {
  const tgl = new Date(tanggalStr);
  const jd = dapatkanJD(tgl.getFullYear(), tgl.getMonth() + 1, tgl.getDate());
  const { deklinasi: dec, perataanWaktu: et } = hitungMatahari(jd);

  let dzuhur = 12 + zonaWaktu - bujur / 15 - et;

  const hitungH = (sudutAlt) => {
    let cosH = (Math.sin(rad(sudutAlt)) - Math.sin(rad(lintang)) * Math.sin(rad(dec))) /
               (Math.cos(rad(lintang)) * Math.cos(rad(dec)));
    if (cosH > 1 || cosH < -1) return null;
    return deg(Math.acos(cosH)) / 15;
  };

  let subuh = dzuhur - (hitungH(-sudutSubuh) || 0);
  let syuruq = dzuhur - (hitungH(-0.8333 - 0.0347 * Math.sqrt(ketinggian)) || 0);
  
  let altAshar = deg(Math.atan(1 / (faktorAshar + Math.tan(rad(Math.abs(lintang - dec))))));
  let ashar = dzuhur + (hitungH(altAshar) || 0);
  
  let maghrib = dzuhur + (hitungH(-0.8333 - 0.0347 * Math.sqrt(ketinggian)) || 0);
  let isya = dzuhur + (hitungH(-sudutIsya) || 0);

  const formatJam = (jamDesimal, offsetMenit) => {
    if (!jamDesimal) return '--:--';
    let totalMenit = Math.round(jamDesimal * 60) + offsetMenit;
    totalMenit = (totalMenit + 1440) % 1440;
    return `${String(Math.floor(totalMenit / 60)).padStart(2, '0')}:${String(totalMenit % 60).padStart(2, '0')}`;
  };

  return {
    subuh: formatJam(subuh, 2),
    syuruq: formatJam(syuruq, -2),
    dzuhur: formatJam(dzuhur, 2),
    ashar: formatJam(ashar, 2),
    maghrib: formatJam(maghrib, 2),
    isya: formatJam(isya, 2)
  };
}

// Konverter Hijriah (Tabular)
function masehiKeHijriah(y, m, d) {
  let jd = dapatkanJD(y, m, d) + 0.5;
  let selisih = jd - 1948439.5;
  let siklus = Math.floor(selisih / 10631);
  let sisaSiklus = selisih % 10631;
  if (sisaSiklus < 0) { sisaSiklus += 10631; siklus -= 1; }
  
  let kabisat = [2, 5, 7, 10, 13, 16, 18, 21, 24, 26, 29];
  let tahunSiklus = 0, hariTahun = 0;
  for (let i = 1; i <= 30; i++) {
    let hariSatuTahun = kabisat.includes(i) ? 355 : 354;
    if (sisaSiklus < hariSatuTahun) {
      tahunSiklus = i - 1;
      hariTahun = sisaSiklus;
      break;
    }
    sisaSiklus -= hariSatuTahun;
  }
  let hTahun = siklus * 30 + tahunSiklus + 1;
  let hBulan = 0, hHari = 0;
  for (let i = 1; i <= 12; i++) {
    let hariSatuBulan = (i % 2 === 1) ? 30 : 29;
    if (i === 12 && kabisat.includes(((hTahun - 1) % 30) + 1)) hariSatuBulan = 30;
    if (hariTahun < hariSatuBulan) {
      hBulan = i;
      hHari = Math.floor(hariTahun) + 1;
      break;
    }
    hariTahun -= hariSatuBulan;
  }
  return { tahun: hTahun, bulan: hBulan, hari: hHari };
}

function hijriahKeMasehi(y, m, d) {
  let kabisat = [2, 5, 7, 10, 13, 16, 18, 21, 24, 26, 29];
  let siklus = Math.floor((y - 1) / 30);
  let tahunSiklus = (y - 1) % 30;
  let jd = 1948439.5 + siklus * 10631;
  for (let i = 1; i <= tahunSiklus; i++) {
    jd += kabisat.includes(i) ? 355 : 354;
  }
  for (let i = 1; i < m; i++) {
    let hariSatuBulan = (i % 2 === 1) ? 30 : 29;
    if (i === 12 && kabisat.includes((y - 1) % 30 + 1)) hariSatuBulan = 30;
    jd += hariSatuBulan;
  }
  jd += d - 1;
  let z = Math.floor(jd + 0.5);
  let f = (jd + 0.5) - z;
  let A = z;
  if (z >= 2299161) {
    let alpha = Math.floor((z - 1867216.25) / 36524.25);
    A = z + 1 + alpha - Math.floor(alpha / 4);
  }
  let B = A + 1524;
  let C = Math.floor((B - 122.1) / 365.25);
  let D = Math.floor(365.25 * C);
  let E = Math.floor((B - D) / 30.6001);
  let hari = B - D - Math.floor(30.6001 * E) + f;
  let bulan = (E < 14) ? E - 1 : E - 13;
  let tahun = (bulan > 2) ? C - 4716 : C - 4715;
  return { tahun, bulan, hari: Math.round(hari) };
}

// --- API ENDPOINTS (BAHASA INDONESIA) ---

// 1. Metode Perhitungan
app.get('/api/metode-perhitungan', (req, res) => {
  db.all('SELECT * FROM metode_perhitungan', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/metode-perhitungan', (req, res) => {
  const { nama, sudut_subuh, sudut_isya } = req.body;
  if (!nama || sudut_subuh == null || sudut_isya == null) {
    return res.status(400).json({ error: 'Data tidak lengkap' });
  }
  db.run('INSERT INTO metode_perhitungan (nama, sudut_subuh, sudut_isya) VALUES (?, ?, ?)',
    [nama, sudut_subuh, sudut_isya],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ id: this.lastID, nama, sudut_subuh, sudut_isya });
    }
  );
});

app.delete('/api/metode-perhitungan/:id', (req, res) => {
  db.run('DELETE FROM metode_perhitungan WHERE id = ?', req.params.id, function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ deleted: this.changes });
  });
});

// 2. Metode Sholat (Madzhab)
app.get('/api/metode-sholat', (req, res) => {
  db.all('SELECT * FROM metode_sholat', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/metode-sholat', (req, res) => {
  const { nama, faktor_ashar } = req.body;
  if (!nama || faktor_ashar == null) {
    return res.status(400).json({ error: 'Data tidak lengkap' });
  }
  db.run('INSERT INTO metode_sholat (nama, faktor_ashar) VALUES (?, ?)',
    [nama, faktor_ashar],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ id: this.lastID, nama, faktor_ashar });
    }
  );
});

app.delete('/api/metode-sholat/:id', (req, res) => {
  db.run('DELETE FROM metode_sholat WHERE id = ?', req.params.id, function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ deleted: this.changes });
  });
});

// 3. Hitung Jadwal Sholat
app.post('/api/hitung-jadwal', (req, res) => {
  const { tanggal, lintang, bujur, zona_waktu, metode_perhitungan_id, metode_sholat_id, ketinggian } = req.body;
  
  db.get('SELECT * FROM metode_perhitungan WHERE id = ?', [metode_perhitungan_id], (err, mp) => {
    if (err || !mp) return res.status(400).json({ error: 'Metode perhitungan tidak ditemukan' });
    
    db.get('SELECT * FROM metode_sholat WHERE id = ?', [metode_sholat_id], (err, ms) => {
      if (err || !ms) return res.status(400).json({ error: 'Metode sholat/madzhab tidak ditemukan' });
      
      const jadwal = hitungJadwalSholat(
        tanggal, 
        parseFloat(lintang), 
        parseFloat(bujur), 
        parseFloat(zona_waktu), 
        parseFloat(mp.sudut_subuh), 
        parseFloat(mp.sudut_isya), 
        parseFloat(ms.faktor_ashar),
        ketinggian ? parseFloat(ketinggian) : 0
      );
      res.json(jadwal);
    });
  });
});

// 4. Hitung Arah Kiblat
app.post('/api/hitung-kiblat', (req, res) => {
  const { lintang, bujur } = req.body;
  if (lintang == null || bujur == null) return res.status(400).json({ error: 'Koordinat kurang lengkap' });
  
  let phi = rad(parseFloat(lintang));
  let lambda = rad(parseFloat(bujur));
  let phiK = rad(21.4225);
  let lambdaK = rad(39.8262);
  let dLambda = lambdaK - lambda;
  
  let y = Math.sin(dLambda);
  let x = Math.cos(phi) * Math.tan(phiK) - Math.sin(phi) * Math.cos(dLambda);
  let q = deg(Math.atan2(y, x));
  let arahKiblat = (q + 360) % 360;
  
  res.json({ arahKiblat: parseFloat(arahKiblat.toFixed(2)) });
});

// 5. Konverter Hijriah
const namaBulanHijriah = [
  "", "Muharram", "Safar", "Rabi'ul Awal", "Rabi'ul Akhir",
  "Jumadil Awal", "Jumadil Akhir", "Rajab", "Sya'ban",
  "Ramadhan", "Syawal", "Dzulqa'dah", "Dzulhijjah"
];

app.post('/api/hitung-hijriah', (req, res) => {
  const { tipe, tahun, bulan, hari } = req.body;
  if (!tipe || !tahun || !bulan || !hari) return res.status(400).json({ error: 'Data input tidak lengkap' });

  if (tipe === 'masehi_ke_hijriah') {
    const hasil = masehiKeHijriah(parseInt(tahun), parseInt(bulan), parseInt(hari));
    res.json({ ...hasil, namaBulan: namaBulanHijriah[hasil.bulan] });
  } else {
    const hasil = hijriahKeMasehi(parseInt(tahun), parseInt(bulan), parseInt(hari));
    res.json(hasil);
  }
});

// 6. Fase Bulan
app.post('/api/hitung-fase-bulan', (req, res) => {
  const { tanggal } = req.body;
  if (!tanggal) return res.status(400).json({ error: 'Tanggal diperlukan' });

  const tgl = new Date(tanggal);
  const jd = dapatkanJD(tgl.getFullYear(), tgl.getMonth() + 1, tgl.getDate());
  
  const epochJD = 2451550.1;
  const siklusSynodik = 29.530588853;
  
  let d = jd - epochJD;
  let c = d / siklusSynodik;
  let fasePersen = c % 1;
  if (fasePersen < 0) fasePersen += 1;
  
  let umurBulan = fasePersen * siklusSynodik;
  let iluminasi = ((1 - Math.cos(2 * Math.PI * fasePersen)) / 2) * 100;
  
  let namaFase = '';
  if (fasePersen < 0.03 || fasePersen >= 0.97) namaFase = 'Bulan Baru (New Moon)';
  else if (fasePersen < 0.22) namaFase = 'Sabit Awal (Waxing Crescent)';
  else if (fasePersen < 0.28) namaFase = 'Perempat Awal (First Quarter)';
  else if (fasePersen < 0.47) namaFase = 'Cembung Awal (Waxing Gibbous)';
  else if (fasePersen < 0.53) namaFase = 'Bulan Purnama (Full Moon)';
  else if (fasePersen < 0.72) namaFase = 'Cembung Akhir (Waning Gibbous)';
  else if (fasePersen < 0.78) namaFase = 'Perempat Akhir (Third Quarter)';
  else if (fasePersen < 0.97) namaFase = 'Sabit Akhir (Waning Crescent)';
  
  res.json({
    fasePersen: parseFloat((fasePersen * 100).toFixed(1)),
    umurBulan: parseFloat(umurBulan.toFixed(1)),
    iluminasi: parseFloat(iluminasi.toFixed(1)),
    namaFase
  });
});

app.listen(PORT, () => {
  console.log(`Server falakiyah aktif di http://localhost:${PORT}`);
});
