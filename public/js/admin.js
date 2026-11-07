import {
  kabupatenKota,
  fetchServerPemilik,
  fetchServerWilayah,
  fetchServerStatusLahan,
  fetchServerDataSawah,
  postServerDataSawah,
  putServerDataSawah,
  deleteServerDataSawah,
  postServerPemilik,
  putServerPemilik,
  deleteServerPemilik,
  postServerWilayah,
  putServerWilayah,
  deleteServerWilayah,
  postServerStatusLahan,
  putServerStatusLahan,
  deleteServerStatusLahan,
  fetchServerJenisPengairan,
  postServerJenisPengairan,
  putServerJenisPengairan,
  deleteServerJenisPengairan,
  postServerKandidatLokasi
} from "./store.js";
import { protectAdminPage, initNavbarAuth, isLoggedIn } from "./auth.js";

// Lindungi akses halaman admin sejak awal skrip dieksekusi
protectAdminPage();

// State Master Data Cache untuk Form & Dropdown
let cachedPemilik = [];
let cachedWilayah = [];
let cachedStatus = [];
let cachedJenisPengairan = [];
let currentAdminSawahList = [];
let batchRowCounter = 0;

// ==========================================================================
// 1. Inisialisasi Master Dropdown
// ==========================================================================
async function loadMasterDropdowns() {
  const [pemilikList, wilayahList, statusList, jpList] = await Promise.all([
    fetchServerPemilik(),
    fetchServerWilayah(),
    fetchServerStatusLahan(),
    fetchServerJenisPengairan()
  ]);

  cachedPemilik = pemilikList;
  cachedWilayah = wilayahList;
  cachedStatus = statusList;
  cachedJenisPengairan = jpList;

  // Dropdown Form Satuan
  populateSelect(document.getElementById("select-pemilik"), cachedPemilik, "pilih_pemilik");
  populateWilayahSelect(document.getElementById("select-wilayah"), cachedWilayah);
  populateSelect(document.getElementById("select-status-hukum"), cachedStatus, "pilih_status");
  populateJenisSelect(document.getElementById("select-jenis-sawah"), cachedJenisPengairan);

  // Dropdown Form Edit Modal
  populateSelect(document.getElementById("edit-select-pemilik"), cachedPemilik, "pilih_pemilik");
  populateWilayahSelect(document.getElementById("edit-select-wilayah"), cachedWilayah);
  populateSelect(document.getElementById("edit-select-status"), cachedStatus, "pilih_status");
  populateJenisSelect(document.getElementById("edit-select-jenis"), cachedJenisPengairan);

  // Update badge counts di mode-master-pane
  const badgePemilik = document.getElementById("badge-count-pemilik");
  const badgeWilayah = document.getElementById("badge-count-wilayah");
  const badgeStatus = document.getElementById("badge-count-status");
  const badgePengairan = document.getElementById("badge-count-pengairan");
  if (badgePemilik) badgePemilik.textContent = `${cachedPemilik.length} Terdata`;
  if (badgeWilayah) badgeWilayah.textContent = `${cachedWilayah.length} Terdata`;
  if (badgeStatus) badgeStatus.textContent = `${cachedStatus.length} Terdata`;
  if (badgePengairan) badgePengairan.textContent = `${cachedJenisPengairan.length} Terdata`;

  // Populate kabupaten dropdown di CRUD wilayah form
  const kabSelect = document.getElementById("crud-wilayah-kabupaten");
  if (kabSelect) {
    kabSelect.innerHTML = '<option value="">-- Pilih Kabupaten/Kota --</option>';
    kabupatenKota.forEach((kab) => {
      const opt = document.createElement("option");
      opt.value = kab.id;
      opt.textContent = kab.nama;
      kabSelect.appendChild(opt);
    });
  }
}

function populateSelect(selectEl, dataList, type) {
  if (!selectEl) return;
  selectEl.innerHTML = "";

  if (type === "pilih_pemilik") {
    selectEl.innerHTML = '<option value="">-- Pilih Pemilik --</option>';
    dataList.forEach((p) => {
      const opt = document.createElement("option");
      opt.value = p.id;
      opt.textContent = `${p.nama} (${p.jenis || "Perorangan"})`;
      selectEl.appendChild(opt);
    });
  } else if (type === "pilih_status") {
    dataList.forEach((st) => {
      const opt = document.createElement("option");
      opt.value = st.id;
      opt.textContent = `${st.kategori} - ${st.boleh_alih_fungsi ? "Boleh Alih Fungsi" : "Dilarang"}`;
      selectEl.appendChild(opt);
    });
  }
}

function populateJenisSelect(selectEl, jenisList) {
  if (!selectEl) return;
  selectEl.innerHTML = "";
  jenisList.forEach((jp) => {
    const opt = document.createElement("option");
    opt.value = jp.nama;
    opt.textContent = jp.nama;
    selectEl.appendChild(opt);
  });
  if (jenisList.length === 0) {
    ["Tadah Hujan", "Setengah Teknis", "Irigasi Teknis"].forEach((name) => {
      const opt = document.createElement("option");
      opt.value = name;
      opt.textContent = name;
      selectEl.appendChild(opt);
    });
  }
}

function populateWilayahSelect(selectEl, wilayahList) {
  if (!selectEl) return;
  selectEl.innerHTML = '<option value="">-- Pilih Desa / Kecamatan --</option>';

  kabupatenKota.forEach((kab) => {
    const optgroup = document.createElement("optgroup");
    optgroup.label = kab.nama;

    const wilFiltered = wilayahList.filter((w) => String(w.kabupaten_kota_id) === String(kab.id));
    wilFiltered.forEach((w) => {
      const opt = document.createElement("option");
      opt.value = w.id;
      opt.textContent = `${w.desa}, Kec. ${w.kecamatan} (${kab.nama})`;
      optgroup.appendChild(opt);
    });

    selectEl.appendChild(optgroup);
  });
}

// ==========================================================================
// 2. Mode Selector Tabs (Satuan vs Banyak Data vs JSON)
// ==========================================================================
function initModeSelector() {
  const tabs = document.querySelectorAll(".admin-mode-tab");
  const panes = document.querySelectorAll(".batch-mode-container");

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      const targetId = tab.getAttribute("data-target");

      tabs.forEach((t) => {
        t.classList.remove("active");
        t.setAttribute("aria-selected", "false");
      });
      panes.forEach((p) => p.classList.remove("active"));

      tab.classList.add("active");
      tab.setAttribute("aria-selected", "true");

      const targetPane = document.getElementById(targetId);
      if (targetPane) targetPane.classList.add("active");
    });
  });
}

// ==========================================================================
// 3. Mode 1: Form Satuan (POST Single Object)
// ==========================================================================
function initSingleSawahForm() {
  const form = document.getElementById("form-add-sawah");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const persil = document.getElementById("input-persil").value.trim();
    const luas = parseFloat(document.getElementById("input-luas").value);
    const pemilikId = document.getElementById("select-pemilik").value;
    const wilayahId = document.getElementById("select-wilayah").value;
    const jenisSawah = document.getElementById("select-jenis-sawah").value;
    const statusHukumId = document.getElementById("select-status-hukum").value;
    const lat = parseFloat(document.getElementById("input-lat").value);
    const lng = parseFloat(document.getElementById("input-lng").value);

    const submitBtn = form.querySelector('button[type="submit"]');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = "Menyimpan ke server...";
    }

    const payloadSawah = {
      id: null,
      nomor_persil: persil,
      pemilik_id: pemilikId,
      wilayah_id: wilayahId,
      status_lahan_id: statusHukumId,
      luas_hektar: luas,
      jenis_sawah: jenisSawah,
      latitude: lat,
      longitude: lng
    };

    try {
      const serverRes = await postServerDataSawah(payloadSawah);

      if (serverRes.status === 401) {
        alert("Sesi login telah kedaluwarsa. Silakan masuk kembali.");
        window.location.replace("login.html?redirect=admin.html");
        return;
      }

      if (serverRes.status === 409) {
        alert(`Gagal: Nomor persil "${persil}" atau ID mengalami konflik di basis data.`);
        return;
      }

      if (serverRes.is_err && serverRes.status !== 201) {
        alert(`Gagal menyimpan data: ${serverRes.status || "Kesalahan server"}`);
        return;
      }

      // Auto-evaluasi kandidat lokasi untuk data center
      await evaluateAndSaveCandidate(persil, luas, statusHukumId);

      form.reset();
      alert(`Berhasil menyimpan petak sawah "${persil}" ke basis data MySQL!`);
      await loadAndRenderAdminTable();
    } catch (err) {
      console.error("Gagal submit sawah:", err);
      alert("Terjadi kesalahan koneksi saat mengirim data ke server.");
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = "Simpan Petak Sawah ke Basis Data";
      }
    }
  });
}

