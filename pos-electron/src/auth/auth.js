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

// ── Branch lock ───────────────────────────────────────────────────────────────
// Locks this installation to the first normal user that logs in.
// Stored as { userCode, branchCode } (both lowercase) in localStorage.
// Admins bypass the lock; only an admin can clear it to allow re-assignment.

const BRANCH_LOCK_KEY = "posDeviceBranchLock";

export function getBranchLock() {
  try {
    const raw = localStorage.getItem(BRANCH_LOCK_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export function setBranchLock(userCode, branchCode) {
  localStorage.setItem(BRANCH_LOCK_KEY, JSON.stringify({
    userCode:   userCode.trim().toLowerCase(),
    branchCode: branchCode.trim().toLowerCase(),
  }));
}

export function clearBranchLock() {
  localStorage.removeItem(BRANCH_LOCK_KEY);
}

export function isAdminRole(roles) {
  return Array.isArray(roles) && roles.some((r) =>
    ["ADMIN", "admin", "SYSTEM_ADMIN", "system-admin"].includes(r)
  );
}
