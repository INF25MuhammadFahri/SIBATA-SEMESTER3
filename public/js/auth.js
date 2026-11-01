// Modul Manajemen Otentikasi & Sesi SIBATA
// Sesuai dengan spesifikasi: doc/client to server login and Sesion.md

const AUTH_STORAGE_KEY = "sibata_auth_state";
const SESSION_ID_KEY = "sibata_session_id";
const USERNAME_KEY = "sibata_auth_username";
const DISPLAY_NAME_KEY = "sibata_auth_name";

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

export function getAuthUser() {
  if (!isLoggedIn()) return null;
  const username = localStorage.getItem(USERNAME_KEY) || "admin";
  return {
    username,
    name: localStorage.getItem(DISPLAY_NAME_KEY) || (username === "joko" ? "Joko (Staff Ahli Tata Ruang)" : "Administrator SIBATA"),
    role: "Admin Tata Ruang",
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

      localStorage.setItem(AUTH_STORAGE_KEY, "true");
      localStorage.setItem(USERNAME_KEY, cleanUsername);
      localStorage.setItem(
        DISPLAY_NAME_KEY,
        cleanUsername === "joko" ? "Joko (Staff Ahli Tata Ruang)" : "Administrator SIBATA"
      );
      if (sessionId) {
        localStorage.setItem(SESSION_ID_KEY, sessionId);
      }

      startSessionKeepAlive();

      return {
        success: true,
        sessionId,
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
 * Inisialisasi tampilan Navbar dan menu mobile
 */
export function initNavbarAuth() {
  const adminNavLink = document.getElementById("nav-admin-link");
  const authSlot = document.getElementById("nav-auth-slot");

  const loggedIn = isLoggedIn();

  if (adminNavLink) {
    adminNavLink.style.display = loggedIn ? "" : "none";
  }

  if (authSlot) {
    if (loggedIn) {
      const user = getAuthUser();
      authSlot.innerHTML = `
        <div class="auth-logged-group" style="display: flex; align-items: center; gap: 8px;">
          <a href="admin.html" class="btn-primary btn-nav-login" title="Buka Panel Admin">Panel Admin</a>
          <button type="button" id="btn-navbar-logout" class="btn-logout-pill" title="Keluar dari sesi admin (${user.username})">Keluar</button>
        </div>
      `;

      const logoutBtn = document.getElementById("btn-navbar-logout");
      if (logoutBtn) {
        logoutBtn.addEventListener("click", () => {
          if (confirm("Apakah Anda yakin ingin keluar dari Panel Admin?")) {
            logout();
          }
        });
      }
    } else {
      authSlot.innerHTML = `
        <a href="login.html" class="btn-primary btn-nav-login" title="Masuk ke Panel Admin">
          Login Admin
        </a>
      `;
    }
  }

  // Toggle navigasi mobile
  const mobileToggle = document.getElementById("btn-mobile-menu");
  const mainNav = document.getElementById("main-nav-menu");
  if (mobileToggle && mainNav && !mobileToggle.dataset.initialized) {
    mobileToggle.dataset.initialized = "true";
    mobileToggle.addEventListener("click", () => {
      const isOpen = mainNav.classList.toggle("open");
      mobileToggle.setAttribute("aria-expanded", String(isOpen));
      
      const iconMenu = mobileToggle.querySelector(".icon-menu");
      const iconClose = mobileToggle.querySelector(".icon-close");
      if (iconMenu && iconClose) {
        iconMenu.style.display = isOpen ? "none" : "block";
        iconClose.style.display = isOpen ? "block" : "none";
      }
    });
  }
}

/**
 * Route Guard untuk halaman admin (admin.html)
 */
export async function protectAdminPage() {
  if (!isLoggedIn()) {
    window.location.replace("login.html?redirect=admin.html");
    return;
  }

  startSessionKeepAlive();

  // Validasi sesi aktif ke server secara asynchronous
  const isValid = await extendSession();
  if (!isValid && !isLoggedIn()) {
    window.location.replace("login.html?redirect=admin.html");
  }
}
