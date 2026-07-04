import React, { useState, useCallback, useEffect, useMemo } from "react";
import {
  Box, Paper, Typography, Button, CircularProgress,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Dialog, DialogTitle, DialogContent, DialogActions,
  Alert, Chip, TextField, Divider, IconButton, Tooltip, Tab, Tabs,
} from "@mui/material";
import {
  CheckCircle as ApproveIcon,
  Cancel as RejectIcon,
  Visibility as ViewIcon,
  Refresh as RefreshIcon,
  History as HistoryIcon,
} from "@mui/icons-material";
import { useTheme } from "@mui/material/styles";
import { useNavigate } from "react-router-dom";

const API = () => {
  const tid = localStorage.getItem("tenancyId");
  const tok = localStorage.getItem("jwtToken");
  return {
    base: `/api/${tid}`,
    headers: { Authorization: `Bearer ${tok}`, "Content-Type": "application/json" },
  };
};

const fmtDT = (v) => {
  if (!v) return "";
  try { return new Date(v).toLocaleString(); } catch { return String(v); }
};

const round2 = (v) => Math.round((v || 0) * 100) / 100;

const STATUS_COLOR = {
  PENDING_APPROVAL: "warning",
  APPROVED: "info",
  APPLIED: "success",
  REJECTED: "error",
  DRAFT: "default",
};

const StatusChip = ({ status }) => (
  <Chip label={status?.replace("_", " ")} size="small" color={STATUS_COLOR[status] || "default"} />
);

const SummaryCard = ({ label, count, color }) => (
  <Paper variant="outlined" sx={{ p: 1.5, minWidth: 110, textAlign: "center" }}>
    <Typography variant="h5" fontWeight={700} color={color}>{count}</Typography>
    <Typography variant="caption" color="text.secondary">{label}</Typography>
  </Paper>
);

