import * as db from "../../database/db.js";
import { createSuccsesReturn, createFailedReturn } from "./common_type.js";

/* ------------------------------------------------------------------ */
/* Konfigurasi                                                         */
/* ------------------------------------------------------------------ */

/** Nama tabel di database. */
const TABLE = "wilayah";

/** Kolom yang dicari saat parameter `search` diisi (OR antar kolom). */
const SEARCH_COLUMNS = ["kecamatan", "desa"];




/* ------------------------------------------------------------------ */
/* Helper                                                              */
/* ------------------------------------------------------------------ */

/** id dianggap ada jika bukan undefined, null, atau string kosong. */
function hasId(id) {
    return id !== undefined && id !== null && String(id).trim() !== "";
}

/** Ubah ke bilangan bulat tidak negatif, atau lempar error. */
function toNonNegativeInt(value, label) {
    const n = Number(value);
    if (!Number.isSafeInteger(n) || n < 0) {
        throw new Error(`${label} must be a non-negative integer`);
    }
    return n;
}

/** Apakah id sudah ada di tabel. */
async function idExists(id) {
    return (await db.countRows(TABLE, { id })) > 0;
}



function normalizeWilayahPayload(item) {
    if (!item || typeof item !== "object") return null;
    const { id, luas_baku_sawah, ...rest } = item;
    const clean = { ...rest };
    if (luas_baku_sawah !== undefined && clean.total_lahan_baku_ha === undefined) {
        clean.total_lahan_baku_ha = Number(luas_baku_sawah) || 0;
    }
    if (clean.total_lahan_baku_ha !== undefined) {
        clean.total_lahan_baku_ha = Number(clean.total_lahan_baku_ha) || 0;
    }
    if (!clean.kabupaten_kota_id) {
        clean.kabupaten_kota_id = "KAB-01";
    }
    return { id, payload: clean };
}

/* ------------------------------------------------------------------ */
/* GET                                                                 */
/* ------------------------------------------------------------------ */

/**
 * Ambil data wilayah.
 *
 * - page null/undefined -> 0 (hanya indeks halaman, dimulai dari 0)
 * - size null/undefined -> ambil seluruh data (page diabaikan)
 * - search              -> cari parsial di SEARCH_COLUMNS
 *
 * @param {number|undefined|null} page
 * @param {number|undefined|null} size
 * @param {string|undefined|null} search
 * @returns {Promise<import("../common_type.js").DBValue>}
 *  data: array of object, mis. [{ id: "769", nama: "A", ... }]
 */
export async function getWilayah(page, size, search) {
    try {
        const pageIndex = page === undefined || page === null
            ? 0
            : toNonNegativeInt(page, "page");

        const hasSize = size !== undefined && size !== null;
        const pageSize = hasSize ? toNonNegativeInt(size, "size") : undefined;

        const keyword = search === undefined || search === null
            ? ""
            : String(search).trim();

        const rows = await db.select({
            from: TABLE,
            search: keyword !== ""
                ? { columns: SEARCH_COLUMNS, keyword }
                : undefined,
            orderBy: [{ column: "id" }],
            limit: pageSize,
            offset: hasSize ? pageIndex * pageSize : undefined
        });

        return createSuccsesReturn(rows.map(r => ({
            ...r,
            id: String(r.id),
            luas_baku_sawah: r.total_lahan_baku_ha != null ? Number(r.total_lahan_baku_ha) : 0
        })));
    } catch (err) {
        return createFailedReturn(err.message);
    }
}

/* ------------------------------------------------------------------ */
/* POST                                                                */
/* ------------------------------------------------------------------ */

async function generateNextId() {
    const rows = await db.select({
        from: TABLE,
        columns: ["id"]
    });
    let max = 0;
    for (const row of rows) {
        const idStr = String(row.id || "");
        if (idStr.startsWith("WIL-")) {
            const num = parseInt(idStr.replace("WIL-", ""), 10);
            if (!Number.isNaN(num) && num > max) {
                max = num;
            }
        }
    }
    return `WIL-${String(max + 1).padStart(2, "0")}`;
}

