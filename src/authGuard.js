// Returns the browser to the login page when the server ends this sign-in.
//
// The server answers 401 with an X-Auth-Error header when a session was signed out by a
// platform admin, expired after inactivity, or the user/tenant was disabled. Screens call the
// API with plain fetch and several axios instances, so instead of touching each one this
// watches every fetch and XMLHttpRequest (which axios uses) for that header.

const AUTH_KEYS = [
  "jwtToken",
  "partialToken",
  "roles",
  "tenancyId",
  "branchCode",
  "allowedBranches",
  "pendingTenants",
  "setupCompleted",
  "platformAdmin",
];

export const SIGN_OUT_REASON_KEY = "signOutReason";

const REASONS = {
  "signed-out": "You were signed out. Please sign in again.",
  "session-expired": "Your session expired. Please sign in again.",
  "account-disabled": "This user has been disabled. Please contact your administrator.",
  "tenant-suspended": "This account's subscription is suspended. Please contact TradeLink247 support.",
};

/** Clears the stored sign-in without asking the server (used after the server already ended it). */
export function clearSignIn() {
  AUTH_KEYS.forEach((k) => localStorage.removeItem(k));
  clearSignOutReason();
}

/** Logout button: ends the session on the server, then clears the browser. */
export async function signOut() {
  const token = localStorage.getItem("jwtToken");
  if (token) {
    try {
      await fetch("/api/auth/logout", { method: "POST", headers: { Authorization: `Bearer ${token}` } });
    } catch {
      // Offline or server down: the browser still signs out, the session expires on its own.
    }
  }
  clearSignIn();
  window.location.href = "/login";
}

let handling = false;

function onAuthError(code) {
  if (!code || handling || !localStorage.getItem("jwtToken")) return;
  handling = true;
  clearSignIn();
  try {
    sessionStorage.setItem(SIGN_OUT_REASON_KEY, REASONS[code] || REASONS["session-expired"]);
  } catch {
    // sessionStorage unavailable: the login page just shows no reason.
  }
  window.location.href = "/login";
}

export function readSignOutReason() {
  try {
    return sessionStorage.getItem(SIGN_OUT_REASON_KEY);
  } catch {
    return null;
  }
}

/** Called after a successful sign-in so the reason is not shown again. */
export function clearSignOutReason() {
  try {
    sessionStorage.removeItem(SIGN_OUT_REASON_KEY);
  } catch {
    // ignore
  }
}

export function installAuthGuard() {
  if (typeof window === "undefined" || window.__authGuardInstalled) return;
  window.__authGuardInstalled = true;

  const originalFetch = window.fetch.bind(window);
  window.fetch = async (...args) => {
    const res = await originalFetch(...args);
    if (res.status === 401) onAuthError(res.headers.get("X-Auth-Error"));
    return res;
  };

  const originalOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (...args) {
    this.addEventListener("load", () => {
      if (this.status === 401) onAuthError(this.getResponseHeader("X-Auth-Error"));
    });
    return originalOpen.apply(this, args);
  };
}
