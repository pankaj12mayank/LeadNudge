import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Written by backend/run_prod.py when the API starts (especially BACKEND_PORT=0). */
function readBackendPortFile() {
  const p = path.resolve(__dirname, "..", ".backend-port");
  try {
    const s = fs.readFileSync(p, "utf8").trim();
    if (/^\d+$/.test(s)) return parseInt(s, 10);
  } catch {
    /* missing or unreadable */
  }
  return null;
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const port = Number(env.VITE_DEV_PORT || env.FRONTEND_PORT || 5173);
  const filePort = readBackendPortFile();
  let proxyTarget = env.VITE_PROXY_TARGET?.trim();
  if (!proxyTarget && filePort != null) {
    proxyTarget = `http://127.0.0.1:${filePort}`;
  }
  proxyTarget = (proxyTarget || "http://127.0.0.1:8000").replace(/\/$/, "");

  return {
    plugins: [react()],
    server: {
      port: Number.isFinite(port) ? port : 5173,
      proxy: {
        "/api": {
          target: proxyTarget,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, ""),
        },
        "/static": {
          target: proxyTarget,
          changeOrigin: true,
        },
      },
    },
  };
});
