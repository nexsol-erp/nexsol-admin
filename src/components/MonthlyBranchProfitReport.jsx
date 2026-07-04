import React, { useState, useEffect, useMemo } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Collapse,
  FormControl,
  IconButton,
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
  Typography,
  useTheme,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";

const MONTHS = [
  { value: 1, label: "January" }, { value: 2, label: "February" },
  { value: 3, label: "March" },   { value: 4, label: "April" },
  { value: 5, label: "May" },     { value: 6, label: "June" },
  { value: 7, label: "July" },    { value: 8, label: "August" },
  { value: 9, label: "September"},{ value: 10, label: "October" },
  { value: 11, label: "November"},{ value: 12, label: "December" },
];

const currentYear  = new Date().getFullYear();
const currentMonth = new Date().getMonth() + 1;
const YEARS = Array.from({ length: 5 }, (_, i) => currentYear - i);

function fmt(v) {
  return new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v ?? 0);
}

function SummaryCard({ label, value, color }) {
  return (
    <Card sx={{ flex: 1, minWidth: 150, borderTop: `4px solid ${color}` }}>
      <CardContent sx={{ p: 1.5, "&:last-child": { pb: 1.5 } }}>
        <Typography variant="caption" color="text.secondary">{label}</Typography>
        <Typography variant="h6" sx={{ fontWeight: 700, color }}>{value}</Typography>
      </CardContent>
    </Card>
  );
}