// ==========================================================================
// 4. Mode 2: Entri Banyak Data Sekaligus (Dynamic Multi-Row Batch Array Grid)
// ==========================================================================
function createBatchRowMarkup(rowId) {
  let pemilikOptions = '<option value="">-- Pemilik --</option>';
  cachedPemilik.forEach((p) => {
    pemilikOptions += `<option value="${p.id}">${p.nama}</option>`;
  });

  let wilayahOptions = '<option value="">-- Wilayah --</option>';
  kabupatenKota.forEach((kab) => {
    const wilFiltered = cachedWilayah.filter((w) => String(w.kabupaten_kota_id) === String(kab.id));
    if (wilFiltered.length > 0) {
      wilayahOptions += `<optgroup label="${kab.nama}">`;
      wilFiltered.forEach((w) => {
        wilayahOptions += `<option value="${w.id}">${w.desa}</option>`;
      });
      wilayahOptions += `</optgroup>`;
    }
  });

  let statusOptions = "";
  cachedStatus.forEach((st) => {
    statusOptions += `<option value="${st.id}">${st.kategori}</option>`;
  });

  return `
    <tr id="batch-row-${rowId}" data-row-id="${rowId}">
      <td style="text-align: center; font-weight: bold; color: var(--text-light);">${rowId}</td>
      <td>
        <input type="text" class="batch-persil" placeholder="PRS-..." required>
      </td>
      <td>
        <input type="number" class="batch-luas" step="0.1" min="0.1" placeholder="10.5" required>
      </td>
      <td>
        <select class="batch-pemilik" required>${pemilikOptions}</select>
      </td>
      <td>
        <select class="batch-wilayah" required>${wilayahOptions}</select>
      </td>
      <td>
        <select class="batch-jenis">
          <option value="Tadah Hujan">Tadah Hujan</option>
          <option value="Setengah Teknis">Setengah Teknis</option>
          <option value="Irigasi Teknis">Irigasi Teknis</option>
        </select>
      </td>
      <td>
        <select class="batch-status">${statusOptions}</select>
      </td>
      <td>
        <input type="number" class="batch-lat" step="0.0001" placeholder="-6.3458" value="-6.3500" required>
      </td>
      <td>
        <input type="number" class="batch-lng" step="0.0001" placeholder="107.3124" value="107.3000" required>
      </td>
      <td style="text-align: center;">
        <button type="button" class="btn-remove-row" data-delete-row="${rowId}" title="Hapus baris ini">&times;</button>
      </td>
    </tr>
  `;
}

function addBatchRow() {
  const tbody = document.getElementById("batch-table-body");
  if (!tbody) return;

  batchRowCounter += 1;
  const tr = document.createElement("tr");
  tr.id = `batch-row-${batchRowCounter}`;
  tr.dataset.rowId = String(batchRowCounter);
  tr.innerHTML = createBatchRowMarkup(batchRowCounter);

  // Pasang listener hapus baris
  const delBtn = tr.querySelector(".btn-remove-row");
  if (delBtn) {
    delBtn.addEventListener("click", () => {
      tr.remove();
      updateBatchRowCountBadge();
    });
  }

  tbody.appendChild(tr);
  updateBatchRowCountBadge();
}

function updateBatchRowCountBadge() {
  const tbody = document.getElementById("batch-table-body");
  const badge = document.getElementById("batch-row-count-badge");
  if (!tbody || !badge) return;

  const count = tbody.querySelectorAll("tr").length;
  badge.textContent = String(count);
}

function initBatchGrid() {
  const btnAdd = document.getElementById("btn-add-batch-row");
  const btnAdd3 = document.getElementById("btn-add-batch-3rows");
  const btnClear = document.getElementById("btn-clear-batch-rows");
  const formBatch = document.getElementById("form-batch-sawah");

  if (btnAdd) btnAdd.addEventListener("click", () => addBatchRow());
  if (btnAdd3) {
    btnAdd3.addEventListener("click", () => {
      addBatchRow();
      addBatchRow();
      addBatchRow();
    });
  }
  if (btnClear) {
    btnClear.addEventListener("click", () => {
      const tbody = document.getElementById("batch-table-body");
      if (tbody) {
        tbody.innerHTML = "";
        batchRowCounter = 0;
        addBatchRow();
        addBatchRow();
      }
    });
  }

  // Buat 2 baris awal
  addBatchRow();
  addBatchRow();

  // Submit Handler: Kirim Payload Array of Objects ke Backend POST /api/data_sawah
  if (formBatch) {
    formBatch.addEventListener("submit", async (e) => {
      e.preventDefault();

      const tbody = document.getElementById("batch-table-body");
      const rows = tbody.querySelectorAll("tr");

      if (rows.length === 0) {
        alert("Tidak ada baris data untuk disimpan. Klik '+ Tambah Baris' terlebih dahulu.");
        return;
      }

      // Kumpulkan data seluruh baris menjadi array of objects
      const batchPayload = [];
      const persilSet = new Set();

      for (const row of rows) {
        const persil = row.querySelector(".batch-persil").value.trim();
        const luas = parseFloat(row.querySelector(".batch-luas").value);
        const pemilikId = row.querySelector(".batch-pemilik").value;
        const wilayahId = row.querySelector(".batch-wilayah").value;
        const jenisSawah = row.querySelector(".batch-jenis").value;
        const statusHukumId = row.querySelector(".batch-status").value;
        const lat = parseFloat(row.querySelector(".batch-lat").value);
        const lng = parseFloat(row.querySelector(".batch-lng").value);

        if (!persil || Number.isNaN(luas) || !pemilikId || !wilayahId) {
          alert("Harap lengkapi semua kolom wajib pada setiap baris data.");
          return;
        }

        if (persilSet.has(persil.toLowerCase())) {
          alert(`Duplikasi nomor persil terdeteksi di dalam tabel input: "${persil}". Pastikan nomor persil unik.`);
          return;
        }
        persilSet.add(persil.toLowerCase());

        batchPayload.push({
          id: null,
          nomor_persil: persil,
          pemilik_id: pemilikId,
          wilayah_id: wilayahId,
          status_lahan_id: statusHukumId,
          luas_hektar: luas,
          jenis_sawah: jenisSawah,
          latitude: lat,
          longitude: lng
        });
      }

      const submitBtn = document.getElementById("btn-submit-batch");
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = `Menyimpan ${batchPayload.length} data ke database...`;
      }

      try {
        // Kirim array langsung ke server!
        const serverRes = await postServerDataSawah(batchPayload);

        if (serverRes.status === 401) {
          alert("Sesi login telah kedaluwarsa. Silakan masuk kembali.");
          window.location.replace("login.html?redirect=admin.html");
          return;
        }

        if (serverRes.status === 409) {
          alert(`Gagal: Terdapat data yang mengalami konflik ID/persil: ${JSON.stringify(serverRes.data)}`);
          return;
        }

        if (serverRes.is_err && serverRes.status !== 201) {
          alert(`Gagal menyimpan batch data: ${serverRes.status || "Kesalahan server"}`);
          return;
        }

        alert(`Berhasil menyimpan ${batchPayload.length} petak sawah sekaligus (Batch Array Insert) ke server MySQL!`);

        // Reset form tabel batch
        tbody.innerHTML = "";
        batchRowCounter = 0;
        addBatchRow();
        addBatchRow();

        // Segarkan tabel data CRUD
        await loadAndRenderAdminTable();
      } catch (err) {
        console.error("Gagal simpan batch array:", err);
        alert("Terjadi kesalahan koneksi saat mengirim batch data ke server.");
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          updateBatchRowCountBadge();
        }
      }
    });
  }
}

// ==========================================================================
// 5. Mode 3: Import Format JSON Array
// ==========================================================================
function initJsonBatchEditor() {
  const formJson = document.getElementById("form-json-batch");
  const textarea = document.getElementById("json-array-input");
  const btnLoadSample = document.getElementById("btn-load-json-sample");
  const btnFormat = document.getElementById("btn-format-json");

  const sampleArray = [
    {
      id: null,
      nomor_persil: "PRS-7701",
      luas_hektar: 11.2,
      pemilik_id: "PMK-001",
      wilayah_id: "WIL-01",
      status_lahan_id: "ST-02",
      jenis_sawah: "Tadah Hujan",
      latitude: -6.3458,
      longitude: 107.3124
    },
    {
      id: null,
      nomor_persil: "PRS-7702",
      luas_hektar: 8.5,
      pemilik_id: "PMK-002",
      wilayah_id: "WIL-02",
      status_lahan_id: "ST-01",
      jenis_sawah: "Irigasi Teknis",
      latitude: -6.3821,
      longitude: 107.3912
    }
  ];

  const indicator = document.getElementById("json-syntax-indicator");
  function updateJsonIndicator() {
    if (!indicator || !textarea) return;
    const val = textarea.value.trim();
    if (!val) {
      indicator.className = "json-indicator badge-neutral";
      indicator.textContent = "Format: [ { ... } ]";
      return;
    }
    try {
      const p = JSON.parse(val);
      if (Array.isArray(p)) {
        indicator.className = "json-indicator badge-success";
        indicator.textContent = `✓ Valid Array (${p.length} objek)`;
      } else {
        indicator.className = "json-indicator badge-warning";
        indicator.textContent = "⚠ Harus berupa array [ { ... } ]";
      }
    } catch (e) {
      indicator.className = "json-indicator badge-danger";
      indicator.textContent = "✕ Sintaks JSON Tidak Valid";
    }
  }

  if (textarea) {
    textarea.addEventListener("input", updateJsonIndicator);
  }

  if (btnLoadSample && textarea) {
    btnLoadSample.addEventListener("click", () => {
      // Ambil ID pemilik & wilayah aktual jika ada di cache
      if (cachedPemilik.length > 0) sampleArray[0].pemilik_id = cachedPemilik[0].id;
      if (cachedWilayah.length > 0) sampleArray[0].wilayah_id = cachedWilayah[0].id;
      if (cachedStatus.length > 0) sampleArray[0].status_lahan_id = cachedStatus[0].id;

      textarea.value = JSON.stringify(sampleArray, null, 2);
      updateJsonIndicator();
    });
  }

  if (btnFormat && textarea) {
    btnFormat.addEventListener("click", () => {
      try {
        const parsed = JSON.parse(textarea.value);
        textarea.value = JSON.stringify(parsed, null, 2);
        updateJsonIndicator();
      } catch (e) {
        alert("JSON tidak valid: " + e.message);
      }
    });
  }

  if (formJson && textarea) {
    formJson.addEventListener("submit", async (e) => {
      e.preventDefault();

      let parsed;
      try {
        parsed = JSON.parse(textarea.value.trim());
      } catch (err) {
        alert("Sintaks JSON tidak valid. Periksa tanda koma, kurung siku, dan petik ganda.");
        return;
      }

      if (!Array.isArray(parsed) || parsed.length === 0) {
        alert("Payload harus berupa Array of Objects non-kosong: [ { ... }, { ... } ]");
        return;
      }

      const submitBtn = document.getElementById("btn-submit-json-batch");
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = `Mengirim ${parsed.length} data JSON...`;
      }

      try {
        const serverRes = await postServerDataSawah(parsed);

        if (serverRes.status === 401) {
          alert("Sesi login telah kedaluwarsa. Silakan masuk kembali.");
          window.location.replace("login.html?redirect=admin.html");
          return;
        }

        if (serverRes.status === 409) {
          alert(`Gagal: Terjadi konflik ID / nomor persil: ${JSON.stringify(serverRes.data)}`);
          return;
        }

        if (serverRes.is_err && serverRes.status !== 201) {
          alert(`Gagal mengirim data JSON: ${serverRes.status || "Kesalahan server"}`);
          return;
        }

        alert(`Berhasil mengimpor ${parsed.length} data petak sawah dari JSON Array ke server!`);
        textarea.value = "";
        await loadAndRenderAdminTable();
      } catch (err) {
        console.error("Gagal kirim JSON batch:", err);
        alert("Terjadi kesalahan koneksi saat mengirim data JSON.");
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = "Kirim Data Array JSON ke Backend";
        }
      }
    });
  }
}

