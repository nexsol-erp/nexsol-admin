// Priority for the API base URL:
//  1. Dev mode            → "" (Vite proxy forwards /api/* to localhost:8084)
//  2. Runtime pos-config  → window.POS.apiServer (read from pos-config.json by preload)
//  3. Build-time env var  → import.meta.env.VITE_API_SERVER
//  4. Fallback            → "" (relative, relies on webRequest intercept)
export function apiUrl(path) {
  if (import.meta.env.DEV) return path;
  const runtime = typeof window !== "undefined" ? window.POS?.apiServer : null;
  const base = runtime || import.meta.env.VITE_API_SERVER || "";
  return base + path;
}
