// Priority for the API base URL:
//  1. Dev mode            → "" (Vite proxy forwards /api/* to localhost:8084)
//  2. Runtime server      → window.POS.apiServer (electron/serverConfig.js, via preload)
//  3. Build-time env var  → import.meta.env.VITE_API_SERVER
//  4. Fallback            → "" (relative, relies on webRequest intercept)
export function apiUrl(path) {
  if (import.meta.env.DEV) return path;
  const runtime = typeof window !== "undefined" ? window.POS?.apiServer : null;
  const base = runtime || import.meta.env.VITE_API_SERVER || "";
  return base + path;
}

// Priority for the AI service base URL:
//  1. Dev mode       → "" (Vite proxy forwards /ai-service/* to localhost:8001)
//  2. Runtime server → window.POS.aiServer (electron/serverConfig.js, via preload)
//  3. Build-time env → import.meta.env.VITE_AI_SERVER
//  4. Fallback       → "" (relative)
export function aiUrl(path) {
  if (import.meta.env.DEV) return path;
  const runtime = typeof window !== "undefined" ? window.POS?.aiServer : null;
  const base = runtime || import.meta.env.VITE_AI_SERVER || "";
  return base + path;
}