// ==========================================================================
// 6. Pengelolaan Data Sawah (READ, UPDATE, DELETE - Single & Batch Delete)
// ==========================================================================
async function loadAndRenderAdminTable() {
  const tbody = document.getElementById("admin-table-body");
  const countLabel = document.getElementById("admin-table-count");
  if (!tbody || !countLabel) return;

  tbody.innerHTML = '<tr><td colspan="7" class="table-empty">Mengambil data dari server MySQL...</td></tr>';
  countLabel.textContent = "Memuat data...";

  try {
    // Ambil data dari server live
    let sawahList = [];
    const joinedRes = await fetch("/api/joined");
    if (joinedRes.ok) {
      const json = await joinedRes.json();
      if (json && Array.isArray(json.data)) {
        sawahList = json.data;
      }
    }

    if (sawahList.length === 0) {
      sawahList = await fetchServerDataSawah();
    }

    currentAdminSawahList = sawahList;
    renderAdminTableRows(currentAdminSawahList);
  } catch (err) {
    console.error("Gagal render tabel admin:", err);
    tbody.innerHTML = '<tr><td colspan="7" class="table-empty" style="color: #dc2626;">Gagal memuat data dari server. Pastikan server aktif.</td></tr>';
  }
}

function renderAdminTableRows(dataList) {
  const tbody = document.getElementById("admin-table-body");
  const countLabel = document.getElementById("admin-table-count");
  const checkAll = document.getElementById("check-all-rows");
  if (!tbody || !countLabel) return;

  if (checkAll) checkAll.checked = false;
  updateBatchDeleteToolbar();

  tbody.innerHTML = "";
  countLabel.textContent = `Total data tersimpan: ${dataList.length} petak sawah`;

  if (dataList.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="table-empty">Tidak ada data petak sawah yang sesuai.</td></tr>';
    return;
  }

  dataList.forEach((item) => {
    const tr = document.createElement("tr");
    tr.id = `admin-row-${item.id}`;
    tr.dataset.sawahId = item.id;

    const pemilikName = item.pemilikData?.nama || item.pemilik_nama || item.pemilik_id || "-";
    const desaName = item.wilayahData?.desa || item.desa || "-";
    const kecName = item.wilayahData?.kecamatan || item.kecamatan || "-";
    const statusKat = item.statusData?.kategori || item.status_kategori || item.status_lahan_id || "-";
    const bolehAlih = item.statusData?.boleh_alih_fungsi ?? true;

    let legalBadge = "badge-success";
    if (statusKat.includes("LP2B") || !bolehAlih) {
      legalBadge = "badge-danger";
    } else if (statusKat.includes("Terancam") || statusKat.includes("Sengketa")) {
      legalBadge = "badge-warning";
    }

    tr.innerHTML = `
      <td style="text-align: center;">
        <input type="checkbox" class="table-checkbox row-select-checkbox" data-id="${item.id}" title="Pilih baris ${item.id}">
      </td>
      <td>
        <span class="badge-id-mono">${item.id}</span>
        <span class="cell-sub" style="margin-top: 4px; font-weight: 600; color: var(--text-dark);">${item.nomor_persil}</span>
      </td>
      <td>
        <span class="cell-primary">${pemilikName}</span>
      </td>
      <td>
        <span class="cell-primary">Ds. ${desaName}</span>
        <span class="cell-sub">Kec. ${kecName}</span>
      </td>
      <td>
        <span class="cell-primary">${item.luas_hektar} Ha</span>
        <span class="cell-sub">${item.jenis_sawah || "Tadah Hujan"}</span>
      </td>
      <td>
        <span class="badge ${legalBadge}">${statusKat}</span>
      </td>
      <td style="text-align: center;">
        <div class="row-actions-group" style="justify-content: center;">
          <button type="button" class="btn-row-edit" data-edit-id="${item.id}" title="Perbarui data petak sawah">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
            </svg>
            Edit
          </button>
          <button type="button" class="btn-row-del" data-del-id="${item.id}" title="Hapus data petak sawah">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
            Hapus
          </button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });

  // Listener checkbox tiap baris
  document.querySelectorAll(".row-select-checkbox").forEach((cb) => {
    cb.addEventListener("change", () => {
      updateBatchDeleteToolbar();
    });
  });

  // Listener tombol edit
  document.querySelectorAll(".btn-row-edit").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-edit-id");
      openEditModal(id);
    });
  });

  // Listener tombol hapus satuan
  document.querySelectorAll(".btn-row-del").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.getAttribute("data-del-id");
      if (confirm(`Apakah Anda yakin ingin menghapus petak sawah ID "${id}" dari basis data?`)) {
        await executeDelete([id]);
      }
    });
  });
}

function updateBatchDeleteToolbar() {
  const banner = document.getElementById("batch-delete-banner");
  const label = document.getElementById("selected-count-label");
  const exportCount = document.getElementById("batch-export-count");
  const selectedCbs = document.querySelectorAll(".row-select-checkbox:checked");

  // Highlight baris yang dicentang
  document.querySelectorAll(".row-select-checkbox").forEach((cb) => {
    const tr = cb.closest("tr");
    if (tr) {
      if (cb.checked) tr.classList.add("row-selected");
      else tr.classList.remove("row-selected");
    }
  });

  if (!banner || !label) return;

  const count = selectedCbs.length;
  if (count > 0) {
    banner.style.display = "flex";
    label.textContent = String(count);
    if (exportCount) exportCount.textContent = String(count);
  } else {
    banner.style.display = "none";
  }
}

// ==========================================================================
// 7. Aksi Batch Delete (DELETE /api/data_sawah dengan Array of IDs)
// ==========================================================================
async function executeDelete(idArray) {
  if (!isLoggedIn()) {
    alert("Sesi login Anda tidak aktif. Silakan masuk terlebih dahulu.");
    window.location.replace("login.html?redirect=admin.html");
    return;
  }

  try {
    const res = await deleteServerDataSawah(idArray);

    if (res.status === 401) {
      alert("Sesi login telah kedaluwarsa. Silakan login kembali.");
      window.location.replace("login.html?redirect=admin.html");
      return;
    }

    if (res.status === 404) {
      alert(`Sebagian data tidak ditemukan di database: ${JSON.stringify(res.data)}`);
    } else {
      alert(`Berhasil menghapus ${idArray.length} data sawah dari server MySQL!`);
    }

    await loadAndRenderAdminTable();
  } catch (err) {
    console.error("Gagal hapus:", err);
    alert("Terjadi kesalahan saat menghapus data.");
  }
}

function initAdminTableActions() {
  const checkAll = document.getElementById("check-all-rows");
  const btnBatchDelete = document.getElementById("btn-execute-batch-delete");
  const btnClearSelect = document.getElementById("btn-clear-selection");
  const searchInput = document.getElementById("admin-search-input");
  const btnRefresh = document.getElementById("btn-admin-refresh");

  // Select all checkbox
  if (checkAll) {
    checkAll.addEventListener("change", () => {
      const isChecked = checkAll.checked;
      document.querySelectorAll(".row-select-checkbox").forEach((cb) => {
        cb.checked = isChecked;
      });
      updateBatchDeleteToolbar();
    });
  }

  // Tombol Hapus Terpilih (Batch Delete Array of IDs)
  if (btnBatchDelete) {
    btnBatchDelete.addEventListener("click", async () => {
      const selectedCbs = document.querySelectorAll(".row-select-checkbox:checked");
      const ids = Array.from(selectedCbs).map((cb) => cb.getAttribute("data-id"));

      if (ids.length === 0) return;

      const confirmMsg = `PERINGATAN: Anda akan menghapus ${ids.length} data sawah berikut sekaligus:\n\n${ids.join(", ")}\n\nLanjutkan penghapusan batch ke server?`;
      if (confirm(confirmMsg)) {
        await executeDelete(ids);
      }
    });
  }

  if (btnClearSelect) {
    btnClearSelect.addEventListener("click", () => {
      if (checkAll) checkAll.checked = false;
      document.querySelectorAll(".row-select-checkbox").forEach((cb) => (cb.checked = false));
      updateBatchDeleteToolbar();
    });
  }

  // Pencarian tabel admin
  if (searchInput) {
    searchInput.addEventListener("input", () => {
      const q = searchInput.value.toLowerCase().trim();
      const filtered = currentAdminSawahList.filter((item) => {
        const idMatch = String(item.id || "").toLowerCase().includes(q);
        const persilMatch = String(item.nomor_persil || "").toLowerCase().includes(q);
        const pemilikMatch = item.pemilikData?.nama ? item.pemilikData.nama.toLowerCase().includes(q) : false;
        const desaMatch = item.wilayahData?.desa ? item.wilayahData.desa.toLowerCase().includes(q) : false;
        return idMatch || persilMatch || pemilikMatch || desaMatch;
      });
      renderAdminTableRows(filtered);
    });
  }

  if (btnRefresh) {
    btnRefresh.addEventListener("click", async () => {
      if (searchInput) searchInput.value = "";
      await loadAndRenderAdminTable();
    });
  }
}

// ==========================================================================
// 8. Modal Edit Petak Sawah (PUT /api/data_sawah)
// ==========================================================================
function openEditModal(id) {
  const item = currentAdminSawahList.find((s) => String(s.id) === String(id));
  if (!item) {
    alert("Data petak sawah tidak ditemukan.");
    return;
  }

  const modal = document.getElementById("edit-sawah-modal");
  document.getElementById("edit-sawah-id").value = item.id;
  document.getElementById("edit-persil").value = item.nomor_persil || "";
  document.getElementById("edit-luas").value = item.luas_hektar || "";

  const selPemilik = document.getElementById("edit-select-pemilik");
  const selWilayah = document.getElementById("edit-select-wilayah");
  const selJenis = document.getElementById("edit-select-jenis");
  const selStatus = document.getElementById("edit-select-status");

  if (selPemilik) selPemilik.value = item.pemilik_id || item.pemilikData?.id || "";
  if (selWilayah) selWilayah.value = item.wilayah_id || item.wilayahData?.id || "";
  if (selJenis) selJenis.value = item.jenis_sawah || "Tadah Hujan";
  if (selStatus) selStatus.value = item.status_lahan_id || item.statusData?.id || "";

  document.getElementById("edit-lat").value = item.latitude || "-6.3500";
  document.getElementById("edit-lng").value = item.longitude || "107.3000";

  if (modal) modal.classList.add("active");
}

function initEditSawahModal() {
  const modal = document.getElementById("edit-sawah-modal");
  const closeBtn = document.getElementById("edit-sawah-close-btn");
  const cancelBtn = document.getElementById("btn-cancel-edit");
  const form = document.getElementById("form-edit-sawah");

  const closeModal = () => {
    if (modal) modal.classList.remove("active");
  };

  if (closeBtn) closeBtn.addEventListener("click", closeModal);
  if (cancelBtn) cancelBtn.addEventListener("click", closeModal);
  if (modal) {
    modal.addEventListener("click", (e) => {
      if (e.target === modal) closeModal();
    });
  }

  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();

      const id = document.getElementById("edit-sawah-id").value;
      const persil = document.getElementById("edit-persil").value.trim();
      const luas = parseFloat(document.getElementById("edit-luas").value);
      const pemilikId = document.getElementById("edit-select-pemilik").value;
      const wilayahId = document.getElementById("edit-select-wilayah").value;
      const jenis = document.getElementById("edit-select-jenis").value;
      const statusId = document.getElementById("edit-select-status").value;
      const lat = parseFloat(document.getElementById("edit-lat").value);
      const lng = parseFloat(document.getElementById("edit-lng").value);

      const updatePayload = {
        id,
        nomor_persil: persil,
        luas_hektar: luas,
        pemilik_id: pemilikId,
        wilayah_id: wilayahId,
        jenis_sawah: jenis,
        status_lahan_id: statusId,
        latitude: lat,
        longitude: lng
      };

      try {
        const res = await putServerDataSawah(updatePayload);

        if (res.status === 401) {
          alert("Sesi login telah kedaluwarsa. Silakan masuk kembali.");
          window.location.replace("login.html?redirect=admin.html");
          return;
        }

        if (res.status === 404) {
          alert(`Gagal: ID petak sawah "${id}" tidak ditemukan di server.`);
          return;
        }

        if (res.is_err && res.status !== 200) {
          alert(`Gagal memperbarui data: ${res.status || "Kesalahan server"}`);
          return;
        }

        alert(`Berhasil memperbarui data petak sawah "${id}" (${persil})!`);
        closeModal();
        await loadAndRenderAdminTable();
      } catch (err) {
        console.error("Gagal update sawah:", err);
        alert("Terjadi kesalahan koneksi saat memperbarui data di server.");
      }
    });
  }
}

// ==========================================================================
// 9. Modal Tambah Pemilik Baru (POST /api/pemilik)
// ==========================================================================
// ==========================================================================
// 7. CRUD MANAGER — Helper Generik
// ==========================================================================

/** Tampilkan / sembunyikan alert di dalam modal CRUD */
function showCrudAlert(alertEl, msg, isError = true) {
  if (!alertEl) return;
  alertEl.textContent = msg;
  if (!msg) {
    alertEl.style.display = "none";
    return;
  }
  alertEl.style.display = "block";
  alertEl.classList.toggle("error", isError);
  alertEl.classList.toggle("success", !isError);
}

/** Helper pesan error ramah pengguna untuk operasi CRUD */
function getCrudErrorMessage(res, defaultMsg = "Terjadi kesalahan saat memproses data.") {
  if (!res) return defaultMsg;
  const rawMsg = String(res.message || res.status || res.error || "");
  if (
    rawMsg.includes("foreign key") ||
    rawMsg.includes("FOREIGN KEY") ||
    rawMsg.includes("a foreign key constraint fails") ||
    rawMsg.includes("ER_ROW_IS_REFERENCED")
  ) {
    return "Data tidak dapat dihapus karena masih digunakan sebagai referensi oleh data petak sawah. Silakan ubah atau hapus data sawah terkait terlebih dahulu.";
  }
  if (rawMsg.includes("conflict")) {
    return "Data dengan ID tersebut sudah terdaftar di sistem (konflik ID).";
  }
  return rawMsg || defaultMsg;
}

/** Buka / tutup modal backdrop CRUD */
function makeCrudModalHandlers(modalId, openBtnIds = [], closeBtnIds = []) {
  const modal = document.getElementById(modalId);
  if (!modal) return { open: () => {}, close: () => {} };

  const open = () => {
    modal.classList.add("active");
    document.body.style.overflow = "hidden";
  };
  const close = () => {
    modal.classList.remove("active");
    document.body.style.overflow = "";
  };

  openBtnIds.forEach((id) => {
    const btn = document.getElementById(id);
    if (btn) btn.addEventListener("click", open);
  });
  closeBtnIds.forEach((id) => {
    const btn = document.getElementById(id);
    if (btn) btn.addEventListener("click", close);
  });
  modal.addEventListener("click", (e) => {
    if (e.target === modal) close();
  });

  return { open, close };
}

// ==========================================================================
// 7a. CRUD PEMILIK LAHAN
// ==========================================================================
/** Helper pencarian cepat baris tabel CRUD secara realtime */
function bindCrudTableSearch(searchInputId, tbodyEl) {
  const input = document.getElementById(searchInputId);
  if (!input || !tbodyEl) return;
  input.addEventListener("input", () => {
    const query = input.value.trim().toLowerCase();
    const rows = tbodyEl.querySelectorAll("tr");
    rows.forEach((row) => {
      const text = row.textContent.toLowerCase();
      row.style.display = text.includes(query) ? "" : "none";
    });
  });
}

function initCrudPemilik() {
  const { open, close } = makeCrudModalHandlers(
    "modal-crud-pemilik",
    ["btn-open-pemilik-modal", "btn-open-pemilik-side", "btn-open-pemilik-grid"],
    ["btn-close-crud-pemilik"]
  );

  const form = document.getElementById("form-crud-pemilik");
  const editIdInput = document.getElementById("crud-pemilik-edit-id");
  const namaInput = document.getElementById("crud-pemilik-nama");
  const jenisSelect = document.getElementById("crud-pemilik-jenis");
  const kontakInput = document.getElementById("crud-pemilik-kontak");
  const alertEl = document.getElementById("crud-pemilik-alert");
  const submitBtn = document.getElementById("btn-crud-pemilik-submit");
  const resetBtn = document.getElementById("btn-crud-pemilik-reset");
  const refreshBtn = document.getElementById("btn-crud-pemilik-refresh");
  const formTitle = document.getElementById("crud-pemilik-form-title");
  const modeBadge = document.getElementById("crud-pemilik-mode-badge");
  const tbody = document.getElementById("crud-pemilik-tbody");
  const tableEl = document.getElementById("crud-pemilik-table");
  const loadingEl = document.getElementById("crud-pemilik-loading");
  const countEl = document.getElementById("crud-pemilik-count");
  const searchInput = document.getElementById("crud-pemilik-search");

  if (!form) return;

  bindCrudTableSearch("crud-pemilik-search", tbody);

  async function renderTable() {
    if (loadingEl) loadingEl.style.display = "flex";
    if (tableEl) tableEl.style.display = "none";
    if (searchInput) searchInput.value = "";
    const list = await fetchServerPemilik();
    cachedPemilik = list;
    if (countEl) countEl.textContent = list.length;
    if (tbody) {
      tbody.innerHTML = "";
      if (list.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:32px;color:#94a3b8;">Belum ada data pemilik terdaftar. Silakan tambah data baru.</td></tr>`;
      } else {
        list.forEach((p) => {
          const tr = document.createElement("tr");
          tr.innerHTML = `
            <td><code>${p.id}</code></td>
            <td style="font-weight:600;color:#0F172A;">${p.nama}</td>
            <td><span class="crud-badge crud-badge-success">${p.jenis || "Perorangan"}</span></td>
            <td style="color:#64748B;font-family:var(--font-mono);font-size:0.8rem;">${p.kontak || "-"}</td>
            <td>
              <div class="crud-table-actions">
                <button class="btn-crud-edit" data-id="${p.id}" title="Edit data ini">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                  Edit
                </button>
                <button class="btn-crud-delete" data-id="${p.id}" title="Hapus data ini">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                  Hapus
                </button>
              </div>
            </td>`;
          tbody.appendChild(tr);
        });
      }
    }
    if (loadingEl) loadingEl.style.display = "none";
    if (tableEl) tableEl.style.display = "";
    bindTableActions();
  }

  function resetForm(clearAlert = true) {
    form.reset();
    if (editIdInput) editIdInput.value = "";
    if (modeBadge) {
      modeBadge.textContent = "Mode Tambah";
      modeBadge.classList.remove("edit-mode");
    }
    if (formTitle) formTitle.textContent = "Pendaftaran Pemilik Baru";
    if (submitBtn) {
      submitBtn.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg> Simpan Pemilik`;
      submitBtn.disabled = false;
    }
    if (clearAlert) {
      showCrudAlert(alertEl, "");
    }
  }

  function bindTableActions() {
    tbody.querySelectorAll(".btn-crud-edit").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-id");
        const item = cachedPemilik.find((p) => String(p.id) === String(id));
        if (!item) return;
        editIdInput.value = item.id;
        namaInput.value = item.nama;
        jenisSelect.value = item.jenis || "Perorangan";
        kontakInput.value = item.kontak || "";
        if (modeBadge) {
          modeBadge.textContent = `Mode Edit (${item.id})`;
          modeBadge.classList.add("edit-mode");
        }
        if (formTitle) formTitle.textContent = `Edit Pemilik: ${item.nama}`;
        if (submitBtn) {
          submitBtn.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg> Simpan Perubahan`;
        }
        showCrudAlert(alertEl, "");
        namaInput.focus();
      });
    });

    tbody.querySelectorAll(".btn-crud-delete").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.getAttribute("data-id");
        const item = cachedPemilik.find((p) => String(p.id) === String(id));
        if (!confirm(`Hapus pemilik "${item?.nama || id}"? Tindakan ini tidak dapat diurungkan.`)) return;
        const res = await deleteServerPemilik([id]);
        if (res.ok) {
          showCrudAlert(alertEl, `Pemilik "${item?.nama || id}" berhasil dihapus.`, false);
          setTimeout(() => showCrudAlert(alertEl, ""), 4000);
          await renderTable();
          await loadMasterDropdowns();
        } else {
          const errMsg = getCrudErrorMessage(res, "Gagal menghapus data pemilik.");
          showCrudAlert(alertEl, errMsg, true);
          alert(`Gagal menghapus:\n\n${errMsg}`);
        }
      });
    });
  }

  if (resetBtn) resetBtn.addEventListener("click", () => resetForm(true));
  if (refreshBtn) refreshBtn.addEventListener("click", renderTable);

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    showCrudAlert(alertEl, "");
    const editId = editIdInput ? editIdInput.value.trim() : "";
    const payload = {
      id: editId || null,
      nama: namaInput.value.trim(),
      jenis: jenisSelect.value,
      kontak: kontakInput.value.trim()
    };
    if (!payload.nama) return showCrudAlert(alertEl, "Nama pemilik tidak boleh kosong.");

    if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = "Menyimpan..."; }
    try {
      const res = editId
        ? await putServerPemilik(payload)
        : await postServerPemilik(payload);
      if (res.httpStatus === 401 || res.status === 401) {
        alert("Sesi login berakhir. Silakan login kembali.");
        window.location.replace("login.html?redirect=admin.html");
        return;
      }
      if (!res.ok) {
        showCrudAlert(alertEl, `Gagal menyimpan: ${getCrudErrorMessage(res, "Terjadi kesalahan server")}`);
        return;
      }
      resetForm(false);
      showCrudAlert(alertEl, editId ? "Data pemilik berhasil diperbarui!" : "Data pemilik berhasil ditambahkan!", false);
      setTimeout(() => showCrudAlert(alertEl, ""), 4000);
      await renderTable();
      await loadMasterDropdowns();
    } catch (err) {
      showCrudAlert(alertEl, `Kesalahan: ${err.message}`);
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        if (editIdInput && editIdInput.value.trim()) {
          submitBtn.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg> Simpan Perubahan`;
        } else {
          submitBtn.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg> Simpan Pemilik`;
        }
      }
    }
  });

  const modalEl = document.getElementById("modal-crud-pemilik");
  if (modalEl) {
    const observer = new MutationObserver((muts) => {
      muts.forEach((m) => {
        if (m.target.classList.contains("active")) renderTable();
      });
    });
    observer.observe(modalEl, { attributes: true, attributeFilter: ["class"] });
  }
}

