
import {
  isLoggedIn,
  getAuthHeaders,
  getAuthUser,
  extendSession,
  startSessionKeepAlive,
  initNavbarAuth
} from "./auth.js";

// ============================================================
// Konfigurasi
// ============================================================

const API_URL = "/api/accounts";
const PAGE_SIZE = 10;
const MIN_PASSWORD_LENGTH = 8;
const USERNAME_PATTERN = /^[a-zA-Z0-9_.-]{3,32}$/;

// Sesuaikan daftar ini jika role yang digunakan server berbeda.
const ROLE_OPTIONS = [
  { value: "admin", label: "Administrator" },
  { value: "manager", label: "manajer" },
  { value: "visitor", label: "Pengunjung" }
];

const state = {
  page: 1,
  search: "",
  accounts: [],
  hasNext: false,
  total: null,
  me: null,
  editing: null,
  selected: new Set(),
  loading: false
};

const $ = (id) => document.getElementById(id);

// ============================================================
// Role helper
// ============================================================

/**
 * Mengubah berbagai format role menjadi array string.
 *
 * Mendukung:
 * - "admin"
 * - ["admin", "staff"]
 * - '["admin","staff"]'
 * - "admin,staff"
 *
 * @param {string|string[]|null|undefined} value
 * @returns {string[]}
 */
function normalizeRoles(value) {
  if (Array.isArray(value)) {
    return value
      .filter(role => typeof role === "string")
      .map(role => role.trim().toLowerCase())
      .filter(Boolean);
  }

  if (typeof value !== "string" || !value.trim()) {
    return [];
  }

  const text = value.trim();

  try {
    const parsed = JSON.parse(text);

    if (Array.isArray(parsed)) {
      return normalizeRoles(parsed);
    }

    if (typeof parsed === "string") {
      return normalizeRoles(parsed);
    }
  } catch {
    // Bukan JSON, lanjutkan sebagai string biasa.
  }

  return text
    .split(",")
    .map(role => role.trim().toLowerCase())
    .filter(Boolean);
}

function roleLabel(role) {
  const option = ROLE_OPTIONS.find(
    item => item.value === role
  );

  return option?.label ?? role;
}

function roleBadgeClass(role) {
  switch (role) {
    case "admin":
      return "badge badge-primary";

    case "staff":
      return "badge badge-success";

    case "visitor":
      return "badge badge-neutral";

    default:
      return "badge badge-neutral";
  }
}

// ============================================================
// Proteksi halaman
// ============================================================

/**
 * Melindungi halaman berdasarkan role.
 *
 * @param {string|string[]} requiredRoles
 * @returns {Promise<boolean>}
 */
async function protectByRole(requiredRoles) {
  if (!isLoggedIn()) {
    window.location.replace(
      "login?redirect=account_manager"
    );
    return false;
  }

  const valid = await extendSession();

  if (!valid) {
    if (!isLoggedIn()) {
      window.location.replace(
        "login?redirect=account_manager"
      );
    } else {
      alert("Tidak dapat memverifikasi sesi ke server.");
    }

    return false;
  }

  const user = getAuthUser();

  if (!user) {
    window.location.replace(
      "login?redirect=account_manager"
    );
    return false;
  }

  const userRoles = normalizeRoles(user.role);

  const allowedRoles = normalizeRoles(
    Array.isArray(requiredRoles)
      ? requiredRoles
      : [requiredRoles]
  );

  const allowed = allowedRoles.some(role =>
    userRoles.includes(role)
  );

  if (!allowed) {
    alert("Anda tidak memiliki izin untuk mengakses halaman ini.");
    window.location.replace("index.html");
    return false;
  }

  startSessionKeepAlive();
  return true;
}

// ============================================================
// Helper UI
// ============================================================

function showAlert(type, message) {
  const box = $("am-alert");

  box.className = `account-alert ${type}`;
  box.textContent = message;
  box.hidden = false;
}

function hideAlert() {
  $("am-alert").hidden = true;
}

function showFormAlert(message) {
  const box = $("am-form-alert");

  box.textContent = message;
  box.hidden = false;
}

