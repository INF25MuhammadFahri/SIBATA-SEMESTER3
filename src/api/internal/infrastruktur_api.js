import * as db from "../../database/db.js";
import * as helper from "./common_type.js";

/**
 * Mengambil data infrastruktur.
 *
 * @param {{
 *   ind?: number|null,
 *   offset?: number|null,
 *   search?: db.Search
 * }} page
 * ind = indeks halaman, dimulai dari 0
 * offset = jumlah data per halaman (size)
 */
export async function getDataInfrastruktur(page = {}) {
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
            from: "infrastruktur",
            search: page.search,
            orderBy: [{ column: "id_infrastruktur", direction: "ASC" }]
        };

        // Size null berarti mengambil seluruh data.
        if (size !== null) {
            options.limit = size;
            options.offset = ind * size;
        }

        const data = await db.select(options);

        return helper.createSuccsesReturn(data);
    } catch (error) {
        return helper.createFailedReturn(
            error.message || "Gagal mengambil data infrastruktur"
        );
    }
}

/**
 * Menambahkan data infrastruktur baru.
 *
 * @param {Object} data
 */
export async function postInfrastruktur(data) {
    try {
        if (!data || typeof data !== "object" || Array.isArray(data)) {
            return helper.createFailedReturn(
                "Data infrastruktur tidak valid"
            );
        }

        const newData = { ...data };
        const id = newData.id_infrastruktur;

        // ID kosong berarti ID dibuat oleh database.
        if (id === undefined || id === null) {
            delete newData.id_infrastruktur;
        } else {
            // Periksa apakah ID sudah digunakan.
            const existing = await db.select({
                from: "infrastruktur",
                columns: ["id_infrastruktur"],
                where: { id_infrastruktur: id }
            });

            if (existing.length > 0) {
                return helper.createSuccsesReturn([String(id)]);
            }
        }

        await db.insert("infrastruktur", newData);

        return helper.createSuccsesReturn([]);
    } catch (error) {
        return helper.createFailedReturn(
            error.message || "Gagal menambahkan data infrastruktur"
        );
    }
}

/**
 * Memperbarui data infrastruktur.
 *
 * @param {Object} data
 */
export async function putInfrastruktur(data) {
    try {
        if (!data || typeof data !== "object" || Array.isArray(data)) {
            return helper.createFailedReturn(
                "Data infrastruktur tidak valid"
            );
        }

        const { id_infrastruktur, ...changes } = data;

        // Data tanpa ID tidak digunakan.
        if (id_infrastruktur === undefined || id_infrastruktur === null) {
            return helper.createSuccsesReturn([]);
        }

        const existing = await db.select({
            from: "infrastruktur",
            columns: ["id_infrastruktur"],
            where: { id_infrastruktur }
        });

        // ID yang tidak ditemukan dikembalikan.
        if (existing.length === 0) {
            return helper.createSuccsesReturn([
                String(id_infrastruktur)
            ]);
        }

        if (Object.keys(changes).length === 0) {
            return helper.createSuccsesReturn([]);
        }

        await db.updateRows({
            table: "infrastruktur",
            set: changes,
            where: { id_infrastruktur }
        });

        return helper.createSuccsesReturn([]);
    } catch (error) {
        return helper.createFailedReturn(
            error.message || "Gagal memperbarui data infrastruktur"
        );
    }
}

/**
 * Menghapus data infrastruktur berdasarkan kumpulan ID.
 *
 * @param {string[]} ids
 */
export async function delInfrastruktur(ids) {
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
            from: "infrastruktur",
            columns: ["id_infrastruktur"],
            where: { id_infrastruktur: uniqueIds }
        });

        const foundIds = existing.map(row =>
            String(row.id_infrastruktur)
        );

        const foundSet = new Set(foundIds);

        const missingIds = uniqueIds.filter(
            id => !foundSet.has(id)
        );

        // Hapus ID yang ditemukan.
        if (foundIds.length > 0) {
            await db.deleteRows({
                from: "infrastruktur",
                where: { id_infrastruktur: foundIds }
            });
        }

        return helper.createSuccsesReturn(missingIds);
    } catch (error) {
        return helper.createFailedReturn(
            error.message || "Gagal menghapus data infrastruktur"
        );
    }
}