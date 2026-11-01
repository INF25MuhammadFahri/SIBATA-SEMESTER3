import mysql from "mysql2/promise";
import * as initial from "./init.js";
let db = null;
export async function init(){
    console.log("DB_HOST:", process.env.DB_HOST);
    console.log("DB_USER:", process.env.DB_USER);
    console.log("DB_NAME:", process.env.DB_NAME);
    console.log("DB_PORT:", process.env.DB_PORT);
    db=mysql.createPool({
        host: process.env.DB_HOST ?? "localhost",
        port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        waitForConnections: true,
        connectionLimit: 10
    });
  return await initial.init(db);
}
/* ------------------------------------------------------------------ */
/* Helper                                                              */
/* ------------------------------------------------------------------ */

/**
 * Mengutip identifier SQL setelah validasi.
 * Mendukung nama seperti users, users.id, dan *.
 * @param {string} name
 */
function identifier(name) {
    if (
        typeof name !== "string" ||
        !/^(?:\*|[a-zA-Z_]\w*)(?:\.(?:\*|[a-zA-Z_]\w*))*$/.test(name)
    ) {
        throw new Error(`Invalid SQL identifier: ${name}`);
    }

    return name.split(".").map(part =>
        part === "*" ? "*" : `\`${part}\``
    ).join(".");
}

/**
 * Validasi bilangan bulat tidak negatif (untuk LIMIT / OFFSET).
 * @param {unknown} value
 * @param {string} label
 */
function nonNegativeInt(value, label) {
    if (!Number.isSafeInteger(value) || value < 0) {
        throw new Error(`${label} must be a non-negative integer`);
    }
    return value;
}

/**
 * Escape karakter khusus LIKE (\, %, _) supaya keyword dicari apa adanya.
 * @param {string} text
 */
function escapeLike(text) {
    return text.replace(/[\\%_]/g, "\\$&");
}

/**
 * @typedef {Object} Search
 * @property {string[]} columns        Kolom yang dicari (OR antar kolom)
 * @property {string|number} keyword   Kata kunci (pencarian parsial: %keyword%)
 * @property {boolean} [caseSensitive] Default false
 */

/**
 * Membangun klausa WHERE dari `where` (AND, =, IS NULL, IN) dan `search` (LIKE).
 * @param {Record<string, unknown>} where
 * @param {Search} [search]
 */
function buildWhere(where = {}, search) {
    const conditions = [];
    const values = [];

    for (const [column, value] of Object.entries(where)) {
        const col = identifier(column);

        if (value === null) {
            conditions.push(`${col} IS NULL`);
        } else if (Array.isArray(value)) {
            if (value.length === 0) {
                conditions.push("1 = 0"); // IN () kosong -> tidak ada hasil
            } else {
                conditions.push(`${col} IN (${value.map(() => "?").join(", ")})`);
                values.push(...value);
            }
        } else {
            conditions.push(`${col} = ?`);
            values.push(value);
        }
    }

    if (search) {
        const { columns, keyword, caseSensitive = false } = search;

        if (!Array.isArray(columns) || columns.length === 0) {
            throw new Error("search.columns must be a non-empty array");
        }
        if (keyword === undefined || keyword === null) {
            throw new Error("search.keyword is required");
        }

        const pattern = `%${escapeLike(String(keyword))}%`;

        const parts = columns.map(column => {
            const col = identifier(column);
            values.push(pattern);

            return caseSensitive
                ? `${col} LIKE BINARY ?`
                : `LOWER(${col}) LIKE LOWER(?)`;
        });

        conditions.push(`(${parts.join(" OR ")})`);
    }

    return {
        clause: conditions.length ? ` WHERE ${conditions.join(" AND ")}` : "",
        values
    };
}

/* ------------------------------------------------------------------ */
/* SELECT                                                              */
/* ------------------------------------------------------------------ */

/**
 * @typedef {Object} Join
 * @property {"INNER" | "LEFT" | "RIGHT"} [type]
 * @property {string} table
 * @property {string} left
 * @property {string} [op]
 * @property {string} right
 */

/**
 * @typedef {Object} SelectOptions
 * @property {string} from
 * @property {string[]} [columns]
 * @property {Join[]} [joins]
 * @property {Record<string, unknown>} [where]   null -> IS NULL, array -> IN (...)
 * @property {Search} [search]                   Pencarian LIKE di satu/lebih kolom
 * @property {{ column: string, direction?: "ASC" | "DESC" }[]} [orderBy]
 * @property {number} [limit]
 * @property {number} [offset]
 */

/**
 * @param {SelectOptions} options
 * @returns {Promise<Object[]>}
 */
