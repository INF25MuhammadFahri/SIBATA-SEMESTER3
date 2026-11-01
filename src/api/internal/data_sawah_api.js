import * as db from "../../database/db.js";

/**
 * 1. Mengambil data sawah (Get / Read)
 * @param {number|null|undefined} page - Indeks halaman (default 0)
 * @param {number|null|undefined} size - Ukuran data per halaman (null/undefined = seluruh data)
 * @param {string|null|undefined} search - Kata kunci pencarian
 * @returns {Promise<Object[]>} Array of object data sawah
 */
export async function getSawah(page, size, search) {
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
        ? { columns: ["nama"], keyword: String(search) }
        : undefined;

    return await db.select({
        from: "data_sawah",
        search: searchOptions,
        limit,
        offset
    });
}

/**
 * 2. Menambah data sawah baru (Create / Post)
 * @param {Object|Object[]} data - Object data sawah { id: string|null|undefined, nama: string, ... }
 * @returns {Promise<string[]>} Array dari ID yang mengalami konflik
 */
export async function postSawah(data) {
    const items = Array.isArray(data) ? data : [data];
    const conflicts = [];

    for (const item of items) {
        const { id, ...payload } = item;

        // Cek jika ID diberikan dan tidak null/undefined
        if (id !== undefined && id !== null && id !== "") {
            const idStr = String(id);
            const existing = await db.select({
                from: "data_sawah",
                where: { id: idStr },
                limit: 1
            });

            // Jika ID sudah ada di database -> Conflict
            if (existing.length > 0) {
                conflicts.push(idStr);
                continue;
            }

            // Simpan dengan ID yang disediakan
            await db.insert("data_sawah", { id: idStr, ...payload });
        } else {
            // Perilaku: Jika ID tidak ada atau null -> dibuat data baru dengan ID otomatis dari DB
            await db.insert("data_sawah", payload);
        }
    }

    return conflicts;
}

/**
 * 3. Memperbarui data sawah (Update / Put)
 * @param {Object|Object[]} data - Object data sawah { id: string|null|undefined, ... }
 * @returns {Promise<string[]>} Array dari ID yang tidak ditemukan di DB
 */
export async function putSawah(data) {
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
            from: "data_sawah",
            where: { id: idStr },
            limit: 1
        });

        if (existing.length === 0) {
            missingIds.push(idStr);
        } else if (Object.keys(payload).length > 0) {
            await db.updateRows({
                table: "data_sawah",
                set: payload,
                where: { id: idStr }
            });
        }
    }

    return missingIds;
}

/**
 * 4. Menghapus data sawah (Delete / Del)
 * @param {string[]} ids - Array ID yang akan dihapus
 * @returns {Promise<string[]>} Array ID yang tidak ditemukan (missing_id)
 */
export async function delSawah(ids) {
    if (!Array.isArray(ids) || ids.length === 0) {
        return [];
    }

    const missingIds = [];
    const existingIds = [];

    for (const rawId of ids) {
        const idStr = String(rawId);
        const existing = await db.select({
            from: "data_sawah",
            where: { id: idStr },
            limit: 1
        });

        if (existing.length === 0) {
            missingIds.push(idStr);
        } else {
            existingIds.push(idStr);
        }
    }

    // Hapus seluruh data ID yang ditemukan (jika ada relasi FK di DB dengan ON DELETE CASCADE, data terikat otomatis terhapus)
    if (existingIds.length > 0) {
        await db.deleteRows({
            from: "data_sawah",
            where: { id: existingIds }
        });
    }

    return missingIds;
}