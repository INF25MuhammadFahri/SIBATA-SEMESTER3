// Modul Manajemen Otentikasi & Sesi SIBATA
// Sesuai dengan spesifikasi: doc/client to server login and Sesion.md

const AUTH_STORAGE_KEY = "sibata_auth_state";
const SESSION_ID_KEY = "sibata_session_id";
const USERNAME_KEY = "sibata_auth_username";
const DISPLAY_NAME_KEY = "sibata_auth_name";
const ROLES_KEY = "sibata_auth_roles";

let sessionHeartbeatTimer = null;

export function isLoggedIn() {
  return localStorage.getItem(AUTH_STORAGE_KEY) === "true" && Boolean(getSessionId());
}

export function getSessionId() {
  return localStorage.getItem(SESSION_ID_KEY) || null;
}

export function getAuthHeaders() {
  const headers = {
    "Content-Type": "application/json"
  };
  const sessionId = getSessionId();
  if (sessionId) {
    headers["X-Sesion-ID"] = sessionId;
  }
  return headers;
}
/**
* @returns {{role:string[],username:string,user:string,seesionId:string|null}}
*/
export function getAuthUser() {
  if (!isLoggedIn()) return null;

  const username = localStorage.getItem(USERNAME_KEY) || "admin";

  let roles;
  try {
    roles = JSON.parse(localStorage.getItem(ROLES_KEY) || '["visitor"]');
  } catch {
    roles = ["visitor"];
  }

  return {
    username,
    name: localStorage.getItem(DISPLAY_NAME_KEY) || "Administrator SIBATA",
    role: roles,
    sessionId: getSessionId()
  };
}
/**
 * Login ke server melalui POST /api/login
 * @param {string} username
 * @param {string} password
 */
export async function login(username, password) {
  const cleanUsername = username.trim();
  const cleanPassword = password.trim();

  if (!cleanUsername || !cleanPassword) {
    return {
      success: false,
      message: "Nama pengguna dan kata sandi wajib diisi."
    };
  }

  try {
    const response = await fetch("/api/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        name: cleanUsername,
        password: cleanPassword
      })
    });

    const result = await response.json();

    if (response.ok && result.status === "ok") {
      const sessionId = result.seesionId || result.sessionId;
      const roles= result.roles;
      const display_name= result.display_name
      //alert(JSON.stringify({role:roles,displayname:display_name}));
      localStorage.setItem(AUTH_STORAGE_KEY, "true");
      localStorage.setItem(USERNAME_KEY, cleanUsername);
      localStorage.setItem(ROLES_KEY, JSON.stringify(roles));
      localStorage.setItem(
        DISPLAY_NAME_KEY,
        display_name
      );
      if (sessionId) {
        localStorage.setItem(SESSION_ID_KEY, sessionId);
      }

      startSessionKeepAlive();

      return {
        success: true,
        sessionId,
        roles,
        message: "Login server berhasil."
      };
    }

    if (response.status === 401) {
      return {
        success: false,
        message: "Kata sandi atau nama pengguna salah."
      };
    }

    return {
      success: false,
      message: result.status || "Terjadi kesalahan saat otentikasi."
    };
  } catch (err) {
    console.error("Gagal terhubung ke endpoint /api/login:", err);
    return {
      success: false,
      message: "Gagal menghubungi server database. Pastikan server aktif."
    };
  }
}

/**
 * Logout dari sistem melalui POST /api/logout
 */
export async function logout() {
  stopSessionKeepAlive();
  const sessionId = getSessionId();

  if (sessionId) {
    try {
      await fetch("/api/logout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          sesionId: sessionId
        })
      });
    } catch (e) {
      console.warn("Gagal memanggil endpoint logout server:", e);
    }
  }

  localStorage.removeItem(AUTH_STORAGE_KEY);
  localStorage.removeItem(SESSION_ID_KEY);
  localStorage.removeItem(USERNAME_KEY);
  localStorage.removeItem(DISPLAY_NAME_KEY);
  localStorage.removeItem(ROLES_KEY);
  window.location.href = "index.html";
}

