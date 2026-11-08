import {
  kabupatenKota,
  getJoinedData,
  syncDataWithServer,
  fetchServerWilayah
} from "./store.js";
import { initNavbarAuth } from "./auth.js";

// Render Metrik Ringkasan
function renderMetrics(data) {
  const totalPetak = data.length;
  const totalLuasHa = data.reduce((acc, curr) => acc + (Number(curr.luas_hektar) || 0), 0).toFixed(1);

  const totalLP2B = data.filter((d) => d.statusData && d.statusData.kategori === "LP2B").length;
  const totalLayakDC = data.filter(
    (d) => d.kandidatData && d.kandidatData.status_penilaian === "Layak"
  ).length;
  const totalDipertimbangkan = data.filter(
    (d) => d.kandidatData && d.kandidatData.status_penilaian === "Dipertimbangkan"
  ).length;

  const totalLuasEl = document.getElementById("metric-total-luas");
  const totalPetakEl = document.getElementById("metric-total-petak");
  const lp2bEl = document.getElementById("metric-lp2b");
  const layakEl = document.getElementById("metric-layak-dc");
  const dipertimbangkanEl = document.getElementById("metric-dipertimbangkan");

  if (totalLuasEl) totalLuasEl.textContent = `${totalLuasHa} Ha`;
  if (totalPetakEl) totalPetakEl.textContent = `${totalPetak} Petak Sawah`;
  if (lp2bEl) lp2bEl.textContent = `${totalLP2B} Petak`;
  if (layakEl) layakEl.textContent = `${totalLayakDC} Petak`;
  if (dipertimbangkanEl) dipertimbangkanEl.textContent = `${totalDipertimbangkan} Petak`;
}

// Render Opsi Filter Wilayah di Dashboard dari data server / cache
async function populateWilayahFilter() {
  const select = document.getElementById("filter-wilayah");
  if (!select) return;
  select.innerHTML = '<option value="">Semua Wilayah</option>';

  const wilayahList = await fetchServerWilayah();

  kabupatenKota.forEach((kab) => {
    const optgroup = document.createElement("optgroup");
    optgroup.label = kab.nama;

    const wilList = wilayahList.filter((w) => String(w.kabupaten_kota_id) === String(kab.id));
    wilList.forEach((w) => {
      const opt = document.createElement("option");
      opt.value = w.id;
      opt.textContent = `${w.desa}, Kec. ${w.kecamatan}`;
      optgroup.appendChild(opt);
    });

    select.appendChild(optgroup);
  });
}

