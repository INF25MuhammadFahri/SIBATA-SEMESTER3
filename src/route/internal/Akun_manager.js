
import express from "express";

import accountManager from "../../middleware/internal/accounts_manager.js";
import sessionManager from "../../middleware/internal/sesion.js";
import * as db from "../../database/db.js";

const router = express.Router();
const izinkan= "manager";
const TABLE = "accounts";
const SESSION_HEADER = "X-Sesion-ID";

// ============================================================
// Helper
// ============================================================

function success(res, data, message = "Berhasil") {
  return res.status(200).json({
    status: message,
    is_err: false,
    data
  });
}

function failure(res, status, message) {
  return res.status(status).json({
    status: message,
    is_err: true,
    message,
    data: []
  });
}

/**
 * Mengubah string role database menjadi array.
 * Format database: admin|editor
 */
function parseRoles(text) {
  return text
    ? text.split("|").filter(Boolean)
    : [];
}

/**
 * Mengubah child_data menjadi object.
 * Format: key=value per baris.
 */
function unescapeProp(text) {
  return text.replace(/\\(.)/g, (_, c) =>
    c === "n" ? "\n" : c === "r" ? "\r" : c
  );
}

function parseProperties(text) {
  const result = Object.create(null);

  if (!text) return result;

  for (const line of text.split("\n")) {
    if (!line.trim()) continue;

    let idx = -1;

    for (let i = 0; i < line.length; i++) {
      if (line[i] === "\\") {
        i++;
        continue;
      }

      if (line[i] === "=") {
        idx = i;
        break;
      }
    }

    if (idx === -1) continue;

    const key = unescapeProp(line.slice(0, idx));
    const value = unescapeProp(line.slice(idx + 1));

    result[key] = value;
  }

  return result;
}

/**
 * Mengambil akun berdasarkan ID.
 */
async function getAccountById(id) {
  const [row] = await db.select({
    from: TABLE,
    columns: ["id", "username"],
    where: { id },
    limit: 1
  });

  if (!row) return null;

  return accountManager.getUser(row.username);
}

/**
 * Mengambil akun berdasarkan identitas sesi.
 *
 * SessionData.userId bisa berisi username atau ID,
 * sehingga keduanya dicoba.
 */
async function getAccountBySession(session) {
  const userId = String(session.userId);

  // Coba sebagai username.
  let user = await accountManager.getUser(userId);

  if (user) return user;

  // Jika userId berupa angka, coba sebagai ID akun.
  if (/^\d+$/.test(userId)) {
    const id = Number(userId);

    if (Number.isSafeInteger(id)) {
      user = await getAccountById(id);
    }
  }

  return user;
}

/**
 * Middleware autentikasi dan otorisasi admin.
 */
async function requireAdmin(req, res, next) {
  try {
    const sessionId = req.get(SESSION_HEADER);

    if (!sessionId) {
      return failure(res, 401, "Session ID tidak ditemukan.");
    }

    const result = sessionManager.getSession(sessionId);

    if (!result.valid) {
      return failure(res, 401, result.message);
    }

    const user = await getAccountBySession(result.session);

    if (!user) {
      sessionManager.destroySession(sessionId);

      return failure(res, 401, "Akun sesi tidak ditemukan.");
    }
console.log(user.roles);
    if (!user.roles.includes(izinkan)) {
      return failure(res, 403, "Anda tidak memiliki izin admin.");
    }

    // Simpan informasi autentikasi untuk handler berikutnya.
    req.account = user;
    req.session = result.session;
    req.sessionId = sessionId;

    next();
  } catch (error) {
    next(error);
  }
}

// Semua endpoint di router ini wajib admin.
router.use(requireAdmin);

// ============================================================
// GET /api/account
// ============================================================

router.get("/", async (req, res, next) => {
  try {
    let page = Number.parseInt(req.query.page, 10) || 1;
    let size = Number.parseInt(req.query.size, 10) || 10;

    page = Math.max(1, page);
    size = Math.min(100, Math.max(1, size));

    const search = String(req.query.search ?? "")
      .trim()
      .toLowerCase();

    // Password tidak ikut diambil.
    const rows = await db.select({
      from: TABLE,
      columns: [
        "id",
        "username",
        "role",
        "child_data"
      ]
    });

    let accounts = rows.map(row => {
      const childData = parseProperties(row.child_data);

      return {
        id: row.id,
        username: row.username,
        display_name: childData.display_name ?? "",
        roles: parseRoles(row.role)
      };
    });

    // Pencarian dilakukan setelah data dibaca.
    if (search) {
      accounts = accounts.filter(account => {
        const searchable = [
          account.username,
          account.display_name,
          ...account.roles
        ].join(" ").toLowerCase();

        return searchable.includes(search);
      });
    }

    const total = accounts.length;
    const offset = (page - 1) * size;

    const result = accounts.slice(offset, offset + size);

    res.set("X-Total-Count", String(total));

    return success(res, result, "Daftar akun berhasil diambil.");
  } catch (error) {
    next(error);
  }
});