/**
 * Memperpanjang masa aktif sesi melalui POST /api/extendSesion
 */
export async function extendSession() {
  const sessionId = getSessionId();
  if (!sessionId) return false;

  try {
    const res = await fetch("/api/extendSesion", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        sesionId: sessionId
      })
    });

    if (res.ok) {
      return true;
    }

    if (res.status === 401) {
      console.warn("Sesi di server telah berakhir atau tidak valid.");
      handleExpiredSession();
      return false;
    }

    return false;
  } catch (err) {
    console.warn("Gagal memperpanjang sesi:", err);
    return false;
  }
}

function handleExpiredSession() {
  stopSessionKeepAlive();
  localStorage.removeItem(AUTH_STORAGE_KEY);
  localStorage.removeItem(SESSION_ID_KEY);
  localStorage.removeItem(USERNAME_KEY);
  localStorage.removeItem(DISPLAY_NAME_KEY);
  localStorage.removeItem(ROLES_KEY);
  if (window.location.pathname.includes("admin")) {
    alert("Sesi login Anda telah berakhir. Silakan masuk kembali.");
    window.location.replace("login.html?redirect=admin.html");
  }
}

/**
 * Keep-alive timer untuk memperpanjang sesi secara otomatis selama browser aktif
 */
export function startSessionKeepAlive() {
  stopSessionKeepAlive();
  if (!isLoggedIn()) return;

  // Lakukan extend sesi setiap 10 menit (TTL default sesi server = 30 menit)
  sessionHeartbeatTimer = setInterval(() => {
    extendSession();
  }, 10 * 60 * 1000);
}

export function stopSessionKeepAlive() {
  if (sessionHeartbeatTimer) {
    clearInterval(sessionHeartbeatTimer);
    sessionHeartbeatTimer = null;
  }
}

/**
 * Inisialisasi tampilan Navbar dan menu mobile.
 */
export async function initNavbarAuth() {
  const navi = await import("./nav.js");
  navi.initNav();
}

  

/**
 * Route Guard untuk halaman admin (admin.html)
 */
export async function protectAdminPage() {
  if (!isLoggedIn()) {
    window.location.replace("login?redirect=admin");
    //window.location.replace("login");
    return;
  }

  startSessionKeepAlive();

  // Validasi sesi aktif ke server secara asynchronous
  const isValid = await extendSession();
  if (!isValid && !isLoggedIn()) {
    window.location.replace("login?redirect=admin");
   // window.location.replace("login");
  }
}

/**
 * Melindungi halaman berdasarkan role pengguna.
 *
 * @param {string|string[]} requiredRoles Role yang diizinkan.
 * @param {string} [redirectUrl="/"] URL tujuan jika tidak memiliki izin.
 * @returns {Promise<boolean>} Apakah akses diizinkan.
 */
export async function protectByRole(requiredRoles, redirectUrl = "/") {
  if (!isLoggedIn()) {
    window.location.replace("login");
    return false;
  }

  const valid = await extendSession();

  if (!valid) {
    if (!isLoggedIn()) {
      window.location.replace("login");
    }

    return false;
  }

  const user = getAuthUser();

  if (!user) {
    window.location.replace("login");
    return false;
  }

  const userRoles = Array.isArray(user.role)
    ? user.role
    : [];

  const allowedRoles = Array.isArray(requiredRoles)
    ? requiredRoles
    : [requiredRoles];

  const allowed = allowedRoles.some(role =>
    userRoles.includes(role)
  );

  if (!allowed) {
    alert("Anda tidak memiliki izin untuk mengakses halaman ini.");
    window.location.replace(redirectUrl);
    return false;
  }

  startSessionKeepAlive();
  return true;
}