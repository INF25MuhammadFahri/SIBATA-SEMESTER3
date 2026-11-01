import * as db from "../../database/db.js";
import * as helper from "./common_type.js";

/**
 * Mengambil data kandidat lokasi.
 *
 * @param {{
 *   ind?: number|null,
 *   offset?: number|null,
 *   search?: db.Search
 * }} page
 * ind = indeks halaman, dimulai dari 0
 * offset = jumlah data per halaman (size)
 */
export async function getKandidatLokasi(page = {}) {
    try {
        const ind = page.ind ?? 0;
        const size = page.offset ?? null;

        if (!Number.isInteger(ind) || ind < 0) {
            return helper.createFailedReturn("Indeks halaman tidak valid");
        }

        if (
            size !== null &&
            (!Number.isInteger(size) || size < 0)
        ) {
            return helper.createFailedReturn("Ukuran halaman tidak valid");
        }

        const options = {
            from: "kandidat_lokasi",
            search: page.search,
            orderBy: [{ column: "id_kandidat", direction: "ASC" }]
        };

        if (size !== null) {
            options.limit = size;
            options.offset = ind * size;
        }

        const data = await db.select(options);

        return helper.createSuccsesReturn(data);
    } catch (error) {
        return helper.createFailedReturn(
            error.message || "Gagal mengambil data kandidat lokasi"
        );
    }
}

/**
 * Menambahkan kandidat lokasi baru.
 *
 * @param {Object} data
 */
export async function postKandidatLokasi(data) {
    try {
        if (!data || typeof data !== "object" || Array.isArray(data)) {
            return helper.createFailedReturn(
                "Data kandidat lokasi tidak valid"
            );
        }

        const newData = { ...data };
        const id = newData.id_kandidat;

        if (id === undefined || id === null) {
            delete newData.id_kandidat;
        } else {
            const existing = await db.select({
                from: "kandidat_lokasi",
                columns: ["id_kandidat"],
                where: { id_kandidat: id }
            });

            if (existing.length > 0) {
                return helper.createSuccsesReturn([String(id)]);
            }
        }

        await db.insert("kandidat_lokasi", newData);

        return helper.createSuccsesReturn([]);
    } catch (error) {
        return helper.createFailedReturn(
            error.message || "Gagal menambahkan kandidat lokasi"
        );
    }
}

/**
 * Memperbarui kandidat lokasi.
 *
 * @param {Object} data
 */
export async function putKandidatLokasi(data) {
    try {
        if (!data || typeof data !== "object" || Array.isArray(data)) {
            return helper.createFailedReturn(
                "Data kandidat lokasi tidak valid"
            );
        }

        const { id_kandidat, ...changes } = data;

        if (id_kandidat === undefined || id_kandidat === null) {
            return helper.createSuccsesReturn([]);
        }

        const existing = await db.select({
            from: "kandidat_lokasi",
            columns: ["id_kandidat"],
            where: { id_kandidat }
        });

        if (existing.length === 0) {
            return helper.createSuccsesReturn([
                String(id_kandidat)
            ]);
        }

        if (Object.keys(changes).length === 0) {
            return helper.createSuccsesReturn([]);
        }

        await db.updateRows({
            table: "kandidat_lokasi",
            set: changes,
            where: { id_kandidat }
        });

        return helper.createSuccsesReturn([]);
    } catch (error) {
        return helper.createFailedReturn(
            error.message || "Gagal memperbarui kandidat lokasi"
        );
    }
}

/**
 * Menghapus kandidat lokasi berdasarkan kumpulan ID.
 *
 * @param {string[]} ids
 */
export async function delKandidatLokasi(ids) {
    try {
        if (!Array.isArray(ids)) {
            return helper.createFailedReturn(
                "Parameter IDs harus berupa array"
            );
        }

        if (ids.length === 0) {
            return helper.createSuccsesReturn([]);
        }

        const uniqueIds = [...new Set(ids.map(String))];

        const existing = await db.select({
            from: "kandidat_lokasi",
            columns: ["id_kandidat"],
            where: { id_kandidat: uniqueIds }
        });

        const foundIds = existing.map(row =>
            String(row.id_kandidat)
        );

        const foundSet = new Set(foundIds);

        const missingIds = uniqueIds.filter(
            id => !foundSet.has(id)
        );

        if (foundIds.length > 0) {
            await db.deleteRows({
                from: "kandidat_lokasi",
                where: { id_kandidat: foundIds }
            });
        }

        return helper.createSuccsesReturn(missingIds);
    } catch (error) {
        return helper.createFailedReturn(
            error.message || "Gagal menghapus kandidat lokasi"
        );
    }
}