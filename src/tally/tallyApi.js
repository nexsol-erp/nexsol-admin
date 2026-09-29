// Calls to /api/{tenant}/tally-sync (Tally integration: settings, ledger mapping, connectors and
// sync status). Every call resolves to { ok, data, message }.

const authHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem("jwtToken")}` });
const tenant = () => localStorage.getItem("tenancyId");

async function call(path, { method = "GET", body } = {}) {
  try {
    const res = await fetch(`/api/${tenant()}/tally-sync${path}`, {
      method,
      headers: body === undefined ? authHeaders() : { ...authHeaders(), "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      const message = (data && data.message)
        || (res.status === 403 ? "Only an admin can do this." : `The server answered ${res.status}.`);
      return { ok: false, data, message };
    }
    return { ok: true, data, message: null };
  } catch (e) {
    return { ok: false, data: null, message: "Could not reach the server. Please try again." };
  }
}

const qs = (params) => {
  const parts = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== "" && v !== false)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`);
  return parts.length ? `?${parts.join("&")}` : "";
};

export const getSettings = () => call("/settings");
export const saveSettings = (settings) => call("/settings", { method: "PUT", body: settings });
export const getLedgerMap = () => call("/ledger-map");
export const saveLedgerMap = (rows) => call("/ledger-map", { method: "PUT", body: rows });
export const getMasters = () => call("/masters");
export const refreshMasters = () => call("/masters/refresh", { method: "POST" });

export const getConnectors = () => call("/connectors");
export const addConnector = (name) => call("/connectors", { method: "POST", body: { name } });
export const newPairingCode = (id) => call(`/connectors/${id}/pairing-code`, { method: "POST" });
export const renameConnector = (id, name) => call(`/connectors/${id}`, { method: "PUT", body: { name } });
export const revokeConnector = (id) => call(`/connectors/${id}`, { method: "DELETE" });

export const getStatus = () => call("/status");
export const listItems = (filters) => call(`/items${qs(filters)}`);
export const getItem = (id) => call(`/items/${id}`);
export const previewItem = (id) => call(`/items/${id}/preview`);
export const actOnItems = (action, ids) => call("/items/actions", { method: "POST", body: { action, ids } });
export const retryFailed = () => call("/items/retry-failed", { method: "POST" });
export const resync = (from, to, resendAll) => call(`/resync${qs({ from, to, resendAll })}`, { method: "POST" });
export const syncNow = () => call("/sync-now", { method: "POST" });

/** Where the Tally Connector installer is published on this server. */
export const CONNECTOR_DOWNLOAD = "/api/updates/tally-connector/download";

export const CATEGORY_LABELS = {
  SALES: "Sales",
  SALES_RECEIPT: "POS receipts",
  PURCHASE: "Purchases",
  RECEIPT: "Receipts",
  PAYMENT: "Payments",
  JOURNAL: "Journals",
  CONTRA: "Contra",
  CREDIT_NOTE: "Credit notes",
  DEBIT_NOTE: "Debit notes",
};

export const STATUS_LABELS = {
  PENDING: "Pending",
  IN_FLIGHT: "Sending",
  SYNCED: "In Tally",
  FAILED: "Failed",
  SKIPPED: "Skipped",
};

/** Tally's reserved groups, offered in the ledger mapping next to whatever Tally sends. */
export const TALLY_GROUPS = [
  "Bank Accounts", "Bank OD A/c", "Branch / Divisions", "Capital Account", "Cash-in-Hand", "Current Assets",
  "Current Liabilities", "Deposits (Asset)", "Direct Expenses", "Direct Incomes", "Duties & Taxes", "Fixed Assets",
  "Indirect Expenses", "Indirect Incomes", "Investments", "Loans & Advances (Asset)", "Loans (Liability)",
  "Misc. Expenses (ASSET)", "Provisions", "Purchase Accounts", "Reserves & Surplus", "Sales Accounts",
  "Secured Loans", "Stock-in-Hand", "Sundry Creditors", "Sundry Debtors", "Suspense A/c", "Unsecured Loans",
];
