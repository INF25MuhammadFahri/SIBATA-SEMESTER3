import * as db from "../../database/db.js";
import { createSuccsesReturn, createFailedReturn } from "./common_type.js";

const TABLE = "status_lahan";
const SEARCH_COLUMNS = ["id", "kategori"];

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

async function idExists(id) {
    return (await db.countRows(TABLE, { id })) > 0;
}

async function generateNextId() {
    const rows = await db.select({
        from: TABLE,
        columns: ["id"]
    });
    let max = 0;
    for (const row of rows) {
        const idStr = String(row.id || "");
        if (idStr.startsWith("ST-")) {
            const num = parseInt(idStr.replace("ST-", ""), 10);
            if (!Number.isNaN(num) && num > max) {
                max = num;
            }
        }
    }
    return `ST-${String(max + 1).padStart(2, "0")}`;
}

function normalizeStatusPayload(item) {
    if (!item || typeof item !== "object") return null;
    const { id, ...rest } = item;
    const payload = { ...rest };
    if (payload.boleh_alih_fungsi !== undefined) {
        payload.boleh_alih_fungsi = (payload.boleh_alih_fungsi === true || payload.boleh_alih_fungsi === 1 || String(payload.boleh_alih_fungsi) === "1") ? 1 : 0;
    }
    return { id, payload };
}

export async function getStatusLahan(page, size, search) {
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

        return createSuccsesReturn(rows.map(r => ({
            ...r,
            id: String(r.id),
            boleh_alih_fungsi: Boolean(r.boleh_alih_fungsi)
        })));
    } catch (err) {
        return createFailedReturn(err.message);
    }
}

export async function postStatusLahan(data) {
    try {
        const conflicts = [];
        const items = [].concat(data ?? []);

        for (const item of items) {
            const normalized = normalizeStatusPayload(item);
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
                const nextId = await generateNextId();
                await db.insert(TABLE, { id: nextId, ...payload });
            }
        }

        return createSuccsesReturn(conflicts);
    } catch (err) {
        return createFailedReturn(err.message);
    }
}

export async function putStatusLahan(data) {
    try {
        const missingIds = [];
        const items = [].concat(data ?? []);

        for (const item of items) {
            const normalized = normalizeStatusPayload(item);
            if (!normalized || !hasId(normalized.id)) continue;

            const { id, payload } = normalized;
            const idStr = String(id).trim();

            if (!(await idExists(idStr))) {
                missingIds.push(idStr);
                continue;
            }

            const set = Object.fromEntries(
                Object.entries(payload).filter(([, v]) => v !== undefined)
            );
            if (Object.keys(set).length === 0) continue;

            await db.updateRows({
                table: TABLE,
                set,
                where: { id: idStr }
            });
        }

        return createSuccsesReturn(missingIds);
    } catch (err) {
        return createFailedReturn(err.message);
    }
}

export async function delStatusLahan(ids) {
    try {
        const wanted = [...new Set([].concat(ids ?? []).filter(hasId).map(String))];
        if (wanted.length === 0) return createSuccsesReturn([]);

        const rows = await db.select({
            from: TABLE,
            columns: ["id"],
            where: { id: wanted }
        });

        const found = new Set(rows.map(r => String(r.id)));
        const missingIds = wanted.filter(id => !found.has(id));
        const toDelete = wanted.filter(id => found.has(id));

        if (toDelete.length > 0) {
            await db.deleteRows({
                from: TABLE,
                where: { id: toDelete }
            });
        }

        return createSuccsesReturn(missingIds);
    } catch (err) {
        return createFailedReturn(err.message);
    }
}