function hideFormAlert() {
  $("am-form-alert").hidden = true;
}

function el(tag, className = "", text) {
  const node = document.createElement(tag);

  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;

  return node;
}

function normalizeAccount(raw) {
  return {
    id: String(raw.id ?? ""),
    username: String(raw.username ?? ""),
    displayName: String(
      raw.display_name ?? raw.displayName ?? ""
    ),
    roles: normalizeRoles(raw.roles ?? raw.role)
  };
}

function isSelf(account) {
  return Boolean(state.me) &&
    account.username.toLowerCase() ===
    state.me.username.toLowerCase();
}

// ============================================================
// Komunikasi API
// ============================================================

/**
 * Melakukan request ke API akun.
 *
 * @param {string} method
 * @param {{body?: any, query?: string}} options
 */
async function api(method, { body, query = "" } = {}) {
  let response;

  try {
    response = await fetch(`${API_URL}${query}`, {
      method,
      headers: getAuthHeaders(),
      body: body === undefined
        ? undefined
        : JSON.stringify(body)
    });
  } catch (error) {
    console.error("API connection error:", error);

    return {
      ok: false,
      status: 0,
      json: null,
      total: null,
      networkError: true
    };
  }

  let json = null;

  try {
    json = await response.json();
  } catch {
    alert("gagal parse")
    // Respons mungkin tidak memiliki JSON.
  }

  if (response.status === 401) {
    alert("Sesi login telah berakhir. Silakan masuk kembali.");

    window.location.replace(
      "login?redirect=account_manager"
    );
  }

  const totalHeader = response.headers.get("X-Total-Count");
  const total = totalHeader !== null
    ? Number(totalHeader)
    : null;

  return {
    ok: response.ok,
    status: response.status,
    json,
    total: Number.isFinite(total) ? total : null
  };
}

function errorText(result, fallback) {
  if (result.networkError) {
    return "Gagal menghubungi server. Pastikan server aktif.";
  }

  const json = result.json;

  const message =
    json?.message ??
    (typeof json?.data === "string" ? json.data : null);

  if (message) return message;

  if (result.status === 403) {
    return "Hanya akun dengan peran admin yang boleh melakukan ini.";
  }

  return fallback;
}

// ============================================================
// Memuat daftar akun
// ============================================================

async function loadAccounts() {
  if (state.loading) return;

  state.loading = true;

  const tbody = $("am-table-body");
  tbody.textContent = "";

  const loadingRow = el("tr");
  const loadingCell = el(
    "td",
    "table-empty",
    "Memuat data akun..."
  );

  loadingCell.colSpan = 4;
  loadingRow.appendChild(loadingCell);
  tbody.appendChild(loadingRow);

  try {
    const params = new URLSearchParams({
      page: String(state.page),
      size: String(PAGE_SIZE)
    });

    if (state.search) {
      params.set("search", state.search);
    }

    const result = await api("GET", {
      query: `?${params.toString()}`
    });

    if (!result.ok) {
      renderTableError(
        errorText(result, "Gagal memuat daftar akun.")
      );
      return;
    }

    const list = Array.isArray(result.json?.data)
      ? result.json.data
      : [];

    // Jika halaman terakhir kosong, mundur satu halaman.
    if (list.length === 0 && state.page > 1) {
      state.page--;
      state.loading = false;
      return loadAccounts();
    }

    state.accounts = list.map(normalizeAccount);
    state.total = result.total;

    state.hasNext = state.total !== null
      ? state.page * PAGE_SIZE < state.total
      : list.length === PAGE_SIZE;

    state.selected.clear();

    renderTable();
  } finally {
    state.loading = false;
  }
}

function renderTableError(message) {
  const tbody = $("am-table-body");
  tbody.textContent = "";

  const row = el("tr");
  const cell = el("td", "table-empty", message);

  cell.colSpan = 4;
  cell.style.color = "var(--danger-color)";

  row.appendChild(cell);
  tbody.appendChild(row);

  $("am-count").textContent = "-";
}

// ============================================================
// Render tabel
// ============================================================

