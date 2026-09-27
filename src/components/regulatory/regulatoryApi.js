// regulatoryApi.js
// Calls to /api/{tenant}/regulatory on server-postgres (the regulatory integration framework:
// tax authority e-invoicing providers, their credentials, and invoice submissions).
// Every call resolves to { ok, data, message } so screens only decide what to show.

const authHeaders = () => ({
  Authorization: `Bearer ${localStorage.getItem("jwtToken")}`,
});

const base = () => `/api/${localStorage.getItem("tenancyId")}/regulatory`;

async function call(path, { method = "GET", body, headers = {} } = {}) {
  try {
    const res = await fetch(`${base()}${path}`, {
      method,
      headers: body === undefined
        ? { ...authHeaders(), ...headers }
        : { ...authHeaders(), ...headers, "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      const message =
        (data && data.message) ||
        (res.status === 403 ? "Only an admin can do this." : `The server answered ${res.status}.`);
      return { ok: false, data, message };
    }
    return { ok: true, data, message: null };
  } catch (e) {
    console.error(`Regulatory call ${method} ${path} failed:`, e);
    return { ok: false, data: null, message: "Could not reach the server. Please try again." };
  }
}

const enc = encodeURIComponent;

export const listProviders = () => call("/providers");
export const listConfigs = () => call("/config");
export const saveConfig = (provider, body) => call(`/config/${enc(provider)}`, { method: "PUT", body });
export const setCredential = (provider, key, value) =>
  call(`/config/${enc(provider)}/credentials/${enc(key)}`, { method: "PUT", body: { value } });
export const removeCredential = (provider, key) =>
  call(`/config/${enc(provider)}/credentials/${enc(key)}`, { method: "DELETE" });
export const testConnection = (provider) => call(`/config/${enc(provider)}/test`, { method: "POST" });
export const onboard = (provider, input) => call(`/config/${enc(provider)}/onboard`, { method: "POST", body: input });
export const readiness = (provider) => call(`/readiness/${enc(provider)}`);
export const auditLog = (provider) => call(`/config/${enc(provider)}/audit`);

export const dashboard = (params) => call(`/dashboard?${new URLSearchParams(clean(params))}`);
export const listSubmissions = (params) => call(`/submissions?${new URLSearchParams(clean(params))}`);
export const submissionDetail = (id) => call(`/submissions/${enc(id)}`);
export const retrySubmission = (id) => call(`/submissions/${enc(id)}/retry`, { method: "POST" });
export const refreshSubmission = (id) => call(`/submissions/${enc(id)}/refresh-status`, { method: "POST" });
export const cancelSubmission = (id, reason) =>
  call(`/submissions/${enc(id)}/cancel`, { method: "POST", body: { reason } });

// ---- periodic tax returns (HMRC Making Tax Digital VAT) ----

// HMRC's fraud prevention rules want facts about the browser on every call. A random device id
// is kept in this browser; the server adds the public IP and port it saw.
const DEVICE_KEY = "regulatoryDeviceId";

const deviceId = () => {
  let id = null;
  try {
    id = localStorage.getItem(DEVICE_KEY);
    if (!id) {
      id = window.crypto?.randomUUID
        ? window.crypto.randomUUID()
        : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
            const r = (Math.random() * 16) | 0;
            return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
          });
      localStorage.setItem(DEVICE_KEY, id);
    }
  } catch (e) {
    // Private mode: send no device id rather than a new one each call.
  }
  return id;
};

const timezone = () => {
  const minutes = -new Date().getTimezoneOffset();
  const sign = minutes >= 0 ? "+" : "-";
  const abs = Math.abs(minutes);
  const pad = (n) => String(n).padStart(2, "0");
  return `UTC${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`;
};

export const clientInfoHeaders = () => {
  const h = {
    "X-Client-Browser-JS-User-Agent": navigator.userAgent,
    "X-Client-Screens": `width=${window.screen.width}&height=${window.screen.height}`
      + `&scaling-factor=${window.devicePixelRatio || 1}&colour-depth=${window.screen.colorDepth}`,
    "X-Client-Window-Size": `width=${window.innerWidth}&height=${window.innerHeight}`,
    "X-Client-Timezone": timezone(),
  };
  const id = deviceId();
  if (id) h["X-Client-Device-ID"] = id;
  return h;
};

const tr = (provider) => `/tax-returns/${enc(provider)}`;
const withClient = (opts = {}) => ({ ...opts, headers: clientInfoHeaders() });

export const taxObligations = (provider, params) =>
  call(`${tr(provider)}/obligations?${new URLSearchParams(clean(params))}`, withClient());
export const taxReturnDraft = (provider, params) =>
  call(`${tr(provider)}/draft?${new URLSearchParams(clean(params))}`);
export const submitTaxReturn = (provider, body) => call(tr(provider), withClient({ method: "POST", body }));
export const taxReturnHistory = (provider) => call(tr(provider));
export const filedTaxReturn = (provider, periodKey) => call(`${tr(provider)}/filed/${enc(periodKey)}`, withClient());
export const taxLiabilities = (provider, params) =>
  call(`${tr(provider)}/liabilities?${new URLSearchParams(clean(params))}`, withClient());
export const taxPayments = (provider, params) =>
  call(`${tr(provider)}/payments?${new URLSearchParams(clean(params))}`, withClient());
export const checkClientInfo = (provider) => call(`${tr(provider)}/client-info-check`, withClient());

function clean(params) {
  const out = {};
  Object.entries(params || {}).forEach(([k, v]) => {
    if (v !== undefined && v !== null && String(v).trim() !== "") out[k] = String(v).trim();
  });
  return out;
}

export const SUCCESS_STATUSES = ["ACCEPTED", "CLEARED", "REPORTED"];
export const FAILED_STATUSES = ["REJECTED", "FAILED", "VALIDATION_FAILED"];
export const ALL_STATUSES = [
  "NEW", "VALIDATING", "VALIDATION_FAILED", "READY", "QUEUED", "SUBMITTING", "SUBMITTED", "PENDING",
  "ACCEPTED", "CLEARED", "REPORTED", "REJECTED", "FAILED", "RETRY_PENDING", "CANCELLED",
];

export const statusColor = (s) =>
  SUCCESS_STATUSES.includes(s) ? "success" : FAILED_STATUSES.includes(s) ? "error" : s === "CANCELLED" ? "default" : "warning";

export const formatDateTime = (v) => (v ? String(v).replace("T", " ").slice(0, 16) : "");
