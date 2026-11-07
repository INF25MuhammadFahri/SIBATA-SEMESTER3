import {
  kabupatenKota as defaultKabupaten,
  wilayah as defaultWilayah,
  pemilik as defaultPemilik,
  statusLahan as defaultStatusLahan,
  dataSawah as defaultDataSawah,
  infrastruktur as defaultInfrastruktur,
  sawahInfrastruktur as defaultSawahInfrastruktur,
  kandidatLokasi as defaultKandidat
} from "./mockData.js";
import { getAuthHeaders } from "./auth.js";

const STORAGE_KEYS = {
  SAWAH: "sibata_data_sawah",
  PEMILIK: "sibata_pemilik",
  KANDIDAT: "sibata_kandidat",
  WILAYAH: "sibata_wilayah",
  INFRASTRUKTUR: "sibata_infrastruktur",
  STATUS_LAHAN: "sibata_status_lahan",
  KABUPATEN: "sibata_kabupaten"
};

// -------------------------------------------------------------
// Helper Cache Lokal
// -------------------------------------------------------------

export function getLocalSawah() {
  const stored = localStorage.getItem(STORAGE_KEYS.SAWAH);
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch (e) {
      console.error("Gagal membaca localDataSawah:", e);
    }
  }
  return [...defaultDataSawah];
}

export function saveLocalSawah(data) {
  localStorage.setItem(STORAGE_KEYS.SAWAH, JSON.stringify(data));
}

export function getLocalPemilik() {
  const stored = localStorage.getItem(STORAGE_KEYS.PEMILIK);
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch (e) {
      console.error("Gagal membaca localPemilik:", e);
    }
  }
  return [...defaultPemilik];
}

export function saveLocalPemilik(data) {
  localStorage.setItem(STORAGE_KEYS.PEMILIK, JSON.stringify(data));
}

export function getLocalKandidat() {
  const stored = localStorage.getItem(STORAGE_KEYS.KANDIDAT);
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch (e) {
      console.error("Gagal membaca localKandidat:", e);
    }
  }
  return [...defaultKandidat];
}

export function saveLocalKandidat(data) {
  localStorage.setItem(STORAGE_KEYS.KANDIDAT, JSON.stringify(data));
}

export function getLocalWilayah() {
  const stored = localStorage.getItem(STORAGE_KEYS.WILAYAH);
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch (e) {
      console.error("Gagal membaca localWilayah:", e);
    }
  }
  return [...defaultWilayah];
}

export function saveLocalWilayah(data) {
  localStorage.setItem(STORAGE_KEYS.WILAYAH, JSON.stringify(data));
}

export function getLocalInfrastruktur() {
  const stored = localStorage.getItem(STORAGE_KEYS.INFRASTRUKTUR);
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch (e) {
      console.error("Gagal membaca localInfrastruktur:", e);
    }
  }
  return [...defaultInfrastruktur];
}

export function saveLocalInfrastruktur(data) {
  localStorage.setItem(STORAGE_KEYS.INFRASTRUKTUR, JSON.stringify(data));
}

export function getLocalStatusLahan() {
  const stored = localStorage.getItem(STORAGE_KEYS.STATUS_LAHAN);
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch (e) {
      console.error("Gagal membaca localStatusLahan:", e);
    }
  }
  return [...defaultStatusLahan];
}

export function saveLocalStatusLahan(data) {
  localStorage.setItem(STORAGE_KEYS.STATUS_LAHAN, JSON.stringify(data));
}

// -------------------------------------------------------------
// Komunikasi Data Server (Fetch API Client-to-Server)
// Sesuai dengan spesifikasi: doc/client to server db.md
// -------------------------------------------------------------

function buildQueryString(params = {}) {
  const query = new URLSearchParams();
  if (params.page !== undefined && params.page !== null) query.set("page", params.page);
  if (params.size !== undefined && params.size !== null) query.set("size", params.size);
  if (params.search) query.set("search", params.search);
  const str = query.toString();
  return str ? `?${str}` : "";
}

/**
 * Mengambil data sawah dari endpoint GET /api/data_sawah
 */
