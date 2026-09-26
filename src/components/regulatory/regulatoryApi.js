// regulatoryApi.js
// Calls to /api/{tenant}/regulatory on server-postgres (the regulatory integration framework:
// tax authority e-invoicing providers, their credentials, and invoice submissions).
// Every call resolves to { ok, data, message } so screens only decide what to show.

const authHeaders = () => ({
  Authorization: `Bearer ${localStorage.getItem("jwtToken")}`,
});

const base = () => `/api/${localStorage.getItem("tenancyId")}/regulatory`;

async function call(path, { method = "GET", body } = {}) {
  try {
    const res = await fetch(`${base()}${path}`, {
      method,
      headers: body === undefined ? authHeaders() : { ...authHeaders(), "Content-Type": "application/json" },
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
