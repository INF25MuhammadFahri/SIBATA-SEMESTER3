import fs from "node:fs/promises";

async function exists(path) {
  try {
    await fs.access(path);
    return true;
  } catch {
    return false;
  }
}

function validateUsers(data) {
  if (!Array.isArray(data)) return false;

  return data.every(
    (user) =>
      user !== null &&
      typeof user === "object" &&
      !Array.isArray(user) &&
      typeof user.name === "string" &&
      typeof user.password === "string",
  );
}
async function loadUsers() {
  const path = "./data/account.json";
  if (!exists(path)) {
    console.log("akun tidak termuat");
  }
  const text = await fs.readFile(path, "utf8");
  const data = JSON.parse(text);

  if (!validateUsers(data)) {
    throw new Error("Struktur JSON tidak valid");
  }

  return data;
}
class AccountManager {
  #data;

  constructor() {
    this.#data = loadUsers();
  }

  /**
   * @param {string} name
   * @param {string} password
   * @returns {Promise<boolean>}
   */
  async validateUser(name, password) {
    const users = await this.#data;

    const user = users.find((user) => user.name === name);

    if (!user) return false;

    return password === user.password;
  }
}
export default new AccountManager();