// Render Baris Tabel & Grid Kartu
function renderTable(data) {
  const tbody = document.getElementById("table-body");
  const countLabel = document.getElementById("table-count");
  const gridContainer = document.getElementById("wrapper-grid-view");

  if (!tbody || !countLabel || !gridContainer) return;

  tbody.innerHTML = "";
  gridContainer.innerHTML = "";
  countLabel.textContent = `Menampilkan ${data.length} petak sawah`;

  if (data.length === 0) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td colspan="7" class="table-empty">
        Tidak ada data sawah yang sesuai dengan kriteria penyaringan.
      </td>
    `;
    tbody.appendChild(tr);

    const emptyGrid = document.createElement("div");
    emptyGrid.className = "grid-empty-state";
    emptyGrid.textContent = "Tidak ada data sawah yang sesuai dengan kriteria penyaringan.";
    gridContainer.appendChild(emptyGrid);
    return;
  }

  data.forEach((item) => {
    // Tentukan badge status hukum
    let legalBadgeClass = "badge-neutral";
    const statusKategori = item.statusData?.kategori || "Bukan LP2B";
    const bolehAlihFungsi = Boolean(item.statusData?.boleh_alih_fungsi);

    if (statusKategori === "LP2B") {
      legalBadgeClass = "badge-danger";
    } else if (bolehAlihFungsi) {
      legalBadgeClass = "badge-success";
    } else {
      legalBadgeClass = "badge-warning";
    }

    // Tentukan badge kelayakan data center
    let dcBadgeClass = "badge-neutral";
    const statusDC = item.kandidatData ? item.kandidatData.status_penilaian : "Belum Dinilai";
    const skorDC = item.kandidatData ? item.kandidatData.skor_kelayakan : "-";

    if (statusDC === "Layak") {
      dcBadgeClass = "badge-primary";
    } else if (statusDC === "Dipertimbangkan") {
      dcBadgeClass = "badge-gold";
    } else if (statusDC === "Tidak Layak") {
      dcBadgeClass = "badge-danger-muted";
    }

    let scoreBarColor = "var(--color-primary-green)";
    if (statusDC === "Dipertimbangkan") scoreBarColor = "var(--color-gold-brown)";
    if (statusDC === "Tidak Layak") scoreBarColor = "#a83232";

    const scoreNum = typeof skorDC === "number" ? Math.min(100, Math.max(0, skorDC)) : 0;

    // 1. Render Baris Tabel
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>
        <span class="cell-primary">${item.id}</span>
        <span class="cell-sub">${item.nomor_persil}</span>
      </td>
      <td>
        <span class="cell-primary">${item.pemilikData?.nama || "-"}</span>
        <span class="cell-sub">${item.pemilikData?.jenis || "-"}</span>
      </td>
      <td>
        <span class="cell-primary">Ds. ${item.wilayahData?.desa || "-"}</span>
        <span class="cell-sub">Kec. ${item.wilayahData?.kecamatan || "-"}, ${item.kabupatenData?.nama || ""}</span>
      </td>
      <td>
        <span class="cell-primary">${item.luas_hektar} Ha</span>
        <span class="cell-sub">${item.jenis_sawah}</span>
      </td>
      <td>
        <span class="badge ${legalBadgeClass}">${statusKategori}</span>
        <span class="cell-sub">${bolehAlihFungsi ? "Boleh Dialihfungsikan" : "Dilarang Alih Fungsi"}</span>
      </td>
      <td>
        <div class="dc-eval-wrapper">
          <span class="badge ${dcBadgeClass}">${statusDC}</span>
          <div class="score-progress" aria-hidden="true">
            <div class="score-progress-bar" style="width: ${scoreNum}%; background-color: ${scoreBarColor};"></div>
          </div>
          <span class="cell-sub">Indeks Kelayakan: ${skorDC}/100</span>
        </div>
      </td>
      <td>
        <button type="button" class="btn-action" data-id="${item.id}">Detail Laporan</button>
      </td>
    `;
    tbody.appendChild(tr);

    // 2. Render Kartu Grid Responsif
    const card = document.createElement("article");
    card.className = "sawah-card";
    card.innerHTML = `
      <div class="sawah-card-header">
        <div class="sawah-card-id-group">
          <span class="sawah-badge-id">${item.id}</span>
          <span class="sawah-persil-code">${item.nomor_persil}</span>
        </div>
        <span class="badge ${legalBadgeClass}">${statusKategori}</span>
      </div>

      <div class="sawah-card-body">
        <div class="card-info-row">
          <span class="info-label">Pemilik</span>
          <span class="info-val"><strong>${item.pemilikData?.nama || "-"}</strong> (${item.pemilikData?.jenis || "-"})</span>
        </div>

        <div class="card-info-row">
          <span class="info-label">Lokasi</span>
          <span class="info-val">Ds. ${item.wilayahData?.desa || "-"}, Kec. ${item.wilayahData?.kecamatan || "-"}</span>
        </div>

        <div class="card-info-row">
          <span class="info-label">Luas & Pengairan</span>
          <span class="info-val"><strong>${item.luas_hektar} Hektar</strong> | ${item.jenis_sawah}</span>
        </div>

        <div class="card-eval-section">
          <div class="card-eval-header">
            <span>Evaluasi Data Center AI</span>
            <span class="badge ${dcBadgeClass}">${statusDC}</span>
          </div>
          <div class="score-progress" aria-hidden="true">
            <div class="score-progress-bar" style="width: ${scoreNum}%; background-color: ${scoreBarColor};"></div>
          </div>
          <div class="score-numeric-label">Skor Kelayakan: ${skorDC}/100</div>
        </div>
      </div>

      <div class="sawah-card-footer">
        <button type="button" class="btn-action full-width" data-id="${item.id}">Detail Analisis Lengkap</button>
      </div>
    `;
    gridContainer.appendChild(card);
  });

  // Pasang event listener ke seluruh tombol detail
  document.querySelectorAll(".btn-action").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-id");
      const currentJoined = getJoinedData();
      const target = currentJoined.find((d) => String(d.id) === String(id));
      if (target) {
        showDetailModal(target);
      }
    });
  });
}

