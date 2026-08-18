import { defineConfig } from "vite";

export default defineConfig({
  server: {
    port: 5173,
    open: false,
    host: false,
  },
  build: {
    target: "es2020",
    outDir: "dist",
    sourcemap: true,
  },
});
