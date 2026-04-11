/** Dev default `/api` uses Vite proxy. If VITE_API_URL is set, it must be the API origin only (no `/api` suffix — FastAPI serves `/admin/...` at the root). */
function apiBaseUrl() {
  const raw = import.meta.env.VITE_API_URL;
  if (raw == null || String(raw).trim() === "") return "/api";
  let u = String(raw).trim().replace(/\/$/, "");
  if (u.endsWith("/api")) u = u.slice(0, -4).replace(/\/$/, "");
  return u || "/api";
}

export const API_BASE_URL = apiBaseUrl();

export const STORAGE_KEYS = {
  token: "ais_token",
  role: "ais_role",
  email: "ais_email",
  displayName: "ais_display_name",
};
