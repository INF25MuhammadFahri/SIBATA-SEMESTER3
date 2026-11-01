import * as db from "../../database/db.js";
import { createSuccsesReturn, createFailedReturn } from "./common_type.js";

const TABLE = "kabupaten_kota";
const SEARCH_COLUMNS = ["id", "nama", "jenis"];

function hasId(id) {
    return id !== undefined && id !== null && String(id).trim() !== "";
}

function toNonNegativeInt(value, label) {
    const n = Number(value);
    if (!Number.isSafeInteger(n) || n < 0) {
        throw new Error(`${label} must be a non-negative integer`);
    }
    return n;
}

export async function getKabupatenKota(page, size, search) {
    try {
        const pageIndex = page === undefined || page === null ? 0 : toNonNegativeInt(page, "page");
        const hasSize = size !== undefined && size !== null;
        const pageSize = hasSize ? toNonNegativeInt(size, "size") : undefined;

        const keyword = search === undefined || search === null ? "" : String(search).trim();

        const rows = await db.select({
            from: TABLE,
            search: keyword !== "" ? { columns: SEARCH_COLUMNS, keyword } : undefined,
            orderBy: [{ column: "id" }],
            limit: pageSize,
            offset: hasSize ? pageIndex * pageSize : undefined
        });

        return createSuccsesReturn(rows.map(r => ({ ...r, id: String(r.id) })));
    } catch (err) {
        return createFailedReturn(err.message);
    }
}

