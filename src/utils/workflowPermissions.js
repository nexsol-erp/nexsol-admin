// Matches the one existing action-level role check in this codebase
// (PurchaseCorrectionPage.jsx's isAdmin gate) rather than inventing a new
// permission-string system — this app only has DB-configurable roles today,
// no per-action permission catalog.
const EDITOR_ROLES = ["admin", "system-admin"];

export function canEditWorkflows(roles) {
  return Array.isArray(roles) && roles.some((r) => EDITOR_ROLES.includes(r));
}