export async function select({
    from,
    columns = ["*"],
    joins = [],
    where = {},
    search,
    orderBy = [],
    limit,
    offset
}) {
    if (!Array.isArray(columns) || columns.length === 0) {
        throw new Error("columns must be a non-empty array");
    }

    let sql = `SELECT ${columns.map(identifier).join(", ")}
               FROM ${identifier(from)}`;

    // JOIN
    for (const join of joins) {
        const type = (join.type ?? "INNER").toUpperCase();

        if (!["INNER", "LEFT", "RIGHT"].includes(type)) {
            throw new Error(`Invalid JOIN type: ${type}`);
        }

        const op = join.op ?? "=";

        if (!["=", "!=", "<", ">", "<=", ">="].includes(op)) {
            throw new Error(`Invalid JOIN operator: ${op}`);
        }

        sql += ` ${type} JOIN ${identifier(join.table)}
                 ON ${identifier(join.left)} ${op} ${identifier(join.right)}`;
    }

    // WHERE + SEARCH
    const { clause, values } = buildWhere(where, search);
    sql += clause;

    // ORDER BY
    if (orderBy.length) {
        sql += " ORDER BY " + orderBy.map(item => {
            const direction = (item.direction ?? "ASC").toUpperCase();

            if (!["ASC", "DESC"].includes(direction)) {
                throw new Error(`Invalid sort direction: ${direction}`);
            }

            return `${identifier(item.column)} ${direction}`;
        }).join(", ");
    }

    // LIMIT dan OFFSET
    // Angka sudah divalidasi sebagai integer, jadi aman ditulis langsung.
    // (db.execute + "LIMIT ?" sering error "Incorrect arguments to
    // mysqld_stmt_execute" di MySQL 8.0.22+.)
    if (limit !== undefined) {
        sql += ` LIMIT ${nonNegativeInt(limit, "limit")}`;

        if (offset !== undefined) {
            sql += ` OFFSET ${nonNegativeInt(offset, "offset")}`;
        }
    } else if (offset !== undefined) {
        throw new Error("offset requires limit");
    }

    const [rows] = await db.execute(sql, values);
    return rows;
}

/* ------------------------------------------------------------------ */
/* SEARCH                                                              */
/* ------------------------------------------------------------------ */

/**
 * Mencari baris yang kolomnya MENGANDUNG nilai tertentu (LIKE %val%).
 *
 * @param {string} table
 * @param {string} col
 * @param {any} val
 * @param {boolean} [caseSensitive=false]
 * @param {{ limit?: number, offset?: number }} [paging]
 * @returns {Promise<Object[]>}
 *  Array of object, key = nama kolom, value = data baris.
 */
export async function searchRowByValue(table, col, val, caseSensitive = false, paging = {}) {
    return select({
        from: table,
        search: { columns: [col], keyword: val, caseSensitive },
        limit: paging.limit,
        offset: paging.offset
    });
}

/* ------------------------------------------------------------------ */
/* CREATE TABLE                                                        */
/* ------------------------------------------------------------------ */

/**
 * @typedef {Object} ColumnDef
 * @property {string} name
 * @property {string} type            Contoh: "INT", "VARCHAR(255)", "DECIMAL(10,2)", "INT UNSIGNED"
 * @property {boolean} [primaryKey]
 * @property {boolean} [autoIncrement]
 * @property {boolean} [notNull]
 * @property {boolean} [unique]
 * @property {unknown} [default]      Nilai literal, atau "CURRENT_TIMESTAMP"
 */

/**
 * @typedef {Object} CreateTableOptions
 * @property {string} name
 * @property {ColumnDef[]} columns
 * @property {boolean} [ifNotExists]  Default true
 */

const COLUMN_TYPE_RE = /^[a-z]+(?:\(\s*\d+(?:\s*,\s*\d+)?\s*\))?(?:\s+unsigned)?$/i;

/**
 * @param {CreateTableOptions} options
 */
export async function createTable({ name, columns, ifNotExists = true }) {
    if (!Array.isArray(columns) || columns.length === 0) {
        throw new Error("columns must be a non-empty array");
    }

    const primaryKeys = [];

    const defs = columns.map(c => {
        if (c.primaryKey) primaryKeys.push(identifier(c.name));
        return columnSql(c);
    });

    if (primaryKeys.length) {
        defs.push(`PRIMARY KEY (${primaryKeys.join(", ")})`);
    }

    const sql = `CREATE TABLE ${ifNotExists ? "IF NOT EXISTS " : ""}${identifier(name)} (
    ${defs.join(",\n    ")}
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`;

    // DDL memakai query(), bukan execute()
    await db.query(sql);
}

/* ------------------------------------------------------------------ */
/* INSERT                                                              */
/* ------------------------------------------------------------------ */