// ─────────────────────────────────────────────────────────────────────────────
// Change diff sub-table
// ─────────────────────────────────────────────────────────────────────────────
function ChangesTable({ changes, headerBg }) {
  if (!changes?.length) return null;
  return (
    <>
      <Typography variant="subtitle2" fontWeight={700} mt={2} mb={0.5}>
        Field Changes ({changes.length})
      </Typography>
      <TableContainer component={Paper} variant="outlined" sx={{ mb: 2 }}>
        <Table size="small">
          <TableHead>
            <TableRow sx={{ "& th": { bgcolor: headerBg, fontWeight: 700 } }}>
              <TableCell>Entity</TableCell>
              <TableCell>Line</TableCell>
              <TableCell>Field</TableCell>
              <TableCell>Old Value</TableCell>
              <TableCell>New Value</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {changes.map((c, i) => (
              <TableRow key={i}>
                <TableCell>
                  <Chip label={c.entityName} size="small" variant="outlined" sx={{ fontSize: "0.7rem" }} />
                </TableCell>
                <TableCell>{c.lineNo ?? "—"}</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>{c.fieldName}</TableCell>
                <TableCell sx={{ color: "error.main" }}>{c.oldValue || "—"}</TableCell>
                <TableCell sx={{ color: "success.main", fontWeight: 600 }}>{c.newValue || "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Stock impact sub-table
// ─────────────────────────────────────────────────────────────────────────────
function StockTable({ impacts, headerBg }) {
  if (!impacts?.length) return null;
  return (
    <>
      <Typography variant="subtitle2" fontWeight={700} mt={2} mb={0.5}>
        Stock Impact ({impacts.length} line{impacts.length !== 1 ? "s" : ""})
      </Typography>
      <TableContainer component={Paper} variant="outlined" sx={{ mb: 2 }}>
        <Table size="small">
          <TableHead>
            <TableRow sx={{ "& th": { bgcolor: headerBg, fontWeight: 700 } }}>
              <TableCell>Item</TableCell>
              <TableCell>Batch</TableCell>
              <TableCell>Original Qty</TableCell>
              <TableCell>Corrected Qty</TableCell>
              <TableCell>Difference</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {impacts.map((si, i) => (
              <TableRow key={i}>
                <TableCell>{si.itemName}</TableCell>
                <TableCell>{si.batchCode || "—"}</TableCell>
                <TableCell>{si.originalQty}</TableCell>
                <TableCell>{si.correctedQty}</TableCell>
                <TableCell sx={{
                  color: si.differenceQty < 0 ? "error.main" : "success.main",
                  fontWeight: 700,
                }}>
                  {si.differenceQty > 0 ? `+${si.differenceQty}` : si.differenceQty}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Financial impact cards
// ─────────────────────────────────────────────────────────────────────────────
function FinancialCards({ fi }) {
  if (!fi) return null;
  const items = [
    ["Original Total", fi.originalTotal, null],
    ["Corrected Total", fi.correctedTotal, null],
    ["Difference", fi.differenceAmount, fi.differenceAmount < 0 ? "error.main" : fi.differenceAmount > 0 ? "success.main" : null],
    ["Tax Difference", fi.taxDifference, fi.taxDifference < 0 ? "error.main" : null],
    ["Payable Difference", fi.payableDifference, null],
  ];
  return (
    <>
      <Typography variant="subtitle2" fontWeight={700} mt={2} mb={0.5}>Financial Impact</Typography>
      <Box display="flex" gap={1.5} flexWrap="wrap" mb={2}>
        {items.map(([label, val, color]) => (
          <Paper key={label} variant="outlined" sx={{ p: 1.5, minWidth: 130 }}>
            <Typography variant="caption" color="text.secondary">{label}</Typography>
            <Typography fontWeight={700} color={color || "text.primary"}>
              {val !== undefined && val !== null ? round2(val).toLocaleString() : "—"}
            </Typography>
          </Paper>
        ))}
      </Box>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────────────────────────────────────
export default function PurchaseCorrectionApprovalPage() {
  const theme   = useTheme();
  const navigate = useNavigate();
  const isDark  = theme.palette.mode === "dark";
  const headerBg = isDark ? "#1e2a3a" : "#e3f2fd";

  const userId = localStorage.getItem("userId") || localStorage.getItem("username") || "unknown";

  // ── Data ──────────────────────────────────────────────────────────────────
  const [all, setAll]         = useState([]);   // full list (all statuses)
  const [loading, setLoading] = useState(false);
  const [err, setErr]         = useState("");
  const [toast, setToast]     = useState(null); // { severity, msg }

  // ── Tabs ──────────────────────────────────────────────────────────────────
  const [tab, setTab] = useState("PENDING_APPROVAL");

  // ── Detail dialog ─────────────────────────────────────────────────────────
  const [detail, setDetail]           = useState(null);
  const [detailOpen, setDetailOpen]   = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);

  // ── Inline action state (inside detail dialog) ────────────────────────────
  const [action, setAction]         = useState(null); // "approve" | "reject" | null
  const [rejectReason, setRejectReason] = useState("");
  const [saving, setSaving]         = useState(false);

  // ─────────────────────────────────────────────────────────────────────────
  const loadAll = useCallback(async () => {
    const { base, headers } = API();
    setLoading(true);
    setErr("");
    try {
      const res  = await fetch(`${base}/purchase-corrections/all`, { headers });
      const data = await res.json();
      setAll(Array.isArray(data) ? data : []);
    } catch (e) {
      setErr("Failed to load: " + e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  // ── Filtered list for current tab ─────────────────────────────────────────
  const filtered = useMemo(() => {
    if (tab === "ALL") return all;
    return all.filter((r) => r.status === tab);
  }, [all, tab]);

  // ── Summary counts ────────────────────────────────────────────────────────
  const counts = useMemo(() => ({
    pending:  all.filter((r) => r.status === "PENDING_APPROVAL").length,
    applied:  all.filter((r) => r.status === "APPLIED").length,
    rejected: all.filter((r) => r.status === "REJECTED").length,
    total:    all.length,
  }), [all]);

  // ─────────────────────────────────────────────────────────────────────────
  const openDetail = useCallback(async (correctionId, initialAction = null) => {
    const { base, headers } = API();
    setDetailLoading(true);
    setAction(null);
    setRejectReason("");
    try {
      const res  = await fetch(`${base}/purchase-corrections/${correctionId}`, { headers });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || res.statusText);
      setDetail(data);
      setDetailOpen(true);
      if (initialAction) setAction(initialAction);
    } catch (e) {
      setErr("Failed to load detail: " + e.message);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  const handleApprove = useCallback(async () => {
    if (!detail) return;
    const { base, headers } = API();
    setSaving(true);
    try {
      const res  = await fetch(`${base}/purchase-corrections/${detail.correctionId}/approve`, {
        method: "POST",
        headers,
        body: JSON.stringify({ approvedBy: userId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || res.statusText);
      setToast({ severity: "success", msg: data.message || "Correction approved and applied." });
      setDetailOpen(false);
      loadAll();
    } catch (e) {
      setToast({ severity: "error", msg: "Approve failed: " + e.message });
    } finally {
      setSaving(false);
      setAction(null);
    }
  }, [detail, userId, loadAll]);

  const handleReject = useCallback(async () => {
    if (!detail) return;
    if (!rejectReason.trim()) return;
    const { base, headers } = API();
    setSaving(true);
    try {
      const res  = await fetch(`${base}/purchase-corrections/${detail.correctionId}/reject`, {
        method: "POST",
        headers,
        body: JSON.stringify({ rejectedBy: userId, rejectionReason: rejectReason.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || res.statusText);
      setToast({ severity: "success", msg: "Correction rejected." });
      setDetailOpen(false);
      loadAll();
    } catch (e) {
      setToast({ severity: "error", msg: "Reject failed: " + e.message });
    } finally {
      setSaving(false);
      setAction(null);
    }
  }, [detail, rejectReason, userId, loadAll]);

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <Box p={2}>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h6" fontWeight={700}>Purchase Correction — Approval Queue</Typography>
        <Tooltip title="Refresh">
          <IconButton onClick={loadAll} disabled={loading}><RefreshIcon /></IconButton>
        </Tooltip>
      </Box>

      {/* Toast */}
      {toast && (
        <Alert severity={toast.severity} sx={{ mb: 2 }} onClose={() => setToast(null)}>
          {toast.msg}
        </Alert>
      )}
      {err && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErr("")}>{err}</Alert>}

      {/* Summary cards */}
      <Box display="flex" gap={1.5} mb={2} flexWrap="wrap">
        <SummaryCard label="Pending"  count={counts.pending}  color="warning.main" />
        <SummaryCard label="Applied"  count={counts.applied}  color="success.main" />
        <SummaryCard label="Rejected" count={counts.rejected} color="error.main"   />
        <SummaryCard label="Total"    count={counts.total}    color="text.primary"  />
      </Box>

      {/* Tab filter */}
      <Paper elevation={0} sx={{ mb: 1 }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} textColor="primary" indicatorColor="primary">
          <Tab value="PENDING_APPROVAL" label={`Pending (${counts.pending})`} />
          <Tab value="APPLIED"          label={`Applied (${counts.applied})`} />
          <Tab value="REJECTED"         label={`Rejected (${counts.rejected})`} />
          <Tab value="ALL"              label={`All (${counts.total})`} />
        </Tabs>
      </Paper>

      {/* Main table */}
      <Paper elevation={2}>
        {loading ? (
          <Box display="flex" justifyContent="center" p={4}><CircularProgress /></Box>
        ) : filtered.length === 0 ? (
          <Box p={4} textAlign="center">
            <Typography color="text.secondary">No corrections in this category.</Typography>
          </Box>
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ "& th": { bgcolor: headerBg, fontWeight: 700, fontSize: "0.75rem" } }}>
                  <TableCell>Correction No</TableCell>
                  <TableCell>Purchase Voucher</TableCell>
                  <TableCell>Supplier</TableCell>
                  <TableCell>Branch</TableCell>
                  <TableCell>Reason</TableCell>
                  <TableCell>Requested By</TableCell>
                  <TableCell>Requested At</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="center">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filtered.map((r) => (
                  <TableRow key={r.correctionId} hover
                    sx={{ cursor: "pointer" }}
                    onClick={() => openDetail(r.correctionId)}>
                    <TableCell sx={{ fontWeight: 600 }}>{r.correctionNo}</TableCell>
                    <TableCell>{r.purchaseVoucherNumber}</TableCell>
                    <TableCell>{r.supplierName}</TableCell>
                    <TableCell>{r.branchCode}</TableCell>
                    <TableCell sx={{ maxWidth: 220 }}>
                      <Typography variant="body2" noWrap title={r.correctionReason}>
                        {r.correctionReason}
                      </Typography>
                    </TableCell>
                    <TableCell>{r.requestedBy}</TableCell>
                    <TableCell>{fmtDT(r.requestedAt)}</TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <StatusChip status={r.status} />
                    </TableCell>
                    <TableCell align="center" onClick={(e) => e.stopPropagation()}>
                      <Box display="flex" justifyContent="center" gap={0.5}>
                        <Tooltip title="View / Act">
                          <IconButton size="small" onClick={() => openDetail(r.correctionId)}
                            disabled={detailLoading}>
                            <ViewIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        {r.status === "PENDING_APPROVAL" && (
                          <>
                            <Tooltip title="Approve">
                              <IconButton size="small" color="success"
                                onClick={() => openDetail(r.correctionId, "approve")}>
                                <ApproveIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Reject">
                              <IconButton size="small" color="error"
                                onClick={() => openDetail(r.correctionId, "reject")}>
                                <RejectIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </>
                        )}
                        <Tooltip title="Full history">
                          <IconButton size="small"
                            onClick={() => navigate(`/purchase-correction-history?purchaseId=${r.purchaseHdrId}`)}>
                            <HistoryIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      {/* ── Detail Dialog ─────────────────────────────────────────────────── */}
      <Dialog open={detailOpen} onClose={() => { setDetailOpen(false); setAction(null); }}
        maxWidth="lg" fullWidth scroll="paper">
        <DialogTitle sx={{ pb: 1 }}>
          <Box display="flex" alignItems="center" gap={1.5}>
            <Typography fontWeight={700} variant="h6">
              {detail?.correctionNo}
            </Typography>
            {detail && <StatusChip status={detail.status} />}
          </Box>
        </DialogTitle>

        <DialogContent dividers>
          {detailLoading && (
            <Box display="flex" justifyContent="center" p={4}><CircularProgress /></Box>
          )}
          {detail && !detailLoading && (
            <Box>
              {/* Meta grid */}
              <Box display="flex" gap={3} flexWrap="wrap" mb={2}>
                {[
                  ["Purchase Voucher", detail.purchaseVoucherNumber],
                  ["Voucher Date",     fmtDT(detail.voucherDate)],
                  ["Supplier",         detail.supplierName],
                  ["Branch",           detail.branchCode],
                  ["Requested By",     detail.requestedBy],
                  ["Requested At",     fmtDT(detail.requestedAt)],
                  ...(detail.approvedBy  ? [["Approved By",  detail.approvedBy],  ["Approved At",  fmtDT(detail.approvedAt)]]  : []),
                  ...(detail.rejectedBy  ? [["Rejected By",  detail.rejectedBy],  ["Rejected At",  fmtDT(detail.rejectedAt)]]  : []),
                  ...(detail.appliedBy   ? [["Applied By",   detail.appliedBy],   ["Applied At",   fmtDT(detail.appliedAt)]]   : []),
                ].map(([l, v]) => (
                  <Box key={l} minWidth={130}>
                    <Typography variant="caption" color="text.secondary">{l}</Typography>
                    <Typography variant="body2" fontWeight={500}>{v || "—"}</Typography>
                  </Box>
                ))}
              </Box>

              <Alert severity="info" sx={{ mb: 2 }}>
                <b>Correction Reason:</b> {detail.correctionReason}
              </Alert>

              {detail.rejectionReason && (
                <Alert severity="error" sx={{ mb: 2 }}>
                  <b>Rejection Reason:</b> {detail.rejectionReason}
                </Alert>
              )}

              <ChangesTable  changes={detail.changes}       headerBg={headerBg} />
              <StockTable    impacts={detail.stockImpacts}  headerBg={headerBg} />
              <FinancialCards fi={detail.financialImpact} />

              {/* Inline approve/reject action area */}
              {detail.status === "PENDING_APPROVAL" && (
                <>
                  <Divider sx={{ my: 2 }} />

                  {/* No action selected yet */}
                  {!action && (
                    <Box display="flex" gap={1.5}>
                      <Button variant="contained" color="success" startIcon={<ApproveIcon />}
                        onClick={() => setAction("approve")}>
                        Approve & Apply
                      </Button>
                      <Button variant="outlined" color="error" startIcon={<RejectIcon />}
                        onClick={() => setAction("reject")}>
                        Reject
                      </Button>
                    </Box>
                  )}

                  {/* Approve confirmation */}
                  {action === "approve" && (
                    <Paper variant="outlined" sx={{ p: 2, bgcolor: isDark ? "success.dark" : "#e8f5e9" }}>
                      <Typography fontWeight={600} mb={1}>
                        Confirm: Approve &amp; Apply this correction?
                      </Typography>
                      <Typography variant="body2" color="text.secondary" mb={2}>
                        All listed changes will be written to the purchase / GRN records immediately.
                        Stock adjustment entries will be created in item_batch_mst.
                      </Typography>
                      <Box display="flex" gap={1}>
                        <Button variant="contained" color="success" onClick={handleApprove}
                          disabled={saving}>
                          {saving ? <CircularProgress size={18} sx={{ color: "inherit" }} /> : "Yes, Approve & Apply"}
                        </Button>
                        <Button variant="text" onClick={() => setAction(null)} disabled={saving}>
                          Cancel
                        </Button>
                      </Box>
                    </Paper>
                  )}

                  {/* Reject form */}
                  {action === "reject" && (
                    <Paper variant="outlined" sx={{ p: 2, bgcolor: isDark ? "error.dark" : "#fff3e0" }}>
                      <Typography fontWeight={600} mb={1}>Rejection Reason *</Typography>
                      <TextField
                        multiline rows={3} fullWidth size="small"
                        placeholder="Enter reason for rejection…"
                        value={rejectReason}
                        onChange={(e) => setRejectReason(e.target.value)}
                        error={action === "reject" && !rejectReason.trim()}
                        helperText={!rejectReason.trim() ? "Required" : ""}
                        autoFocus
                      />
                      <Box display="flex" gap={1} mt={1.5}>
                        <Button variant="contained" color="error" onClick={handleReject}
                          disabled={saving || !rejectReason.trim()}>
                          {saving ? <CircularProgress size={18} sx={{ color: "inherit" }} /> : "Confirm Reject"}
                        </Button>
                        <Button variant="text" onClick={() => { setAction(null); setRejectReason(""); }}
                          disabled={saving}>
                          Cancel
                        </Button>
                      </Box>
                    </Paper>
                  )}
                </>
              )}
            </Box>
          )}
        </DialogContent>

        <DialogActions>
          <Button onClick={() => navigate(`/purchase-correction-history?purchaseId=${detail?.purchaseHdrId}`)}>
            View Full History
          </Button>
          <Button onClick={() => { setDetailOpen(false); setAction(null); }}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
