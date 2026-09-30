import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // Relative asset URLs so the bundle loads from file:// inside the packaged app.
  base: "./",
  server: { port: 5174, strictPort: true },
});
