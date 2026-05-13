import { resolve } from "path";
import { defineConfig, externalizeDepsPlugin } from "electron-vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      outDir: "out/main",
      rollupOptions: {
        input: resolve(__dirname, "main/index.ts"),
      },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      outDir: "out/preload",
      rollupOptions: {
        input: resolve(__dirname, "preload/index.ts"),
      },
    },
  },
  renderer: {
    root: resolve(__dirname, "../web"),
    build: {
      outDir: resolve(__dirname, "out/renderer"),
      rollupOptions: {
        input: resolve(__dirname, "../web/index.html"),
      },
    },
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        "@": resolve(__dirname, "../web/src"),
      },
    },
    define: {
      "import.meta.env.VITE_API_URL": JSON.stringify("http://127.0.0.1:18789"),
      "import.meta.env.VITE_WS_URL": JSON.stringify("ws://127.0.0.1:18789/ws/chat"),
    },
    server: {
      port: 5173,
      proxy: {
        "/api": {
          target: "http://127.0.0.1:18789",
          changeOrigin: true,
        },
        "/ws": {
          target: "http://127.0.0.1:18789",
          ws: true,
        },
      },
    },
  },
});
