import axios from "axios";
import { toast } from "sonner";
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
  // Let the browser set multipart boundary; default JSON Content-Type breaks logo/favicon uploads.
  if (config.data instanceof FormData && config.headers) {
    if (typeof config.headers.delete === "function") {
      config.headers.delete("Content-Type");
    } else {
      delete config.headers["Content-Type"];
    }
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    const status = err.response?.status;

    if (status === 403) {
      const d = err.response?.data?.detail;
      const msg = typeof d === "string" ? d : "";
      const lower = msg.toLowerCase();
      // Quota / AI limits must not clear the session — only block specific actions server-side.
      if (
        lower.includes("quota exhausted") ||
        lower.includes("ai message quota") ||
        (lower.includes("quota") && lower.includes("exhausted")) ||
        lower.includes("workspace plan has expired") ||
        lower.includes("ai follow-ups and message generation are disabled") ||
        lower.includes("your usage limit is reached") ||
        lower.includes("your plan has expired")
      ) {
        const error = new Error(msg);
        error.status = status;
        error.original = err;
        return Promise.reject(error);
      }
      if (
        lower.includes("blocked your account") ||
        lower.includes("deactivated") ||
        lower.includes("account is inactive")
      ) {
        clearSession();
        if (!window.location.pathname.startsWith("/login")) {
          toast.error(
            lower.includes("blocked your account")
              ? msg
              : "Your account has been deactivated.",
          );
          window.location.replace("/login");
        }
        return Promise.reject(err);
      }
    }

    if (status === 401) {
      clearSession();
      if (!window.location.pathname.startsWith("/login")) {
        toast.error("Your session expired. Please sign in again.");
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