export async function fetchServerDataSawah(params = {}) {
  const qs = buildQueryString(params);
  try {
    const res = await fetch(`/api/data_sawah${qs}`, {
      method: "GET"
    });
    if (res.ok) {
      const json = await res.json();
      if (json && Array.isArray(json.data) && json.data.length > 0) {
        saveLocalSawah(json.data);
        return json.data;
      }
    }
  } catch (err) {
    console.warn("fetchServerDataSawah fallback:", err);
  }
  return getLocalSawah();
}

/**
 * Mengambil data wilayah dari endpoint GET /api/wilayah
 */
export async function fetchServerWilayah(params = {}) {
  const qs = buildQueryString(params);
  try {
    const res = await fetch(`/api/wilayah${qs}`, {
      method: "GET"
    });
    if (res.ok) {
      const json = await res.json();
      if (json && Array.isArray(json.data) && json.data.length > 0) {
        saveLocalWilayah(json.data);
        return json.data;
      }
    }
  } catch (err) {
    console.warn("fetchServerWilayah fallback:", err);
  }
  return getLocalWilayah();
}

/**
 * Mengambil data pemilik dari endpoint GET /api/pemilik
 */
export async function fetchServerPemilik(params = {}) {
  const qs = buildQueryString(params);
  try {
    const res = await fetch(`/api/pemilik${qs}`, {
      method: "GET"
    });
    if (res.ok) {
      const json = await res.json();
      if (json && Array.isArray(json.data) && json.data.length > 0) {
        saveLocalPemilik(json.data);
        return json.data;
      }
    }
  } catch (err) {
    console.warn("fetchServerPemilik fallback:", err);
  }
  return getLocalPemilik();
}

/**
 * Mengambil data infrastruktur dari endpoint GET /api/infrastruktur
 */
export async function fetchServerInfrastruktur(params = {}) {
  const qs = buildQueryString(params);
  try {
    const res = await fetch(`/api/infrastruktur${qs}`, {
      method: "GET"
    });
    if (res.ok) {
      const json = await res.json();
      if (json && Array.isArray(json.data) && json.data.length > 0) {
        saveLocalInfrastruktur(json.data);
        return json.data;
      }
    }
  } catch (err) {
    console.warn("fetchServerInfrastruktur fallback:", err);
  }
  return getLocalInfrastruktur();
}

/**
 * Mengambil data status lahan dari endpoint GET /api/status_lahan
 */
export async function fetchServerStatusLahan(params = {}) {
  const qs = buildQueryString(params);
  try {
    const res = await fetch(`/api/status_lahan${qs}`, {
      method: "GET"
    });
    if (res.ok) {
      const json = await res.json();
      if (json && Array.isArray(json.data) && json.data.length > 0) {
        saveLocalStatusLahan(json.data);
        return json.data;
      }
    }
  } catch (err) {
    console.warn("fetchServerStatusLahan fallback:", err);
  }
  return getLocalStatusLahan();
}

/**
 * Mengambil data kandidat lokasi dari endpoint GET /api/kandidat_lokasi
 */
export async function fetchServerKandidatLokasi(params = {}) {
  const qs = buildQueryString(params);
  try {
    const res = await fetch(`/api/kandidat_lokasi${qs}`, {
      method: "GET"
    });
    if (res.ok) {
      const json = await res.json();
      if (json && Array.isArray(json.data) && json.data.length > 0) {
        saveLocalKandidat(json.data);
        return json.data;
      }
    }
  } catch (err) {
    console.warn("fetchServerKandidatLokasi fallback:", err);
  }
  return getLocalKandidat();
}

/**
 * Menambahkan data sawah baru ke server melalui POST /api/data_sawah
 * Sesuai doc: Mengirim 1 objek data tunggal dengan header X-Sesion-ID
 * @param {Object} sawahObj
 */
export async function postServerDataSawah(sawahObj) {
  const payload = sawahObj;
  try {
    const res = await fetch("/api/data_sawah", {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(payload)
    });
    const result = await res.json();
    return {
      ok: res.ok,
      status: res.status,
      ...result
    };
  } catch (err) {
    console.warn("postServerDataSawah offline/error:", err);
    return { ok: false, status: 0, is_err: true, error: err.message };
  }
}