// ==========================================================================
// 7b. CRUD WILAYAH ADMINISTRATIF
// ==========================================================================
function initCrudWilayah() {
  const { open, close } = makeCrudModalHandlers(
    "modal-crud-wilayah",
    ["btn-open-wilayah-modal", "btn-open-wilayah-side", "btn-open-wilayah-grid"],
    ["btn-close-crud-wilayah"]
  );

  const form = document.getElementById("form-crud-wilayah");
  const editIdInput = document.getElementById("crud-wilayah-edit-id");
  const kabSelect = document.getElementById("crud-wilayah-kabupaten");
  const kecInput = document.getElementById("crud-wilayah-kecamatan");
  const desaInput = document.getElementById("crud-wilayah-desa");
  const luasInput = document.getElementById("crud-wilayah-luas");
  const banjirSelect = document.getElementById("crud-wilayah-banjir");
  const gempaSelect = document.getElementById("crud-wilayah-gempa");
  const longsorSelect = document.getElementById("crud-wilayah-longsor");
  const alertEl = document.getElementById("crud-wilayah-alert");
  const submitBtn = document.getElementById("btn-crud-wilayah-submit");
  const resetBtn = document.getElementById("btn-crud-wilayah-reset");
  const refreshBtn = document.getElementById("btn-crud-wilayah-refresh");
  const formTitle = document.getElementById("crud-wilayah-form-title");
  const modeBadge = document.getElementById("crud-wilayah-mode-badge");
  const tbody = document.getElementById("crud-wilayah-tbody");
  const tableEl = document.getElementById("crud-wilayah-table");
  const loadingEl = document.getElementById("crud-wilayah-loading");
  const countEl = document.getElementById("crud-wilayah-count");
  const searchInput = document.getElementById("crud-wilayah-search");

  if (!form) return;

  bindCrudTableSearch("crud-wilayah-search", tbody);

  async function renderTable() {
    if (loadingEl) loadingEl.style.display = "flex";
    if (tableEl) tableEl.style.display = "none";
    if (searchInput) searchInput.value = "";
    const list = await fetchServerWilayah();
    cachedWilayah = list;
    if (countEl) countEl.textContent = list.length;
    if (tbody) {
      tbody.innerHTML = "";
      if (list.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:32px;color:#94a3b8;">Belum ada data wilayah. Silakan tambah data baru.</td></tr>`;
      } else {
        list.forEach((w) => {
          const kab = kabupatenKota.find((k) => String(k.id) === String(w.kabupaten_kota_id));
          const tr = document.createElement("tr");
          tr.innerHTML = `
            <td><code>${w.id}</code></td>
            <td style="font-weight:600;color:#0F172A;">${w.desa}</td>
            <td>${w.kecamatan}</td>
            <td style="color:#475569;">${kab ? kab.nama : w.kabupaten_kota_id}</td>
            <td>
              <div class="crud-table-actions">
                <button class="btn-crud-edit" data-id="${w.id}" title="Edit wilayah ini">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                  Edit
                </button>
                <button class="btn-crud-delete" data-id="${w.id}" title="Hapus wilayah ini">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                  Hapus
                </button>
              </div>
            </td>`;
          tbody.appendChild(tr);
        });
      }
    }
    if (loadingEl) loadingEl.style.display = "none";
    if (tableEl) tableEl.style.display = "";
    bindTableActions();
  }

  function resetForm(clearAlert = true) {
    form.reset();
    if (editIdInput) editIdInput.value = "";
    if (modeBadge) {
      modeBadge.textContent = "Mode Tambah";
      modeBadge.classList.remove("edit-mode");
    }
    if (formTitle) formTitle.textContent = "Pendaftaran Wilayah Baru";
    if (submitBtn) {
      submitBtn.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg> Simpan Wilayah`;
      submitBtn.disabled = false;
    }
    if (clearAlert) {
      showCrudAlert(alertEl, "");
    }
  }

  function bindTableActions() {
    tbody.querySelectorAll(".btn-crud-edit").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-id");
        const item = cachedWilayah.find((w) => String(w.id) === String(id));
        if (!item) return;
        editIdInput.value = item.id;
        if (kabSelect) kabSelect.value = item.kabupaten_kota_id;
        kecInput.value = item.kecamatan;
        desaInput.value = item.desa;
        if (luasInput) luasInput.value = item.luas_baku_sawah ?? item.total_lahan_baku_ha ?? "";
        if (banjirSelect) banjirSelect.value = item.risiko_banjir || "Rendah";
        if (gempaSelect) gempaSelect.value = item.risiko_gempa || "Rendah";
        if (longsorSelect) longsorSelect.value = item.risiko_longsor || "Rendah";
        if (modeBadge) {
          modeBadge.textContent = `Mode Edit (${item.id})`;
          modeBadge.classList.add("edit-mode");
        }
        if (formTitle) formTitle.textContent = `Edit Wilayah: ${item.desa}`;
        if (submitBtn) {
          submitBtn.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg> Simpan Perubahan`;
        }
        showCrudAlert(alertEl, "");
        desaInput.focus();
      });
    });

    tbody.querySelectorAll(".btn-crud-delete").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.getAttribute("data-id");
        const item = cachedWilayah.find((w) => String(w.id) === String(id));
        if (!confirm(`Hapus wilayah "${item?.desa || id}"? Tindakan ini tidak dapat diurungkan.`)) return;
        const res = await deleteServerWilayah([id]);
        if (res.ok) {
          showCrudAlert(alertEl, `Wilayah "${item?.desa || id}" berhasil dihapus.`, false);
          setTimeout(() => showCrudAlert(alertEl, ""), 4000);
          await renderTable();
          await loadMasterDropdowns();
        } else {
          const errMsg = getCrudErrorMessage(res, "Gagal menghapus data wilayah.");
          showCrudAlert(alertEl, errMsg, true);
          alert(`Gagal menghapus:\n\n${errMsg}`);
        }
      });
    });
  }

  if (resetBtn) resetBtn.addEventListener("click", () => resetForm(true));
  if (refreshBtn) refreshBtn.addEventListener("click", renderTable);

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    showCrudAlert(alertEl, "");
    const editId = editIdInput ? editIdInput.value.trim() : "";
    const parsedLuas = luasInput ? parseFloat(luasInput.value) || 0 : 0;
    const payload = {
      id: editId || null,
      kabupaten_kota_id: kabSelect ? kabSelect.value : "KAB-01",
      kecamatan: kecInput.value.trim(),
      desa: desaInput.value.trim(),
      total_lahan_baku_ha: parsedLuas,
      luas_baku_sawah: parsedLuas,
      risiko_banjir: banjirSelect ? banjirSelect.value : "Rendah",
      risiko_gempa: gempaSelect ? gempaSelect.value : "Rendah",
      risiko_longsor: longsorSelect ? longsorSelect.value : "Rendah"
    };
    if (!payload.kecamatan || !payload.desa || !payload.kabupaten_kota_id) {
      return showCrudAlert(alertEl, "Kabupaten/kota, kecamatan, dan desa wajib diisi.");
    }

    if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = "Menyimpan..."; }
    try {
      const res = editId
        ? await putServerWilayah(payload)
        : await postServerWilayah(payload);
      if (res.httpStatus === 401 || res.status === 401) {
        alert("Sesi login berakhir. Silakan login kembali.");
        window.location.replace("login.html?redirect=admin.html");
        return;
      }
      if (!res.ok) {
        showCrudAlert(alertEl, `Gagal menyimpan: ${getCrudErrorMessage(res, "Terjadi kesalahan server")}`);
        return;
      }
      resetForm(false);
      showCrudAlert(alertEl, editId ? "Data wilayah berhasil diperbarui!" : "Data wilayah berhasil ditambahkan!", false);
      setTimeout(() => showCrudAlert(alertEl, ""), 4000);
      await renderTable();
      await loadMasterDropdowns();
    } catch (err) {
      showCrudAlert(alertEl, `Kesalahan: ${err.message}`);
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        if (editIdInput && editIdInput.value.trim()) {
          submitBtn.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg> Simpan Perubahan`;
        } else {
          submitBtn.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg> Simpan Wilayah`;
        }
      }
    }
  });

  const modalEl = document.getElementById("modal-crud-wilayah");
  if (modalEl) {
    const observer = new MutationObserver((muts) => {
      muts.forEach((m) => {
        if (m.target.classList.contains("active")) renderTable();
      });
    });
    observer.observe(modalEl, { attributes: true, attributeFilter: ["class"] });
  }
}

