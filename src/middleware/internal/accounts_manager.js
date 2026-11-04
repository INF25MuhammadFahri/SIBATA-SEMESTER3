import fs from "node:fs/promises";
import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import * as db from "../../database/db.js";

const TABLE = "accounts";
const scryptAsync = promisify(scrypt);

/* ------------------------------------------------------------------ */
/* Password (hash scrypt bawaan Node, tanpa dependency tambahan)       */
/* Format tersimpan: scrypt$<salt base64>$<hash base64>                */
/* ------------------------------------------------------------------ */

const KEY_LEN = 64;

/** @param {string} password */
async function hashPassword(password) {
  const salt = randomBytes(16);
  const key = await scryptAsync(password, salt, KEY_LEN);
  return `scrypt$${salt.toString("base64")}$${key.toString("base64")}`;
}

/**
 * @param {string} password
 * @param {string} stored
 */
async function verifyPassword(password, stored) {
  const [alg, saltB64, keyB64] = String(stored).split("$");
  if (alg !== "scrypt" || !saltB64 || !keyB64) return false;

  const expected = Buffer.from(keyB64, "base64");
  const actual = await scryptAsync(
    password,
    Buffer.from(saltB64, "base64"),
    expected.length,
  );
  return timingSafeEqual(actual, expected);
}

/* ------------------------------------------------------------------ */
/* Role: "admin|editor"                                                */
/* ------------------------------------------------------------------ */

/** @param {string|null|undefined} text */
function parseRoles(text) {
  return text ? text.split("|").filter(Boolean) : [];
}

/** @param {string[]} roles */
function formatRoles(roles) {
  if (!Array.isArray(roles)) throw new Error("roles harus berupa array");

  for (const role of roles) {
    if (typeof role !== "string" || role === "" || role.includes("|")) {
      throw new Error(`Role tidak valid: ${role}`);
    }
  }
  return [...new Set(roles)].join("|");
}

/* ------------------------------------------------------------------ */
/* child_data: string properties, satu "key=value" per baris           */
/* Escape: \\ untuk backslash, \n untuk baris baru, \= untuk "=" di key */
/* ------------------------------------------------------------------ */

/**
 * @param {unknown} text
 * @param {boolean} isKey
 */
function escapeProp(text, isKey) {
  let out = String(text)
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r");
  if (isKey) out = out.replace(/=/g, "\\=");
  return out;
}

/** @param {string} text */
function unescapeProp(text) {
  return text.replace(/\\(.)/g, (_, c) =>
    c === "n" ? "\n" : c === "r" ? "\r" : c,
  );
}

/**
 * @param {string|null|undefined} text
 * @returns {Record<string, string>}
 */
function parseProperties(text) {
  const result = Object.create(null);
  if (!text) return result;

  for (const line of text.split("\n")) {
    if (!line.trim()) continue;

    // cari "=" pertama yang tidak di-escape
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

    result[unescapeProp(line.slice(0, idx))] = unescapeProp(line.slice(idx + 1));
  }
  return result;
}

/** @param {Record<string, unknown>} obj */
function formatProperties(obj) {
  if (obj === null || typeof obj !== "object" || Array.isArray(obj)) {
    throw new Error("childData harus berupa object");
  }
  return Object.entries(obj)
    .map(([k, v]) => `${escapeProp(k, true)}=${escapeProp(v ?? "", false)}`)
    .join("\n");
}

/* ------------------------------------------------------------------ */
/* Validasi input                                                      */
/* ------------------------------------------------------------------ */

/** @param {unknown} username */
function assertUsername(username) {
  if (typeof username !== "string" || username === "" || username.length > 64) {
    throw new Error("username harus string 1-64 karakter");
  }
}

/** @param {unknown} password */
function assertPassword(password) {
  if (typeof password !== "string" || password === "") {
    throw new Error("password harus string tidak kosong");
  }
}

/**
 * @typedef {Object} Account
 * @property {number} id
 * @property {string} username
 * @property {string[]} roles
 * @property {Record<string, string>} childData
 */

class AccountManager {
  /** @type {Promise<void>|null} */
  #ready = null;
  /** @type {Promise<string>|null} */
  #dummyHash = null;