/**
 * Memperbarui data sawah di server melalui PUT /api/data_sawah
 * Sesuai doc: Mengirim 1 objek data tunggal yang memiliki properti id
 * @param {Object} sawahObj
 */
export async function putServerDataSawah(sawahObj) {
  const payload = sawahObj;
  try {
    const res = await fetch("/api/data_sawah", {
      method: "PUT",
      headers: getAuthHeaders(),
      body: JSON.stringify(payload)
    });
    const result = await res.json();
    return {
      ok: res.ok,
      status: res.status,
      ...result
    };
  } catch (err) {
    console.warn("putServerDataSawah offline/error:", err);
    return { ok: false, status: 0, is_err: true, error: err.message };
  }
}

/**
 * Menghapus data sawah di server melalui DELETE /api/data_sawah
 * Sesuai doc: Mengirim array string ID, e.g. ["SW-001", "SW-002"]
 * @param {string|string[]} ids
 */
export async function deleteServerDataSawah(ids) {
  const idArray = Array.isArray(ids) ? ids : [ids];
  const payload = idArray.map(item =>
    typeof item === "object" && item !== null ? String(item.id) : String(item)
  );
  try {
    const res = await fetch("/api/data_sawah", {
      method: "DELETE",
      headers: getAuthHeaders(),
      body: JSON.stringify(payload)
    });
    const result = await res.json();
    return {
      ok: res.ok,
      status: res.status,
      ...result
    };
  } catch (err) {
    console.warn("deleteServerDataSawah offline/error:", err);
    return { ok: false, status: 0, is_err: true, error: err.message };
  }
}

/**
 * Menambahkan data pemilik baru ke server melalui POST /api/pemilik
 * @param {Object} pemilikObj
 */
export async function postServerPemilik(pemilikObj) {
  const payload = Array.isArray(pemilikObj) ? pemilikObj[0] : pemilikObj;
  try {
    const res = await fetch("/api/pemilik", {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(payload)
    });
    const result = await res.json().catch(() => ({}));
    return {
      ok: res.ok,
      httpStatus: res.status,
      message: typeof result.status === "string" ? result.status : (result.message || ""),
      ...result
    };
  } catch (err) {
    console.warn("postServerPemilik offline/error:", err);
    return { ok: false, httpStatus: 0, status: 0, is_err: true, error: err.message, message: err.message };
  }
}

/**
 * Memperbarui data pemilik di server melalui PUT /api/pemilik
 */
export async function putServerPemilik(pemilikObj) {
  const payload = Array.isArray(pemilikObj) ? pemilikObj[0] : pemilikObj;
  try {
    const res = await fetch("/api/pemilik", {
      method: "PUT",
      headers: getAuthHeaders(),
      body: JSON.stringify(payload)
    });
    const result = await res.json().catch(() => ({}));
    return {
      ok: res.ok,
      httpStatus: res.status,
      message: typeof result.status === "string" ? result.status : (result.message || ""),
      ...result
    };
  } catch (err) {
    console.warn("putServerPemilik error:", err);
    return { ok: false, httpStatus: 0, status: 0, is_err: true, error: err.message, message: err.message };
  }
}

/**
 * Menghapus data pemilik di server melalui DELETE /api/pemilik
 */
export async function deleteServerPemilik(ids) {
  const idArray = Array.isArray(ids) ? ids : [ids];
  const payload = idArray.map(item =>
    typeof item === "object" && item !== null ? String(item.id) : String(item)
  );
  try {
    const res = await fetch("/api/pemilik", {
      method: "DELETE",
      headers: getAuthHeaders(),
      body: JSON.stringify(payload)
    });
    const result = await res.json().catch(() => ({}));
    return {
      ok: res.ok,
      httpStatus: res.status,
      message: typeof result.status === "string" ? result.status : (result.message || ""),
      ...result
    };
  } catch (err) {
    console.warn("deleteServerPemilik error:", err);
    return { ok: false, httpStatus: 0, status: 0, is_err: true, error: err.message, message: err.message };
  }
}

