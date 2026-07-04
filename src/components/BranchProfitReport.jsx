import React, { useState, useEffect, useMemo } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  InputLabel,
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
  Tooltip,
  Typography,
  useTheme,
  Switch,
} from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import dayjs from "dayjs";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import { useNavigate } from "react-router-dom";

const BRANCH_TYPES = ["ALL", "CGN", "FRANCHISE", "OUTLET", "PRODUCTION"];

// ── Summary card ─────────────────────────────────────────────────────────────
function SummaryCard({ label, value, sub, color }) {
  return (
    <Card sx={{ flex: 1, minWidth: 160, borderTop: `4px solid ${color}` }}>
      <CardContent sx={{ p: 1.5, "&:last-child": { pb: 1.5 } }}>
        <Typography variant="caption" color="text.secondary">{label}</Typography>
        <Typography variant="h6" sx={{ fontWeight: 700, color }}>{value}</Typography>
        {sub && <Typography variant="caption" color="text.secondary">{sub}</Typography>}
      </CardContent>
    </Card>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
const BranchProfitReport = () => {
  const theme  = useTheme();
  const isDark = theme.palette.mode === "dark";
  const navigate = useNavigate();

  const ROW_COLORS = {
    missingCost:    isDark ? "rgba(255,167,38,0.18)"  : "#fff3e0",
    negativeProfit: isDark ? "rgba(239,83,80,0.18)"   : "#ffebee",
    manualOverride: isDark ? "rgba(33,150,243,0.12)"  : "#e3f2fd",
    normal:         "inherit",
  };
  const headerBg = isDark ? theme.palette.background.default : "#f5f5f5";

  // ── Filters ────────────────────────────────────────────────────────────────
  const [fromDate,      setFromDate]      = useState(dayjs().subtract(30,"day").format("YYYY-MM-DD"));
  const [toDate,        setToDate]        = useState(dayjs().format("YYYY-MM-DD"));
  const [branchCode,    setBranchCode]    = useState("");
  const [branchType,    setBranchType]    = useState("ALL");
  const [itemId,        setItemId]        = useState("");
  const [categoryName,  setCategoryName]  = useState("");

  // ── Report data ────────────────────────────────────────────────────────────
  const [branches,   setBranches]   = useState([]);
  const [reportData, setReportData] = useState(null);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState("");

  // ── UI state ───────────────────────────────────────────────────────────────
  const [showBranchSummary, setShowBranchSummary] = useState(false);
  const [showItemSummary,   setShowItemSummary]   = useState(false);
  const [exportDialogOpen,  setExportDialogOpen]  = useState(false);
  const [exportFileName,    setExportFileName]    = useState("BranchProfitReport.xlsx");

  // ── Override dialog state ──────────────────────────────────────────────────
  const [overrideOpen,      setOverrideOpen]      = useState(false);
  const [overrideRow,       setOverrideRow]        = useState(null);   // clicked report row
  const [overrideCostRate,  setOverrideCostRate]   = useState("");
  const [overrideNotes,     setOverrideNotes]      = useState("");
  const [overrideAllBranch, setOverrideAllBranch]  = useState(false);  // apply to all branches
  const [overrideSaving,    setOverrideSaving]     = useState(false);
  const [snack,             setSnack]              = useState({ open: false, msg: "", severity: "success" });

  const allowedBranches = useMemo(() => {
    try {
      const raw = localStorage.getItem("allowedBranches");
      const list = raw ? JSON.parse(raw) : [];
      return Array.isArray(list) ? list : [];
    } catch { return []; }
  }, []);

  // ── Fetch branches ─────────────────────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      try {
        const tenancyId = localStorage.getItem("tenancyId");
        const token     = localStorage.getItem("jwtToken");
        const res  = await fetch(`/api/${tenancyId}/branches`, { headers: { Authorization: `Bearer ${token}` } });
        if (!res.ok) return;
        const data = await res.json();
        const list = Array.isArray(data) ? data : data.branches || data.data || [];
        const filtered = allowedBranches.length ? list.filter(b => allowedBranches.includes(b.branchCode)) : list;
        setBranches(filtered);
        if (filtered.length === 1) setBranchCode(filtered[0].branchCode);
      } catch (e) { console.error(e); }
    };
    load();
  }, [allowedBranches]);

  // ── Fetch report ───────────────────────────────────────────────────────────
  const fetchReport = async () => {
    if (!fromDate || !toDate) { setError("Please select a date range."); return; }
    setError(""); setLoading(true); setReportData(null);
    try {
      const tenancyId = localStorage.getItem("tenancyId");
      const token     = localStorage.getItem("jwtToken");
      const params    = new URLSearchParams({ fromDate, toDate });
      if (branchCode) {
        params.set("branchCode", branchCode);
      } else if (allowedBranches.length > 0) {
        // No specific branch selected but user has an allow-list — enforce it server-side
        params.set("branchCodes", allowedBranches.join(","));
      }
      if (branchType && branchType !== "ALL") params.set("branchType", branchType);
      if (itemId)                             params.set("itemId",       itemId.trim());
      if (categoryName)                       params.set("categoryName", categoryName.trim());

      const res = await fetch(`/api/${tenancyId}/reports/branch-profit?${params}`,
        { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error(`Server error: ${res.status}`);
      setReportData(await res.json());
    } catch (e) {
      setError(e.message || "Failed to fetch report.");
    } finally {
      setLoading(false);
    }
  };

  // ── Override dialog ────────────────────────────────────────────────────────
  const openOverrideDialog = (row) => {
    setOverrideRow(row);
    setOverrideCostRate(row.costSource === "MANUAL_OVERRIDE" ? String(row.costRate) : "");
    setOverrideNotes("");
    setOverrideAllBranch(false);
    setOverrideOpen(true);
  };

  const saveOverride = async () => {
    const rate = parseFloat(overrideCostRate);
    if (!overrideRow || isNaN(rate) || rate <= 0) {
      setSnack({ open: true, msg: "Enter a valid cost rate > 0", severity: "error" });
      return;
    }
    setOverrideSaving(true);
    try {
      const tenancyId = localStorage.getItem("tenancyId");
      const token     = localStorage.getItem("jwtToken");
      const userId    = localStorage.getItem("userId") || "admin";

      const payload = {
        itemId:     overrideRow.itemId,
        itemName:   overrideRow.itemName,
        itemCode:   overrideRow.itemCode,
        branchCode: overrideAllBranch ? null : overrideRow.branchCode,
        branchName: overrideRow.branch,
        branchType: overrideRow.branchType,
        costRate:   rate,
        notes:      overrideNotes || null,
        updatedBy:  userId,
      };

      const res = await fetch(`/api/${tenancyId}/item-cost-override`, {
        method:  "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body:    JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.success) {
        setSnack({ open: true, msg: "Cost rate saved. Refreshing report…", severity: "success" });
        setOverrideOpen(false);
        fetchReport();          // re-run so MANUAL_OVERRIDE appears immediately
      } else {
        setSnack({ open: true, msg: data.message || "Save failed", severity: "error" });
      }
    } catch (e) {
      setSnack({ open: true, msg: e.message, severity: "error" });
    } finally {
      setOverrideSaving(false);
    }
  };

  // ── Excel export ───────────────────────────────────────────────────────────
  const handleExport = () => {
    if (!reportData?.rows?.length) return;
    const detail = reportData.rows.map(r => ({
      Branch: r.branch, "Branch Code": r.branchCode, "Branch Type": r.branchType,
      "Bill Number": r.billNumber, "Bill Date": r.billDate,
      "Item Code": r.itemCode, "Item Name": r.itemName,
      "Qty Sold": r.quantitySold, "Sales Rate": r.salesRate, "Sales Amount": r.salesAmount,
      "Cost Rate": r.costRate, "Cost Amount": r.costAmount,
      "Profit Amount": r.profitAmount, "Profit %": r.profitPercentage,
      "Cost Source": r.costSource,
      "Missing Cost": r.hasMissingCost ? "YES" : "NO",
      "Negative Profit": r.isNegativeProfit ? "YES" : "NO",
    }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(detail), "Detail");
    if (reportData.branchSummary?.length)
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(reportData.branchSummary), "Branch Summary");
    if (reportData.itemSummary?.length)
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(reportData.itemSummary), "Item Summary");
    saveAs(new Blob([XLSX.write(wb, { bookType: "xlsx", type: "array" })], { type: "application/octet-stream" }), exportFileName);
    setExportDialogOpen(false);
  };

  // ── Derived ────────────────────────────────────────────────────────────────
  const summary  = reportData?.summary       ?? null;
  const rows     = reportData?.rows          ?? [];
  const bSum     = reportData?.branchSummary ?? [];
  const iSum     = reportData?.itemSummary   ?? [];
  const fmt      = n => (n ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const rowBg = (row) => {
    if (row.hasMissingCost)                      return ROW_COLORS.missingCost;
    if (row.costSource === "MANUAL_OVERRIDE")     return ROW_COLORS.manualOverride;
    if (row.isNegativeProfit)                    return ROW_COLORS.negativeProfit;
    return ROW_COLORS.normal;
  };

  const isEditable = (row) => row.hasMissingCost || row.costSource === "MANUAL_OVERRIDE";

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2 }}>
        <Typography variant="h5" fontWeight={700}>Branch-wise Profit Report</Typography>
        <Button size="small" variant="outlined" onClick={() => navigate("/item-cost-override")}>
          Manage Cost Overrides
        </Button>
      </Box>

      {/* ── Filters ── */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2, alignItems: "flex-end" }}>
          <TextField label="From Date" type="date" size="small" value={fromDate}
            onChange={e => setFromDate(e.target.value)} InputLabelProps={{ shrink: true }} sx={{ minWidth: 160 }} />
          <TextField label="To Date" type="date" size="small" value={toDate}
            onChange={e => setToDate(e.target.value)} InputLabelProps={{ shrink: true }} sx={{ minWidth: 160 }} />

          <FormControl size="small" sx={{ minWidth: 180 }}>
            <InputLabel>Branch</InputLabel>
            <Select value={branchCode} label="Branch" onChange={e => setBranchCode(e.target.value)}>
              <MenuItem value="">All Branches</MenuItem>
              {branches.map(b => <MenuItem key={b.id} value={b.branchCode}>{b.branchName || b.branchCode}</MenuItem>)}
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel>Branch Type</InputLabel>
            <Select value={branchType} label="Branch Type" onChange={e => setBranchType(e.target.value)}>
              {BRANCH_TYPES.map(t => <MenuItem key={t} value={t}>{t}</MenuItem>)}
            </Select>
          </FormControl>

          <TextField label="Item ID (optional)" size="small" value={itemId}
            onChange={e => setItemId(e.target.value)} sx={{ minWidth: 160 }} />
          <TextField label="Category (optional)" size="small" value={categoryName}
            onChange={e => setCategoryName(e.target.value)} sx={{ minWidth: 160 }} />

          <Button variant="contained" color="primary" onClick={fetchReport} disabled={loading}>
            {loading ? "Loading…" : "Search"}
          </Button>
          {rows.length > 0 && (
            <Button variant="outlined" color="success" onClick={() => setExportDialogOpen(true)}>
              Export Excel
            </Button>
          )}
        </Box>
        {error && <Typography color="error" mt={1} variant="body2">{error}</Typography>}
      </Paper>

      {/* ── Summary cards ── */}
      {summary && (
        <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap", mb: 2 }}>
          <SummaryCard label="Total Sales"  value={fmt(summary.totalSalesAmount)}  color="#1976d2" />
          <SummaryCard label="Total Cost"   value={fmt(summary.totalCostAmount)}   color="#7b1fa2" />
          <SummaryCard label="Total Profit" value={fmt(summary.totalProfitAmount)}
            color={summary.totalProfitAmount >= 0 ? "#388e3c" : "#d32f2f"} />
          <SummaryCard label="Profit %"
            value={`${fmt(summary.profitPercentage)} %`}
            color={summary.profitPercentage >= 0 ? "#388e3c" : "#d32f2f"}
            sub={`${summary.totalRows} rows · ${summary.missingCostRows} missing cost · ${summary.negativeProfitRows} negative profit`} />
        </Box>
      )}

      {/* ── Legend ── */}
      {rows.length > 0 && (
        <Box sx={{ display: "flex", gap: 1, mb: 1, flexWrap: "wrap", alignItems: "center" }}>
          <Chip size="small" label="Missing cost — click to set"
            sx={{ bgcolor: ROW_COLORS.missingCost, border: "1px solid #ffa726", color: "text.primary", cursor: "pointer" }} />
          <Chip size="small" label="Manual override — click to edit"
            sx={{ bgcolor: ROW_COLORS.manualOverride, border: "1px solid #42a5f5", color: "text.primary", cursor: "pointer" }} />
          <Chip size="small" label="Negative profit"
            sx={{ bgcolor: ROW_COLORS.negativeProfit, border: "1px solid #ef9a9a", color: "text.primary" }} />
        </Box>
      )}

      {/* ── Detail table ── */}
      {rows.length > 0 && (
        <TableContainer component={Paper} sx={{ mb: 2 }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow sx={{ "& th": { fontWeight: 700, bgcolor: headerBg, color: "text.primary" } }}>
                <TableCell>Branch</TableCell>
                <TableCell>Bill No</TableCell>
                <TableCell>Bill Date</TableCell>
                <TableCell>Item Code</TableCell>
                <TableCell>Item Name</TableCell>
                <TableCell align="right">Qty</TableCell>
                <TableCell align="right">Sales Rate</TableCell>
                <TableCell align="right">Sales Amt</TableCell>
                <TableCell align="right">Cost Rate</TableCell>
                <TableCell align="right">Cost Amt</TableCell>
                <TableCell align="right">Profit Amt</TableCell>
                <TableCell align="right">Profit %</TableCell>
                <TableCell>Cost Source</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((row, idx) => (
                <Tooltip
                  key={idx}
                  title={isEditable(row) ? (row.hasMissingCost ? "Click to set cost rate" : "Click to edit manual cost rate") : ""}
                  placement="left"
                  arrow
                >
                  <TableRow
                    sx={{
                      bgcolor: rowBg(row),
                      cursor: isEditable(row) ? "pointer" : "default",
                      "&:hover": { filter: "brightness(0.96)" },
                    }}
                    onClick={() => isEditable(row) && openOverrideDialog(row)}
                  >
                    <TableCell>
                      <Typography variant="body2" fontWeight={500}>{row.branch}</Typography>
                      <Typography variant="caption" color="text.secondary">{row.branchType}</Typography>
                    </TableCell>
                    <TableCell>{row.billNumber}</TableCell>
                    <TableCell sx={{ whiteSpace: "nowrap" }}>
                      {row.billDate ? row.billDate.toString().slice(0, 10) : ""}
                    </TableCell>
                    <TableCell>{row.itemCode}</TableCell>
                    <TableCell>{row.itemName}</TableCell>
                    <TableCell align="right">{fmt(row.quantitySold)}</TableCell>
                    <TableCell align="right">{fmt(row.salesRate)}</TableCell>
                    <TableCell align="right">{fmt(row.salesAmount)}</TableCell>
                    <TableCell align="right">
                      {row.hasMissingCost
                        ? <Typography variant="body2" color="warning.main">—</Typography>
                        : fmt(row.costRate)}
                    </TableCell>
                    <TableCell align="right">{row.hasMissingCost ? "—" : fmt(row.costAmount)}</TableCell>
                    <TableCell align="right"
                      sx={{ color: row.profitAmount < 0 ? "error.main" : "success.main", fontWeight: 600 }}>
                      {row.hasMissingCost ? "—" : fmt(row.profitAmount)}
                    </TableCell>
                    <TableCell align="right"
                      sx={{ color: row.profitPercentage < 0 ? "error.main" : "text.primary" }}>
                      {row.hasMissingCost ? "—" : `${fmt(row.profitPercentage)} %`}
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                        <Chip
                          label={row.costSource}
                          size="small"
                          color={
                            row.costSource === "NOT_FOUND"      ? "warning"   :
                            row.costSource === "MANUAL_OVERRIDE"? "info"      :
                            row.costSource === "PURCHASE"       ? "primary"   :
                            row.costSource === "PRODUCTION_COST"? "secondary" : "default"
                          }
                          variant="outlined"
                        />
                        {isEditable(row) && <EditIcon sx={{ fontSize: 14, color: "text.secondary" }} />}
                      </Box>
                    </TableCell>
                  </TableRow>
                </Tooltip>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* ── Branch summary ── */}
      {bSum.length > 0 && (
        <Paper sx={{ mb: 2, p: 1 }}>
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center",
            cursor: "pointer", px: 1, py: 0.5 }} onClick={() => setShowBranchSummary(v => !v)}>
            <Typography fontWeight={700}>Branch-wise Summary</Typography>
            <Typography variant="caption" color="primary">{showBranchSummary ? "Hide ▲" : "Show ▼"}</Typography>
          </Box>
          <Collapse in={showBranchSummary}>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ "& th": { fontWeight: 700, bgcolor: headerBg, color: "text.primary" } }}>
                    <TableCell>Branch</TableCell>
                    <TableCell align="right">Sales Amount</TableCell>
                    <TableCell align="right">Cost Amount</TableCell>
                    <TableCell align="right">Profit Amount</TableCell>
                    <TableCell align="right">Profit %</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {bSum.map((b, i) => (
                    <TableRow key={i}>
                      <TableCell>
                        <b>{b.branchName}</b>
                        <Typography variant="caption" color="text.secondary" display="block">{b.branchCode}</Typography>
                      </TableCell>
                      <TableCell align="right">{fmt(b.salesAmount)}</TableCell>
                      <TableCell align="right">{fmt(b.costAmount)}</TableCell>
                      <TableCell align="right"
                        sx={{ color: b.profitAmount < 0 ? "error.main" : "success.main", fontWeight: 600 }}>
                        {fmt(b.profitAmount)}
                      </TableCell>
                      <TableCell align="right">{fmt(b.profitPercentage)} %</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Collapse>
        </Paper>
      )}

      {/* ── Item summary ── */}
      {iSum.length > 0 && (
        <Paper sx={{ mb: 2, p: 1 }}>
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center",
            cursor: "pointer", px: 1, py: 0.5 }} onClick={() => setShowItemSummary(v => !v)}>
            <Typography fontWeight={700}>Item-wise Summary</Typography>
            <Typography variant="caption" color="primary">{showItemSummary ? "Hide ▲" : "Show ▼"}</Typography>
          </Box>
          <Collapse in={showItemSummary}>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ "& th": { fontWeight: 700, bgcolor: headerBg, color: "text.primary" } }}>
                    <TableCell>Item Code</TableCell>
                    <TableCell>Item Name</TableCell>
                    <TableCell align="right">Sales Amount</TableCell>
                    <TableCell align="right">Cost Amount</TableCell>
                    <TableCell align="right">Profit Amount</TableCell>
                    <TableCell align="right">Profit %</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {iSum.map((item, i) => (
                    <TableRow key={i}>
                      <TableCell>{item.itemCode}</TableCell>
                      <TableCell>{item.itemName}</TableCell>
                      <TableCell align="right">{fmt(item.salesAmount)}</TableCell>
                      <TableCell align="right">{fmt(item.costAmount)}</TableCell>
                      <TableCell align="right"
                        sx={{ color: item.profitAmount < 0 ? "error.main" : "success.main", fontWeight: 600 }}>
                        {fmt(item.profitAmount)}
                      </TableCell>
                      <TableCell align="right">{fmt(item.profitPercentage)} %</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Collapse>
        </Paper>
      )}

      {/* ── Cost override dialog ── */}
      <Dialog open={overrideOpen} onClose={() => !overrideSaving && setOverrideOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>
          {overrideRow?.costSource === "MANUAL_OVERRIDE" ? "Edit Manual Cost Rate" : "Set Missing Cost Rate"}
        </DialogTitle>
        <DialogContent>
          {overrideRow && (
            <Box sx={{ mb: 2, p: 1.5, bgcolor: "action.hover", borderRadius: 1 }}>
              <Typography variant="body2"><b>Item:</b> {overrideRow.itemName} ({overrideRow.itemCode})</Typography>
              <Typography variant="body2"><b>Branch:</b> {overrideRow.branch} · {overrideRow.branchType}</Typography>
              <Typography variant="body2"><b>Bill:</b> {overrideRow.billNumber} · {overrideRow.billDate?.toString().slice(0,10)}</Typography>
              <Typography variant="body2"><b>Sales Rate:</b> {fmt(overrideRow.salesRate)}</Typography>
            </Box>
          )}

          <TextField
            label="Cost Rate *"
            type="number"
            fullWidth
            size="small"
            value={overrideCostRate}
            onChange={e => setOverrideCostRate(e.target.value)}
            inputProps={{ min: 0, step: "0.01" }}
            sx={{ mb: 2 }}
            autoFocus
          />
          <TextField
            label="Notes (optional)"
            fullWidth
            size="small"
            value={overrideNotes}
            onChange={e => setOverrideNotes(e.target.value)}
            sx={{ mb: 2 }}
          />
          {allowedBranches.length === 0 && (
            <FormControlLabel
              control={
                <Switch
                  checked={overrideAllBranch}
                  onChange={e => setOverrideAllBranch(e.target.checked)}
                  size="small"
                />
              }
              label={
                <Typography variant="body2">
                  Apply to <b>all branches</b> (not just {overrideRow?.branch})
                </Typography>
              }
            />
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOverrideOpen(false)} disabled={overrideSaving}>Cancel</Button>
          <Button onClick={saveOverride} variant="contained" disabled={overrideSaving || !overrideCostRate}>
            {overrideSaving ? "Saving…" : "Save"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Export dialog ── */}
      <Dialog open={exportDialogOpen} onClose={() => setExportDialogOpen(false)}>
        <DialogTitle>Export to Excel</DialogTitle>
        <DialogContent>
          <TextField autoFocus margin="dense" label="File Name" fullWidth
            value={exportFileName} onChange={e => setExportFileName(e.target.value)} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setExportDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleExport} variant="contained" color="success">Export</Button>
        </DialogActions>
      </Dialog>

      {/* ── Snackbar ── */}
      <Snackbar open={snack.open} autoHideDuration={4000} onClose={() => setSnack(s => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}>
        <Alert severity={snack.severity} onClose={() => setSnack(s => ({ ...s, open: false }))}>
          {snack.msg}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default BranchProfitReport;