// ============================================================
// POST /api/account
// ============================================================

router.post("/", async (req, res, next) => {
  try {
    const {
      username,
      password,
      roles = [],
      display_name = ""
    } = req.body ?? {};

    if (
      typeof username !== "string" ||
      typeof password !== "string"
    ) {
      return failure(
        res,
        400,
        "Username dan password wajib berupa string."
      );
    }

    if (!Array.isArray(roles)) {
      return failure(res, 400, "Roles harus berupa array.");
    }

    if (typeof display_name !== "string") {
      return failure(
        res,
        400,
        "Display name harus berupa string."
      );
    }

    const id = await accountManager.createUser({
      username,
      password,
      roles,
      childData: {
        display_name
      }
    });

    return success(
      res,
      { id, username },
      "Akun berhasil dibuat."
    );
  } catch (error) {
    if (error.code === "DUPLICATE_USERNAME") {
      return failure(res, 409, error.message);
    }

    if (
      error.message?.includes("username harus") ||
      error.message?.includes("password harus") ||
      error.message?.includes("Role tidak valid")
    ) {
      return failure(res, 400, error.message);
    }

    next(error);
  }
});

// ============================================================
// PUT /api/account
// ============================================================

router.put("/", async (req, res, next) => {
  try {
    const {
      id,
      display_name,
      roles,
      password
    } = req.body ?? {};

    if (
      !Number.isSafeInteger(Number(id)) ||
      Number(id) <= 0
    ) {
      return failure(res, 400, "ID akun tidak valid.");
    }

    const accountId = Number(id);
    const user = await getAccountById(accountId);

    if (!user) {
      return failure(res, 404, "Akun tidak ditemukan.");
    }

    if (
      display_name === undefined &&
      roles === undefined &&
      password === undefined
    ) {
      return failure(
        res,
        400,
        "Tidak ada data yang perlu diperbarui."
      );
    }

    if (
      display_name !== undefined &&
      typeof display_name !== "string"
    ) {
      return failure(
        res,
        400,
        "Display name harus berupa string."
      );
    }

    if (roles !== undefined && !Array.isArray(roles)) {
      return failure(res, 400, "Roles harus berupa array.");
    }

    if (
      password !== undefined &&
      (typeof password !== "string" || password === "")
    ) {
      return failure(
        res,
        400,
        "Password baru tidak valid."
      );
    }

    // Update role jika dikirim.
    if (roles !== undefined) {
      await accountManager.setRoles(user.username, roles);
    }

    // Update child_data tanpa menghapus properti lainnya.
    if (display_name !== undefined) {
      await accountManager.setChildData(user.username, {
        ...user.childData,
        display_name
      });
    }

    // Password akan di-hash oleh AccountManager.
    if (password !== undefined) {
      await accountManager.changePassword(
        user.username,
        password
      );
    }

    return success(
      res,
      { id: accountId, username: user.username },
      "Akun berhasil diperbarui."
    );
  } catch (error) {
    if (
      error.message?.includes("Role tidak valid") ||
      error.message?.includes("password harus") ||
      error.message?.includes("username harus")
    ) {
      return failure(res, 400, error.message);
    }

    next(error);
  }
});

// ============================================================
// DELETE /api/account
// ============================================================

router.delete("/", async (req, res, next) => {
  try {
    // Format body: [1, 2, 3]
    const ids = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return failure(
        res,
        400,
        "Body harus berupa array ID akun."
      );
    }

    const deleted = [];
    const skipped = [];

    for (const value of [...new Set(ids)]) {
      const id = Number(value);

      if (!Number.isSafeInteger(id) || id <= 0) {
        skipped.push({
          id: value,
          reason: "ID tidak valid."
        });
        continue;
      }

      // Jangan izinkan admin menghapus akunnya sendiri.
      if (String(id) === String(req.account.id)) {
        skipped.push({
          id,
          reason: "Tidak dapat menghapus akun sendiri."
        });
        continue;
      }

      const user = await getAccountById(id);

      if (!user) {
        skipped.push({
          id,
          reason: "Akun tidak ditemukan."
        });
        continue;
      }

      const removed = await accountManager.deleteUser(
        user.username
      );

      if (removed) {
        deleted.push(id);
      } else {
        skipped.push({
          id,
          reason: "Gagal menghapus akun."
        });
      }
    }

    return success(
      res,
      { deleted, skipped },
      "Proses penghapusan selesai."
    );
  } catch (error) {
    next(error);
  }
});

// ============================================================
// Error handler lokal
// ============================================================

router.use((error, req, res, next) => {
  console.error("Account router error:", error);

  if (res.headersSent) {
    return next(error);
  }

  return failure(
    res,
    500,
    "Terjadi kesalahan internal server."
  );
});

export {router};