// ==========================================================================
// 7c. CRUD STATUS HUKUM LAHAN
// ==========================================================================
function initCrudStatus() {
  const { open, close } = makeCrudModalHandlers(
    "modal-crud-status",
    ["btn-open-status-modal", "btn-open-status-side", "btn-open-status-grid"],
    ["btn-close-crud-status"]
  );

  const form = document.getElementById("form-crud-status");
  const editIdInput = document.getElementById("crud-status-edit-id");
  const kategoriInput = document.getElementById("crud-status-kategori");
  const alihSelect = document.getElementById("crud-status-alih");
  const hukumInput = document.getElementById("crud-status-hukum");
  const alertEl = document.getElementById("crud-status-alert");
  const submitBtn = document.getElementById("btn-crud-status-submit");
  const resetBtn = document.getElementById("btn-crud-status-reset");
  const refreshBtn = document.getElementById("btn-crud-status-refresh");
  const formTitle = document.getElementById("crud-status-form-title");
  const modeBadge = document.getElementById("crud-status-mode-badge");
  const tbody = document.getElementById("crud-status-tbody");
  const tableEl = document.getElementById("crud-status-table");
  const loadingEl = document.getElementById("crud-status-loading");
  const countEl = document.getElementById("crud-status-count");
  const searchInput = document.getElementById("crud-status-search");

  if (!form) return;

  bindCrudTableSearch("crud-status-search", tbody);

  async function renderTable() {
    if (loadingEl) loadingEl.style.display = "flex";
    if (tableEl) tableEl.style.display = "none";
    if (searchInput) searchInput.value = "";
    const list = await fetchServerStatusLahan();
    cachedStatus = list;
    if (countEl) countEl.textContent = list.length;
    if (tbody) {
      tbody.innerHTML = "";
      if (list.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:32px;color:#94a3b8;">Belum ada data status lahan. Silakan tambah data baru.</td></tr>`;
      } else {
        list.forEach((s) => {
          const bolehBadge = s.boleh_alih_fungsi
            ? '<span class="crud-badge crud-badge-success">Boleh Alih</span>'
            : '<span class="crud-badge crud-badge-danger">Dilarang Alih</span>';
          const tr = document.createElement("tr");
          tr.innerHTML = `
            <td><code>${s.id}</code></td>
            <td style="font-weight:600;color:#0F172A;">${s.kategori}</td>
            <td>${bolehBadge}</td>
            <td style="color:#64748B;font-size:0.8rem;">${s.dasar_hukum || '<span style="color:#CBD5E1">-</span>'}</td>
            <td>
              <div class="crud-table-actions">
                <button class="btn-crud-edit" data-id="${s.id}" title="Edit status ini">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                  Edit
                </button>
                <button class="btn-crud-delete" data-id="${s.id}" title="Hapus status ini">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                  Hapus
                </button>
              </div>
            </td>`;
          tbody.appendChild(tr);
        });
      }
    }
    if (loadingEl) loadingEl.style.display = "none";
    if (tableEl) tableEl.style.display = "";
    bindTableActions();
  }

  function resetForm(clearAlert = true) {
    form.reset();
    if (editIdInput) editIdInput.value = "";
    if (modeBadge) {
      modeBadge.textContent = "Mode Tambah";
      modeBadge.classList.remove("edit-mode");
    }
    if (formTitle) formTitle.textContent = "Pendaftaran Status Baru";
    if (submitBtn) {
      submitBtn.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg> Simpan Status`;
      submitBtn.disabled = false;
    }
    if (clearAlert) {
      showCrudAlert(alertEl, "");
    }
  }

  function bindTableActions() {
    tbody.querySelectorAll(".btn-crud-edit").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-id");
        const item = cachedStatus.find((s) => String(s.id) === String(id));
        if (!item) return;
        editIdInput.value = item.id;
        kategoriInput.value = item.kategori;
        if (alihSelect) alihSelect.value = (item.boleh_alih_fungsi === 1 || item.boleh_alih_fungsi === true || String(item.boleh_alih_fungsi) === "1") ? "1" : "0";
        if (hukumInput) hukumInput.value = item.dasar_hukum || "";
        if (modeBadge) {
          modeBadge.textContent = `Mode Edit (${item.id})`;
          modeBadge.classList.add("edit-mode");
        }
        if (formTitle) formTitle.textContent = `Edit Status: ${item.kategori}`;
        if (submitBtn) {
          submitBtn.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg> Simpan Perubahan`;
        }
        showCrudAlert(alertEl, "");
        kategoriInput.focus();
      });
    });

    tbody.querySelectorAll(".btn-crud-delete").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.getAttribute("data-id");
        const item = cachedStatus.find((s) => String(s.id) === String(id));
        if (!confirm(`Hapus status "${item?.kategori || id}"? Tindakan ini tidak dapat diurungkan.`)) return;
        const res = await deleteServerStatusLahan([id]);
        if (res.ok) {
          showCrudAlert(alertEl, `Status "${item?.kategori || id}" berhasil dihapus.`, false);
          setTimeout(() => showCrudAlert(alertEl, ""), 4000);
          await renderTable();
          await loadMasterDropdowns();
        } else {
          const errMsg = getCrudErrorMessage(res, "Gagal menghapus data status lahan.");
          showCrudAlert(alertEl, errMsg, true);
          alert(`Gagal menghapus:\n\n${errMsg}`);
        }
      });
    });
  }

  if (resetBtn) resetBtn.addEventListener("click", () => resetForm(true));
  if (refreshBtn) refreshBtn.addEventListener("click", renderTable);

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    showCrudAlert(alertEl, "");
    const editId = editIdInput ? editIdInput.value.trim() : "";
    const payload = {
      id: editId || null,
      kategori: kategoriInput.value.trim(),
      boleh_alih_fungsi: alihSelect ? (alihSelect.value === "1" ? 1 : 0) : 1,
      dasar_hukum: hukumInput ? hukumInput.value.trim() : ""
    };
    if (!payload.kategori) return showCrudAlert(alertEl, "Kategori status tidak boleh kosong.");

    if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = "Menyimpan..."; }
    try {
      const res = editId
        ? await putServerStatusLahan(payload)
        : await postServerStatusLahan(payload);
      if (res.httpStatus === 401 || res.status === 401) {
        alert("Sesi login berakhir. Silakan login kembali.");
        window.location.replace("login.html?redirect=admin.html");
        return;
      }
      if (!res.ok) {
        showCrudAlert(alertEl, `Gagal menyimpan: ${getCrudErrorMessage(res, "Terjadi kesalahan server")}`);
        return;
      }
      resetForm(false);
      showCrudAlert(alertEl, editId ? "Data status berhasil diperbarui!" : "Data status berhasil ditambahkan!", false);
      setTimeout(() => showCrudAlert(alertEl, ""), 4000);
      await renderTable();
      await loadMasterDropdowns();
    } catch (err) {
      showCrudAlert(alertEl, `Kesalahan: ${err.message}`);
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        if (editIdInput && editIdInput.value.trim()) {
          submitBtn.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg> Simpan Perubahan`;
        } else {
          submitBtn.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg> Simpan Status`;
        }
      }
    }
  });

  const modalEl = document.getElementById("modal-crud-status");
  if (modalEl) {
    const observer = new MutationObserver((muts) => {
      muts.forEach((m) => {
        if (m.target.classList.contains("active")) renderTable();
      });
    });
    observer.observe(modalEl, { attributes: true, attributeFilter: ["class"] });
  }
}