/**
 * Insert satu baris (object) atau banyak baris (array of object).
 *
 * @param {string} table
 * @param {Record<string, unknown> | Record<string, unknown>[]} data
 * @param {{ ignore?: boolean }} [options]  ignore -> INSERT IGNORE
 * @returns {Promise<{ insertId: number, affectedRows: number }>}
 */
export async function insert(table, data, { ignore = false } = {}) {
    const rows = Array.isArray(data) ? data : [data];

    if (rows.length === 0) {
        throw new Error("data must not be empty");
    }

    const cols = Object.keys(rows[0]);

    if (cols.length === 0) {
        throw new Error("row must have at least one column");
    }

    // Semua baris harus punya kolom yang sama
    for (const row of rows) {
        const keys = Object.keys(row);
        if (keys.length !== cols.length || !cols.every(c => keys.includes(c))) {
            throw new Error("All rows must have the same columns");
        }
    }

    const sql = `INSERT ${ignore ? "IGNORE " : ""}INTO ${identifier(table)}
                 (${cols.map(identifier).join(", ")}) VALUES ?`;

    // "VALUES ?" dengan array bersarang hanya didukung oleh query(), bukan execute()
    const [result] = await db.query(sql, [
        rows.map(row => cols.map(c => row[c] ?? null))
    ]);

    return {
        insertId: result.insertId,
        affectedRows: result.affectedRows
    };
}

/* ------------------------------------------------------------------ */
/* UPDATE / DELETE ROW                                                 */
/* ------------------------------------------------------------------ */

/**
 * Update baris. `where` wajib diisi supaya tidak mengubah seluruh tabel
 * secara tidak sengaja; pakai allowAll: true jika memang disengaja.
 *
 * @param {Object} options
 * @param {string} options.table
 * @param {Record<string, unknown>} options.set    Kolom -> nilai baru (null -> NULL)
 * @param {Record<string, unknown>} [options.where]
 * @param {number} [options.limit]
 * @param {boolean} [options.allowAll]
 * @returns {Promise<{ affectedRows: number, changedRows: number }>}
 */
export async function updateRows({ table, set, where = {}, limit, allowAll = false }) {
    const setCols = Object.keys(set ?? {});

    if (setCols.length === 0) {
        throw new Error("set must have at least one column");
    }
    if (Object.keys(where).length === 0 && !allowAll) {
        throw new Error("where is empty; pass allowAll: true to update every row");
    }

    const setValues = setCols.map(c => set[c] ?? null);
    const { clause, values } = buildWhere(where);

    let sql = `UPDATE ${identifier(table)}
               SET ${setCols.map(c => `${identifier(c)} = ?`).join(", ")}${clause}`;

    if (limit !== undefined) {
        sql += ` LIMIT ${nonNegativeInt(limit, "limit")}`;
    }

    const [result] = await db.execute(sql, [...setValues, ...values]);

    return {
        affectedRows: result.affectedRows,
        changedRows: result.changedRows
    };
}

/**
 * Hapus baris. `where` wajib diisi kecuali allowAll: true.
 *
 * @param {Object} options
 * @param {string} options.from
 * @param {Record<string, unknown>} [options.where]
 * @param {number} [options.limit]
 * @param {boolean} [options.allowAll]
 * @returns {Promise<{ affectedRows: number }>}
 */
export async function deleteRows({ from, where = {}, limit, allowAll = false }) {
    if (Object.keys(where).length === 0 && !allowAll) {
        throw new Error("where is empty; pass allowAll: true to delete every row");
    }

    const { clause, values } = buildWhere(where);

    let sql = `DELETE FROM ${identifier(from)}${clause}`;

    if (limit !== undefined) {
        sql += ` LIMIT ${nonNegativeInt(limit, "limit")}`;
    }

    const [result] = await db.execute(sql, values);

    return { affectedRows: result.affectedRows };
}

/* ------------------------------------------------------------------ */
/* DROP / RENAME TABLE                                                 */
/* ------------------------------------------------------------------ */

/**
 * Hapus tabel beserta seluruh datanya (tidak bisa dibatalkan).
 * @param {string} name
 * @param {{ ifExists?: boolean }} [options]  Default ifExists: true
 */
export async function dropTable(name, { ifExists = true } = {}) {
    await db.query(`DROP TABLE ${ifExists ? "IF EXISTS " : ""}${identifier(name)}`);
}

/**
 * Ganti nama tabel.
 * @param {string} oldName
 * @param {string} newName
 */
export async function renameTable(oldName, newName) {
    await db.query(`RENAME TABLE ${identifier(oldName)} TO ${identifier(newName)}`);
}