// Instance Leaflet Map untuk Modal Detail
let detailMapInstance = null;

function renderModalMap(item) {
  const mapContainer = document.getElementById("modal-map");
  if (!mapContainer || typeof L === "undefined") return;

  const lat = parseFloat(item.latitude);
  const lng = parseFloat(item.longitude);

  if (isNaN(lat) || isNaN(lng)) {
    mapContainer.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--text-light);font-size:0.8125rem;">Koordinat lokasi tidak valid</div>';
    return;
  }

  // Bersihkan map sebelumnya jika sudah ada agar tidak error "Map container is already initialized"
  if (detailMapInstance) {
    detailMapInstance.remove();
    detailMapInstance = null;
  }

  try {
    detailMapInstance = L.map("modal-map", {
      zoomControl: true,
      scrollWheelZoom: false // Mencegah zoom tidak sengaja saat scroll modal
    }).setView([lat, lng], 15);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a>'
    }).addTo(detailMapInstance);

    // Marker utama lokasi petak sawah
    const marker = L.marker([lat, lng]).addTo(detailMapInstance);
    
    const statusDC = item.kandidatData ? item.kandidatData.status_penilaian : "Belum Dinilai";
    const skorDC = item.kandidatData ? item.kandidatData.skor_kelayakan : "-";
    
    marker.bindPopup(`
      <div style="font-family: inherit; font-size: 13px; line-height: 1.5; min-width: 160px;">
        <strong style="color: #1E4D36; font-size: 14px;">🌾 Petak ${item.nomor_persil}</strong><br>
        <span>Pemilik: <b>${item.pemilikData?.nama || "-"}</b></span><br>
        <span>Ds. ${item.wilayahData?.desa || "-"}, Kec. ${item.wilayahData?.kecamatan || "-"}</span><br>
        <span>Luas: <b>${item.luas_hektar} Ha</b> (${item.jenis_sawah})</span><br>
        <span style="display:inline-block; margin-top: 4px; padding: 2px 6px; background: #e8f3ed; color: #1E4D36; border-radius: 4px; font-weight: bold; font-size: 11px;">
          Kelayakan DC: ${statusDC} (${skorDC}/100)
        </span>
      </div>
    `).openPopup();

    // Area estimasi petak sawah (lingkaran perimeter)
    L.circle([lat, lng], {
      color: '#1E4D36',
      fillColor: '#52B788',
      fillOpacity: 0.2,
      weight: 2,
      radius: 120
    }).addTo(detailMapInstance);

    // Invalidate size setelah transisi modal selesai agar tile ter-render penuh
    setTimeout(() => {
      if (detailMapInstance) {
        detailMapInstance.invalidateSize();
      }
    }, 250);
  } catch (err) {
    console.warn("Gagal inisialisasi peta Leaflet:", err);
  }
}

// Variabel penyimpan posisi scroll beranda saat modal dibuka
let savedScrollY = 0;