// ==========================================================================
// 7d. CRUD JENIS PENGAIRAN SAWAH
// ==========================================================================
function initCrudPengairan() {
  const { open, close } = makeCrudModalHandlers(
    "modal-crud-pengairan",
    ["btn-open-pengairan-modal", "btn-open-pengairan-side", "btn-open-pengairan-grid"],
    ["btn-close-crud-pengairan"]
  );

  const form = document.getElementById("form-crud-pengairan");
  const editIdInput = document.getElementById("crud-pengairan-edit-id");
  const namaInput = document.getElementById("crud-pengairan-nama");
  const deskInput = document.getElementById("crud-pengairan-deskripsi");
  const alertEl = document.getElementById("crud-pengairan-alert");
  const submitBtn = document.getElementById("btn-crud-pengairan-submit");
  const resetBtn = document.getElementById("btn-crud-pengairan-reset");
  const refreshBtn = document.getElementById("btn-crud-pengairan-refresh");
  const formTitle = document.getElementById("crud-pengairan-form-title");
  const modeBadge = document.getElementById("crud-pengairan-mode-badge");
  const tbody = document.getElementById("crud-pengairan-tbody");
  const tableEl = document.getElementById("crud-pengairan-table");
  const loadingEl = document.getElementById("crud-pengairan-loading");
  const countEl = document.getElementById("crud-pengairan-count");
  const searchInput = document.getElementById("crud-pengairan-search");

  if (!form) return;

  bindCrudTableSearch("crud-pengairan-search", tbody);

  async function renderTable() {
    if (loadingEl) loadingEl.style.display = "flex";
    if (tableEl) tableEl.style.display = "none";
    if (searchInput) searchInput.value = "";
    const list = await fetchServerJenisPengairan();
    cachedJenisPengairan = list;
    if (countEl) countEl.textContent = list.length;
    if (tbody) {
      tbody.innerHTML = "";
      if (list.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;padding:32px;color:#94a3b8;">Belum ada jenis pengairan. Silakan tambah data baru.</td></tr>`;
      } else {
        list.forEach((jp) => {
          const tr = document.createElement("tr");
          tr.innerHTML = `
            <td><code>${jp.id}</code></td>
            <td style="font-weight:600;color:#0F172A;">${jp.nama}</td>
            <td style="color:#64748B;font-size:0.82rem;">${jp.deskripsi || '<span style="color:#CBD5E1">-</span>'}</td>
            <td>
              <div class="crud-table-actions">
                <button class="btn-crud-edit" data-id="${jp.id}" title="Edit jenis ini">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                  Edit
                </button>
                <button class="btn-crud-delete" data-id="${jp.id}" title="Hapus jenis ini">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                  Hapus
                </button>
              </div>
            </td>`;
          tbody.appendChild(tr);
        });
      }
    }
    if (loadingEl) loadingEl.style.display = "none";
    if (tableEl) tableEl.style.display = "";
    bindTableActions();
  }

  function resetForm(clearAlert = true) {
    form.reset();
    if (editIdInput) editIdInput.value = "";
    if (modeBadge) {
      modeBadge.textContent = "Mode Tambah";
      modeBadge.classList.remove("edit-mode");
    }
    if (formTitle) formTitle.textContent = "Pendaftaran Jenis Pengairan";
    if (submitBtn) {
      submitBtn.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg> Simpan Pengairan`;
      submitBtn.disabled = false;
    }
    if (clearAlert) {
      showCrudAlert(alertEl, "");
    }
  }

  function bindTableActions() {
    tbody.querySelectorAll(".btn-crud-edit").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-id");
        const item = cachedJenisPengairan.find((jp) => String(jp.id) === String(id));
        if (!item) return;
        editIdInput.value = item.id;
        namaInput.value = item.nama;
        if (deskInput) deskInput.value = item.deskripsi || "";
        if (modeBadge) {
          modeBadge.textContent = `Mode Edit (${item.id})`;
          modeBadge.classList.add("edit-mode");
        }
        if (formTitle) formTitle.textContent = `Edit Pengairan: ${item.nama}`;
        if (submitBtn) {
          submitBtn.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg> Simpan Perubahan`;
        }
        showCrudAlert(alertEl, "");
        namaInput.focus();
      });
    });

    tbody.querySelectorAll(".btn-crud-delete").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.getAttribute("data-id");
        const item = cachedJenisPengairan.find((jp) => String(jp.id) === String(id));
        if (!confirm(`Hapus jenis pengairan "${item?.nama || id}"? Tindakan ini tidak dapat diurungkan.`)) return;
        const res = await deleteServerJenisPengairan([id]);
        if (res.ok) {
          showCrudAlert(alertEl, `Jenis pengairan "${item?.nama || id}" berhasil dihapus.`, false);
          setTimeout(() => showCrudAlert(alertEl, ""), 4000);
          await renderTable();
          await loadMasterDropdowns();
        } else {
          const errMsg = getCrudErrorMessage(res, "Gagal menghapus jenis pengairan.");
          showCrudAlert(alertEl, errMsg, true);
          alert(`Gagal menghapus:\n\n${errMsg}`);
        }
      });
    });
  }

  if (resetBtn) resetBtn.addEventListener("click", () => resetForm(true));
  if (refreshBtn) refreshBtn.addEventListener("click", renderTable);

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    showCrudAlert(alertEl, "");
    const editId = editIdInput ? editIdInput.value.trim() : "";
    const payload = {
      id: editId || null,
      nama: namaInput.value.trim(),
      deskripsi: deskInput ? deskInput.value.trim() : ""
    };
    if (!payload.nama) return showCrudAlert(alertEl, "Nama jenis pengairan tidak boleh kosong.");

    if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = "Menyimpan..."; }
    try {
      const res = editId
        ? await putServerJenisPengairan(payload)
        : await postServerJenisPengairan(payload);
      if (res.httpStatus === 401 || res.status === 401) {
        alert("Sesi login berakhir. Silakan login kembali.");
        window.location.replace("login.html?redirect=admin.html");
        return;
      }
      if (!res.ok) {
        showCrudAlert(alertEl, `Gagal menyimpan: ${getCrudErrorMessage(res, "Terjadi kesalahan server")}`);
        return;
      }
      resetForm(false);
      showCrudAlert(alertEl, editId ? "Data jenis pengairan berhasil diperbarui!" : "Data jenis pengairan berhasil ditambahkan!", false);
      setTimeout(() => showCrudAlert(alertEl, ""), 4000);
      await renderTable();
      await loadMasterDropdowns();
    } catch (err) {
      showCrudAlert(alertEl, `Kesalahan: ${err.message}`);
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        if (editIdInput && editIdInput.value.trim()) {
          submitBtn.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg> Simpan Perubahan`;
        } else {
          submitBtn.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg> Simpan Pengairan`;
        }
      }
    }
  });

  const modalEl = document.getElementById("modal-crud-pengairan");
  if (modalEl) {
    const observer = new MutationObserver((muts) => {
      muts.forEach((m) => {
        if (m.target.classList.contains("active")) renderTable();
      });
    });
    observer.observe(modalEl, { attributes: true, attributeFilter: ["class"] });
  }
}

