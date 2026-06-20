document.addEventListener('DOMContentLoaded', () => {
  // Set tanggal default ke hari ini
  const hariIni = new Date().toISOString().split('T')[0];
  document.getElementById('input-tanggal').value = hariIni;
  document.getElementById('conv-m-tanggal').value = hariIni;

  // Navigasi Tab
  const tabs = document.querySelectorAll('.tab-item');
  const contents = document.querySelectorAll('.konten-tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('aktif'));
      contents.forEach(c => c.classList.remove('aktif'));
      tab.classList.add('aktif');
      document.getElementById(tab.dataset.tab).classList.add('aktif');
    });
  });

  // Load Data Metode & Madzhab
  async function muatDropdownDanTabel() {
    try {
      // Fetch Metode Perhitungan
      const resMetode = await fetch('/api/metode-perhitungan');
      const metodeList = await resMetode.json();
      
      const pilihMetode = document.getElementById('pilih-metode');
      const tabelMetode = document.getElementById('tabel-metode');
      
      pilihMetode.innerHTML = '';
      tabelMetode.innerHTML = '';
      
      metodeList.forEach((m, indeks) => {
        // Dropdown
        const opt = document.createElement('option');
        opt.value = m.id;
        opt.textContent = `${m.nama} (Subuh: ${m.sudut_subuh}°, Isya: ${m.sudut_isya}°)`;
        if (indeks === 0) opt.selected = true;
        pilihMetode.appendChild(opt);

        // Tabel
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${m.nama}</td>
          <td>${m.sudut_subuh}°</td>
          <td>${m.sudut_isya}°</td>
          <td><button class="tombol-hapus" data-id="${m.id}" data-tipe="metode">Hapus</button></td>
        `;
        tabelMetode.appendChild(tr);
      });

      // Fetch Madzhab / Metode Sholat
      const resMadzhab = await fetch('/api/metode-sholat');
      const madzhabList = await resMadzhab.json();
      
      const pilihMadzhab = document.getElementById('pilih-madzhab');
      const tabelMadzhab = document.getElementById('tabel-madzhab');
      
      pilihMadzhab.innerHTML = '';
      tabelMadzhab.innerHTML = '';
      
      madzhabList.forEach((m, indeks) => {
        // Dropdown
        const opt = document.createElement('option');
        opt.value = m.id;
        opt.textContent = `${m.nama} (Faktor: ${m.faktor_ashar})`;
        if (indeks === 0) opt.selected = true;
        pilihMadzhab.appendChild(opt);

        // Tabel
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${m.nama}</td>
          <td>${m.faktor_ashar}</td>
          <td><button class="tombol-hapus" data-id="${m.id}" data-tipe="madzhab">Hapus</button></td>
        `;
        tabelMadzhab.appendChild(tr);
      });

      // Hapus Event Listener untuk tombol hapus
      document.querySelectorAll('.tombol-hapus').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          const id = e.target.dataset.id;
          const tipe = e.target.dataset.tipe;
          if (confirm('Apakah Anda yakin ingin menghapus data ini?')) {
            const url = tipe === 'metode' ? `/api/metode-perhitungan/${id}` : `/api/metode-sholat/${id}`;
            await fetch(url, { method: 'DELETE' });
            await muatDropdownDanTabel();
            jalankanSemuaPerhitungan();
          }
        });
      });

      // Jalankan kalkulasi setelah dropdown terisi
      jalankanSemuaPerhitungan();

    } catch (err) {
      console.error('Gagal memuat data:', err);
    }
  }

  let koordinatTerakhir = { lat: null, lon: null };

  async function perbaruiNamaLokasi(lat, lon) {
    const latBulat = parseFloat(lat).toFixed(4);
    const lonBulat = parseFloat(lon).toFixed(4);
    
    if (koordinatTerakhir.lat === latBulat && koordinatTerakhir.lon === lonBulat) {
      return; 
    }
    
    koordinatTerakhir.lat = latBulat;
    koordinatTerakhir.lon = lonBulat;

    const teksLokasiControl = document.getElementById('teks-nama-lokasi');
    const labelLokasiJadwal = document.getElementById('label-lokasi-jadwal');
    
    teksLokasiControl.textContent = 'Mencari...';
    labelLokasiJadwal.textContent = 'Mencari Lokasi...';
    
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&zoom=12`, {
        headers: {
          'Accept-Language': 'id'
        }
      });
      const data = await res.json();
      if (data && data.address) {
        const addr = data.address;
        const kota = addr.city || addr.town || addr.municipality || addr.city_district || addr.county || addr.suburb || addr.village || '';
        const provinsi = addr.state || '';
        const negara = addr.country || '';
        
        let namaTampil = '';
        if (kota && provinsi) {
          namaTampil = `${kota}, ${provinsi}`;
        } else if (kota) {
          namaTampil = kota;
        } else if (provinsi) {
          namaTampil = provinsi;
        } else {
          namaTampil = negara || 'Lokasi Terdeteksi';
        }
        
        teksLokasiControl.textContent = namaTampil;
        labelLokasiJadwal.textContent = `Lokasi: ${namaTampil}`;
      } else {
        teksLokasiControl.textContent = `Koordinat: ${latBulat}, ${lonBulat}`;
        labelLokasiJadwal.textContent = `Lokasi: Koordinat (${latBulat}, ${lonBulat})`;
      }
    } catch (err) {
      console.warn('Gagal reverse geocoding:', err);
      teksLokasiControl.textContent = `Koordinat: ${latBulat}, ${lonBulat}`;
      labelLokasiJadwal.textContent = `Lokasi: Koordinat (${latBulat}, ${lonBulat})`;
    }
  }

  // Fungsi Kalkulasi Falakiah Utama
  async function jalankanSemuaPerhitungan() {
    const tanggal = document.getElementById('input-tanggal').value;
    const lintang = document.getElementById('input-lintang').value;
    const bujur = document.getElementById('input-bujur').value;
    const zona_waktu = document.getElementById('input-zona-waktu').value;
    const ketinggian = document.getElementById('input-ketinggian').value || 0;
    const metode_perhitungan_id = document.getElementById('pilih-metode').value;
    const metode_sholat_id = document.getElementById('pilih-madzhab').value;

    if (!metode_perhitungan_id || !metode_sholat_id) return;

    try {
      // 1. Jadwal Sholat
      const resJadwal = await fetch('/api/hitung-jadwal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tanggal, lintang, bujur, zona_waktu, metode_perhitungan_id, metode_sholat_id, ketinggian })
      });
      const jadwal = await resJadwal.json();
      tampilkanJadwal(jadwal);

      // 2. Arah Kiblat
      const resKiblat = await fetch('/api/hitung-kiblat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lintang, bujur })
      });
      const kiblat = await resKiblat.json();
      document.getElementById('teks-kiblat').textContent = `${kiblat.arahKiblat}° dari Utara`;
      document.getElementById('jarum-kiblat-id').style.transform = `rotate(${kiblat.arahKiblat}deg)`;

      // 3. Fase Bulan
      const resBulan = await fetch('/api/hitung-fase-bulan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tanggal })
      });
      const bulan = await resBulan.json();
      document.getElementById('nama-fase-bulan').textContent = bulan.namaFase;
      document.getElementById('iluminasi-bulan').textContent = `${bulan.iluminasi}%`;
      document.getElementById('umur-bulan').textContent = `${bulan.umurBulan} hari`;
      
      // Hitung pergeseran bayangan bulan (0% lit -> 0% translasi, 100% lit -> 100% translasi)
      let transformX = 0;
      if (bulan.umurBulan < 14.7) {
        transformX = (bulan.umurBulan / 14.7) * 100;
      } else {
        transformX = 100 - ((bulan.umurBulan - 14.7) / 14.7) * 100;
      }
      document.getElementById('bulan-bayangan-id').style.transform = `translateX(${transformX}%)`;

      // 4. Perbarui nama tempat lokasi
      perbaruiNamaLokasi(lintang, bujur);

    } catch (err) {
      console.error('Gagal menghitung data falakiyah:', err);
    }
  }

  function tampilkanJadwal(jadwal) {
    const kontainer = document.getElementById('kontainer-jadwal');
    kontainer.innerHTML = '';

    const daftarSholat = [
      { id: 'subuh', nama: 'Subuh', waktu: jadwal.subuh },
      { id: 'syuruq', nama: 'Terbit', waktu: jadwal.syuruq },
      { id: 'dzuhur', nama: 'Dzuhur', waktu: jadwal.dzuhur },
      { id: 'ashar', nama: 'Ashar', waktu: jadwal.ashar },
      { id: 'maghrib', nama: 'Maghrib', waktu: jadwal.maghrib },
      { id: 'isya', nama: 'Isya', waktu: jadwal.isya }
    ];

    // Temukan sholat aktif (berikutnya)
    const skrg = new Date();
    const jamMenitSkrg = skrg.getHours() * 60 + skrg.getMinutes();
    let indeksAktif = 0;
    let selisihTerkecil = Infinity;

    daftarSholat.forEach((sh, idx) => {
      if (sh.waktu !== '--:--') {
        const [h, m] = sh.waktu.split(':').map(Number);
        const menitSholat = h * 60 + m;
        const selisih = menitSholat - jamMenitSkrg;
        if (selisih > 0 && selisih < selisihTerkecil) {
          selisihTerkecil = selisih;
          indeksAktif = idx;
        }
      }
    });

    // Jika lewat Isya, maka Subuh besok yang aktif
    if (selisihTerkecil === Infinity) {
      indeksAktif = 0;
    }

    daftarSholat.forEach((sh, idx) => {
      const kartu = document.createElement('div');
      kartu.className = `kartu-sholat ${idx === indeksAktif ? 'aktif' : ''}`;
      kartu.innerHTML = `
        <div class="nama-sholat">${sh.nama}</div>
        <div class="waktu-sholat">${sh.waktu}</div>
      `;
      kontainer.appendChild(kartu);
    });
  }

  // Geolocation Button
  document.getElementById('tombol-deteksi-lokasi').addEventListener('click', () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((pos) => {
        document.getElementById('input-lintang').value = pos.coords.latitude.toFixed(6);
        document.getElementById('input-bujur').value = pos.coords.longitude.toFixed(6);
        
        // Estimasi Zona Waktu
        const offsetMenit = new Date().getTimezoneOffset();
        document.getElementById('input-zona-waktu').value = -(offsetMenit / 60);
        
        jalankanSemuaPerhitungan();
      }, (err) => {
        alert("Gagal mendeteksi lokasi secara otomatis: " + err.message);
      });
    } else {
      alert("Browser Anda tidak mendukung Geolocation.");
    }
  });

  // Event Listener perubahan input utama
  ['input-tanggal', 'input-lintang', 'input-bujur', 'input-zona-waktu', 'input-ketinggian', 'pilih-metode', 'pilih-madzhab']
    .forEach(id => {
      document.getElementById(id).addEventListener('change', jalankanSemuaPerhitungan);
    });

  // Konverter Kalender Masehi ke Hijriah
  document.getElementById('tombol-m-ke-h').addEventListener('click', async () => {
    const tanggalMasehi = document.getElementById('conv-m-tanggal').value;
    if (!tanggalMasehi) return;
    const [y, m, d] = tanggalMasehi.split('-');
    
    try {
      const res = await fetch('/api/hitung-hijriah', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipe: 'masehi_ke_hijriah', tahun: y, bulan: m, hari: d })
      });
      const data = await res.json();
      document.getElementById('hasil-m-ke-h').textContent = `${data.hari} ${data.namaBulan} ${data.tahun} H`;
    } catch (e) {
      console.error(e);
    }
  });

  // Konverter Kalender Hijriah ke Masehi
  document.getElementById('tombol-h-ke-m').addEventListener('click', async () => {
    const hari = document.getElementById('conv-h-hari').value;
    const bulan = document.getElementById('conv-h-bulan').value;
    const tahun = document.getElementById('conv-h-tahun').value;
    
    try {
      const res = await fetch('/api/hitung-hijriah', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipe: 'hijriah_ke_masehi', tahun, bulan, hari })
      });
      const data = await res.json();
      const namaBulanMasehi = ["", "Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
      document.getElementById('hasil-h-ke-m').textContent = `${data.hari} ${namaBulanMasehi[data.bulan]} ${data.tahun} M`;
    } catch (e) {
      console.error(e);
    }
  });

  // Form Tambah Metode Perhitungan Baru
  document.getElementById('form-tambah-metode').addEventListener('submit', async (e) => {
    e.preventDefault();
    const nama = document.getElementById('metode-nama').value;
    const sudut_subuh = parseFloat(document.getElementById('metode-subuh').value);
    const sudut_isya = parseFloat(document.getElementById('metode-isya').value);

    try {
      const res = await fetch('/api/metode-perhitungan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nama, sudut_subuh, sudut_isya })
      });
      if (res.ok) {
        document.getElementById('form-tambah-metode').reset();
        document.getElementById('metode-subuh').value = 20;
        document.getElementById('metode-isya').value = 18;
        await muatDropdownDanTabel();
      }
    } catch (err) {
      console.error(err);
    }
  });

  // Form Tambah Madzhab Baru
  document.getElementById('form-tambah-madzhab').addEventListener('submit', async (e) => {
    e.preventDefault();
    const nama = document.getElementById('madzhab-nama').value;
    const faktor_ashar = parseFloat(document.getElementById('madzhab-faktor').value);

    try {
      const res = await fetch('/api/metode-sholat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nama, faktor_ashar })
      });
      if (res.ok) {
        document.getElementById('form-tambah-madzhab').reset();
        document.getElementById('madzhab-faktor').value = 1.0;
        await muatDropdownDanTabel();
      }
    } catch (err) {
      console.error(err);
    }
  });

  // Jalankan inisialisasi awal
  muatDropdownDanTabel();
});
