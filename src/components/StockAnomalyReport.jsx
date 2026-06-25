import React, { useState, useEffect, useMemo } from "react";
import {
  Box,
  Paper,
  Button,
  TextField,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  CircularProgress,
  Alert,
  Chip,
  Tabs,
  Tab,
  Card,
  CardContent,
  Autocomplete,
} from "@mui/material";
import Grid from "@mui/material/Unstable_Grid2";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import InventoryIcon from "@mui/icons-material/Inventory";
import AttachMoneyIcon from "@mui/icons-material/AttachMoney";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import RefreshIcon from "@mui/icons-material/Refresh";
import BlockIcon from "@mui/icons-material/Block";
import { Bar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip as ChartTooltip,
  Legend,
} from "chart.js";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, ChartTooltip, Legend);

// ── helpers ──────────────────────────────────────────────────────────────────
const fmt = (n) =>
  Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });

const fmtCurrency = (n) =>
  "₹" +
  Number(n || 0).toLocaleString("en-IN", {
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  });

function supplyChipStyle(months) {
  if (months === null || months === undefined)
    return { bg: "#fce4ec", color: "#b71c1c", label: "No Sales" };
  if (months > 12) return { bg: "#ffebee", color: "#c62828", label: `${months}m` };
  if (months > 6) return { bg: "#fff8e1", color: "#e65100", label: `${months}m` };
  return { bg: "#e8f5e9", color: "#2e7d32", label: `${months}m` };
}

// ── sub-components ────────────────────────────────────────────────────────────
function SummaryCard({ icon, label, value, color, subtitle }) {
  return (
    <Card
      elevation={2}
      sx={{ borderLeft: `4px solid ${color}`, height: "100%", borderRadius: 2 }}
    >
      <CardContent
        sx={{ display: "flex", alignItems: "center", gap: 2, py: "14px !important" }}
      >
        <Box
          sx={{
            bgcolor: color + "18",
            borderRadius: "50%",
            width: 48,
            height: 48,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color,
            flexShrink: 0,
          }}
        >
          {icon}
        </Box>
        <Box>
          <Typography variant="h5" fontWeight={700} color={color} lineHeight={1.2}>
            {value}
          </Typography>
          <Typography variant="body2" fontWeight={500}>
            {label}
          </Typography>
          {subtitle && (
            <Typography variant="caption" color="text.disabled">
              {subtitle}
            </Typography>
          )}
        </Box>
      </CardContent>
    </Card>
  );
}

function TabPanel({ children, value, index }) {
  return value === index ? <Box sx={{ pt: 2 }}>{children}</Box> : null;
}

const COLS_HIGH = [
  { id: "branchCode",        label: "Branch" },
  { id: "itemName",          label: "Item Name" },
  { id: "itemCode",          label: "Code" },
  { id: "unitName",          label: "Unit" },
  { id: "currentQty",        label: "Current Qty",    align: "right" },
  { id: "avgMonthlyOutflow", label: "Avg / Month",    align: "right" },
  { id: "monthsOfSupply",    label: "Months Supply",  align: "right" },
  { id: "stockValue",        label: "Stock Value",    align: "right" },
];

const COLS_DEAD = [
  { id: "branchCode",          label: "Branch" },
  { id: "itemName",            label: "Item Name" },
  { id: "itemCode",            label: "Code" },
  { id: "unitName",            label: "Unit" },
  { id: "currentQty",         label: "Current Qty",        align: "right" },
  { id: "lastTransactionDate", label: "Last Transaction" },
];

