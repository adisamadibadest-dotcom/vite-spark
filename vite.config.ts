import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

export default defineConfig({
  envPrefix: ["VITE_", "EXPO_PUBLIC_"],
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: process.env.PORT ? parseInt(process.env.PORT) : 5000,
    host: "0.0.0.0",
    allowedHosts: "all",
    watch: {
      ignored: ["**/node_modules/**", "**/.local/share/pnpm/**", "**/pnpm/store/**"],
    },
    proxy: {
      "/api": {
        target: `http://localhost:${process.env.API_PORT ?? 3001}`,
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});