function renderTable() {
  const tbody = $("am-table-body");
  tbody.textContent = "";

  if (state.accounts.length === 0) {
    const row = el("tr");

    const cell = el(
      "td",
      "table-empty",
      state.search
        ? "Tidak ada akun yang cocok dengan pencarian."
        : "Belum ada akun."
    );

    cell.colSpan = 4;
    row.appendChild(cell);
    tbody.appendChild(row);
  }

  for (const account of state.accounts) {
    const self = isSelf(account);
    const tr = el("tr");

    tr.dataset.id = account.id;

    // Checkbox
    const tdCheck = el("td", "am-col-check");
    const checkbox = el("input", "table-checkbox");

    checkbox.type = "checkbox";
    checkbox.dataset.id = account.id;
    checkbox.disabled = self;
    checkbox.checked = state.selected.has(account.id);

    checkbox.title = self
      ? "Akun Anda sendiri tidak bisa dihapus"
      : `Pilih ${account.username}`;

    checkbox.addEventListener("change", () => {
      if (checkbox.checked) {
        state.selected.add(account.id);
      } else {
        state.selected.delete(account.id);
      }

      updateBatchBanner();
    });

    tdCheck.appendChild(checkbox);
    tr.appendChild(tdCheck);

    // Informasi pengguna
    const tdUser = el("td");

    const nameLine = el(
      "span",
      "cell-primary",
      account.displayName || account.username
    );

    if (self) {
      nameLine.appendChild(
        el("span", "badge badge-primary am-self-badge", "Anda")
      );
    }

    tdUser.appendChild(nameLine);
    tdUser.appendChild(
      el("span", "cell-sub", `@${account.username}`)
    );

    tr.appendChild(tdUser);

    // Role
    const tdRoles = el("td");
    const rolesWrap = el("div", "am-roles-cell");

    if (account.roles.length === 0) {
      rolesWrap.appendChild(
        el("span", "badge badge-neutral", "Tanpa peran")
      );
    }

    for (const role of account.roles) {
  rolesWrap.appendChild(
    el("span", roleBadgeClass(role), roleLabel(role)) // <-- Ubah tag pertamanya jadi "span"
  );
    }

    tdRoles.appendChild(rolesWrap);
    tr.appendChild(tdRoles);

    // Tombol aksi
    const tdActions = el("td");
    const group = el("div", "row-actions-group");

    group.style.justifyContent = "center";

    const btnEdit = el("button", "btn-row-edit", "Ubah");
    btnEdit.type = "button";
    btnEdit.addEventListener("click", () => {
      openModal(account);
    });

    const btnDelete = el("button", "btn-row-del", "Hapus");
    btnDelete.type = "button";
    btnDelete.disabled = self;

    btnDelete.addEventListener("click", () => {
      if (
        confirm(
          `Hapus akun "${account.username}"? Tindakan ini tidak bisa dibatalkan.`
        )
      ) {
        deleteAccounts([account.id]);
      }
    });

    group.append(btnEdit, btnDelete);
    tdActions.appendChild(group);
    tr.appendChild(tdActions);

    tbody.appendChild(tr);
  }

  $("am-check-all").checked = false;

  updateBatchBanner();
  updatePager();
}

// ============================================================
// Pagination dan pemilihan banyak akun
// ============================================================

function updatePager() {
  const count = state.accounts.length;

  const first = count === 0
    ? 0
    : (state.page - 1) * PAGE_SIZE + 1;

  const last = (state.page - 1) * PAGE_SIZE + count;

  const totalText = state.total !== null
    ? ` dari ${state.total}`
    : "";

  $("am-count").textContent = count === 0
    ? "0 akun"
    : `Menampilkan ${first}-${last}${totalText} akun`;

  $("am-page-label").textContent = `Halaman ${state.page}`;

  $("am-prev").disabled = state.page <= 1;
  $("am-next").disabled = !state.hasNext;
}

