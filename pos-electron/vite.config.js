import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  define: {
    "import.meta.env.VITE_API_SERVER": JSON.stringify(process.env.VITE_API_SERVER || "http://localhost:8084"),
  },
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:8084",
        changeOrigin: true
      }
    }
  }
});