// Modal Detail Lahan
function showDetailModal(item) {
  const modal = document.getElementById("detail-modal");
  const body = document.getElementById("modal-content-body");
  if (!modal || !body) return;

  const infraList = item.infrastrukturList || [];
  const infraHtml = infraList.length
    ? infraList
        .map(
          (inf) => `
            <div class="modal-list-item">
              <div>
                <strong>${inf.nama || "Fasilitas"}</strong> (${inf.jenis || "Infrastruktur"})
                <div class="cell-sub">Kapasitas: ${inf.kapasitas || "-"} ${inf.satuan_kapasitas || ""} | Kondisi: ${inf.kondisi || "Baik"}</div>
              </div>
              <span class="badge badge-gold">${inf.jarak_meter} meter</span>
            </div>
          `
        )
        .join("")
    : '<div class="cell-sub">Tidak ada fasilitas tercatat di radius terdekat.</div>';

  body.innerHTML = `
    <div class="modal-grid">
      <div class="modal-section">
        <h3>Informasi Petak & Kepemilikan</h3>
        <p><strong>Nomor Persil:</strong> ${item.nomor_persil} (${item.id})</p>
        <p><strong>Pemilik:</strong> ${item.pemilikData?.nama || "-"} (${item.pemilikData?.jenis || "-"})</p>
        <p><strong>Kontak:</strong> ${item.pemilikData?.kontak || "-"}</p>
        <p><strong>Luas Area:</strong> ${item.luas_hektar} Hektar</p>
        <p><strong>Tipe Lahan:</strong> ${item.jenis_sawah}</p>
        <p><strong>Koordinat:</strong> ${item.latitude}, ${item.longitude}</p>
      </div>

      <div class="modal-section">
        <h3>Status Hukum & Kebijakan</h3>
        <p><strong>Kategori Lahan:</strong> ${item.statusData?.kategori || "-"}</p>
        <p><strong>Izin Alih Fungsi:</strong> ${item.statusData?.boleh_alih_fungsi ? "Boleh untuk kegiatan non-pertanian" : "Dilarang (Perlindungan LP2B / Sengketa)"}</p>
        <p><strong>Dasar Hukum:</strong> ${item.statusData?.dasar_hukum || "-"}</p>
      </div>
    </div>

    <!-- Peta Lokasi Spasial Sawah (Leaflet) -->
    <div class="modal-section">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
        <h3 style="margin-bottom: 0; border-bottom: none; padding-bottom: 0;">Peta Lokasi Spasial Sawah</h3>
        <span class="badge badge-primary">${item.latitude}, ${item.longitude}</span>
      </div>
      <div class="modal-map-wrapper">
        <div id="modal-map" class="modal-map-container"></div>
        <div class="modal-map-footer">
          <span>📍 Lokasi: Ds. ${item.wilayahData?.desa || "-"}, Kec. ${item.wilayahData?.kecamatan || "-"} (${item.latitude}, ${item.longitude})</span>
          <a href="https://www.google.com/maps?q=${item.latitude},${item.longitude}" target="_blank" rel="noopener noreferrer" class="btn-map-nav">
            Buka di Google Maps ↗
          </a>
        </div>
      </div>
    </div>

    <div class="modal-section">
      <h3>Profil Risiko Bencana Wilayah</h3>
      <div class="modal-risk-grid">
        <div class="risk-card">
          <span>Risiko Banjir</span>
          <strong>${item.wilayahData?.risiko_banjir || "Rendah"}</strong>
        </div>
        <div class="risk-card">
          <span>Risiko Gempa</span>
          <strong>${item.wilayahData?.risiko_gempa || "Rendah"}</strong>
        </div>
        <div class="risk-card">
          <span>Risiko Longsor</span>
          <strong>${item.wilayahData?.risiko_longsor || "Rendah"}</strong>
        </div>
      </div>
    </div>

    <div class="modal-section">
      <h3>Kedekatan Infrastruktur Penunjang Data Center</h3>
      <div class="modal-list">
        ${infraHtml}
      </div>
    </div>

    <div class="modal-section evaluation-box">
      <h3>Hasil Penilaian Kelayakan Data Center AI</h3>
      <p><strong>Status:</strong> ${item.kandidatData ? item.kandidatData.status_penilaian : "Belum Dinilai"}</p>
      <p><strong>Skor Gabungan:</strong> ${item.kandidatData ? item.kandidatData.skor_kelayakan : "-"} / 100</p>
      <p><strong>Catatan Teknis:</strong> ${item.kandidatData ? item.kandidatData.catatan : "-"}</p>
      <p><strong>Tanggal Penilaian:</strong> ${item.kandidatData ? item.kandidatData.tanggal_penilaian : "-"}</p>
    </div>
  `;

  // Kunci scroll posisi beranda agar tidak bergeser saat membaca modal
  savedScrollY = window.scrollY || document.documentElement.scrollTop || 0;
  document.documentElement.classList.add("modal-open");
  document.body.classList.add("modal-open");
  document.body.style.position = "fixed";
  document.body.style.top = `-${savedScrollY}px`;
  document.body.style.left = "0";
  document.body.style.right = "0";
  document.body.style.width = "100%";
  document.body.style.overflow = "hidden";

  modal.classList.add("active");

  // Render peta Leaflet untuk sawah yang dipilih
  renderModalMap(item);
}

