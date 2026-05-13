// In Vite dev mode (npm run dev) we use relative paths so the Vite proxy
// forwards /api/* to localhost:8084.  In a production build the Vite proxy
// does not exist, so we must prefix every request with the configured API
// server URL (set at build time via VITE_API_SERVER env var).
const BASE = import.meta.env.DEV ? "" : (import.meta.env.VITE_API_SERVER || "");

export function apiUrl(path) {
  return BASE + path;
}
