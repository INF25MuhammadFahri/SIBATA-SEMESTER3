
import {
  isLoggedIn,
  getAuthUser,
  logout
} from "./auth.js";

// ============================================================
// CONFIGURATION
// ============================================================

export const NAV_ITEMS = [
  { label: "User", href: "user_account", auth: true },
  { label: "Panel Admin", href: "admin", roles: ["admin","manager"] },
  { label: "Kelola Akun", href: "account_manager", roles: ["manager"] }
];

let mobileToggleReady = false;
let storageListenerReady = false;


// ============================================================
// AUTHORIZATION
// ============================================================

/**
 * Memeriksa apakah pengguna memiliki salah satu role.
 * @param {...string} roles
 * @returns {boolean}
 */
export function hasRole(...roles) {
  const user = getAuthUser();

  if (!user || !Array.isArray(user.role)) {
    return false;
  }

  return roles.some(role => user.role.includes(role));
}

/**
 * Memeriksa apakah menu dapat ditampilkan.
 * @param {object} item
 * @param {boolean} [loggedIn]
 * @returns {boolean}
 */
export function canSeeNavItem(item, loggedIn = isLoggedIn()) {
  if (item.guestOnly) return !loggedIn;
  if (item.roles) return loggedIn && hasRole(...item.roles);
  if (item.auth) return loggedIn;

  return true;
}


// ============================================================
// NAVIGATION HELPERS
// ============================================================

function normalizePath(path) {
  const p = path.replace(/\.html$/, "").replace(/\/+$/, "");

  return p === "" || p === "/index" ? "/" : p;
}

function isActive(item) {
  if (item.href.includes("#")) return false;

  const target = normalizePath(
    new URL(item.href, `${window.location.origin}/`).pathname
  );

  return target === normalizePath(window.location.pathname);
}


// ============================================================
// CREATE NAV ITEM
// ============================================================

function createNavItem(item) {
  const li = document.createElement("li");
  li.dataset.dynamicNav = "true";
  const div = document.createElement("div");
  
  const a = document.createElement("a");

  a.href = item.href;
  a.className = "nav-item-link";
  a.textContent = item.label;

  if (isActive(item)) {
    a.classList.add("active");
    a.setAttribute("aria-current", "page");
  }

  li.appendChild(a);

  return li;
}


// ============================================================
// AUTH SLOT
// ============================================================

function buildAuthSlot(loggedIn) {
  const li = document.createElement("li");
  li.id = "nav-auth-slot";

  if (loggedIn) {
    const user = getAuthUser();

    const group = document.createElement("div");
    group.className = "auth-logged-group";

    const btn = document.createElement("button");

    btn.type = "button";
    btn.id = "btn-navbar-logout";
    btn.className = "btn-logout-pill";
    btn.textContent = "Keluar";

    btn.title = `Keluar dari akun ${user?.username || ""}`.trim();

    btn.addEventListener("click", async () => {
      if (confirm("Apakah Anda yakin ingin keluar?")) {
        try {
          await logout();
        } catch (error) {
          console.error("[Navbar] Logout gagal:", error);
        }
      }
    });

    group.appendChild(btn);
    li.appendChild(group);

  } else {
    const a = document.createElement("a");

    a.href = "login.html";
    a.className = "btn-primary btn-nav-login";
    a.textContent = "Login Admin";

    li.appendChild(a);
  }

  return li;
}


// ============================================================
// RENDER NAVIGATION
// ============================================================

export function renderNav() {
  const list = document.querySelector(
    "#main-nav-menu .nav-links-wrapper"
  );

  if (!list) return;

  const slot = list.querySelector("selipan");
  const authSlot = list.querySelector("#nav-auth-slot");

  if (!slot || !authSlot) {
    console.warn("[Navbar] Placeholder tidak ditemukan.");
    return;
  }

  const loggedIn = isLoggedIn();

  // Hapus menu dinamis sebelumnya
  list.querySelectorAll("[data-dynamic-nav]").forEach(el => {
    el.remove();
  });

  // Sisipkan menu sesuai hak akses
  NAV_ITEMS
    .filter(item => canSeeNavItem(item, loggedIn))
    .forEach(item => {
      slot.before(createNavItem(item));
    });

  // Perbarui bagian autentikasi saja
  authSlot.replaceWith(buildAuthSlot(loggedIn));
}


// ============================================================
// MOBILE MENU
// ============================================================

function initMobileToggle() {
  const toggle = document.getElementById("btn-mobile-menu");
  const nav = document.getElementById("main-nav-menu");

  if (!toggle || !nav || mobileToggleReady) return;

  mobileToggleReady = true;

  toggle.addEventListener("click", () => {
    const isOpen = nav.classList.toggle("open");

    toggle.setAttribute("aria-expanded", String(isOpen));

    const iconMenu = toggle.querySelector(".icon-menu");
    const iconClose = toggle.querySelector(".icon-close");

    if (iconMenu && iconClose) {
      iconMenu.style.display = isOpen ? "none" : "block";
      iconClose.style.display = isOpen ? "block" : "none";
    }
  });
}


// ============================================================
// INITIALIZATION
// ============================================================

export function initNav() {
  try {
    renderNav();
    initMobileToggle();

    // Sinkronisasi login/logout dari tab lain
    if (!storageListenerReady) {
      storageListenerReady = true;

      window.addEventListener("storage", (e) => {
        if (
          e.key === null ||
          e.key.startsWith("sibata_auth") ||
          e.key === "sibata_session_id"
        ) {
          renderNav();
        }
      });
    }

  } catch (error) {
    console.error("[Navbar] Initialization error:", error);
  }
}