function SortableTable({ columns, rows, renderRow, emptyLabel }) {
  const [orderBy, setOrderBy] = useState(null);
  const [orderDir, setOrderDir] = useState("asc");

  const sorted = useMemo(() => {
    if (!orderBy) return rows;
    return [...rows].sort((a, b) => {
      const va = a[orderBy] ?? "";
      const vb = b[orderBy] ?? "";
      if (typeof va === "number" && typeof vb === "number")
        return orderDir === "asc" ? va - vb : vb - va;
      return orderDir === "asc"
        ? String(va).localeCompare(String(vb))
        : String(vb).localeCompare(String(va));
    });
  }, [rows, orderBy, orderDir]);

  const handleSort = (col) => {
    if (orderBy === col) setOrderDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setOrderBy(col); setOrderDir("asc"); }
  };

  return (
    <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: "52vh" }}>
      <Table size="small" stickyHeader>
        <TableHead>
          <TableRow>
            <TableCell sx={{ width: 36, py: 1, fontWeight: 700 }}>#</TableCell>
            {columns.map((col) => (
              <TableCell
                key={col.id}
                align={col.align}
                sx={{ fontWeight: 700, py: 1, whiteSpace: "nowrap" }}
              >
                <TableSortLabel
                  active={orderBy === col.id}
                  direction={orderBy === col.id ? orderDir : "asc"}
                  onClick={() => handleSort(col.id)}
                >
                  {col.label}
                </TableSortLabel>
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {sorted.map((row, i) => renderRow(row, i))}
          {!sorted.length && (
            <TableRow>
              <TableCell
                colSpan={columns.length + 1}
                align="center"
                sx={{ py: 5, color: "text.secondary" }}
              >
                {emptyLabel || "No data"}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

// ── main component ────────────────────────────────────────────────────────────
const StockAnomalyReport = () => {
  const tenancyId = localStorage.getItem("tenancyId");
  const token     = localStorage.getItem("jwtToken");

  const [branches, setBranches]     = useState([]);
  const [branchCode, setBranchCode] = useState(null);
  const [threshold, setThreshold]   = useState(6);
  const [loading, setLoading]       = useState(false);
  const [report, setReport]         = useState(null);
  const [error, setError]           = useState(null);
  const [tab, setTab]               = useState(0);

  useEffect(() => {
    fetch(`/api/${tenancyId}/branches`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((d) => setBranches(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, [tenancyId, token]);

  const fetchReport = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ threshold });
      if (branchCode) params.append("branchCode", branchCode);
      const resp = await fetch(
        `/api/${tenancyId}/reports/stock-anomaly?${params}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!resp.ok) throw new Error(`Server returned ${resp.status}`);
      setReport(await resp.json());
      setTab(0);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  // Top-10 overstocked items for horizontal bar chart
  const chartData = useMemo(() => {
    if (!report?.highStock?.length) return null;
    const top10 = [...report.highStock]
      .sort((a, b) => (b.monthsOfSupply ?? 9999) - (a.monthsOfSupply ?? 9999))
      .slice(0, 10);

    return {
      labels: top10.map((r) => r.itemName),
      datasets: [
        {
          label: "Months of Supply",
          data: top10.map((r) => r.monthsOfSupply ?? 999),
          backgroundColor: top10.map((r) =>
            r.monthsOfSupply === null || r.monthsOfSupply > 12
              ? "#ef5350"
              : "#ff9800"
          ),
          borderRadius: 4,
          maxBarThickness: 28,
        },
      ],
    };
  }, [report]);

  const chartOptions = useMemo(
    () => ({
      indexAxis: "y",
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        title: {
          display: true,
          text: "Top Overstocked Items — Months of Supply",
          font: { size: 13, weight: "600" },
          padding: { bottom: 12 },
        },
        tooltip: {
          callbacks: {
            label: (ctx) =>
              ctx.raw >= 999
                ? "No outflow recorded in last 6 months"
                : `${ctx.raw} months of supply`,
          },
        },
      },
      scales: {
        x: {
          title: { display: true, text: "Months" },
          ticks: { callback: (v) => (v >= 999 ? "∞" : v) },
        },
        y: { ticks: { font: { size: 11 } } },
      },
    }),
    []
  );

  // Excel exports
  const exportHighStock = () => {
    if (!report?.highStock?.length) return;
    const ws = XLSX.utils.json_to_sheet(
      report.highStock.map((r) => ({
        Branch:                r.branchCode,
        "Item Name":           r.itemName,
        "Item Code":           r.itemCode,
        Unit:                  r.unitName,
        "Current Qty":         r.currentQty,
        "Avg Monthly Outflow": r.avgMonthlyOutflow,
        "Months of Supply":    r.monthsOfSupply ?? "No Sales",
        "Stock Value":         r.stockValue,
      }))
    );
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "High Stock");
    saveAs(
      new Blob([XLSX.write(wb, { bookType: "xlsx", type: "array" })], {
        type: "application/octet-stream",
      }),
      "HighStockAnomaly.xlsx"
    );
  };

  const exportDeadStock = () => {
    if (!report?.deadStock?.length) return;
    const ws = XLSX.utils.json_to_sheet(
      report.deadStock.map((r) => ({
        Branch:             r.branchCode,
        "Item Name":        r.itemName,
        "Item Code":        r.itemCode,
        Unit:               r.unitName,
        "Current Qty":      r.currentQty,
        "Last Transaction": r.lastTransactionDate
          ? r.lastTransactionDate.split("T")[0]
          : "—",
      }))
    );
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Dead Stock");
    saveAs(
      new Blob([XLSX.write(wb, { bookType: "xlsx", type: "array" })], {
        type: "application/octet-stream",
      }),
      "DeadStockAnomaly.xlsx"
    );
  };

  const s = report?.summary;

  return (
    <Box sx={{ flexGrow: 1, p: 3, ml: "240px", mt: 2 }}>
      {/* ── Page header ── */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" fontWeight={700} gutterBottom>
          Stock Anomaly Report
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Detect overstocked items (excess months of supply) and dead inventory
          (zero stock with no transactions in the past 6 months).
        </Typography>
      </Box>

      {/* ── Filter bar ── */}
      <Paper
        elevation={1}
        sx={{ p: 2, mb: 3, display: "flex", gap: 2, alignItems: "center", flexWrap: "wrap", borderRadius: 2 }}
      >
        <Autocomplete
          size="small"
          sx={{ minWidth: 240 }}
          options={branches}
          getOptionLabel={(b) =>
            typeof b === "string" ? b : `${b.branchCode} — ${b.branchName}`
          }
          value={branches.find((b) => b.branchCode === branchCode) ?? null}
          onChange={(_, v) => setBranchCode(v?.branchCode ?? null)}
          renderInput={(params) => (
            <TextField {...params} label="Branch (leave blank for all)" />
          )}
          isOptionEqualToValue={(o, v) => o.branchCode === v.branchCode}
        />
        <TextField
          size="small"
          label="High-Stock Threshold (months)"
          type="number"
          value={threshold}
          onChange={(e) => setThreshold(Math.max(1, Number(e.target.value)))}
          sx={{ width: 220 }}
          inputProps={{ min: 1 }}
          helperText="Flag items with stock > N months of supply"
        />
        <Button
          variant="contained"
          onClick={fetchReport}
          disabled={loading}
          startIcon={
            loading ? (
              <CircularProgress size={16} color="inherit" />
            ) : (
              <RefreshIcon />
            )
          }
          sx={{ height: 40, alignSelf: "flex-start" }}
        >
          {loading ? "Generating…" : "Generate Report"}
        </Button>
      </Paper>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* ── Summary cards ── */}
      {s && (
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid xs={12} sm={6} md={3}>
            <SummaryCard
              icon={<TrendingUpIcon />}
              label="High Stock Items"
              value={s.highStockCount}
              color="#f44336"
              subtitle={`> ${s.highStockMonthsThreshold} months supply`}
            />
          </Grid>
          <Grid xs={12} sm={6} md={3}>
            <SummaryCard
              icon={<BlockIcon />}
              label="Dead Stock Items"
              value={s.deadStockCount}
              color="#757575"
              subtitle="Zero qty · no tx in 6 months"
            />
          </Grid>
          <Grid xs={12} sm={6} md={3}>
            <SummaryCard
              icon={<AttachMoneyIcon />}
              label="Tied-up Capital"
              value={fmtCurrency(s.totalHighStockValue)}
              color="#ff9800"
              subtitle="Est. value of high-stock items"
            />
          </Grid>
          <Grid xs={12} sm={6} md={3}>
            <SummaryCard
              icon={<WarningAmberIcon />}
              label="Total Anomalies"
              value={s.highStockCount + s.deadStockCount}
              color="#7b1fa2"
              subtitle="Requiring review"
            />
          </Grid>
        </Grid>
      )}

      {/* ── Chart (High Stock tab only) ── */}
      {report && tab === 0 && chartData && (
        <Paper
          elevation={1}
          sx={{ p: 2, mb: 3, borderRadius: 2, height: Math.min(60 + chartData.labels.length * 38, 340) }}
        >
          <Bar data={chartData} options={chartOptions} />
        </Paper>
      )}

      {/* ── Tabbed tables ── */}
      {report && (
        <Paper elevation={1} sx={{ borderRadius: 2, overflow: "hidden" }}>
          {/* Tab bar with export button */}
          <Box
            sx={{
              borderBottom: 1,
              borderColor: "divider",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              pr: 2,
            }}
          >
            <Tabs value={tab} onChange={(_, v) => setTab(v)}>
              <Tab
                label={
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <TrendingUpIcon fontSize="small" sx={{ color: "#f44336" }} />
                    High Stock
                    <Chip
                      size="small"
                      label={report.highStock.length}
                      sx={{ bgcolor: "#ffebee", color: "#c62828", fontWeight: 700 }}
                    />
                  </Box>
                }
              />
              <Tab
                label={
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <BlockIcon fontSize="small" sx={{ color: "#757575" }} />
                    Dead Stock
                    <Chip
                      size="small"
                      label={report.deadStock.length}
                      sx={{ bgcolor: "#f5f5f5", color: "#424242", fontWeight: 700 }}
                    />
                  </Box>
                }
              />
            </Tabs>

            <Button
              size="small"
              variant="outlined"
              startIcon={<FileDownloadIcon />}
              onClick={tab === 0 ? exportHighStock : exportDeadStock}
              disabled={
                tab === 0 ? !report.highStock.length : !report.deadStock.length
              }
            >
              Export Excel
            </Button>
          </Box>

          <Box sx={{ p: 2 }}>
            {/* High Stock table */}
            <TabPanel value={tab} index={0}>
              <SortableTable
                columns={COLS_HIGH}
                rows={report.highStock}
                emptyLabel="No high-stock anomalies found with current threshold"
                renderRow={(row, i) => {
                  const chip = supplyChipStyle(row.monthsOfSupply);
                  const isCritical =
                    row.monthsOfSupply === null || row.monthsOfSupply > 12;
                  return (
                    <TableRow
                      key={i}
                      hover
                      sx={{ bgcolor: isCritical ? "#fff5f5" : "inherit" }}
                    >
                      <TableCell sx={{ color: "text.disabled", fontSize: 11 }}>
                        {i + 1}
                      </TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          label={row.branchCode}
                          variant="outlined"
                          sx={{ fontSize: 11, height: 20 }}
                        />
                      </TableCell>
                      <TableCell sx={{ fontWeight: 500, maxWidth: 200 }}>
                        {row.itemName}
                      </TableCell>
                      <TableCell sx={{ color: "text.secondary", fontSize: 12 }}>
                        {row.itemCode}
                      </TableCell>
                      <TableCell sx={{ color: "text.secondary", fontSize: 12 }}>
                        {row.unitName}
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 500 }}>
                        {fmt(row.currentQty)}
                      </TableCell>
                      <TableCell align="right" sx={{ color: "text.secondary" }}>
                        {fmt(row.avgMonthlyOutflow)}
                      </TableCell>
                      <TableCell align="right">
                        <Chip
                          size="small"
                          label={chip.label}
                          sx={{
                            bgcolor: chip.bg,
                            color: chip.color,
                            fontWeight: 700,
                            fontSize: 12,
                          }}
                        />
                      </TableCell>
                      <TableCell
                        align="right"
                        sx={{ fontWeight: 600, color: isCritical ? "#c62828" : "inherit" }}
                      >
                        {fmtCurrency(row.stockValue)}
                      </TableCell>
                    </TableRow>
                  );
                }}
              />

              {/* Legend */}
              <Box sx={{ display: "flex", gap: 2, mt: 1.5, flexWrap: "wrap" }}>
                {[
                  { bg: "#ffebee", color: "#c62828", label: "> 12 months / No sales" },
                  { bg: "#fff8e1", color: "#e65100", label: "6–12 months" },
                  { bg: "#e8f5e9", color: "#2e7d32", label: "≤ 6 months" },
                ].map((l) => (
                  <Box key={l.label} sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                    <Box
                      sx={{
                        width: 12,
                        height: 12,
                        borderRadius: "50%",
                        bgcolor: l.bg,
                        border: `1.5px solid ${l.color}`,
                      }}
                    />
                    <Typography variant="caption" color="text.secondary">
                      {l.label}
                    </Typography>
                  </Box>
                ))}
              </Box>
            </TabPanel>

            {/* Dead Stock table */}
            <TabPanel value={tab} index={1}>
              <SortableTable
                columns={COLS_DEAD}
                rows={report.deadStock}
                emptyLabel="No dead-stock items found"
                renderRow={(row, i) => (
                  <TableRow
                    key={i}
                    hover
                    sx={{ bgcolor: i % 2 === 0 ? "#fafafa" : "inherit" }}
                  >
                    <TableCell sx={{ color: "text.disabled", fontSize: 11 }}>
                      {i + 1}
                    </TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={row.branchCode}
                        variant="outlined"
                        sx={{ fontSize: 11, height: 20 }}
                      />
                    </TableCell>
                    <TableCell sx={{ fontWeight: 500, maxWidth: 200 }}>
                      {row.itemName}
                    </TableCell>
                    <TableCell sx={{ color: "text.secondary", fontSize: 12 }}>
                      {row.itemCode}
                    </TableCell>
                    <TableCell sx={{ color: "text.secondary", fontSize: 12 }}>
                      {row.unitName}
                    </TableCell>
                    <TableCell
                      align="right"
                      sx={{
                        color: row.currentQty < 0 ? "error.main" : "text.secondary",
                        fontWeight: 500,
                      }}
                    >
                      {fmt(row.currentQty)}
                    </TableCell>
                    <TableCell sx={{ color: "text.secondary", fontSize: 12 }}>
                      {row.lastTransactionDate
                        ? row.lastTransactionDate.split("T")[0]
                        : "—"}
                    </TableCell>
                  </TableRow>
                )}
              />

              <Typography variant="caption" color="text.disabled" sx={{ mt: 1.5, display: "block" }}>
                Showing items with zero or negative stock and no inbound/outbound transactions in the last 6 months.
              </Typography>
            </TabPanel>
          </Box>
        </Paper>
      )}

      {/* ── Empty state ── */}
      {!report && !loading && (
        <Paper
          elevation={0}
          variant="outlined"
          sx={{
            p: 8,
            textAlign: "center",
            color: "text.secondary",
            borderRadius: 2,
            borderStyle: "dashed",
          }}
        >
          <InventoryIcon sx={{ fontSize: 56, opacity: 0.2, mb: 2 }} />
          <Typography variant="h6" fontWeight={500} gutterBottom>
            No report generated yet
          </Typography>
          <Typography variant="body2">
            Select a branch (or leave blank for all branches), set the threshold,
            and click <strong>Generate Report</strong>.
          </Typography>
        </Paper>
      )}
    </Box>
  );
};

export default StockAnomalyReport;