const MonthlyBranchProfitReport = () => {
  const theme  = useTheme();
  const isDark = theme.palette.mode === "dark";

  // ── Filters ────────────────────────────────────────────────────────────────
  const [branchCode, setBranchCode] = useState("");
  const [month,      setMonth]      = useState(currentMonth);
  const [year,       setYear]       = useState(currentYear);

  // ── Data ───────────────────────────────────────────────────────────────────
  const [branches,    setBranches]    = useState([]);
  const [reportData,  setReportData]  = useState(null);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState("");
  const [expandedRow, setExpandedRow] = useState(null);

  const [snack, setSnack] = useState({ open: false, msg: "", severity: "info" });

  const allowedBranches = useMemo(() => {
    try {
      const raw = localStorage.getItem("allowedBranches");
      const list = raw ? JSON.parse(raw) : [];
      return Array.isArray(list) ? list : [];
    } catch { return []; }
  }, []);

  const tenancyId = localStorage.getItem("tenancyId");
  const token     = localStorage.getItem("jwtToken");
  const headers   = { Authorization: `Bearer ${token}` };

  // ── Load branches ──────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const res  = await fetch(`/api/${tenancyId}/branches`, { headers });
        const data = res.ok ? await res.json() : [];
        const list = Array.isArray(data) ? data : data.branches || [];
        const filtered = allowedBranches.length
          ? list.filter(b => allowedBranches.includes(b.branchCode))
          : list;
        setBranches(filtered);
        if (filtered.length === 1) setBranchCode(filtered[0].branchCode);
      } catch (e) { console.error(e); }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Fetch report ───────────────────────────────────────────────────────────
  const fetchReport = async () => {
    setError(""); setLoading(true); setReportData(null);
    try {
      const params = new URLSearchParams({ month, year });
      if (branchCode) params.set("branchCode", branchCode);
      else if (allowedBranches.length) params.set("branchCodes", allowedBranches.join(","));

      const res  = await fetch(`/api/${tenancyId}/expenses/monthly-profit?${params}`, { headers });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Failed to load report."); return; }
      setReportData(data);
    } catch (e) {
      setError("Network error: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  // ── Helpers ────────────────────────────────────────────────────────────────
  const profitColor = (v) =>
    v > 0 ? "#2e7d32" : v < 0 ? "#c62828" : "text.secondary";

  const chipColor = (pct) => {
    if (pct >= 15) return "success";
    if (pct >= 5)  return "warning";
    return "error";
  };

  const headerSx = {
    bgcolor: isDark ? theme.palette.background.default : "#f5f5f5",
    fontWeight: 700, fontSize: 13, whiteSpace: "nowrap",
  };

  // ── Excel Export ───────────────────────────────────────────────────────────
  const exportExcel = () => {
    if (!reportData) return;
    const { summary, rows } = reportData;

    // Summary sheet
    const summaryData = [
      ["Monthly Branch Profit Report"],
      [`Period: ${summary.monthName} ${summary.year}`],
      [],
      ["Metric", "Amount"],
      ["Total Sales",       summary.totalSales],
      ["Total Cost",        summary.totalCost],
      ["Gross Profit",      summary.totalGrossProfit],
      ["Total Expenses",    summary.totalExpenses],
      ["Net Profit",        summary.totalNetProfit],
      ["Profit %",          summary.profitPercent + "%"],
    ];

    // Collect all expense type keys
    const expenseKeys = [...new Set(
      rows.flatMap(r => Object.keys(r.expenseBreakup || {}))
    )];

    // Detail sheet
    const detailHeaders = [
      "Branch", "Branch Code",
      "Sales Amount", "Cost Amount", "Gross Profit",
      "Expense Amount", "Net Profit", "Profit %",
      ...expenseKeys,
    ];
    const detailRows = rows.map(r => [
      r.branchName, r.branchCode,
      r.salesAmount, r.costAmount, r.grossProfit,
      r.expenseAmount, r.netProfit, r.profitPercent + "%",
      ...expenseKeys.map(k => r.expenseBreakup?.[k] ?? 0),
    ]);

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summaryData), "Summary");
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.aoa_to_sheet([detailHeaders, ...detailRows]),
      "Branch Detail"
    );
    saveAs(
      new Blob([XLSX.write(wb, { bookType: "xlsx", type: "array" })], { type: "application/octet-stream" }),
      `MonthlyProfitReport_${summary.monthName}_${summary.year}.xlsx`
    );
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  const summary = reportData?.summary;
  const rows    = reportData?.rows || [];

  return (
    <Box sx={{ p: 2, maxWidth: 1200, mx: "auto" }}>
      <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
        Monthly Branch Profit Report
      </Typography>

      {/* ── Filter Bar ── */}
      <Paper sx={{ p: 2, mb: 2, display: "flex", gap: 2, flexWrap: "wrap", alignItems: "center" }}>
        <FormControl size="small" sx={{ minWidth: 180 }}>
          <InputLabel>Branch</InputLabel>
          <Select value={branchCode} label="Branch" onChange={e => setBranchCode(e.target.value)}>
            <MenuItem value="">All Branches</MenuItem>
            {branches.map(b => (
              <MenuItem key={b.branchCode} value={b.branchCode}>{b.branchCode} - {b.branchName}</MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl size="small" sx={{ minWidth: 140 }}>
          <InputLabel>Month</InputLabel>
          <Select value={month} label="Month" onChange={e => setMonth(e.target.value)}>
            {MONTHS.map(m => <MenuItem key={m.value} value={m.value}>{m.label}</MenuItem>)}
          </Select>
        </FormControl>

        <FormControl size="small" sx={{ minWidth: 100 }}>
          <InputLabel>Year</InputLabel>
          <Select value={year} label="Year" onChange={e => setYear(e.target.value)}>
            {YEARS.map(y => <MenuItem key={y} value={y}>{y}</MenuItem>)}
          </Select>
        </FormControl>

        <Button
          variant="contained" startIcon={<SearchIcon />}
          onClick={fetchReport} disabled={loading}
        >
          {loading ? "Loading…" : "Generate"}
        </Button>

        {reportData && (
          <Button
            variant="outlined" startIcon={<FileDownloadIcon />}
            onClick={exportExcel}
          >
            Export Excel
          </Button>
        )}
      </Paper>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {/* ── Summary Cards ── */}
      {summary && (
        <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap", mb: 2 }}>
          <SummaryCard label="Total Sales"       value={`₹ ${fmt(summary.totalSales)}`}       color="#1565c0" />
          <SummaryCard label="Total Cost"        value={`₹ ${fmt(summary.totalCost)}`}        color="#6a1b9a" />
          <SummaryCard label="Gross Profit"      value={`₹ ${fmt(summary.totalGrossProfit)}`} color="#00695c" />
          <SummaryCard label="Total Expenses"    value={`₹ ${fmt(summary.totalExpenses)}`}    color="#e65100" />
          <SummaryCard
            label="Net Profit"
            value={`₹ ${fmt(summary.totalNetProfit)}`}
            color={summary.totalNetProfit >= 0 ? "#2e7d32" : "#c62828"}
          />
          <SummaryCard
            label="Profit %"
            value={`${summary.profitPercent}%`}
            color={summary.profitPercent >= 10 ? "#2e7d32" : summary.profitPercent >= 0 ? "#f57f17" : "#c62828"}
          />
        </Box>
      )}

      {/* ── Branch Table ── */}
      {rows.length > 0 && (
        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={headerSx} />
                <TableCell sx={headerSx}>Branch</TableCell>
                <TableCell sx={{ ...headerSx, textAlign: "right" }}>Sales (₹)</TableCell>
                <TableCell sx={{ ...headerSx, textAlign: "right" }}>Cost (₹)</TableCell>
                <TableCell sx={{ ...headerSx, textAlign: "right" }}>Gross Profit (₹)</TableCell>
                <TableCell sx={{ ...headerSx, textAlign: "right" }}>Expenses (₹)</TableCell>
                <TableCell sx={{ ...headerSx, textAlign: "right" }}>Net Profit (₹)</TableCell>
                <TableCell sx={{ ...headerSx, textAlign: "center" }}>Profit %</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((row, idx) => {
                const isExpanded = expandedRow === idx;
                const hasBreakup = Object.keys(row.expenseBreakup || {}).length > 0;
                return (
                  <React.Fragment key={row.branchCode}>
                    <TableRow
                      hover
                      sx={{
                        bgcolor: row.netProfit < 0
                          ? (isDark ? "rgba(239,83,80,0.10)" : "#ffebee")
                          : "inherit",
                      }}
                    >
                      <TableCell sx={{ width: 40 }}>
                        {hasBreakup && (
                          <IconButton size="small" onClick={() => setExpandedRow(isExpanded ? null : idx)}>
                            {isExpanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
                          </IconButton>
                        )}
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {row.branchCode} - {row.branchName}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">{fmt(row.salesAmount)}</TableCell>
                      <TableCell align="right">{fmt(row.costAmount)}</TableCell>
                      <TableCell align="right" sx={{ color: profitColor(row.grossProfit), fontWeight: 600 }}>
                        {fmt(row.grossProfit)}
                      </TableCell>
                      <TableCell align="right" sx={{ color: "#e65100" }}>{fmt(row.expenseAmount)}</TableCell>
                      <TableCell align="right" sx={{ color: profitColor(row.netProfit), fontWeight: 700 }}>
                        {fmt(row.netProfit)}
                      </TableCell>
                      <TableCell align="center">
                        <Chip
                          label={`${row.profitPercent}%`}
                          size="small"
                          color={chipColor(row.profitPercent)}
                          variant="outlined"
                        />
                      </TableCell>
                    </TableRow>

                    {/* ── Expense Breakup Row ── */}
                    {hasBreakup && (
                      <TableRow>
                        <TableCell colSpan={8} sx={{ p: 0, borderBottom: "none" }}>
                          <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                            <Box sx={{
                              mx: 6, my: 1, p: 1.5,
                              bgcolor: isDark ? "rgba(255,255,255,0.04)" : "#fafafa",
                              borderRadius: 1, border: "1px solid",
                              borderColor: isDark ? "rgba(255,255,255,0.1)" : "#e0e0e0",
                            }}>
                              <Typography variant="caption" sx={{ fontWeight: 700, mb: 1, display: "block" }}>
                                Expense Breakup
                              </Typography>
                              <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
                                {Object.entries(row.expenseBreakup).map(([type, amount]) => (
                                  <Box key={type} sx={{ textAlign: "center", minWidth: 100 }}>
                                    <Typography variant="caption" color="text.secondary">{type}</Typography>
                                    <Typography variant="body2" sx={{ fontWeight: 600, color: "#e65100" }}>
                                      ₹ {fmt(amount)}
                                    </Typography>
                                  </Box>
                                ))}
                              </Box>
                            </Box>
                          </Collapse>
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                );
              })}

              {/* ── Totals Row ── */}
              {summary && (
                <TableRow sx={{ bgcolor: isDark ? "rgba(255,255,255,0.08)" : "#f0f0f0" }}>
                  <TableCell />
                  <TableCell sx={{ fontWeight: 700 }}>TOTAL</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>{fmt(summary.totalSales)}</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>{fmt(summary.totalCost)}</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700, color: profitColor(summary.totalGrossProfit) }}>
                    {fmt(summary.totalGrossProfit)}
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700, color: "#e65100" }}>
                    {fmt(summary.totalExpenses)}
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700, color: profitColor(summary.totalNetProfit) }}>
                    {fmt(summary.totalNetProfit)}
                  </TableCell>
                  <TableCell align="center">
                    <Chip
                      label={`${summary.profitPercent}%`}
                      size="small"
                      color={chipColor(summary.profitPercent)}
                    />
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {reportData && rows.length === 0 && (
        <Alert severity="info" sx={{ mt: 2 }}>
          No sales or expense data found for {MONTHS.find(m => m.value === month)?.label} {year}.
        </Alert>
      )}

      <Snackbar
        open={snack.open} autoHideDuration={3500}
        onClose={() => setSnack(s => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert severity={snack.severity}>{snack.msg}</Alert>
      </Snackbar>
    </Box>
  );
};

export default MonthlyBranchProfitReport;
