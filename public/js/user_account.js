import {
  isLoggedIn,
  getAuthUser,
  getSessionId,
  extendSession,
  logout,
  initNavbarAuth,
  startSessionKeepAlive,
  protectAdminPage
} from "./auth.js";
const LOGIN_URL = "login?redirect=user_account";

const ROLE_LABELS = {
  admin: "Administrator",
  manager: "manajer",
  visitor: "Pengunjung"
};

const $ = (id) => document.getElementById(id);
protectAdminPage();
let sessionIdVisible = false;

// ==========================================================================
// Helper
// ==========================================================================

function cleanValue(value) {
  if (value === null || value === undefined) return null;

  const text = String(value).trim();

  if (!text || text === "") return null;

  return text;
}

function getInitials(name) {
  const parts = name
    .replace(/\(.*?\)/g, "")
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0][0] || "";
  const second = parts.length > 1 ? parts[1][0] : "";
  return (first + second).toUpperCase();
}

function maskSessionId(id) {
  if (id.length <= 8) return "•".repeat(id.length);
  return id.substring(0, 8) + "•".repeat(Math.min(id.length - 8, 16));
}

function formatTime(date) {
  return date.toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });
}

function showAlert(type, message) {
  const box = $("account-alert");
  if (!box) return;
  box.className = `account-alert ${type}`;
  box.textContent = message;
  box.hidden = false;
}

function hideAlert() {
  const box = $("account-alert");
  if (box) box.hidden = true;
}

function setSessionStatus(state) {
  const badge = $("session-status");
  if (!badge) return;

  const states = {
    checking: ["badge badge-neutral", "Memverifikasi..."],
    active: ["badge badge-success", "Aktif"],
    unverified: ["badge badge-warning", "Belum dapat diverifikasi"],
    expired: ["badge badge-danger", "Berakhir"]
  };
  const [cls, text] = states[state] || states.checking;
  badge.className = cls;
  badge.textContent = text;
}

function redirectToLogin(message) {
  if (message) alert(message);
  window.location.replace(LOGIN_URL);
}

// ==========================================================================
// Render data akun & sesi
// ==========================================================================
function renderAccount() {
  const user = getAuthUser();
  if (!user) return;

  const username = cleanValue(user.username) || "-";
  const displayName = cleanValue(user.name) || username;
  const roles = (user.role);
  //alert(JSON.stringify({username,displayName,roles}));
  $("account-display-name").textContent = displayName;
  $("account-username-sub").textContent = `@${username}`;
  $("account-username").textContent = username;
  $("account-name").textContent = displayName;
  $("account-avatar").textContent = getInitials(displayName);

  const rolesEl = $("account-roles");
  rolesEl.textContent = "";
  roles.forEach((role) => {

    const key = role.toLowerCase();
    const badge = document.createElement("span");
    badge.className =
      key === "admin" ? "badge badge-gold" : key === "visitor" ? "badge badge-neutral" : "badge badge-primary";
    badge.textContent = ROLE_LABELS[key] || role;
    rolesEl.appendChild(badge);
  });

  // Tautan panel admin hanya untuk peran admin
  const adminLink = $("btn-open-admin");
  if (adminLink) adminLink.hidden = !roles.some((r) => r.toLowerCase() === "admin");
  renderSessionId();
}

function renderSessionId() {
  const id = getSessionId();
  const el = $("session-id");
  const toggleBtn = $("btn-toggle-session-id");
  const copyBtn = $("btn-copy-session-id");

  if (!el) return;

  if (!id) {
    el.textContent = "Tidak ada sesi";
    if (toggleBtn) toggleBtn.disabled = true;
    if (copyBtn) copyBtn.disabled = true;
    return;
  }

  el.textContent = sessionIdVisible ? id : maskSessionId(id);
  if (toggleBtn) toggleBtn.textContent = sessionIdVisible ? "Sembunyikan" : "Lihat";
}

function markExtended() {
  const el = $("session-last-extend");
  if (el) el.textContent = formatTime(new Date());
}

// ==========================================================================
// Aksi
// ==========================================================================
async function handleExtend() {
  const btn = $("btn-extend-session");
  if (btn) {
    btn.disabled = true;
    btn.textContent = "Memperpanjang...";
  }
  hideAlert();

  try {
    const ok = await extendSession();

    // extendSession() menghapus data login sendiri jika server menjawab 401
    if (!isLoggedIn()) {
      setSessionStatus("expired");
      redirectToLogin("Sesi login Anda telah berakhir. Silakan masuk kembali.");
      return;
    }

    if (ok) {
      setSessionStatus("active");
      markExtended();
      showAlert("success", "Sesi berhasil diperpanjang.");
    } else {
      setSessionStatus("unverified");
      showAlert("danger", "Sesi belum bisa diperpanjang. Pastikan server aktif, lalu coba lagi.");
    }
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = "Perpanjang sesi";
    }
  }
}

async function handleCopySessionId() {
  const id = getSessionId();
  if (!id) return;

  const btn = $("btn-copy-session-id");
  try {
    await navigator.clipboard.writeText(id);
    if (btn) {
      btn.textContent = "Tersalin";
      setTimeout(() => (btn.textContent = "Salin"), 2000);
    }
  } catch (err) {
    prompt("Salin ID sesi berikut secara manual:", id);
  }
}

function initActions() {
  const toggleBtn = $("btn-toggle-session-id");
  const copyBtn = $("btn-copy-session-id");
  const extendBtn = $("btn-extend-session");
  const logoutBtn = $("btn-account-logout");

  if (toggleBtn) {
    toggleBtn.addEventListener("click", () => {
      sessionIdVisible = !sessionIdVisible;
      renderSessionId();
    });
  }
  if (copyBtn) copyBtn.addEventListener("click", handleCopySessionId);
  if (extendBtn) extendBtn.addEventListener("click", handleExtend);

  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      if (confirm("Apakah Anda yakin ingin keluar dari akun ini?")) {
        logout();
      }
    });
  }
}

// ==========================================================================
// Inisialisasi
// ==========================================================================
document.addEventListener("DOMContentLoaded", async () => {
  initNavbarAuth();
  if (!isLoggedIn()) {
    redirectToLogin();
    return;
  }


  renderAccount();
  initActions();
  setSessionStatus("checking");

  // Validasi sesi ke server, sama seperti route guard di halaman admin
  const valid = await extendSession();

  if (!isLoggedIn()) {
    setSessionStatus("expired");
    redirectToLogin("Sesi login Anda telah berakhir. Silakan masuk kembali.");
    return;
  }

  if (valid) {
    setSessionStatus("active");
    markExtended();
    startSessionKeepAlive();
  } else {
    setSessionStatus("unverified");
    showAlert("danger", "Server tidak merespons. Data di bawah berasal dari penyimpanan lokal browser.");
  }
});