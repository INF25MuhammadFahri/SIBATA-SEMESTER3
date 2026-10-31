import * as db from "../../database/db.js";

/**
 * 1. Mengambil data status lahan (Get / Read)
 * @param {number|null|undefined} page - Indeks halaman (default 0)
 * @param {number|null|undefined} size - Ukuran data per halaman (null/undefined = seluruh data)
 * @param {string|null|undefined} search - Kata kunci pencarian
 * @returns {Promise<Object[]>} Array of object data status lahan
 */
export async function getStatusLahan(page, size, search) {
    // Perilaku: Jika page undefined atau null, set ke 0
    const pageIndex = (page === undefined || page === null) ? 0 : Number(page);

    let limit;
    let offset;

    // Perilaku: Jika size undefined atau null, ambil seluruh data
    if (size !== undefined && size !== null) {
        limit = Number(size);
        offset = pageIndex * limit;
    }

    // Konfigurasi pencarian jika parameter search diberikan
    const searchOptions = (search !== undefined && search !== null && search !== "")
        ? { columns: ["id_status"], keyword: String(search) }
        : undefined;

    return await db.select({
        from: "status_lahan",
        search: searchOptions,
        limit,
        offset
    });
}

/**
 * 2. Menambah data status lahan baru (Create / Post)
 * @param {Object|Object[]} data - Object/array data status lahan { id: string|null|undefined, ... }
 * @returns {Promise<string[]>} Array dari ID yang mengalami konflik
 */
export async function postStatusLahan(data) {
    const items = Array.isArray(data) ? data : [data];
    const conflicts = [];

    for (const item of items) {
        const { id, ...payload } = item;

        // Cek jika ID diberikan dan tidak null/undefined
        if (id !== undefined && id !== null && id !== "") {
            const idStr = String(id);
            const existing = await db.select({
                from: "status_lahan",
                where: { id: idStr },
                limit: 1
            });

            // Jika ID sudah ada di database -> Conflict
            if (existing.length > 0) {
                conflicts.push(idStr);
                continue;
            }

            // Simpan dengan ID yang disediakan
            await db.insert("status_lahan", { id: idStr, ...payload });
        } else {
            // Perilaku: Jika ID tidak ada atau null -> dibuat data baru dengan ID otomatis dari DB
            await db.insert("status_lahan", payload);
        }
    }

    return conflicts;
}

/**
 * 3. Memperbarui data status lahan (Update / Put)
 * @param {Object|Object[]} data - Object/array data status lahan { id: string|null|undefined, ... }
 * @returns {Promise<string[]>} Array dari ID yang tidak ditemukan di DB
 */
export async function putStatusLahan(data) {
    const items = Array.isArray(data) ? data : [data];
    const missingIds = [];

    for (const item of items) {
        const { id, ...payload } = item;

        // Perilaku: Jika ID tidak ada, null, atau undefined -> data tidak digunakan / diabaikan
        if (id === undefined || id === null || id === "") {
            continue;
        }

        const idStr = String(id);
        const existing = await db.select({
            from: "status_lahan",
            where: { id: idStr },
            limit: 1
        });

        if (existing.length === 0) {
            missingIds.push(idStr);
        } else if (Object.keys(payload).length > 0) {
            await db.updateRows({
                table: "status_lahan",
                set: payload,
                where: { id: idStr }
            });
        }
    }

    return missingIds;
}

/**
 * 4. Menghapus data status lahan (Delete / Del)
 * @param {string[]} ids - Array ID yang akan dihapus
 * @returns {Promise<string[]>} Array ID yang tidak ditemukan (missing_id)
 */
export async function delStatusLahan(ids) {
    if (!Array.isArray(ids) || ids.length === 0) {
        return [];
    }

    const missingIds = [];
    const existingIds = [];

    for (const rawId of ids) {
        const idStr = String(rawId);
        const existing = await db.select({
            from: "status_lahan",
            where: { id: idStr },
            limit: 1
        });

        if (existing.length === 0) {
            missingIds.push(idStr);
        } else {
            existingIds.push(idStr);
        }
    }

    // Hapus seluruh data ID yang ditemukan
    if (existingIds.length > 0) {
        await db.deleteRows({
            from: "status_lahan",
            where: { id: existingIds }
        });
    }

    return missingIds;
}