// Helper auto-evaluasi kandidat data center
async function evaluateAndSaveCandidate(persil, luas, statusHukumId) {
  const stData = cachedStatus.find((s) => String(s.id) === String(statusHukumId));
  let evalStatus = "Dipertimbangkan";
  let evalSkor = 50;
  let evalCatatan = "Data baru disimpan. Menunggu verifikasi jarak fasilitas terdekat.";

  if (stData && !stData.boleh_alih_fungsi) {
    evalStatus = "Tidak Layak";
    evalSkor = 0;
    evalCatatan = `Dilarang secara hukum: ${stData.dasar_hukum || "Status LP2B / Sengketa"}`;
  } else if (luas >= 10.0) {
    evalStatus = "Layak";
    evalSkor = 85;
    evalCatatan = "Luas lahan sangat memadai (>10 Ha) dan bukan zona terlarang LP2B.";
  } else if (luas >= 5.0) {
    evalStatus = "Dipertimbangkan";
    evalSkor = 70;
    evalCatatan = "Luas memenuhi kriteria minimal (5-10 Ha). Bukan LP2B.";
  }

  const newKandidat = {
    id: null,
    sawah_id: null,
    nama_blok: `Blok Persil ${persil}`,
    skor_kelayakan: evalSkor,
    status_penilaian: evalStatus,
    catatan: evalCatatan,
    tanggal_penilaian: new Date().toISOString().split("T")[0]
  };

  try {
    await postServerKandidatLokasi(newKandidat);
  } catch (e) {
    // Non-critical background save
  }
}