/**
 * Tambah data baru.
 *
 * - id tidak ada/null -> baris baru, id dibuat oleh database
 * - id sudah dipakai  -> data tidak disimpan, id dikembalikan sebagai conflict
 *
 * Menerima satu object (sesuai dokumentasi) atau array of object.
 *
 * @param {{ id?: string|null, [key: string]: unknown }} data
 * @returns {Promise<import("../common_type.js").DBValue>}
 *  data: id yang conflict (array of string)
 */
export async function postWilayah(data) {
    try {
        const conflicts = [];

        for (const item of [].concat(data ?? [])) {
            const normalized = normalizeWilayahPayload(item);
            if (!normalized) continue;

            const { id, payload } = normalized;

            if (hasId(id)) {
                const idStr = String(id).trim();
                if (await idExists(idStr)) {
                    conflicts.push(idStr);
                    continue;
                }
                await db.insert(TABLE, { id: idStr, ...payload });
            } else {
                const newId = await generateNextId();
                await db.insert(TABLE, { id: newId, ...payload });
            }
        }

        return createSuccsesReturn(conflicts);
    } catch (err) {
        return createFailedReturn(err.message);
    }
}

/* ------------------------------------------------------------------ */
/* PUT                                                                 */
/* ------------------------------------------------------------------ */

/**
 * Update data.
 *
 * - id tidak ada/null/undefined -> data tidak digunakan
 * - id tidak ditemukan          -> id dikembalikan
 *
 * Menerima satu object (sesuai dokumentasi) atau array of object.
 * Field yang bernilai undefined tidak diubah.
 *
 * @param {{ id?: string|null, [key: string]: unknown }} data
 * @returns {Promise<import("../common_type.js").DBValue>}
 *  data: id yang tidak ada (array of string)
 */
export async function putWilayah(data) {
    try {
        const missing = [];

        for (const item of [].concat(data ?? [])) {
            const normalized = normalizeWilayahPayload(item);
            if (!normalized || !hasId(normalized.id)) continue;

            const { id, payload } = normalized;
            const idStr = String(id).trim();

            if (!(await idExists(idStr))) {
                missing.push(idStr);
                continue;
            }

            const set = Object.fromEntries(
                Object.entries(payload).filter(([, v]) => v !== undefined)
            );
            if (Object.keys(set).length === 0) continue;

            await db.updateRows({ table: TABLE, set, where: { id: idStr } });
        }

        return createSuccsesReturn(missing);
    } catch (err) {
        return createFailedReturn(err.message);
    }
}

/* ------------------------------------------------------------------ */
/* DELETE                                                              */
/* ------------------------------------------------------------------ */

/**
 * Hapus data berdasarkan id.
 *
 * - id yang tidak ditemukan dikembalikan sebagai missing_id
 * - data yang me-reference id yang dihapus ikut terhapus (lihat REFERENCES)
 *
 * @param {string[]} ids
 * @returns {Promise<import("../common_type.js").DBValue>}
 *  data: missing_id (array of string)
 */
export async function delWilayah(ids) {
    try {
        const wanted = [...new Set([].concat(ids ?? []).filter(hasId).map(String))];

        if (wanted.length === 0) return createSuccsesReturn([]);

        const rows = await db.select({
            from: TABLE,
            columns: ["id"],
            where: { id: wanted }
        });

        const found = new Set(rows.map(r => String(r.id)));
        const missingId = wanted.filter(id => !found.has(id));
        const toDelete = wanted.filter(id => found.has(id));

        if (toDelete.length > 0) {
            await db.deleteRows({
                from: TABLE,
                where: { id: toDelete }
            });
        }

        return createSuccsesReturn(missingId);
    } catch (err) {
        return createFailedReturn(err.message);
    }
}