/**
 * Menambahkan data wilayah baru melalui POST /api/wilayah
 */
export async function postServerWilayah(wilayahObj) {
  const payload = Array.isArray(wilayahObj) ? wilayahObj[0] : wilayahObj;
  try {
    const res = await fetch("/api/wilayah", {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(payload)
    });
    const result = await res.json().catch(() => ({}));
    return {
      ok: res.ok,
      httpStatus: res.status,
      message: typeof result.status === "string" ? result.status : (result.message || ""),
      ...result
    };
  } catch (err) {
    console.warn("postServerWilayah error:", err);
    return { ok: false, httpStatus: 0, status: 0, is_err: true, error: err.message, message: err.message };
  }
}

/**
 * Memperbarui data wilayah melalui PUT /api/wilayah
 */
export async function putServerWilayah(wilayahObj) {
  const payload = Array.isArray(wilayahObj) ? wilayahObj[0] : wilayahObj;
  try {
    const res = await fetch("/api/wilayah", {
      method: "PUT",
      headers: getAuthHeaders(),
      body: JSON.stringify(payload)
    });
    const result = await res.json().catch(() => ({}));
    return {
      ok: res.ok,
      httpStatus: res.status,
      message: typeof result.status === "string" ? result.status : (result.message || ""),
      ...result
    };
  } catch (err) {
    console.warn("putServerWilayah error:", err);
    return { ok: false, httpStatus: 0, status: 0, is_err: true, error: err.message, message: err.message };
  }
}

/**
 * Menghapus data wilayah melalui DELETE /api/wilayah
 */
export async function deleteServerWilayah(ids) {
  const idArray = Array.isArray(ids) ? ids : [ids];
  const payload = idArray.map(item =>
    typeof item === "object" && item !== null ? String(item.id) : String(item)
  );
  try {
    const res = await fetch("/api/wilayah", {
      method: "DELETE",
      headers: getAuthHeaders(),
      body: JSON.stringify(payload)
    });
    const result = await res.json().catch(() => ({}));
    return {
      ok: res.ok,
      httpStatus: res.status,
      message: typeof result.status === "string" ? result.status : (result.message || ""),
      ...result
    };
  } catch (err) {
    console.warn("deleteServerWilayah error:", err);
    return { ok: false, httpStatus: 0, status: 0, is_err: true, error: err.message, message: err.message };
  }
}

/**
 * Menambahkan data status lahan melalui POST /api/status_lahan
 */
export async function postServerStatusLahan(statusObj) {
  const payload = Array.isArray(statusObj) ? statusObj[0] : statusObj;
  try {
    const res = await fetch("/api/status_lahan", {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(payload)
    });
    const result = await res.json().catch(() => ({}));
    return {
      ok: res.ok,
      httpStatus: res.status,
      message: typeof result.status === "string" ? result.status : (result.message || ""),
      ...result
    };
  } catch (err) {
    console.warn("postServerStatusLahan error:", err);
    return { ok: false, httpStatus: 0, status: 0, is_err: true, error: err.message, message: err.message };
  }
}

/**
 * Memperbarui data status lahan melalui PUT /api/status_lahan
 */
export async function putServerStatusLahan(statusObj) {
  const payload = Array.isArray(statusObj) ? statusObj[0] : statusObj;
  try {
    const res = await fetch("/api/status_lahan", {
      method: "PUT",
      headers: getAuthHeaders(),
      body: JSON.stringify(payload)
    });
    const result = await res.json().catch(() => ({}));
    return {
      ok: res.ok,
      httpStatus: res.status,
      message: typeof result.status === "string" ? result.status : (result.message || ""),
      ...result
    };
  } catch (err) {
    console.warn("putServerStatusLahan error:", err);
    return { ok: false, httpStatus: 0, status: 0, is_err: true, error: err.message, message: err.message };
  }
}

/**
 * Menghapus data status lahan melalui DELETE /api/status_lahan
 */
