import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function findSqlDirectory() {
  const candidates = [
    path.join(__dirname, "sql_script"),
    path.resolve(process.cwd(), "src/database/sql_script"),
  ];

  for (const dir of candidates) {
    try {
      await Promise.all([
        fs.access(path.join(dir, "init.sql")),
        fs.access(path.join(dir, "cekInit.sql")),
      ]);

      return dir;
    } catch {
      // Coba lokasi berikutnya.
    }
  }

  throw new Error(
    "Folder sql_script tidak ditemukan atau file SQL tidak lengkap.",
  );
}

// Memisahkan statement berdasarkan titik koma di luar string dan komentar.
function splitSqlStatements(sql) {
  const statements = [];
  let current = "";
  let quote = null;
  let lineComment = false;
  let blockComment = false;

  for (let i = 0; i < sql.length; i++) {
    const c = sql[i];
    const next = sql[i + 1];

    if (lineComment) {
      current += c;
      if (c === "\n") lineComment = false;
      continue;
    }

    if (blockComment) {
      current += c;
      if (c === "*" && next === "/") {
        current += next;
        i++;
        blockComment = false;
      }
      continue;
    }

    if (quote) {
      current += c;

      if (c === "\\" && next !== undefined) {
        current += next;
        i++;
        continue;
      }

      if (c === quote) {
        if (next === quote) {
          current += next;
          i++;
        } else {
          quote = null;
        }
      }
      continue;
    }

    if (c === "'" || c === '"' || c === "`") {
      quote = c;
      current += c;
    } else if (
      c === "-" &&
      next === "-" &&
      (sql[i + 2] === undefined || /\s/.test(sql[i + 2]))
    ) {
      current += c + next;
      i++;
      lineComment = true;
    } else if (c === "#") {
      current += c;
      lineComment = true;
    } else if (c === "/" && next === "*") {
      current += c + next;
      i++;
      blockComment = true;
    } else if (c === ";") {
      if (current.trim()) statements.push(current.trim());
      current = "";
    } else {
      current += c;
    }
  }

  if (current.trim()) statements.push(current.trim());

  return statements;
}

async function executeScript(connection, sql) {
  for (const statement of splitSqlStatements(sql)) {
    await connection.query(statement);
  }
}

async function checkSchema(connection, sql) {
  // Gunakan database yang sedang dipilih oleh koneksi db.
  sql = sql.replace(
    /SET\s+@target_db\s*:=\s*'[^']*'\s*;/i,
    "SET @target_db := DATABASE();",
  );

  const results = [];

  for (const statement of splitSqlStatements(sql)) {
    const [rows] = await connection.query(statement);

    if (Array.isArray(rows)) {
      results.push(rows);
    }
  }

  const errors = [];

  for (const rows of results) {
    for (const row of rows) {
      const status = String(row.status ?? "").toUpperCase();

      if (
        status === "HILANG" ||
        status === "PERIKSA TIPE" ||
        status === "TIDAK ADA"
      ) {
        errors.push({
          table: row.tabel ?? null,
          column: row.kolom ?? null,
          message: status,
        });
      }
    }
  }

  return {
    success: true,
    valid: errors.length === 0,
    errors,
  };
}

/**
 * @param {import("mysql2/promise").Pool} db
 * @param {{ initializeEmpty?: boolean }} options
 */
export async function init(db, { initializeEmpty = true } = {}) {
  let connection;

  try {
    const sqlDir = await findSqlDirectory();

    const [initSql, checkSql] = await Promise.all([
      fs.readFile(path.join(sqlDir, "init_no_dummy.sql"), "utf8"),
      fs
        .readFile(path.join(sqlDir, "cekInit.sql"), "utf8")
        .then((sql) => `SET @target_db := '${process.env.DB_NAME}';\n${sql}`),
    ]);

    connection = await db.getConnection();

    const [[databaseInfo]] = await connection.query(
      "SELECT DATABASE() AS name",
    );

    if (!databaseInfo?.name) {
      throw new Error("Koneksi db belum memilih database.");
    }

    const [[tableInfo]] = await connection.query(
      `SELECT COUNT(*) AS total
             FROM INFORMATION_SCHEMA.TABLES
             WHERE TABLE_SCHEMA = DATABASE()
               AND TABLE_TYPE = 'BASE TABLE'`,
    );

    let initialized = false;

    if (Number(tableInfo.total) === 0) {
      if (!initializeEmpty) {
        return {
          success: true,
          valid: false,
          initialized: false,
          database: databaseInfo.name,
          errors: [
            {
              message: "Database belum memiliki tabel.",
            },
          ],
        };
      }

      // init.sql berisi DROP TABLE, jadi hanya dijalankan
      // otomatis jika database belum memiliki tabel.
      await executeScript(connection, initSql);
      initialized = true;
    }

    const result = await checkSchema(connection, checkSql);

    return {
      ...result,
      initialized,
      database: databaseInfo.name,
    };
  } catch (error) {
    return {
      success: false,
      valid: false,
      initialized: false,
      errors: [
        {
          message: error.message,
          code: error.code ?? null,
        },
      ],
    };
  } finally {
    connection?.release();
  }
}
