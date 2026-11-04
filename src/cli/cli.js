import cmd from "./internal/commandManager.js";
import readline from "node:readline";
import * as db from "../database/db.js";
import * as commond from "../common_data.js";
import fs from "node:fs/promises";
import path from "node:path";
import acc from "../middleware/internal/accounts_manager.js";
const exec = new cmd();
//init db first
export function init() {
  exec.register("resetDB", async (arg1) => {
    let filetarget;
    if (arg1 != "dummy") {
      filetarget = path.join(
        commond.srcDir,
        "database",
        "sql_script",
        "init_no_dummy.sql",
      );
    } else {
      filetarget = path.join(
        commond.srcDir,
        "database",
        "sql_script",
        "init.sql",
      );
    }
    try {
      const sql = await fs.readFile(filetarget, "utf8");
      const statements = sql
        .split(";")
        .map((s) => s.trim())
        .filter((s) => s.length > 0);

      console.log("Me-reset database...");

      const conn = await db.db.getConnection();

      try {
        for (const statement of statements) {
          await conn.execute(statement);
        }
      } finally {
        conn.release();
      }

      console.log("Database berhasil di-reset");
    } catch (err) {
      console.error("Gagal reset database:", err);
    }
  });
  exec.register("addUser", async (user, password) => {
  try {
    const id = await acc.createUser({ username: user, password });
    console.log(`User ${user} dibuat (id ${id})`);
  } catch (err) {
    if (err.code === "DUPLICATE_USERNAME") {
      console.log(`Username ${user} sudah dipakai`);
    } else {
      console.log("Gagal membuat user:", err.message);
    }
  }
});
  exec.register("setRoles", async (user, ...roles) => {
    return acc.setRoles(user, roles.flat());
  });
  exec.register("setPropertiesOfUser", async (user, props) => {
    const account = await acc.getUser(user);
    if (!account) return false; // user tidak ada

    // props: object, mis. { level: 5, title: "Pro" }
    return acc.setChildData(user, { ...account.childData, ...props });
  });
  // Mengembalikan array role, atau null jika user tidak ada
  exec.register("getRolesOfUser", async (user) => {
    const account = await acc.getUser(user);
    return account ? account.roles : null;
  });

  // Mengembalikan seluruh properti (object), atau null jika user tidak ada
  exec.register("getPropertiesOfUser", async (user) => {
    const account = await acc.getUser(user);
    return account ? account.childData : null;
  });

  // Mengembalikan satu properti (string), atau null jika user atau key tidak ada
  exec.register("getPropertyOfUser", async (user, key) => {
    const account = await acc.getUser(user);
    if (!account) return null;
    return Object.hasOwn(account.childData, key)
      ? account.childData[key]
      : null;
  });

  // Cek role: true / false
  exec.register("userHasRole", async (user, role) => {
    return acc.hasRole(user, role);
  });
}
export function close() {
  exec.close();
}
