import * as db from "../db/db.js";
import { createSuccsesReturn, createFailedReturn } from "../common_type.js";

/* ------------------------------------------------------------------ */
/* Konfigurasi                                                         */
/* ------------------------------------------------------------------ */

/** Nama tabel di database. */
const TABLE = "wilayah";

/** Kolom yang dicari saat parameter `search` diisi (OR antar kolom). */
const SEARCH_COLUMNS = ["nama"];

/**
 * Tabel/kolom yang me-reference `wilayah.id`. Baris di sini ikut dihapus
 * saat wilayah dihapus (cascade manual).
 *
 * Kalau di init.js sudah memakai FOREIGN KEY ... ON DELETE CASCADE,
 * biarkan kosong. Contoh isi (self-reference, mis. kabupaten -> provinsi):
 *   { table: "wilayah", column: "parent_id" }
 *
 * @type {{ table: string, column: string }[]}
 */
const REFERENCES = [];

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

/**
 * Hapus baris berdasarkan id beserta seluruh baris yang me-reference-nya.
 * @param {string[]} ids
 */
async function cascadeDelete(ids) {
    if (ids.length === 0) return;

    for (const ref of REFERENCES) {
        if (ref.table === TABLE) {
            // self-reference: hapus anak (dan cucunya) lebih dulu
            const children = await db.select({
                from: ref.table,
                columns: ["id"],
                where: { [ref.column]: ids }
            });
            const childIds = children
                .map(r => String(r.id))
                .filter(id => !ids.includes(id)); // cegah loop tak berujung
            await cascadeDelete(childIds);
        } else {
            await db.deleteRows({
                from: ref.table,
                where: { [ref.column]: ids }
            });
        }
    }

    await db.deleteRows({ from: TABLE, where: { id: ids } });
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

        return createSuccsesReturn(rows.map(r => ({ ...r, id: String(r.id) })));
    } catch (err) {
        return createFailedReturn(err.message);
    }
}

/* ------------------------------------------------------------------ */
/* POST                                                                */
/* ------------------------------------------------------------------ */

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
            if (!item || typeof item !== "object") continue;

            const { id, ...rest } = item;

            if (hasId(id)) {
                if (await idExists(id)) {
                    conflicts.push(String(id));
                    continue;
                }
                await db.insert(TABLE, { id, ...rest });
            } else {
                await db.insert(TABLE, rest);
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
            if (!item || typeof item !== "object" || !hasId(item.id)) continue;

            const { id, ...rest } = item;

            if (!(await idExists(id))) {
                missing.push(String(id));
                continue;
            }

            const set = Object.fromEntries(
                Object.entries(rest).filter(([, v]) => v !== undefined)
            );
            if (Object.keys(set).length === 0) continue;

            await db.updateRows({ table: TABLE, set, where: { id } });
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

        await cascadeDelete(wanted.filter(id => found.has(id)));

        return createSuccsesReturn(missingId);
    } catch (err) {
        return createFailedReturn(err.message);
    }
}
