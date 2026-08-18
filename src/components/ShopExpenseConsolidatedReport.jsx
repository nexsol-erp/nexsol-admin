import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Paper,
  Select,
  Snackbar,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import dayjs from "dayjs";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import BranchMultiSelect from "./BranchMultiSelect";

const PAYMENT_MODES = ["CASH", "CARD", "UPI", "BANK_TRANSFER", "OTHER"];
const STATUSES = ["ACTIVE", "VOIDED"];

export default function ShopExpenseConsolidatedReport() {
  const tenancyId = localStorage.getItem("tenancyId");
  const token = localStorage.getItem("jwtToken");
  const headers = { Authorization: `Bearer ${token}` };
  const jsonHeaders = { ...headers, "Content-Type": "application/json" };

  const [fromDate, setFromDate] = useState(dayjs().startOf("month").format("YYYY-MM-DD"));
  const [toDate, setToDate] = useState(dayjs().format("YYYY-MM-DD"));
  const [branchCodes, setBranchCodes] = useState([]);
  const [expenseTypeId, setExpenseTypeId] = useState("");
  const [paymentMode, setPaymentMode] = useState("");
  const [enteredBy, setEnteredBy] = useState("");
  const [status, setStatus] = useState("");
  const [voucherNumber, setVoucherNumber] = useState("");
  const [page, setPage] = useState(0);
  const [size] = useState(100);

  const [heads, setHeads] = useState([]);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");
  const [snack, setSnack] = useState({ open: false, msg: "", severity: "success" });

  // ── Correction / void dialog ──────────────────────────────────────────────
  const [actionRow, setActionRow] = useState(null);
  const [actionType, setActionType] = useState(""); // "correct" | "void"
  const [actionReason, setActionReason] = useState("");
  const [actionAmount, setActionAmount] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [history, setHistory] = useState([]);

  useEffect(() => {
    fetch(`/api/${tenancyId}/expense-heads`, { headers })
      .then((r) => (r.ok ? r.json() : []))
      .then(setHeads)
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const runReport = async () => {
    if (branchCodes.length === 0) {
      setError("Select at least one branch");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const params = new URLSearchParams({ fromDate, toDate, page: String(page), size: String(size) });
      branchCodes.forEach((b) => params.append("branchCodes", b));
      if (expenseTypeId) params.set("expenseTypeId", expenseTypeId);
      if (paymentMode) params.set("paymentMode", paymentMode);
      if (enteredBy) params.set("enteredBy", enteredBy);
      if (status) params.set("status", status);
      if (voucherNumber) params.set("voucherNumber", voucherNumber);

      const res = await fetch(`/api/${tenancyId}/reports/shop-expenses?${params}`, { headers });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Report failed (${res.status})`);
      setReport(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  // Re-run when the page changes via the Previous/Next controls (not on the initial mount,
  // since there's nothing to report until the user picks branches and clicks Run Report).
  useEffect(() => {
    if (report) runReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  // Groups the on-screen table and the exported sheet by branch (secondary: date,
  // then voucher no.) — the backend's search() uses a fixed native-SQL ORDER BY
  // (expense_date/voucher_number) that can't take a dynamic sort field, so this is
  // done client-side instead.
  const sortByBranch = (rows) =>
    [...rows].sort((a, b) => {
      const byBranch = String(a.branch_code || "").localeCompare(String(b.branch_code || ""));
      if (byBranch !== 0) return byBranch;
      const byDate = String(a.expense_date || "").localeCompare(String(b.expense_date || ""));
      if (byDate !== 0) return byDate;
      return String(a.voucher_number || "").localeCompare(String(b.voucher_number || ""));
    });

  const detailRows = useMemo(
    () => sortByBranch(report?.detail?.content ?? []),
    [report]
  );

  // Export must cover every row matching the current filters, not just the page
  // currently on screen — re-fetches with the same filters, paging through the
  // full result set server-side rather than reading the already-loaded page.
  const fetchAllDetailRows = async () => {
    const params = new URLSearchParams({ fromDate, toDate, size: "500" });
    branchCodes.forEach((b) => params.append("branchCodes", b));
    if (expenseTypeId) params.set("expenseTypeId", expenseTypeId);
    if (paymentMode) params.set("paymentMode", paymentMode);
    if (enteredBy) params.set("enteredBy", enteredBy);
    if (status) params.set("status", status);
    if (voucherNumber) params.set("voucherNumber", voucherNumber);

    let all = [];
    let pageNum = 0;
    let totalPages = 1;
    do {
      params.set("page", String(pageNum));
      const res = await fetch(`/api/${tenancyId}/reports/shop-expenses?${params}`, { headers });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Export fetch failed (${res.status})`);
      all = all.concat(data.detail?.content ?? []);
      totalPages = data.detail?.totalPages ?? 1;
      pageNum += 1;
    } while (pageNum < totalPages);
    return all;
  };

  const handleExport = async () => {
    if (!report) return;
    setExporting(true);
    try {
      const allRows = sortByBranch(await fetchAllDetailRows());
      const detail = allRows.map((r) => ({
        "Voucher No": r.voucher_number,
        "Date": r.expense_date,
        "Branch": r.branch_code,
        "Expense Head": r.expense_type_name,
        "Amount": r.amount,
        "Payment Mode": r.payment_mode,
        "Payee": r.payee,
        "Reference No": r.reference_no,
        "Remarks": r.remarks,
        "Entered By": r.entered_by_username,
        "Status": r.status,
      }));
      const branchSummary = (report.byBranch || []).map((r) => ({
        "Branch": r.branchCode, "Total": r.total, "Count": r.count,
      }));
      const headSummary = (report.byExpenseHead || []).map((r) => ({
        "Expense Head": r.expenseTypeName, "Total": r.total, "Count": r.count,
      }));
      const modeSummary = (report.byPaymentMode || []).map((r) => ({
        "Payment Mode": r.paymentMode, "Total": r.total, "Count": r.count,
      }));

      const wb = XLSX.utils.book_new();
      const meta = [
        { Field: "Reporting Period", Value: `${fromDate} to ${toDate}` },
        { Field: "Branches", Value: branchCodes.join(", ") },
        { Field: "Overall Total", Value: report.overallTotal },
        { Field: "Row Count", Value: allRows.length },
      ];
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(meta), "Summary");
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(detail), "Detail");
      if (branchSummary.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(branchSummary), "Branch Summary");
      if (headSummary.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(headSummary), "Expense Head Summary");
      if (modeSummary.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(modeSummary), "Payment Mode Summary");

      const filename = `expense-report-${fromDate}-to-${toDate}.xlsx`;
      saveAs(new Blob([XLSX.write(wb, { bookType: "xlsx", type: "array" })], { type: "application/octet-stream" }), filename);
    } catch (e) {
      setSnack({ open: true, msg: e.message || "Export failed", severity: "error" });
    } finally {
      setExporting(false);
    }
  };

  const openCorrect = (row) => {
    setActionRow(row); setActionType("correct");
    setActionReason(""); setActionAmount(row.amount);
  };
  const openVoid = (row) => {
    setActionRow(row); setActionType("void"); setActionReason("");
  };

  const submitAction = async () => {
    if (!actionReason.trim()) {
      setSnack({ open: true, msg: "A reason is required", severity: "error" });
      return;
    }
    try {
      const url = actionType === "correct"
        ? `/api/${tenancyId}/shop-expenses/${actionRow.id}/correct`
        : `/api/${tenancyId}/shop-expenses/${actionRow.id}/void`;
      const body = actionType === "correct"
        ? JSON.stringify({ reason: actionReason, amount: Number(actionAmount) })
        : JSON.stringify({ reason: actionReason });
      const res = await fetch(url, { method: "POST", headers: jsonHeaders, body });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Action failed (${res.status})`);
      setSnack({ open: true, msg: `Expense ${actionType === "correct" ? "corrected" : "voided"}`, severity: "success" });
      setActionRow(null);
      runReport();
    } catch (e) {
      setSnack({ open: true, msg: e.message, severity: "error" });
    }
  };

  const viewHistory = async (row) => {
    try {
      const res = await fetch(`/api/${tenancyId}/shop-expenses/${row.id}/history`, { headers });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load history");
      setHistory(data);
      setHistoryOpen(true);
    } catch (e) {
      setSnack({ open: true, msg: e.message, severity: "error" });
    }
  };

  const overallTotal = useMemo(() => Number(report?.overallTotal || 0), [report]);

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h6" sx={{ mb: 2 }}>Shop Expense Consolidated Report</Typography>

      <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap", alignItems: "flex-start", mb: 2 }}>
        <TextField label="From Date" type="date" size="small" value={fromDate} onChange={(e) => setFromDate(e.target.value)} InputLabelProps={{ shrink: true }} />
        <TextField label="To Date" type="date" size="small" value={toDate} onChange={(e) => setToDate(e.target.value)} InputLabelProps={{ shrink: true }} />
        <BranchMultiSelect label="Branches" required value={branchCodes} onChange={setBranchCodes} />
        <Select size="small" displayEmpty value={expenseTypeId} onChange={(e) => setExpenseTypeId(e.target.value)} sx={{ minWidth: 160 }}>
          <MenuItem value="">All Expense Heads</MenuItem>
          {heads.map((h) => <MenuItem key={h.id} value={h.id}>{h.name}</MenuItem>)}
        </Select>
        <Select size="small" displayEmpty value={paymentMode} onChange={(e) => setPaymentMode(e.target.value)} sx={{ minWidth: 140 }}>
          <MenuItem value="">All Payment Modes</MenuItem>
          {PAYMENT_MODES.map((m) => <MenuItem key={m} value={m}>{m}</MenuItem>)}
        </Select>
        <TextField label="Entered By" size="small" value={enteredBy} onChange={(e) => setEnteredBy(e.target.value)} />
        <Select size="small" displayEmpty value={status} onChange={(e) => setStatus(e.target.value)} sx={{ minWidth: 120 }}>
          <MenuItem value="">All Status</MenuItem>
          {STATUSES.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
        </Select>
        <TextField label="Voucher No" size="small" value={voucherNumber} onChange={(e) => setVoucherNumber(e.target.value)} />
        <Button
          variant="contained"
          onClick={() => { if (page === 0) runReport(); else setPage(0); }}
          disabled={loading}
        >
          {loading ? "Loading..." : "Run Report"}
        </Button>
        <Button variant="outlined" onClick={handleExport} disabled={!detailRows.length || exporting}>
          {exporting ? "Exporting..." : "Export Excel"}
        </Button>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {report && (
        <>
          <Box sx={{ display: "flex", gap: 2, mb: 2, flexWrap: "wrap" }}>
            <Chip color="primary" label={`Overall Total: ${overallTotal.toFixed(2)}`} />
            {(report.byBranch || []).map((r) => (
              <Chip key={r.branchCode} label={`${r.branchCode}: ${Number(r.total).toFixed(2)}`} variant="outlined" />
            ))}
          </Box>

          <TableContainer component={Paper} sx={{ mb: 2 }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Voucher No</TableCell>
                  <TableCell>Date</TableCell>
                  <TableCell>Branch</TableCell>
                  <TableCell>Expense Head</TableCell>
                  <TableCell align="right">Amount</TableCell>
                  <TableCell>Mode</TableCell>
                  <TableCell>Payee</TableCell>
                  <TableCell>Entered By</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {detailRows.map((r) => (
                  <TableRow key={r.id} hover>
                    <TableCell>{r.voucher_number}</TableCell>
                    <TableCell>{r.expense_date}</TableCell>
                    <TableCell>{r.branch_code}</TableCell>
                    <TableCell>{r.expense_type_name}</TableCell>
                    <TableCell align="right">{Number(r.amount).toFixed(2)}</TableCell>
                    <TableCell>{r.payment_mode}</TableCell>
                    <TableCell>{r.payee}</TableCell>
                    <TableCell>{r.entered_by_username}</TableCell>
                    <TableCell>
                      <Chip size="small" label={r.status} color={r.status === "VOIDED" ? "error" : "success"} />
                    </TableCell>
                    <TableCell align="right">
                      <Button size="small" onClick={() => openCorrect(r)} disabled={r.status === "VOIDED"}>Correct</Button>
                      <Button size="small" color="error" onClick={() => openVoid(r)} disabled={r.status === "VOIDED"}>Void</Button>
                      <Button size="small" onClick={() => viewHistory(r)}>History</Button>
                    </TableCell>
                  </TableRow>
                ))}
                {detailRows.length === 0 && (
                  <TableRow><TableCell colSpan={10} align="center">No data — run the report</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>

          <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 2, mb: 2 }}>
            <Button size="small" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>
              Previous
            </Button>
            <Typography variant="body2">
              Page {page + 1} of {Math.max(1, report.detail?.totalPages || 1)}
            </Typography>
            <Button
              size="small"
              disabled={report.detail && page >= (report.detail.totalPages - 1)}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </Box>
        </>
      )}

      {/* ── Correct / Void dialog ── */}
      <Dialog open={!!actionRow} onClose={() => setActionRow(null)} maxWidth="xs" fullWidth>
        <DialogTitle>{actionType === "correct" ? "Correct Expense" : "Void Expense"}</DialogTitle>
        <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 1 }}>
          {actionType === "correct" && (
            <TextField
              label="Corrected Amount" type="number" size="small"
              value={actionAmount} onChange={(e) => setActionAmount(e.target.value)}
            />
          )}
          <TextField
            label="Reason" required multiline rows={2} size="small"
            value={actionReason} onChange={(e) => setActionReason(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setActionRow(null)}>Cancel</Button>
          <Button variant="contained" color={actionType === "void" ? "error" : "primary"} onClick={submitAction}>
            Confirm
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── History dialog ── */}
      <Dialog open={historyOpen} onClose={() => setHistoryOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Correction / Void History</DialogTitle>
        <DialogContent>
          {history.length === 0 && <Typography variant="body2">No corrections recorded.</Typography>}
          {history.map((h, i) => (
            <Box key={i} sx={{ mb: 2, pb: 1, borderBottom: "1px solid #eee" }}>
              <Typography variant="subtitle2">{h.action} — {h.changedBy} — {h.changedAt}</Typography>
              <Typography variant="body2" color="text.secondary">Reason: {h.reason}</Typography>
              <Typography variant="caption" component="pre" sx={{ whiteSpace: "pre-wrap" }}>
                Before: {JSON.stringify(h.before)}
                {"\n"}After: {JSON.stringify(h.after)}
              </Typography>
            </Box>
          ))}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setHistoryOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={snack.open} autoHideDuration={4000} onClose={() => setSnack({ ...snack, open: false })}>
        <Alert severity={snack.severity} onClose={() => setSnack({ ...snack, open: false })}>{snack.msg}</Alert>
      </Snackbar>
    </Box>
  );
}