function updateBatchBanner() {
  const count = state.selected.size;

  $("am-selected-count").textContent = String(count);

  $("am-batch-banner").style.display =
    count > 0 ? "flex" : "none";

  document.querySelectorAll("#am-table-body tr").forEach(row => {
    row.classList.toggle(
      "row-selected",
      state.selected.has(row.dataset.id)
    );
  });
}

// ============================================================
// Hapus akun
// ============================================================

async function deleteAccounts(ids) {
  hideAlert();

  const result = await api("DELETE", {
    body: ids
  });

  if (!result.ok) {
    showAlert(
      "danger",
      errorText(result, "Gagal menghapus akun.")
    );
    return;
  }

  showAlert(
    "success",
    `${ids.length} akun berhasil dihapus.`
  );

  await loadAccounts();
}

// ============================================================
// Modal tambah / ubah
// ============================================================

function buildRoleOptions() {
  const wrap = $("am-role-options");
  wrap.textContent = "";

  for (const role of ROLE_OPTIONS) {
    const label = el("label", "role-option");
    const input = el("input");

    input.type = "checkbox";
    input.name = "am-role";
    input.value = role.value;

    label.append(
      input,
      el("span", "", role.label)
    );

    wrap.appendChild(label);
  }
}

function openModal(account = null) {
  state.editing = account;

  hideFormAlert();
  $("am-form").reset();

  const editing = Boolean(account);

  $("am-modal-title").textContent = editing
    ? "Ubah akun"
    : "Tambah akun";

  $("am-modal-sub").textContent = editing
    ? `Mengubah akun @${account.username}`
    : "Buat akun baru dan tentukan perannya.";

  $("am-submit").textContent = editing
    ? "Simpan perubahan"
    : "Simpan akun";

  $("am-id").value = editing ? account.id : "";
  $("am-username").value = editing ? account.username : "";
  $("am-username").disabled = editing;

  $("am-display-name").value = editing
    ? account.displayName
    : "";

  $("am-password").type = "password";
  $("am-toggle-password").textContent = "Lihat";

  $("am-password-required").hidden = editing;

  $("am-password").placeholder = editing
    ? "Kosongkan jika tidak diubah"
    : `Minimal ${MIN_PASSWORD_LENGTH} karakter`;

  $("am-password-help").textContent = editing
    ? "Isi hanya jika ingin mengganti kata sandi."
    : "";

  const selfEditing = editing && isSelf(account);

  const currentRoles = editing
    ? account.roles
    : ["visitor"];

  document.querySelectorAll('input[name="am-role"]').forEach(input => {
    input.checked = currentRoles.includes(input.value);

    // Tidak boleh mencabut role admin dari akun sendiri.
    input.disabled = selfEditing && input.value === "admin";
  });

  $("am-modal").classList.add("active");

  (editing
    ? $("am-display-name")
    : $("am-username")
  ).focus();
}

function closeModal() {
  $("am-modal").classList.remove("active");
  state.editing = null;
}

// ============================================================
// Simpan akun
// ============================================================

async function handleSubmit(event) {
  event.preventDefault();
  hideFormAlert();

  const editing = state.editing;

  const username = $("am-username").value.trim();
  const displayName = $("am-display-name").value.trim();
  const password = $("am-password").value;

  const roles = Array.from(
    document.querySelectorAll('input[name="am-role"]:checked')
  ).map(input => input.value);

  if (!editing && !USERNAME_PATTERN.test(username)) {
    showFormAlert(
      "Username harus 3-32 karakter dan hanya boleh berisi huruf, angka, titik, garis bawah, atau strip."
    );
    return;
  }

  if (!editing && password.length < MIN_PASSWORD_LENGTH) {
    showFormAlert(
      `Kata sandi minimal ${MIN_PASSWORD_LENGTH} karakter.`
    );
    return;
  }

  if (editing && password && password.length < MIN_PASSWORD_LENGTH) {
    showFormAlert(
      `Kata sandi baru minimal ${MIN_PASSWORD_LENGTH} karakter.`
    );
    return;
  }

  if (roles.length === 0) {
    showFormAlert("Pilih minimal satu peran.");
    return;
  }

  const submitBtn = $("am-submit");
  const originalLabel = submitBtn.textContent;

  submitBtn.disabled = true;
  submitBtn.textContent = "Menyimpan...";

  try {
    let result;

    if (editing) {
      const body = {
        id: editing.id,
        display_name: displayName,
        roles
      };

      if (password) {
        body.password = password;
      }

      result = await api("PUT", { body });
    } else {
      result = await api("POST", {
        body: {
          username,
          password,
          display_name: displayName,
          roles
        }
      });
    }

    if (!result.ok) {
      const fallback = result.status === 409
        ? "Username sudah dipakai akun lain."
        : "Gagal menyimpan akun.";

      showFormAlert(errorText(result, fallback));
      return;
    }

    closeModal();

    showAlert(
      "success",
      editing
        ? `Akun "${editing.username}" berhasil diperbarui.`
        : `Akun "${username}" berhasil dibuat.`
    );

    await loadAccounts();
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = originalLabel;
  }
}