export async function deleteServerStatusLahan(ids) {
  const idArray = Array.isArray(ids) ? ids : [ids];
  const payload = idArray.map(item =>
    typeof item === "object" && item !== null ? String(item.id) : String(item)
  );
  try {
    const res = await fetch("/api/status_lahan", {
      method: "DELETE",
      headers: getAuthHeaders(),
      body: JSON.stringify(payload)
    });
    const result = await res.json().catch(() => ({}));
    return {
      ok: res.ok,
      httpStatus: res.status,
      message: typeof result.status === "string" ? result.status : (result.message || ""),
      ...result
    };
  } catch (err) {
    console.warn("deleteServerStatusLahan error:", err);
    return { ok: false, httpStatus: 0, status: 0, is_err: true, error: err.message, message: err.message };
  }
}

/**
 * Mengambil data jenis pengairan dari GET /api/jenis_pengairan
 */
export async function fetchServerJenisPengairan(params = {}) {
  const qs = buildQueryString(params);
  try {
    const res = await fetch(`/api/jenis_pengairan${qs}`);
    if (res.ok) {
      const json = await res.json();
      if (json && Array.isArray(json.data) && json.data.length > 0) {
        return json.data;
      }
    }
  } catch (err) {
    console.warn("fetchServerJenisPengairan error:", err);
  }
  return [
    { id: "JP-01", nama: "Tadah Hujan", deskripsi: "Mengandalkan curah hujan musiman" },
    { id: "JP-02", nama: "Setengah Teknis", deskripsi: "Saluran irigasi semi-permanen" },
    { id: "JP-03", nama: "Irigasi Teknis", deskripsi: "Jaringan irigasi permanen teratur" }
  ];
}

/**
 * Menambahkan data jenis pengairan melalui POST /api/jenis_pengairan
 */
export async function postServerJenisPengairan(jpObj) {
  const payload = Array.isArray(jpObj) ? jpObj[0] : jpObj;
  try {
    const res = await fetch("/api/jenis_pengairan", {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(payload)
    });
    const result = await res.json().catch(() => ({}));
    return {
      ok: res.ok,
      httpStatus: res.status,
      message: typeof result.status === "string" ? result.status : (result.message || ""),
      ...result
    };
  } catch (err) {
    console.warn("postServerJenisPengairan error:", err);
    return { ok: false, httpStatus: 0, status: 0, is_err: true, error: err.message, message: err.message };
  }
}

/**
 * Memperbarui data jenis pengairan melalui PUT /api/jenis_pengairan
 */
export async function putServerJenisPengairan(jpObj) {
  const payload = Array.isArray(jpObj) ? jpObj[0] : jpObj;
  try {
    const res = await fetch("/api/jenis_pengairan", {
      method: "PUT",
      headers: getAuthHeaders(),
      body: JSON.stringify(payload)
    });
    const result = await res.json().catch(() => ({}));
    return {
      ok: res.ok,
      httpStatus: res.status,
      message: typeof result.status === "string" ? result.status : (result.message || ""),
      ...result
    };
  } catch (err) {
    console.warn("putServerJenisPengairan error:", err);
    return { ok: false, httpStatus: 0, status: 0, is_err: true, error: err.message, message: err.message };
  }
}

/**
 * Menghapus data jenis pengairan melalui DELETE /api/jenis_pengairan
 */
export async function deleteServerJenisPengairan(ids) {
  const idArray = Array.isArray(ids) ? ids : [ids];
  const payload = idArray.map(item =>
    typeof item === "object" && item !== null ? String(item.id) : String(item)
  );
  try {
    const res = await fetch("/api/jenis_pengairan", {
      method: "DELETE",
      headers: getAuthHeaders(),
      body: JSON.stringify(payload)
    });
    const result = await res.json().catch(() => ({}));
    return {
      ok: res.ok,
      httpStatus: res.status,
      message: typeof result.status === "string" ? result.status : (result.message || ""),
      ...result
    };
  } catch (err) {
    console.warn("deleteServerJenisPengairan error:", err);
    return { ok: false, httpStatus: 0, status: 0, is_err: true, error: err.message, message: err.message };
  }
}

/**
 * Menambahkan evaluasi kandidat lokasi baru ke server melalui POST /api/kandidat_lokasi
 * @param {Object} kandidatObj
 */