  /**
   * Memastikan db sudah init dan tabel ada. Dijalankan lazy (bukan di
   * constructor) karena instance dibuat saat import, sebelum db.init().
   */
  #ensureReady() {
    this.#ready ??= (async () => {
      db.withDB(() => {}); // lempar error jelas jika db belum init
      await db.createTable({
        name: TABLE,
        columns: [
          { name: "id", type: "INT UNSIGNED", primaryKey: true, autoIncrement: true },
          { name: "username", type: "VARCHAR(64)", notNull: true, unique: true },
          { name: "password", type: "VARCHAR(255)", notNull: true },
          { name: "role", type: "VARCHAR(255)", notNull: true, default: "" },
          { name: "child_data", type: "TEXT" },
        ],
      });
    })().catch((err) => {
      this.#ready = null; // boleh dicoba lagi
      throw err;
    });
    return this.#ready;
  }

  /**
   * @param {string} name
   * @param {string} password
   * @returns {Promise<boolean>}
   */
  async validateUser(name, password) {
    if (typeof name !== "string" || typeof password !== "string") return false;
    await this.#ensureReady();

    const [row] = await db.select({
      from: TABLE,
      columns: ["password"],
      where: { username: name },
      limit: 1,
    });

    if (!row) {
      // hitung hash palsu supaya waktu respon tidak membocorkan keberadaan user
      this.#dummyHash ??= hashPassword("dummy-password");
      await verifyPassword(password, await this.#dummyHash);
      return false;
    }

    return verifyPassword(password, row.password);
  }

  /**
   * @param {string} username
   * @returns {Promise<Account|null>} tanpa password
   */
  async getUser(username) {
    await this.#ensureReady();

    const [row] = await db.select({
      from: TABLE,
      columns: ["id", "username", "role", "child_data"],
      where: { username },
      limit: 1,
    });

    if (!row) return null;

    return {
      id: row.id,
      username: row.username,
      roles: parseRoles(row.role),
      childData: parseProperties(row.child_data),
    };
  }

  /**
   * @param {string} username
   * @param {string} role
   * @returns {Promise<boolean>}
   */
  async hasRole(username, role) {
    const user = await this.getUser(username);
    return !!user && user.roles.includes(role);
  }

  /**
   * @param {{ username: string, password: string, roles?: string[], childData?: Record<string, unknown> }} data
   * @returns {Promise<number>} id user baru
   * @throws error dengan code "DUPLICATE_USERNAME" jika username sudah ada
   */
  async createUser({ username, password, roles = [], childData = {} }) {
    assertUsername(username);
    assertPassword(password);
    await this.#ensureReady();

    try {
      const { insertId } = await db.insert(TABLE, {
        username,
        password: await hashPassword(password),
        role: formatRoles(roles),
        child_data: formatProperties(childData),
      });
      return insertId;
    } catch (err) {
      if (err.code === "ER_DUP_ENTRY") {
        const e = new Error(`Username sudah dipakai: ${username}`);
        e.code = "DUPLICATE_USERNAME";
        throw e;
      }
      throw err;
    }
  }

  /**
   * @param {string} username
   * @param {string} newPassword
   * @returns {Promise<boolean>} false jika user tidak ada
   */
  async changePassword(username, newPassword) {
    assertPassword(newPassword);
    return this.#update(username, { password: await hashPassword(newPassword) });
  }

  /**
   * @param {string} username
   * @param {string[]} roles
   * @returns {Promise<boolean>}
   */
  async setRoles(username, roles) {
    return this.#update(username, { role: formatRoles(roles) });
  }

  /**
   * Mengganti seluruh child_data.
   * @param {string} username
   * @param {Record<string, unknown>} childData
   * @returns {Promise<boolean>}
   */
  async setChildData(username, childData) {
    return this.#update(username, { child_data: formatProperties(childData) });
  }

  /**
   * @param {string} username
   * @returns {Promise<boolean>} false jika user tidak ada
   */
  async deleteUser(username) {
    await this.#ensureReady();
    const { affectedRows } = await db.deleteRows({
      from: TABLE,
      where: { username },
      limit: 1,
    });
    return affectedRows > 0;
  }

  /**
   * Sekali jalan: pindahkan akun dari ./data/account.json (name + password
   * plaintext) ke database dengan password di-hash. Username yang sudah ada
   * dilewati.
   * @param {string} [path]
   * @returns {Promise<number>} jumlah akun yang berhasil dimasukkan
   */
  async importFromJson(path = "./data/account.json") {
    const data = JSON.parse(await fs.readFile(path, "utf8"));

    if (
      !Array.isArray(data) ||
      !data.every(
        (u) =>
          u && typeof u === "object" &&
          typeof u.name === "string" &&
          typeof u.password === "string",
      )
    ) {
      throw new Error("Struktur JSON tidak valid");
    }

    let imported = 0;
    for (const u of data) {
      try {
        await this.createUser({ username: u.name, password: u.password });
        imported++;
      } catch (err) {
        if (err.code !== "DUPLICATE_USERNAME") throw err;
      }
    }
    return imported;
  }

  /**
   * @param {string} username
   * @param {Record<string, unknown>} set
   */
  async #update(username, set) {
    assertUsername(username);
    await this.#ensureReady();

    const { affectedRows } = await db.updateRows({
      table: TABLE,
      set,
      where: { username },
      limit: 1,
    });
    return affectedRows > 0;
  }
}

export default new AccountManager();