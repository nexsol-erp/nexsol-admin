import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // "./" makes all asset URLs relative so they resolve correctly from
  // file:// in the packaged Electron ASAR. Without this, Vite emits
  // absolute paths like /assets/index.js which fail under file://.
  base: "./",
  define: {
    "import.meta.env.VITE_API_SERVER": JSON.stringify(process.env.VITE_API_SERVER || "http://localhost:8084"),
    "import.meta.env.VITE_APP_VERSION": JSON.stringify(process.env.npm_package_version || "1.0.0"),
  },
  server: {
    proxy: {
      "/api": {
        target: "https://www.tradelink247.com",
        changeOrigin: true,
        secure: true,
      }
    }
  }
});