// Logika Filter & Pencarian
function filterData() {
  const searchInput = document.getElementById("search-input");
  const filterWilayah = document.getElementById("filter-wilayah");
  const filterHukum = document.getElementById("filter-hukum");
  const filterDC = document.getElementById("filter-dc");

  const searchKeyword = searchInput ? searchInput.value.toLowerCase().trim() : "";
  const selectedWilayah = filterWilayah ? filterWilayah.value : "";
  const selectedHukum = filterHukum ? filterHukum.value : "";
  const selectedDC = filterDC ? filterDC.value : "";

  const joined = getJoinedData();

  const filtered = joined.filter((item) => {
    if (searchKeyword) {
      const matchId = String(item.id || "").toLowerCase().includes(searchKeyword);
      const matchPersil = String(item.nomor_persil || "").toLowerCase().includes(searchKeyword);
      const matchPemilik = item.pemilikData?.nama ? item.pemilikData.nama.toLowerCase().includes(searchKeyword) : false;
      const matchDesa = item.wilayahData?.desa ? item.wilayahData.desa.toLowerCase().includes(searchKeyword) : false;
      const matchKecamatan = item.wilayahData?.kecamatan ? item.wilayahData.kecamatan.toLowerCase().includes(searchKeyword) : false;

      if (!matchId && !matchPersil && !matchPemilik && !matchDesa && !matchKecamatan) {
        return false;
      }
    }

    if (selectedWilayah && String(item.wilayah_id) !== String(selectedWilayah)) {
      return false;
    }

    if (selectedHukum === "boleh" && !item.statusData?.boleh_alih_fungsi) {
      return false;
    }
    if (selectedHukum === "dilarang" && item.statusData?.boleh_alih_fungsi) {
      return false;
    }
    if (selectedHukum === "lp2b" && item.statusData?.kategori !== "LP2B") {
      return false;
    }

    if (selectedDC && (!item.kandidatData || item.kandidatData.status_penilaian !== selectedDC)) {
      return false;
    }

    return true;
  });

  renderTable(filtered);
}

function closeDetailModal() {
  const modal = document.getElementById("detail-modal");
  if (!modal) return;
  modal.classList.remove("active");
  document.documentElement.classList.remove("modal-open");
  document.body.classList.remove("modal-open");

  // Kembalikan posisi scroll beranda persis seperti sebelum modal dibuka
  const scrollYToRestore = savedScrollY;
  document.body.style.position = "";
  document.body.style.top = "";
  document.body.style.left = "";
  document.body.style.right = "";
  document.body.style.width = "";
  document.body.style.overflow = "";
  window.scrollTo(0, scrollYToRestore);
}

