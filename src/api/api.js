import * as db from "../database/db.js";
export * as wilayah from "./internal/wilayah_api.js";
export * as dataSawah from "./internal/data_sawah_api.js";
export * as infrastruktur from "./internal/infrastruktur_api.js";
export * as kandidatLokasi from "./internal/kandidat_lokasi_api.js";
export * as statusLahan from "./internal/status_lahan_api.js";
export * as statudLahan from "./internal/status_lahan_api.js";
export * as pemilik from "./internal/pemilik_api.js";
export * as kabupatenKota from "./internal/kabupaten_kota_api.js";
import * as commondata from "../common_data.js";

export async function init() {
  try {
    commondata.setDbStatus(await db.init());
    console.log(JSON.stringify(commondata.dbstatus));
  } catch (err) {
    console.error("Database init error:", err.message);
  }
}

/**
 * Mengambil seluruh data relasional yang digabungkan (JOIN)
 */
export async function joinAll() {
  try {
    const [
      sawahRows,
      wilayahRows,
      pemilikRows,
      kabRows,
      statusRows,
      kandidatRows,
      infraRows,
      sawahInfraRows
    ] = await Promise.all([
      db.select({ from: "data_sawah" }),
      db.select({ from: "wilayah" }),
      db.select({ from: "pemilik" }),
      db.select({ from: "kabupaten_kota" }),
      db.select({ from: "status_lahan" }),
      db.select({ from: "kandidat_lokasi" }),
      db.select({ from: "infrastruktur" }),
      db.select({ from: "sawah_infrastruktur" })
    ]);

    return sawahRows.map((sawah) => {
      const pmk = pemilikRows.find((p) => String(p.id) === String(sawah.pemilik_id)) || {};
      const wil = wilayahRows.find((w) => String(w.id) === String(sawah.wilayah_id)) || {};
      const kab = kabRows.find((k) => String(k.id) === String(wil.kabupaten_kota_id)) || {};
      const st = statusRows.find((s) => String(s.id) === String(sawah.status_lahan_id)) || {};
      const kan = kandidatRows.find((k) => String(k.sawah_id) === String(sawah.id)) || null;

      const infraLinks = sawahInfraRows
        .filter((si) => String(si.sawah_id) === String(sawah.id))
        .map((si) => {
          const item = infraRows.find((inf) => String(inf.id) === String(si.infrastruktur_id)) || {};
          return {
            ...item,
            jarak_meter: si.jarak_meter
          };
        });

      return {
        ...sawah,
        id: String(sawah.id),
        luas_hektar: Number(sawah.luas_hektar),
        latitude: Number(sawah.latitude),
        longitude: Number(sawah.longitude),
        pemilikData: pmk,
        wilayahData: wil,
        kabupatenData: kab,
        statusData: {
          ...st,
          boleh_alih_fungsi: Boolean(st.boleh_alih_fungsi)
        },
        kandidatData: kan ? {
          ...kan,
          skor_kelayakan: Number(kan.skor_kelayakan)
        } : null,
        infrastrukturList: infraLinks
      };
    });
  } catch (err) {
    console.error("joinAll error:", err.message);
    return [];
  }
}
