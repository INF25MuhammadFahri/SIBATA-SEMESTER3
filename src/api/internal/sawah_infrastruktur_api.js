
import * as db from "../../database/db.js";
import { createSuccsesReturn, createFailedReturn } from "./common_type.js";

/* ------------------------------------------------------------------ */
/* Konfigurasi                                                         */
/* ------------------------------------------------------------------ */

/** Nama tabel di database. */
const TABLE = "sawah_infrastruktur";

/** Kolom yang dicari saat parameter `search` diisi (OR antar kolom). */
const SEARCH_COLUMNS = ["sawah_id", "infrastruktur_id"];

/** Kolom primary key gabungan. */
const PRIMARY_KEYS = ["sawah_id", "infrastruktur_id"];

/* ------------------------------------------------------------------ */
/* Helper                                                              */
/* ------------------------------------------------------------------ */

/** ID dianggap ada jika bukan undefined, null, atau string kosong. */
function hasId(id) {
    return id !== undefined && id !== null && String(id).trim() !== "";
}

/** Pastikan kedua primary key tersedia. */
function hasPrimaryKey(item) {
    return item &&
        typeof item === "object" &&
        hasId(item.sawah_id) &&
        hasId(item.infrastruktur_id);
}

/** Apakah kombinasi primary key sudah ada. */
async function idExists(sawah_id, infrastruktur_id) {
    return (await db.countRows(TABLE, {
        sawah_id,
        infrastruktur_id
    })) > 0;
}

/* ------------------------------------------------------------------ */
/* GET                                                                 */
/* ------------------------------------------------------------------ */

/**
 * Ambil data relasi sawah dan infrastruktur.
 *
 * - page null/undefined -> 0
 * - size null/undefined -> ambil seluruh data
 * - search              -> cari berdasarkan sawah_id/infrastruktur_id
 *
 * @param {number|undefined|null} page
 * @param {number|undefined|null} size
 * @param {string|undefined|null} search
 */
export async function getSawahInfrastruktur(page, size, search) {
    try {
        const pageIndex = page === undefined || page === null
            ? 0
            : Number(page);

        const hasSize = size !== undefined && size !== null;
        const pageSize = hasSize ? Number(size) : undefined;

        if (!Number.isSafeInteger(pageIndex) || pageIndex < 0)
            throw new Error("page must be a non-negative integer");

        if (hasSize &&
            (!Number.isSafeInteger(pageSize) || pageSize < 0))
            throw new Error("size must be a non-negative integer");

        const keyword = search === undefined || search === null
            ? ""
            : String(search).trim();

        const rows = await db.select({
            from: TABLE,
            search: keyword !== ""
                ? { columns: SEARCH_COLUMNS, keyword }
                : undefined,
            orderBy: [
                { column: "sawah_id" },
                { column: "infrastruktur_id" }
            ],
            limit: pageSize,
            offset: hasSize ? pageIndex * pageSize : undefined
        });

        return createSuccsesReturn(rows.map(r => ({
            ...r,
            sawah_id: String(r.sawah_id),
            infrastruktur_id: String(r.infrastruktur_id)
        })));
    } catch (err) {
        return createFailedReturn(err.message);
    }
}

/* ------------------------------------------------------------------ */
/* POST                                                                */
/* ------------------------------------------------------------------ */

/**
 * Tambah relasi sawah dan infrastruktur.
 *
 * - Kombinasi PK sudah ada -> dikembalikan sebagai conflict
 * - Kombinasi PK belum ada -> data dimasukkan
 *
 * Menerima satu object atau array of object.
 *
 * @param {{ sawah_id: string, infrastruktur_id: string, jarak_meter: number }|Array}
 */
export async function postSawahInfrastruktur(data) {
    try {
        const conflicts = [];

        for (const item of [].concat(data ?? [])) {
            if (!hasPrimaryKey(item)) continue;

            const { sawah_id, infrastruktur_id, ...rest } = item;

            if (await idExists(sawah_id, infrastruktur_id)) {
                conflicts.push({
                    sawah_id: String(sawah_id),
                    infrastruktur_id: String(infrastruktur_id)
                });
                continue;
            }

            await db.insert(TABLE, {
                sawah_id,
                infrastruktur_id,
                ...rest
            });
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
 * Update relasi sawah dan infrastruktur.
 *
 * - Primary key tidak lengkap -> data dilewati
 * - Relasi tidak ditemukan   -> PK dikembalikan
 * - Field undefined          -> tidak diubah
 *
 * Primary key tidak dapat diubah melalui fungsi ini.
 *
 * Menerima satu object atau array of object.
 *
 * @param {{ sawah_id: string, infrastruktur_id: string, jarak_meter?: number }|Array}
 */
export async function putSawahInfrastruktur(data) {
    try {
        const missing = [];

        for (const item of [].concat(data ?? [])) {
            if (!hasPrimaryKey(item)) continue;

            const { sawah_id, infrastruktur_id, ...rest } = item;

            if (!(await idExists(sawah_id, infrastruktur_id))) {
                missing.push({
                    sawah_id: String(sawah_id),
                    infrastruktur_id: String(infrastruktur_id)
                });
                continue;
            }

            const set = Object.fromEntries(
                Object.entries(rest).filter(([, v]) => v !== undefined)
            );

            if (Object.keys(set).length === 0) continue;

            await db.updateRows({
                table: TABLE,
                set,
                where: {
                    sawah_id,
                    infrastruktur_id
                }
            });
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
 * Hapus relasi berdasarkan composite primary key.
 *
 * - Relasi tidak ditemukan -> dikembalikan sebagai missing
 * - Relasi ditemukan       -> dihapus
 *
 * Menerima satu object atau array of object.
 *
 * @param {{ sawah_id: string, infrastruktur_id: string }|Array}
 */
export async function delSawahInfrastruktur(data) {
    try {
        const wanted = [];
        const seen = new Set();

        for (const item of [].concat(data ?? [])) {
            if (!hasPrimaryKey(item)) continue;

            const key = JSON.stringify([
                String(item.sawah_id),
                String(item.infrastruktur_id)
            ]);

            if (seen.has(key)) continue;

            seen.add(key);
            wanted.push({
                sawah_id: String(item.sawah_id),
                infrastruktur_id: String(item.infrastruktur_id)
            });
        }

        if (wanted.length === 0)
            return createSuccsesReturn([]);

        const missing = [];

        for (const item of wanted) {
            if (!(await idExists(
                item.sawah_id,
                item.infrastruktur_id
            ))) {
                missing.push(item);
                continue;
            }

            await db.deleteRows({
                table: TABLE,
                where: {
                    sawah_id: item.sawah_id,
                    infrastruktur_id: item.infrastruktur_id
                }
            });
        }

        return createSuccsesReturn(missing);
    } catch (err) {
        return createFailedReturn(err.message);
    }
}