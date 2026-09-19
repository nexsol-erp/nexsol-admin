import React, { useMemo, useState } from "react";
import {
  Box, Typography, Button, Paper, Table, TableHead, TableRow, TableCell, TableBody,
  TableContainer, TextField, Alert, CircularProgress, Chip, Tooltip, useTheme,
} from "@mui/material";
import { Bar } from "react-chartjs-2";
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement, Tooltip as ChartTooltip, Legend,
} from "chart.js";

ChartJS.register(CategoryScale, LinearScale, BarElement, ChartTooltip, Legend);

const PATTERN = {
  CONSISTENT_SHORTAGE: { label: "Consistent shortage", color: "error" },
  CONSISTENT_EXCESS:   { label: "Consistent excess",   color: "info" },
  MIXED:               { label: "Mixed",               color: "default" },
  INSUFFICIENT_DATA:   { label: "Too few days",        color: "default", variant: "outlined" },
};

// Diverging pair from the data-viz palette: red = shortage, blue = excess, gray midpoint.
const PALETTE = {
  light: { short: "#e34948", excess: "#2a78d6", mid: "#f0efec" },
  dark:  { short: "#e66767", excess: "#3987e5", mid: "#383835" },
};

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const mix = (a, b, t) => hex(a).map((v, i) => Math.round(v + (hex(b)[i] - v) * t));
const lum = ([r, g, b]) => {
  const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
const inkFor = (rgb) => (lum(rgb) > 0.4 ? "#0b0b0b" : "#ffffff");

const monthValue = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

/**
 * Monthly branch-wise analysis of the Excess / Shortage difference (Day End collected - CASH
 * sales): which branches are consistently short and which consistently over.
 */
export default function ExcessShortageMonthly() {
  const theme = useTheme();
  const pal = PALETTE[theme.palette.mode === "dark" ? "dark" : "light"];
  const tenancyId = localStorage.getItem("tenancyId");
  const headers = { Authorization: `Bearer ${localStorage.getItem("jwtToken")}` };

  const now = new Date();
  const [fromMonth, setFromMonth] = useState(monthValue(new Date(now.getFullYear(), now.getMonth() - 5, 1)));
  const [toMonth, setToMonth] = useState(monthValue(now));
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fmt = (n) => Number(n ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmt0 = (n) => Number(n ?? 0).toLocaleString("en-IN", { maximumFractionDigits: 0 });
  const signed = (n, f = fmt) => (Number(n) > 0 ? "+" : "") + f(n);
  const branchLabel = (b) => (b.branchName ? `${b.branchCode} - ${b.branchName}` : b.branchCode);
  const monthLabel = (m) => new Date(`${m}-01T00:00:00`).toLocaleString("en-IN", { month: "short", year: "2-digit" });
  const diffColor = (n) => (Number(n) > 0 ? pal.excess : Number(n) < 0 ? pal.short : theme.palette.text.primary);

  const handleRun = async () => {
    if (!fromMonth || !toMonth) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/${tenancyId}/reports/excess-shortage/monthly?fromMonth=${fromMonth}&toMonth=${toMonth}`, { headers });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Could not generate the report.");
      }
      const body = await res.json();
      if (!Array.isArray(body?.branches) || !Array.isArray(body?.months)) {
        throw new Error("The server did not return the monthly analysis. The backend may need updating.");
      }
      setData(body);
    } catch (e) {
      setError(e.message);
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  const branches = useMemo(() => data?.branches ?? [], [data]);
  const withData = branches.filter((b) => b.daysEntered > 0);
  const byPattern = (p) => branches.filter((b) => b.pattern === p);
  const shortBranches = byPattern("CONSISTENT_SHORTAGE");
  const excessBranches = byPattern("CONSISTENT_EXCESS");
  const missingTotal = branches.reduce((s, b) => s + b.missingDays, 0);

  // One scale for the whole heatmap so colour depth is comparable between cells.
  const maxAbs = useMemo(
    () => Math.max(1, ...branches.flatMap((b) => b.months.filter((c) => c.days > 0).map((c) => Math.abs(Number(c.difference))))),
    [branches]);

  const cellStyle = (cell) => {
    if (cell.days === 0) return { color: theme.palette.text.disabled };
    const v = Number(cell.difference);
    if (v === 0) return { backgroundColor: pal.mid, color: inkFor(hex(pal.mid)) };
    const t = Math.pow(Math.min(1, Math.abs(v) / maxAbs), 0.7);
    const rgb = mix(pal.mid, v < 0 ? pal.short : pal.excess, t);
    return { backgroundColor: `rgb(${rgb.join(",")})`, color: inkFor(rgb) };
  };

  const grid = theme.palette.divider;
  const ink = theme.palette.text.secondary;
  const chartData = {
    labels: withData.map((b) => b.branchCode),
    datasets: [
      { label: "Shortage days", data: withData.map((b) => -b.shortageDays), backgroundColor: pal.short,
        borderRadius: 4, borderSkipped: false, barThickness: 14 },
      { label: "Excess days", data: withData.map((b) => b.excessDays), backgroundColor: pal.excess,
        borderRadius: 4, borderSkipped: false, barThickness: 14 },
    ],
  };
  const chartOptions = {
    indexAxis: "y",
    maintainAspectRatio: false,
    scales: {
      x: { stacked: true, grid: { color: grid }, ticks: { color: ink, callback: (v) => Math.abs(v) },
           title: { display: true, text: "Days (with a Day End entry)", color: ink } },
      y: { stacked: true, grid: { display: false }, ticks: { color: ink } },
    },
    plugins: {
      legend: { position: "top", labels: { color: ink, usePointStyle: true, boxWidth: 8 } },
      tooltip: {
        callbacks: {
          title: (items) => branchLabel(withData[items[0].dataIndex]),
          label: (ctx) => `${ctx.dataset.label}: ${Math.abs(ctx.parsed.x)}`,
        },
      },
    },
  };

  const headCell = { color: "#fff", fontWeight: 700 };
  const patternChip = (p) => {
    const cfg = PATTERN[p] ?? PATTERN.MIXED;
    return <Chip size="small" label={cfg.label} color={cfg.color} variant={cfg.variant ?? "filled"} />;
  };
  const names = (list) => list.map((b) => b.branchCode).join(", ") || "None";

  return (
    <Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Difference (Day End collected − CASH sales) per branch and month, to show which branches are
        repeatedly short and which repeatedly over. Only days with a Day End entry are compared; days
        with cash sales but no entry are counted separately as “Missing”. A branch is called
        consistent when at least 60% of its days (minimum 5) fall the same way and the net agrees.
      </Typography>

      <Box display="flex" gap={2} alignItems="center" mb={2} flexWrap="wrap">
        <TextField label="From month" type="month" value={fromMonth} onChange={(e) => setFromMonth(e.target.value)}
                   InputLabelProps={{ shrink: true }} />
        <TextField label="To month" type="month" value={toMonth} onChange={(e) => setToMonth(e.target.value)}
                   InputLabelProps={{ shrink: true }} />
        <Button variant="contained" onClick={handleRun} disabled={loading || !fromMonth || !toMonth}>
          {loading ? <CircularProgress size={22} /> : "Run Analysis"}
        </Button>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {data && branches.length === 0 && <Alert severity="info">No Day End or cash sales found in this period.</Alert>}

      {data && branches.length > 0 && (
        <>
          <Box display="flex" gap={2} flexWrap="wrap" mb={3}>
            {[
              { title: "Consistent shortage", list: shortBranches, color: pal.short },
              { title: "Consistent excess", list: excessBranches, color: pal.excess },
            ].map((t) => (
              <Paper key={t.title} variant="outlined" sx={{ p: 2, minWidth: 220, flex: "1 1 220px", borderLeft: `4px solid ${t.color}` }}>
                <Typography variant="caption" color="text.secondary">{t.title}</Typography>
                <Typography variant="h4">{t.list.length}</Typography>
                <Typography variant="body2" color="text.secondary">{names(t.list)}</Typography>
              </Paper>
            ))}
            <Paper variant="outlined" sx={{ p: 2, minWidth: 220, flex: "1 1 220px" }}>
              <Typography variant="caption" color="text.secondary">Days with cash sales but no Day End</Typography>
              <Typography variant="h4">{missingTotal}</Typography>
              <Typography variant="body2" color="text.secondary">
                {names(branches.filter((b) => b.missingDays > 0).sort((a, b) => b.missingDays - a.missingDays).slice(0, 5))}
              </Typography>
            </Paper>
          </Box>

          <Paper sx={{ p: 2, mb: 3 }}>
            <Typography variant="subtitle1" fontWeight="bold">Net difference by branch and month</Typography>
            <Box display="flex" alignItems="center" gap={1} my={1}>
              <Typography variant="caption" sx={{ color: pal.short, fontWeight: 700 }}>Shortage</Typography>
              <Box sx={{ width: 160, height: 10, borderRadius: 1,
                         background: `linear-gradient(to right, ${pal.short}, ${pal.mid}, ${pal.excess})` }} />
              <Typography variant="caption" sx={{ color: pal.excess, fontWeight: 700 }}>Excess</Typography>
              <Typography variant="caption" color="text.secondary">(— = no Day End that month)</Typography>
            </Box>
            <TableContainer>
              <Table size="small" sx={{ "& td, & th": { borderColor: theme.palette.background.paper, borderWidth: 2 } }}>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700 }}>Branch</TableCell>
                    {data.months.map((m) => (
                      <TableCell key={m} align="center" sx={{ fontWeight: 700 }}>{monthLabel(m)}</TableCell>
                    ))}
                    <TableCell align="right" sx={{ fontWeight: 700 }}>Total</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {branches.map((b) => (
                    <TableRow key={b.branchCode}>
                      <TableCell sx={{ whiteSpace: "nowrap" }}>{branchLabel(b)}</TableCell>
                      {b.months.map((c) => (
                        <Tooltip key={c.month} arrow
                                 title={c.days === 0 ? "No Day End entries" : `${signed(c.difference)} over ${c.days} day(s)`}>
                          <TableCell align="center" sx={{ ...cellStyle(c), minWidth: 64, fontVariantNumeric: "tabular-nums" }}>
                            {c.days === 0 ? "—" : signed(c.difference, fmt0)}
                          </TableCell>
                        </Tooltip>
                      ))}
                      <TableCell align="right" sx={{ fontWeight: 700, color: diffColor(b.totalDifference), fontVariantNumeric: "tabular-nums" }}>
                        {signed(b.totalDifference, fmt0)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>

          {withData.length > 0 && (
            <Paper sx={{ p: 2, mb: 3 }}>
              <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                How often each branch is short or over
              </Typography>
              <Box sx={{ height: Math.max(220, withData.length * 30 + 90) }}>
                <Bar data={chartData} options={chartOptions} />
              </Box>
            </Paper>
          )}

          <TableContainer component={Paper}>
            <Table size="small">
              <TableHead sx={{ bgcolor: "#1976d2" }}>
                <TableRow>
                  <TableCell sx={headCell}>Branch</TableCell>
                  <TableCell align="right" sx={headCell}>Days entered</TableCell>
                  <TableCell align="right" sx={headCell}>Shortage days</TableCell>
                  <TableCell align="right" sx={headCell}>Excess days</TableCell>
                  <TableCell align="right" sx={headCell}>Tally days</TableCell>
                  <TableCell align="right" sx={headCell}>Missing</TableCell>
                  <TableCell align="right" sx={headCell}>Avg / day</TableCell>
                  <TableCell align="right" sx={headCell}>Total</TableCell>
                  <TableCell align="center" sx={headCell}>Pattern</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {branches.map((b) => (
                  <TableRow key={b.branchCode}>
                    <TableCell>{branchLabel(b)}</TableCell>
                    <TableCell align="right">{b.daysEntered}</TableCell>
                    <TableCell align="right">{b.shortageDays}</TableCell>
                    <TableCell align="right">{b.excessDays}</TableCell>
                    <TableCell align="right">{b.tallyDays}</TableCell>
                    <TableCell align="right">{b.missingDays}</TableCell>
                    <TableCell align="right" sx={{ color: diffColor(b.avgDailyDifference) }}>{signed(b.avgDailyDifference)}</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700, color: diffColor(b.totalDifference) }}>{signed(b.totalDifference)}</TableCell>
                    <TableCell align="center">{patternChip(b.pattern)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </>
      )}
    </Box>
  );
}
