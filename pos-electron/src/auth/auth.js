// src/auth/auth.js

export function getToken() {
  return localStorage.getItem("jwtToken") || "";
}

export function getTenancyId() {
  return localStorage.getItem("tenancyId") || "";
}

export function isLoggedIn() {
  return !!getToken() && !!getTenancyId();
}

export function logout() {
  localStorage.removeItem("jwtToken");
  localStorage.removeItem("tenancyId");
  localStorage.removeItem("roles");
  localStorage.removeItem("allowedBranches");
  window.POS?.setUserRoles?.([]);
}

export function decodeJwtPayload(token) {
  try {
    if (!token) return null;
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(base64.length + (4 - (base64.length % 4)) % 4, "=");

    const json = atob(padded);
    return JSON.parse(json);
  } catch {
    return null;
  }
}