// ============================================================
// Event handler
// ============================================================

function bindEvents() {
  // Pencarian
  let searchTimer = null;

  $("am-search").addEventListener("input", event => {
    clearTimeout(searchTimer);

    searchTimer = setTimeout(() => {
      state.search = event.target.value.trim();
      state.page = 1;

      loadAccounts();
    }, 300);
  });

  // Refresh
  $("am-refresh").addEventListener("click", () => {
    hideAlert();
    loadAccounts();
  });

  // Pagination
  $("am-prev").addEventListener("click", () => {
    if (state.page <= 1) return;

    state.page--;
    loadAccounts();
  });

  $("am-next").addEventListener("click", () => {
    if (!state.hasNext) return;

    state.page++;
    loadAccounts();
  });

  // Pilih semua
  $("am-check-all").addEventListener("change", event => {
    document.querySelectorAll(
      "#am-table-body .table-checkbox"
    ).forEach(checkbox => {
      if (checkbox.disabled) return;

      checkbox.checked = event.target.checked;

      if (checkbox.checked) {
        state.selected.add(checkbox.dataset.id);
      } else {
        state.selected.delete(checkbox.dataset.id);
      }
    });

    updateBatchBanner();
  });

  // Bersihkan pilihan
  $("am-clear-selection").addEventListener("click", () => {
    state.selected.clear();

    document.querySelectorAll(
      "#am-table-body .table-checkbox"
    ).forEach(checkbox => {
      checkbox.checked = false;
    });

    $("am-check-all").checked = false;

    updateBatchBanner();
  });

  // Hapus banyak akun
  $("am-delete-selected").addEventListener("click", () => {
    const ids = Array.from(state.selected);

    if (ids.length === 0) return;

    if (
      confirm(
        `Hapus ${ids.length} akun terpilih? Tindakan ini tidak bisa dibatalkan.`
      )
    ) {
      deleteAccounts(ids);
    }
  });

  // Modal
  $("am-add").addEventListener("click", () => {
    openModal();
  });

  $("am-modal-close").addEventListener("click", closeModal);
  $("am-cancel").addEventListener("click", closeModal);

  $("am-modal").addEventListener("click", event => {
    if (event.target === $("am-modal")) {
      closeModal();
    }
  });

  document.addEventListener("keydown", event => {
    if (
      event.key === "Escape" &&
      $("am-modal").classList.contains("active")
    ) {
      closeModal();
    }
  });

  // Tampilkan/sembunyikan password
  $("am-toggle-password").addEventListener("click", () => {
    const input = $("am-password");
    const show = input.type === "password";

    input.type = show ? "text" : "password";

    $("am-toggle-password").textContent =
      show ? "Sembunyikan" : "Lihat";
  });

  // Submit form
  $("am-form").addEventListener("submit", handleSubmit);
}

// ============================================================
// Inisialisasi
// ============================================================

document.addEventListener("DOMContentLoaded", async () => {
  initNavbarAuth();

  const allowed = await protectByRole("manager");

  if (!allowed) return;

  state.me = getAuthUser();

  buildRoleOptions();
  bindEvents();

  await loadAccounts();
});
