import { defineConfig } from "vite";

// Tauri 期望相对路径的静态资源，且开发时由 Tauri 的 dev server 代理
export default defineConfig({
  base: "./",
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    // Tauri 期望固定端口，并允许从 Tauri 的 webview 访问
    host: "localhost",
    hmr: {
      protocol: "ws",
      host: "localhost",
      port: 1421,
    },
    watch: {
      // 忽略 src-tauri 下的 Rust 文件，避免触发 vite 重启
      ignored: ["**/src-tauri/**"],
    },
  },
  build: {
    target: "es2021",
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: "index.html",
        settings: "settings.html",
      },
    },
  },
});