/* ------------------------------------------------------------------ */
/* ADD / MODIFY / RENAME / DROP COLUMN                                 */
/* ------------------------------------------------------------------ */

/**
 * Definisi satu kolom (tanpa PRIMARY KEY; itu ditangani pemanggil).
 * @param {ColumnDef} c
 */
function columnSql(c) {
    if (typeof c.type !== "string" || !COLUMN_TYPE_RE.test(c.type.trim())) {
        throw new Error(`Invalid column type: ${c.type}`);
    }

    let def = `${identifier(c.name)} ${c.type.trim().toUpperCase()}`;

    if (c.notNull || c.primaryKey) def += " NOT NULL";
    if (c.autoIncrement) def += " AUTO_INCREMENT";
    if (c.unique) def += " UNIQUE";

    if (c.default !== undefined) {
        def += c.default === "CURRENT_TIMESTAMP"
            ? " DEFAULT CURRENT_TIMESTAMP"
            : ` DEFAULT ${db.escape(c.default)}`;
    }

    return def;
}

/**
 * Tambah kolom baru.
 * @param {string} table
 * @param {ColumnDef} column
 * @param {{ after?: string, first?: boolean }} [position]
 */
export async function addColumn(table, column, { after, first = false } = {}) {
    let sql = `ALTER TABLE ${identifier(table)} ADD COLUMN ${columnSql(column)}`;

    if (column.primaryKey) sql += " PRIMARY KEY";

    if (first) sql += " FIRST";
    else if (after) sql += ` AFTER ${identifier(after)}`;

    await db.query(sql);
}

/**
 * Ubah tipe/constraint kolom yang sudah ada (nama kolom tetap).
 * Definisi baru menggantikan seluruhnya, jadi sebutkan ulang notNull, default, dst.
 * @param {string} table
 * @param {ColumnDef} column
 */
export async function modifyColumn(table, column) {
    await db.query(
        `ALTER TABLE ${identifier(table)} MODIFY COLUMN ${columnSql(column)}`
    );
}

/**
 * Ganti nama kolom. Butuh MySQL 8.0+ / MariaDB 10.5.2+.
 * @param {string} table
 * @param {string} oldName
 * @param {string} newName
 */
export async function renameColumn(table, oldName, newName) {
    await db.query(
        `ALTER TABLE ${identifier(table)}
         RENAME COLUMN ${identifier(oldName)} TO ${identifier(newName)}`
    );
}

/**
 * Hapus kolom beserta datanya (tidak bisa dibatalkan).
 * @param {string} table
 * @param {string} column
 */
export async function dropColumn(table, column) {
    await db.query(
        `ALTER TABLE ${identifier(table)} DROP COLUMN ${identifier(column)}`
    );
}
/* ------------------------------------------------------------------ */
/* CEK UKURAN / KEBERADAAN                                             */
/* ------------------------------------------------------------------ */

/**
 * Jumlah baris di tabel (bisa difilter dengan where / search).
 * @returns {Promise<number|null>} jumlah baris, atau null jika tabel tidak ada
 */
export async function countRows(from, where = {}, search) {
    const { clause, values } = buildWhere(where, search);

    try {
        const [rows] = await db.execute(
            `SELECT COUNT(*) AS total FROM ${identifier(from)}${clause}`,
            values
        );
        return Number(rows[0].total);
    } catch (err) {
        if (err.code === "ER_NO_SUCH_TABLE") return null;
        throw err;
    }
}

/**
 * Ukuran tabel di disk dalam byte (data + index).
 * @returns {Promise<number|null>} byte, atau null jika tabel tidak ada
 */
export async function tableSize(table) {
    const [rows] = await db.execute(
        `SELECT (data_length + index_length) AS size
         FROM information_schema.tables
         WHERE table_schema = DATABASE() AND table_name = ?
         LIMIT 1`,
        [table]
    );

    return rows.length ? Number(rows[0].size ?? 0) : null;
}

/**
 * Ukuran yang dideklarasikan pada kolom: panjang untuk VARCHAR/TEXT,
 * presisi untuk tipe angka (INT -> 10, BIGINT -> 19, DECIMAL(10,2) -> 10).
 * Tipe tanpa ukuran (mis. DATE) mengembalikan 0.
 * @returns {Promise<number|null>} ukuran, atau null jika tabel/kolom tidak ada
 */
export async function columnSize(table, column) {
    const [rows] = await db.execute(
        `SELECT COALESCE(character_maximum_length, numeric_precision) AS size
         FROM information_schema.columns
         WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?
         LIMIT 1`,
        [table, column]
    );

    return rows.length ? Number(rows[0].size ?? 0) : null;
}
export { db };