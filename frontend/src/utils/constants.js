export const API_BASE_URL =
  import.meta.env.VITE_API_URL?.replace(/\/$/, "") || "/api";

export const STORAGE_KEYS = {
  token: "ais_token",
  role: "ais_role",
  email: "ais_email",
};