function initDetailModal() {
  const modal = document.getElementById("detail-modal");
  const closeBtn = document.getElementById("modal-close-btn");
  if (!modal || !closeBtn) return;

  closeBtn.addEventListener("click", closeDetailModal);
  modal.addEventListener("click", (e) => {
    if (e.target === modal) closeDetailModal();
  });

  // Mencegah scroll tembus dari modal ke beranda (wheel & touch overscroll containment)
  modal.addEventListener(
    "wheel",
    (e) => {
      const modalBody = e.target.closest(".modal-card-body");
      if (!modalBody) {
        // Jika kursor berada di backdrop atau header modal, blokir wheel event total
        e.preventDefault();
        return;
      }

      // Jika kursor di dalam modal-card-body, cegah scroll bocor saat mentok atas atau bawah
      const delta = e.deltaY;
      const isUp = delta < 0;
      const isDown = delta > 0;
      const atTop = modalBody.scrollTop <= 0;
      const atBottom = Math.ceil(modalBody.scrollTop + modalBody.clientHeight) >= modalBody.scrollHeight;

      if ((isUp && atTop) || (isDown && atBottom)) {
        e.preventDefault();
      }
    },
    { passive: false }
  );

  let touchStartY = 0;
  modal.addEventListener(
    "touchstart",
    (e) => {
      if (e.touches && e.touches.length > 0) {
        touchStartY = e.touches[0].clientY;
      }
    },
    { passive: true }
  );

  modal.addEventListener(
    "touchmove",
    (e) => {
      const modalBody = e.target.closest(".modal-card-body");
      if (!modalBody) {
        e.preventDefault();
        return;
      }

      if (e.touches && e.touches.length > 0) {
        const currentY = e.touches[0].clientY;
        const isUp = currentY > touchStartY; // swipe ke bawah (scroll up)
        const isDown = currentY < touchStartY; // swipe ke atas (scroll down)
        const atTop = modalBody.scrollTop <= 0;
        const atBottom = Math.ceil(modalBody.scrollTop + modalBody.clientHeight) >= modalBody.scrollHeight;

        if ((isUp && atTop) || (isDown && atBottom)) {
          e.preventDefault();
        }
      }
    },
    { passive: false }
  );

  // Cegah tombol keyboard menggeser halaman beranda saat modal aktif
  window.addEventListener("keydown", (e) => {
    if (!modal.classList.contains("active")) return;

    if (e.key === "Escape") {
      closeDetailModal();
      return;
    }

    const scrollKeys = ["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End", " "];
    if (scrollKeys.includes(e.key)) {
      const modalBody = modal.querySelector(".modal-card-body");
      if (!modalBody) return;

      const activeTag = document.activeElement ? document.activeElement.tagName.toLowerCase() : "";
      if (activeTag !== "input" && activeTag !== "textarea") {
        e.preventDefault();
        const step = 60;
        if (e.key === "ArrowDown") modalBody.scrollTop += step;
        else if (e.key === "ArrowUp") modalBody.scrollTop -= step;
        else if (e.key === "PageDown" || e.key === " ") modalBody.scrollTop += modalBody.clientHeight * 0.8;
        else if (e.key === "PageUp") modalBody.scrollTop -= modalBody.clientHeight * 0.8;
        else if (e.key === "Home") modalBody.scrollTop = 0;
        else if (e.key === "End") modalBody.scrollTop = modalBody.scrollHeight;
      }
    }
  });
}

