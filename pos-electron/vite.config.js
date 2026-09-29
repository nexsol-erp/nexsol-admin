import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // "./" makes all asset URLs relative so they resolve correctly from
  // file:// in the packaged Electron ASAR. Without this, Vite emits
  // absolute paths like /assets/index.js which fail under file://.
  base: "./",
  define: {
    // Only a fallback for running the bundle outside Electron. The desktop app always gets its
    // server at runtime from electron/serverConfig.js (window.POS.apiServer).
    "import.meta.env.VITE_API_SERVER": JSON.stringify(process.env.VITE_API_SERVER || ""),
    "import.meta.env.VITE_APP_VERSION": JSON.stringify(process.env.npm_package_version || "1.0.0"),
  },
  server: {
    proxy: {
      "/api": {
        target: "https://www.tradelink247.com",
        changeOrigin: true,
        secure: true,
      },
      "/ai-service": {
        target: "https://www.tradelink247.com",
        changeOrigin: true,
      },
    }
  }
});
