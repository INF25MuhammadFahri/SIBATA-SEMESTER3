// Daftar peran yang dikenal client. Nilai (value) harus sama dengan yang disimpan di kolom `role` server.
// Dipakai oleh nav.js, user_account.js, dan account_manager.js.

export const ROLE_OPTIONS = [
  { value: "admin", label: "Administrator" },
  { value: "manager", label: "manajer" },
];

export const ROLE_LABELS = Object.fromEntries(ROLE_OPTIONS.map((r) => [r.value, r.label]));

export function roleLabel(role) {
  const key = String(role).toLowerCase();
  return ROLE_LABELS[key] || String(role);
}

export function roleBadgeClass(role) {
  const key = String(role).toLowerCase();
  if (key === "admin") return "badge badge-gold";
  if (key === "visitor") return "badge badge-neutral";
  return "badge badge-primary";
}