function initViewToggle() {
  const btnTable = document.getElementById("btn-view-table");
  const btnGrid = document.getElementById("btn-view-grid");
  const wrapperTable = document.getElementById("wrapper-table-view");
  const wrapperGrid = document.getElementById("wrapper-grid-view");

  if (!btnTable || !btnGrid || !wrapperTable || !wrapperGrid) return;

  function setView(mode) {
    if (mode === "grid") {
      btnGrid.classList.add("active");
      btnTable.classList.remove("active");
      wrapperGrid.style.display = "grid";
      wrapperTable.style.display = "none";
    } else {
      btnTable.classList.add("active");
      btnGrid.classList.remove("active");
      wrapperTable.style.display = "block";
      wrapperGrid.style.display = "none";
    }
  }

  btnTable.addEventListener("click", () => setView("table"));
  btnGrid.addEventListener("click", () => setView("grid"));

  if (window.innerWidth <= 768) {
    setView("grid");
  } else {
    setView("table");
  }
}

// Logika Pelacakan Menu Navigasi Aktif (Scroll-Spy & Click Tracker)
function initNavActiveTracker() {
  const navLinks = document.querySelectorAll("#main-nav-menu a.nav-item-link");
  if (!navLinks.length) return;

  const sectionIds = ["beranda", "latar-belakang", "analisis-lahan"];
  const sections = sectionIds
    .map((id) => document.getElementById(id))
    .filter(Boolean);

  function setActiveLink(activeId) {
    navLinks.forEach((link) => {
      const href = link.getAttribute("href");
      if (
        href === `#${activeId}` ||
        href === `index.html#${activeId}` ||
        (activeId === "beranda" && (href === "index.html" || href === "#beranda"))
      ) {
        link.classList.add("active");
      } else {
        link.classList.remove("active");
      }
    });
  }

  // 1. Update aktif langsung saat menu diklik
  navLinks.forEach((link) => {
    link.addEventListener("click", () => {
      const href = link.getAttribute("href");
      if (href && href.startsWith("#")) {
        setActiveLink(href.substring(1));
      }
    });
  });

  // 2. Pelacakan posisi scroll otomatis (Scroll-Spy)
  if ("IntersectionObserver" in window && sections.length) {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveLink(entry.target.id);
          }
        });
      },
      {
        root: null,
        rootMargin: "-25% 0px -65% 0px",
        threshold: 0
      }
    );

    sections.forEach((sec) => observer.observe(sec));
  }
}

// Inisialisasi Halaman Dashboard
document.addEventListener("DOMContentLoaded", async () => {
  initNavbarAuth();
  initNavActiveTracker();
  initDetailModal();
  initViewToggle();

  // 1. Tampilkan data awal (cache/default) secara instan
  const initialJoined = getJoinedData();
  renderMetrics(initialJoined);
  await populateWilayahFilter();
  renderTable(initialJoined);

  // 2. Sinkronkan dengan server database live
  syncDataWithServer().then((syncResult) => {
    if (syncResult && syncResult.sawah) {
      const refreshedJoined = getJoinedData(syncResult.sawah);
      renderMetrics(refreshedJoined);
      renderTable(refreshedJoined);
    }
  }).catch((err) => {
    console.info("Info sinkronisasi data server:", err);
  });

  // Filter Dashboard Events
  const searchInput = document.getElementById("search-input");
  const filterWilayah = document.getElementById("filter-wilayah");
  const filterHukum = document.getElementById("filter-hukum");
  const filterDC = document.getElementById("filter-dc");
  const btnReset = document.getElementById("btn-reset-filter");

  if (searchInput) searchInput.addEventListener("input", filterData);
  if (filterWilayah) filterWilayah.addEventListener("change", filterData);
  if (filterHukum) filterHukum.addEventListener("change", filterData);
  if (filterDC) filterDC.addEventListener("change", filterData);
  if (btnReset) {
    btnReset.addEventListener("click", () => {
      if (searchInput) searchInput.value = "";
      if (filterWilayah) filterWilayah.value = "";
      if (filterHukum) filterHukum.value = "";
      if (filterDC) filterDC.value = "";
      renderTable(getJoinedData());
    });
  }
});
