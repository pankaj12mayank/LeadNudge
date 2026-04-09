import axios from "axios";
import { API_BASE_URL, STORAGE_KEYS } from "../utils/constants";

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { "Content-Type": "application/json" },
  timeout: 120000,
});

function clearSession() {
  localStorage.removeItem(STORAGE_KEYS.token);
  localStorage.removeItem(STORAGE_KEYS.role);
  localStorage.removeItem(STORAGE_KEYS.email);
}

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(STORAGE_KEYS.token);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    const status = err.response?.status;

    if (status === 401) {
      clearSession();
      if (!window.location.pathname.startsWith("/login")) {
        window.location.replace("/login");
      }
    }

    const d = err.response?.data?.detail;
    let msg;
    if (Array.isArray(d)) {
      msg = d
        .map((x) =>
          typeof x === "object" && x?.msg ? x.msg : JSON.stringify(x)
        )
        .join(", ");
    } else if (typeof d === "string") {
      msg = d;
    } else {
      msg = d != null ? JSON.stringify(d) : null;
    }
    if (!msg) {
      if (err.code === "ECONNABORTED") {
        msg = "Request timed out. Check the API server and network.";
      } else if (!err.response) {
        msg =
          "Cannot reach the API. Confirm the backend is running and VITE_API_URL (or Vite proxy) is correct.";
      } else {
        msg = err.message || "Request failed";
      }
    }
    const error = new Error(msg);
    error.status = status;
    error.original = err;
    return Promise.reject(error);
  }
);

export default api;