export async function postServerKandidatLokasi(kandidatObj) {
  const payload = Array.isArray(kandidatObj) ? kandidatObj[0] : kandidatObj;
  try {
    const res = await fetch("/api/kandidat_lokasi", {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(payload)
    });
    const result = await res.json();
    return {
      ok: res.ok,
      status: res.status,
      ...result
    };
  } catch (err) {
    console.warn("postServerKandidatLokasi error:", err);
    return { ok: false, status: 0, is_err: true, error: err.message };
  }
}

/**
 * Sinkronisasi data lokal dengan data server secara menyeluruh
 */
export async function syncDataWithServer() {
  try {
    // 1. Coba ambil dari endpoint joined cepat
    const joinedRes = await fetch("/api/joined");
    if (joinedRes.ok) {
      const json = await joinedRes.json();
      if (json && Array.isArray(json.data) && json.data.length > 0) {
        saveLocalSawah(json.data);
        return {
          sawah: json.data,
          source: "server_joined"
        };
      }
    }
  } catch (e) {
    // fallback ke fetch individual
  }

  // 2. Fallback fetch individual endpoints
  const [sawahData, wilayahData, pemilikData, statusData, kandidatData, infraData] = await Promise.allSettled([
    fetchServerDataSawah(),
    fetchServerWilayah(),
    fetchServerPemilik(),
    fetchServerStatusLahan(),
    fetchServerKandidatLokasi(),
    fetchServerInfrastruktur()
  ]);

  return {
    sawah: sawahData.status === "fulfilled" ? sawahData.value : getLocalSawah(),
    wilayah: wilayahData.status === "fulfilled" ? wilayahData.value : getLocalWilayah(),
    pemilik: pemilikData.status === "fulfilled" ? pemilikData.value : getLocalPemilik(),
    statusLahan: statusData.status === "fulfilled" ? statusData.value : getLocalStatusLahan(),
    kandidat: kandidatData.status === "fulfilled" ? kandidatData.value : getLocalKandidat(),
    infrastruktur: infraData.status === "fulfilled" ? infraData.value : getLocalInfrastruktur()
  };
}

/**
 * Fungsi Helper untuk menggabungkan relasi data
 */
export function getJoinedData(customSawahList = null) {
  const localDataSawah = customSawahList || getLocalSawah();
  const localPemilik = getLocalPemilik();
  const localWilayah = getLocalWilayah();
  const localStatusLahan = getLocalStatusLahan();
  const localKandidat = getLocalKandidat();
  const localInfra = getLocalInfrastruktur();

  return localDataSawah.map((sawah) => {
    // Jika data sawah sudah membawa data relasi dari backend /api/joined
    if (sawah.pemilikData && sawah.wilayahData && sawah.statusData) {
      return sawah;
    }

    const pmk = localPemilik.find((p) => String(p.id) === String(sawah.pemilik_id)) || {};
    const wil = localWilayah.find((w) => String(w.id) === String(sawah.wilayah_id)) || {};
    const kab = defaultKabupaten.find((k) => String(k.id) === String(wil.kabupaten_kota_id)) || {};
    const st = localStatusLahan.find((s) => String(s.id) === String(sawah.status_lahan_id)) || {};
    const kan = localKandidat.find((k) => String(k.sawah_id) === String(sawah.id)) || null;

    const infraLinks = defaultSawahInfrastruktur
      .filter((si) => String(si.sawah_id) === String(sawah.id))
      .map((si) => {
        const item = localInfra.find((inf) => String(inf.id) === String(si.infrastruktur_id)) || {};
        return {
          ...item,
          jarak_meter: si.jarak_meter
        };
      });

    return {
      ...sawah,
      id: String(sawah.id),
      luas_hektar: Number(sawah.luas_hektar),
      pemilikData: pmk,
      wilayahData: wil,
      kabupatenData: kab,
      statusData: st,
      kandidatData: kan,
      infrastrukturList: infraLinks
    };
  });
}

export {
  defaultKabupaten as kabupatenKota,
  defaultWilayah as wilayah,
  defaultStatusLahan as statusLahan,
  defaultInfrastruktur as infrastruktur,
  defaultSawahInfrastruktur as sawahInfrastruktur
};
