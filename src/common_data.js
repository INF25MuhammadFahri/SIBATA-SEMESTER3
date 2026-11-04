import { fileURLToPath } from "node:url";
import path from "node:path";

export const srcDir = path.dirname(fileURLToPath(import.meta.url));
/**
 * @type {{
 *   valid: boolean,
 *   initialized: boolean,
 *   message?: string,
 *   results?: unknown[],
 *   errors?: Error[]
 * }|null}
 */
export let dbstatus=null;
export function setDbStatus(status) {
  dbstatus = status;
}

export const Role = Object.freeze({
  ADMIN: "admin",
  VIEWER: "viewer"
});