// ==========================================================================
// 8. Fitur Ekspor Data ke Berkas JSON (Batch & Seluruh Data)
// ==========================================================================
function initExportJsonModal() {
  const modal = document.getElementById("export-modal");
  const btnOpenHeader = document.getElementById("btn-admin-export-json");
  const btnOpenBatch = document.getElementById("btn-batch-export-selected");
  const btnClose = document.getElementById("export-modal-close-btn");
  const btnCancel = document.getElementById("btn-cancel-export");
  const btnConfirm = document.getElementById("btn-confirm-export");
  const btnCopy = document.getElementById("btn-export-copy");

  const radioScopeAll = document.getElementById("export-scope-all");
  const radioScopeSelected = document.getElementById("export-scope-selected");
  const scopeSelectedWrapper = document.getElementById("export-scope-selected-wrapper");
  const radioFormatRaw = document.getElementById("export-format-raw");
  const radioFormatJoined = document.getElementById("export-format-joined");

  const totalCountEl = document.getElementById("export-total-count");
  const selectedCountEl = document.getElementById("export-selected-count");
  const previewCountEl = document.getElementById("export-preview-count");
  const filenameInput = document.getElementById("export-filename");

  if (!modal) return;

  function getSelectedIds() {
    const checked = document.querySelectorAll(".row-select-checkbox:checked");
    return Array.from(checked).map((cb) => cb.getAttribute("data-id"));
  }

  function updateModalState(defaultScope = null) {
    const selectedIds = getSelectedIds();
    const hasSelection = selectedIds.length > 0;

    if (totalCountEl) totalCountEl.textContent = String(currentAdminSawahList.length);
    if (selectedCountEl) selectedCountEl.textContent = String(selectedIds.length);

    if (radioScopeSelected) {
      radioScopeSelected.disabled = !hasSelection;
    }
    if (scopeSelectedWrapper) {
      scopeSelectedWrapper.style.opacity = hasSelection ? "1" : "0.5";
      scopeSelectedWrapper.style.cursor = hasSelection ? "pointer" : "not-allowed";
    }

    if (defaultScope === "selected" && hasSelection) {
      if (radioScopeSelected) radioScopeSelected.checked = true;
    } else if (!hasSelection || defaultScope === "all") {
      if (radioScopeAll) radioScopeAll.checked = true;
    }

    updatePreviewCount();
    generateDefaultFilename();
  }

  function updatePreviewCount() {
    const isSelected = radioScopeSelected && radioScopeSelected.checked;
    const selectedIds = getSelectedIds();
    const count = isSelected ? selectedIds.length : currentAdminSawahList.length;
    if (previewCountEl) previewCountEl.textContent = String(count);
  }

  function generateDefaultFilename() {
    if (!filenameInput) return;
    const dateStr = new Date().toISOString().split("T")[0];
    const isSelected = radioScopeSelected && radioScopeSelected.checked;
    const isJoined = radioFormatJoined && radioFormatJoined.checked;

    const prefix = "sibata_data_sawah";
    const scopePart = isSelected ? "_terpilih" : "";
    const formatPart = isJoined ? "_lengkap" : "";

    filenameInput.value = `${prefix}${scopePart}${formatPart}_${dateStr}.json`;
  }

  function openModal(preferredScope = "all") {
    updateModalState(preferredScope);
    modal.classList.add("active");
  }

  function closeModal() {
    modal.classList.remove("active");
  }

  if (btnOpenHeader) {
    btnOpenHeader.addEventListener("click", () => {
      const selectedIds = getSelectedIds();
      openModal(selectedIds.length > 0 ? "selected" : "all");
    });
  }

  if (btnOpenBatch) {
    btnOpenBatch.addEventListener("click", () => {
      openModal("selected");
    });
  }

  if (btnClose) btnClose.addEventListener("click", closeModal);
  if (btnCancel) btnCancel.addEventListener("click", closeModal);

  modal.addEventListener("click", (e) => {
    if (e.target === modal) closeModal();
  });

  if (radioScopeAll) {
    radioScopeAll.addEventListener("change", () => {
      updatePreviewCount();
      generateDefaultFilename();
    });
  }
  if (radioScopeSelected) {
    radioScopeSelected.addEventListener("change", () => {
      updatePreviewCount();
      generateDefaultFilename();
    });
  }
  if (radioFormatRaw) {
    radioFormatRaw.addEventListener("change", generateDefaultFilename);
  }
  if (radioFormatJoined) {
    radioFormatJoined.addEventListener("change", generateDefaultFilename);
  }

  function getExportPayload() {
    const isSelected = radioScopeSelected && radioScopeSelected.checked;
    const isJoined = radioFormatJoined && radioFormatJoined.checked;
    const selectedIds = getSelectedIds();

    let targetItems = currentAdminSawahList;
    if (isSelected) {
      const idSet = new Set(selectedIds);
      targetItems = currentAdminSawahList.filter((item) => idSet.has(item.id));
    }

    if (isJoined) {
      return targetItems.map((item) => ({
        id: item.id,
        nomor_persil: item.nomor_persil,
        luas_hektar: parseFloat(item.luas_hektar),
        jenis_sawah: item.jenis_sawah || "Tadah Hujan",
        koordinat: {
          latitude: parseFloat(item.latitude),
          longitude: parseFloat(item.longitude)
        },
        pemilik: {
          id: item.pemilik_id || item.pemilikData?.id || null,
          nama: item.pemilikData?.nama || item.pemilik_nama || item.pemilik_id || "-",
          jenis: item.pemilikData?.jenis || "-"
        },
        wilayah: {
          id: item.wilayah_id || item.wilayahData?.id || null,
          desa: item.wilayahData?.desa || item.desa || "-",
          kecamatan: item.wilayahData?.kecamatan || item.kecamatan || "-",
          kabupaten: item.kabupatenData?.nama || item.kabupaten_nama || "-"
        },
        status_lahan: {
          id: item.status_lahan_id || item.statusData?.id || null,
          kategori: item.statusData?.kategori || item.status_kategori || "-",
          boleh_alih_fungsi: item.statusData?.boleh_alih_fungsi ?? true,
          dasar_hukum: item.statusData?.dasar_hukum || null
        },
        kandidat_data_center: item.kandidatData ? {
          skor_kelayakan: item.kandidatData.skor_kelayakan,
          status_penilaian: item.kandidatData.status_penilaian,
          catatan: item.kandidatData.catatan
        } : null
      }));
    }

    // Format Raw (Kompatibel Import langsung ke POST /api/data_sawah)
    return targetItems.map((item) => ({
      id: item.id || null,
      nomor_persil: item.nomor_persil,
      luas_hektar: parseFloat(item.luas_hektar),
      pemilik_id: item.pemilik_id || (item.pemilikData ? item.pemilikData.id : ""),
      wilayah_id: item.wilayah_id || (item.wilayahData ? item.wilayahData.id : ""),
      status_lahan_id: item.status_lahan_id || (item.statusData ? item.statusData.id : ""),
      jenis_sawah: item.jenis_sawah || "Tadah Hujan",
      latitude: parseFloat(item.latitude),
      longitude: parseFloat(item.longitude)
    }));
  }

  // Tombol Unduh Berkas JSON
  if (btnConfirm) {
    btnConfirm.addEventListener("click", () => {
      const payload = getExportPayload();
      if (!payload || payload.length === 0) {
        alert("Tidak ada data sawah untuk diekspor.");
        return;
      }

      let filename = filenameInput ? filenameInput.value.trim() : "";
      if (!filename) filename = "sibata_data_sawah.json";
      if (!filename.toLowerCase().endsWith(".json")) filename += ".json";

      downloadJsonFile(payload, filename);
      closeModal();
    });
  }

  // Tombol Salin ke Clipboard
  if (btnCopy) {
    btnCopy.addEventListener("click", async () => {
      const payload = getExportPayload();
      if (!payload || payload.length === 0) {
        alert("Tidak ada data sawah untuk disalin.");
        return;
      }

      const jsonStr = JSON.stringify(payload, null, 2);
      try {
        await navigator.clipboard.writeText(jsonStr);
        const originalHtml = btnCopy.innerHTML;
        btnCopy.innerHTML = "✓ Tersalin ke Clipboard!";
        btnCopy.style.borderColor = "var(--primary-green)";
        btnCopy.style.color = "var(--primary-green)";
        setTimeout(() => {
          btnCopy.innerHTML = originalHtml;
          btnCopy.style.borderColor = "";
          btnCopy.style.color = "";
        }, 2000);
      } catch (err) {
        prompt("Salin manual teks JSON berikut:", jsonStr);
      }
    });
  }
}

function downloadJsonFile(data, filename) {
  const jsonString = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonString], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// ==========================================================================
// Inisialisasi Halaman Admin
// ==========================================================================
document.addEventListener("DOMContentLoaded", async () => {
  protectAdminPage();
  initNavbarAuth();

  await loadMasterDropdowns();

  initModeSelector();
  initSingleSawahForm();
  initBatchGrid();
  initJsonBatchEditor();
  initAdminTableActions();
  initEditSawahModal();
  initExportJsonModal();

  // 4 CRUD Modals untuk data master
  initCrudPemilik();
  initCrudWilayah();
  initCrudStatus();
  initCrudPengairan();

  // Muat tabel CRUD data sawah lengkap
  await loadAndRenderAdminTable();
});
