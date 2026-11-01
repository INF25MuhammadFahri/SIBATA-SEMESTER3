import * as db from "../../database/db.js";
import { createSuccsesReturn, createFailedReturn } from "./common_type.js";

const TABLE = "pemilik";
const SEARCH_COLUMNS = ["id", "nama", "jenis", "kontak"];

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
        if (idStr.startsWith("PMK-")) {
            const num = parseInt(idStr.replace("PMK-", ""), 10);
            if (!Number.isNaN(num) && num > max) {
                max = num;
            }
        }
    }
    return `PMK-${String(max + 1).padStart(3, "0")}`;
}

export async function getPemilik(page, size, search) {
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

export async function postPemilik(data) {
    try {
        const conflicts = [];
        const items = [].concat(data ?? []);

        for (const item of items) {
            if (!item || typeof item !== "object") continue;

            const { id, ...payload } = item;

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

export async function putPemilik(data) {
    try {
        const missingIds = [];
        const items = [].concat(data ?? []);

        for (const item of items) {
            if (!item || typeof item !== "object" || !hasId(item.id)) continue;

            const { id, ...payload } = item;
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

export async function delPemilik(ids) {
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

