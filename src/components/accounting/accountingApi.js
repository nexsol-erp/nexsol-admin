const getHeaders = () => ({
  Authorization: `Bearer ${localStorage.getItem("jwtToken")}`,
  "Content-Type": "application/json",
});
const base = () => `/api/${localStorage.getItem("tenancyId")}`;

const api = {
  get: (path, params = {}) => {
    const qs = Object.entries(params)
      .filter(([, v]) => v !== null && v !== undefined && v !== "")
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join("&");
    return fetch(`${base()}${path}${qs ? "?" + qs : ""}`, { headers: getHeaders() }).then((r) => r.json());
  },
  post: (path, body) =>
    fetch(`${base()}${path}`, { method: "POST", headers: getHeaders(), body: JSON.stringify(body) }).then((r) => r.json()),
  del: (path) =>
    fetch(`${base()}${path}`, { method: "DELETE", headers: getHeaders() }),
};

// ── Ledger Accounts ───────────────────────────────────────────
export const getLedgerAccounts = () => api.get("/ledger-accounts");

// ── Suppliers ─────────────────────────────────────────────────
export const getSuppliers = () => api.get("/suppliers");

// ── Customers ─────────────────────────────────────────────────
export const getCustomers = () => api.get("/customers");

// ── Financial Year ────────────────────────────────────────────
export const getActiveFY = () => api.get("/financial-year/active");

// ── Phase 2: Receipts / Payments ──────────────────────────────
export const getCustomerOutstanding = (customerId) =>
  api.get(`/receipts/customer-outstanding/${customerId}`);
export const createReceipt = (dto) => api.post("/receipts", dto);

export const getSupplierOutstanding = (supplierId) =>
  api.get(`/payments/supplier-outstanding/${supplierId}`);
export const createPayment = (dto) => api.post("/payments", dto);

// ── Phase 3: Core reports ─────────────────────────────────────
export const getTrialBalance = (from, to, branchCode) =>
  api.get("/reports/trial-balance", { from, to, branchCode });
export const getLedgerStatement = (accountId, from, to, branchCode) =>
  api.get("/reports/ledger-statement", { accountId, from, to, branchCode });
export const getCustomerStatement = (customerId, from, to) =>
  api.get("/reports/customer-statement", { customerId, from, to });
export const getSupplierStatement = (supplierId, from, to) =>
  api.get("/reports/supplier-statement", { supplierId, from, to });

// ── Phase 4: Financial reports ────────────────────────────────
export const getProfitLoss = (from, to, branchCode) =>
  api.get("/reports/profit-loss", { from, to, branchCode });
export const getBalanceSheet = (asOfDate, branchCode) =>
  api.get("/reports/balance-sheet", { asOfDate, branchCode });
export const getCashFlow = (from, to, branchCode) =>
  api.get("/reports/cash-flow", { from, to, branchCode });

// ── Phase 5: Bank Reconciliation ──────────────────────────────
export const createBankStatement = (dto) => api.post("/bank-statements", dto);
export const getBankStatements = (accountId, from, to) =>
  api.get(`/bank-statements/${accountId}`, { from, to });
export const getUnmatchedStatements = (accountId, from, to) =>
  api.get(`/bank-statements/${accountId}/unmatched`, { from, to });
export const getUnmatchedGlEntries = (accountId, from, to) =>
  api.get(`/bank-reconciliation/${accountId}/unmatched-gl`, { from, to });
export const matchReconciliation = (dto) => api.post("/bank-reconciliation/match", dto);
export const unmatchReconciliation = (statementId) =>
  api.del(`/bank-reconciliation/unmatch/${statementId}`);
export const getBankReconciliationSummary = (accountId, asOfDate) =>
  api.get(`/bank-reconciliation/${accountId}/summary`, { asOfDate });

// ── Phase 5: Inventory ────────────────────────────────────────
export const getInventoryLedger = (itemId, branchCode, from, to) =>
  api.get("/inventory/ledger", { itemId, branchCode, from, to });
export const getStockValuation = (branchCode, asOfDate) =>
  api.get("/inventory/valuation", { branchCode, asOfDate });

// ── Phase 6: Aging ────────────────────────────────────────────
export const getCustomerAging = (asOfDate) =>
  api.get("/reports/aging/customers", { asOfDate });
export const getSupplierAging = (asOfDate) =>
  api.get("/reports/aging/suppliers", { asOfDate });

// ── Phase 6: Inter-branch Transfer ───────────────────────────
export const createInterBranchTransfer = (dto) => api.post("/inter-branch-transfers", dto);
export const getInterBranchTransfers = (from, to) =>
  api.get("/inter-branch-transfers", { from, to });

// ── Phase 6: Period Closing ───────────────────────────────────
export const runDayEnd = (date) =>
  api.post(`/period-close/day-end?date=${date}`, null);
export const runMonthEnd = (periodEnd) =>
  api.post(`/period-close/month-end?periodEnd=${periodEnd}`, null);
export const runYearEnd = (fyEndDate, retainedEarningsAccountId) =>
  api.post(`/period-close/year-end?fyEndDate=${fyEndDate}&retainedEarningsAccountId=${retainedEarningsAccountId}`, null);
export const getPeriodCloseHistory = () => api.get("/period-close/history");

// ── Phase 6: Budget ───────────────────────────────────────────
export const saveBudget = (dto) => api.post("/budgets", dto);
export const getBudgets = () => api.get("/budgets");
export const approveBudget = (id) => api.post(`/budgets/${id}/approve`, null);
export const getBudgetVsActual = (id) => api.get(`/budgets/${id}/vs-actual`);
