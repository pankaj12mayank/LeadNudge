import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const port = Number(env.VITE_DEV_PORT || env.FRONTEND_PORT || 5173);
  const proxyTarget = (
    env.VITE_PROXY_TARGET || "http://127.0.0.1:8000"
  ).replace(/\/$/, "");

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
