import React, { useState, useEffect, useCallback } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Collapse,
  Divider,
  Paper,
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
} from "@mui/material";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import RefreshIcon   from "@mui/icons-material/Refresh";
import HelpOutline   from "@mui/icons-material/HelpOutline";
import dayjs         from "dayjs";
import { useNavigate } from "react-router-dom";

const STATUS_COLOR = {
  SUCCESS: "success",
  RUNNING: "info",
  FAILED:  "error",
  SKIPPED: "default",
};

const fmtNum = (n) => (n ?? 0).toLocaleString("en-IN");
const fmtDt  = (s) => (s ? dayjs(s).format("DD-MMM-YYYY HH:mm") : "—");
const fmtD   = (s) => (s ? dayjs(s).format("DD-MMM-YYYY") : "—");

/**
 * Setup ▸ Cost & Profit Stamping.
 *
 * Front end for the nightly job that writes item-wise cost and profit onto every sales
 * line. Replaces having to curl /cost-stamp/run and /cost-stamp/status by hand.
 */
const CostStampingPage = () => {
  const navigate  = useNavigate();
  const tenancyId = localStorage.getItem("tenancyId") || "";
  const token     = localStorage.getItem("jwtToken")  || "";
  const headers   = { Authorization: `Bearer ${token}` };

  const [status,  setStatus]  = useState(null);
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [showHelp, setShowHelp] = useState(true);

  const [fromDate, setFromDate] = useState(dayjs().subtract(7, "day").format("YYYY-MM-DD"));
  const [toDate,   setToDate]   = useState(dayjs().subtract(1, "day").format("YYYY-MM-DD"));

  const [snack, setSnack] = useState({ open: false, msg: "", severity: "success" });
  const toast = (msg, severity = "success") => setSnack({ open: true, msg, severity });

  const loadStatus = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await fetch(`/api/${tenancyId}/cost-stamp/status`, { headers });
      const data = await res.json();
      setStatus(data);
    } catch (e) {
      toast("Failed to load status: " + e.message, "error");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenancyId, token]);

  useEffect(() => { loadStatus(); }, [loadStatus]);

  const preset = (from, to) => { setFromDate(from); setToDate(to); };

  const runNow = async () => {
    if (!fromDate || !toDate) { toast("Pick both dates", "error"); return; }
    if (dayjs(toDate).isBefore(dayjs(fromDate))) { toast("To Date is before From Date", "error"); return; }

    setRunning(true);
    try {
      const res = await fetch(
        `/api/${tenancyId}/cost-stamp/run?fromDate=${fromDate}&toDate=${toDate}`,
        { method: "POST", headers }
      );
      const data = await res.json();
      if (!res.ok || data.error) {
        toast(data.error || "Run failed", "error");
      } else if (data.status === "SKIPPED") {
        toast("Skipped — a run is already in progress for this company.", "warning");
      } else if (data.status === "FAILED") {
        toast("Run failed: " + (data.error || "see server log"), "error");
      } else {
        toast(
          `Done. ${fmtNum(data.linesWritten)} line(s) updated, ` +
          `${fmtNum(data.linesSeen)} covered, ${fmtNum(data.linesUncosted)} still without a cost.`
        );
      }
      loadStatus();
    } catch (e) {
      toast("Run failed: " + e.message, "error");
    } finally {
      setRunning(false);
    }
  };

  const cov  = status?.coverage ?? {};
  const runs = status?.runs ?? [];
  const notReady = status && status.ready === false;

  return (
    <Box sx={{ p: 2 }}>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1 }}>
        <Typography variant="h6" fontWeight={700}>Cost &amp; Profit Stamping</Typography>
        <Box sx={{ display: "flex", gap: 1 }}>
          <Button size="small" startIcon={<HelpOutline />} onClick={() => setShowHelp(v => !v)}>
            {showHelp ? "Hide Help" : "Show Help"}
          </Button>
          <Button size="small" startIcon={<RefreshIcon />} onClick={loadStatus} disabled={loading}>
            Refresh
          </Button>
        </Box>
      </Box>

      {/* ── Help ── */}
      <Collapse in={showHelp}>
        <Paper sx={{ p: 2, mb: 2 }}>
          <Typography variant="subtitle2" fontWeight={700} gutterBottom>
            What this page does
          </Typography>
          <Typography variant="body2" paragraph>
            Every night the system works out what each item sold actually <b>cost</b>, and stores
            the cost and profit against that sales line. The Branch Profit Report then simply
            adds up stored numbers instead of recalculating cost every time it is opened. That
            makes the report fast, lets it cover long date ranges, and — most importantly — means
            last month&rsquo;s profit does not silently change when a purchase or transfer rate is
            edited today.
          </Typography>

          <Divider sx={{ my: 1.5 }} />

          <Typography variant="subtitle2" fontWeight={700} gutterBottom>
            How the cost of an item is decided
          </Typography>
          <Typography variant="body2" component="div">
            <ol style={{ margin: "4px 0 8px 18px", padding: 0 }}>
              <li>
                <b>Manual rate</b> — if the item has a manually entered cost in{" "}
                <b>Cost Price History</b>, that rate is always used, whatever date it was entered.
                A rate entered for a specific branch beats one entered for all branches.
              </li>
              <li>
                Otherwise the <b>most recent</b> of the item&rsquo;s purchase rate, stock-transfer-in
                rate, or production rate, on or before the sale date — whichever happened last.
              </li>
              <li>
                If none exists, the line is left <b>uncosted</b>. Its sales value still counts as
                sales, but it is excluded from cost and profit so a missing rate can never look
                like free stock.
              </li>
            </ol>
            Profit = Sales Amount − (Cost Rate × Quantity).
          </Typography>

          <Divider sx={{ my: 1.5 }} />

          <Typography variant="subtitle2" fontWeight={700} gutterBottom>
            When it runs on its own
          </Typography>
          <Typography variant="body2" paragraph>
            Automatically at <b>01:30 every night</b>, re-covering the <b>last 7 days</b> — not just
            yesterday. POS data often syncs late and bills get edited after the fact, so a
            one-day-only job would miss both. You do not need to do anything for normal operation.
          </Typography>

          <Typography variant="subtitle2" fontWeight={700} gutterBottom>
            When to run it by hand
          </Typography>
          <Typography variant="body2" component="div">
            <ul style={{ margin: "4px 0 8px 18px", padding: 0 }}>
              <li>
                After you correct a rate in <b>Cost Price History</b> — re-run the dates those
                items were sold so the report picks up the new cost.
              </li>
              <li>
                To <b>backfill older months</b> that were never costed. Do this one month at a
                time, oldest first.
              </li>
              <li>If a night was missed because the server was down.</li>
            </ul>
          </Typography>

          <Alert severity="success" sx={{ mt: 1 }}>
            <b>Safe to run as often as you like.</b> Re-running the same dates does not create
            duplicates and does not change lines that are already correct — it only rewrites what
            actually differs. Only one run per company happens at a time; a second is skipped
            rather than queued.
          </Alert>

          <Alert severity="info" sx={{ mt: 1 }}>
            Long ranges take a while — roughly a minute per busy month per branch. Backfill in
            monthly chunks rather than one large range, and leave the page open until it finishes.
          </Alert>
        </Paper>
      </Collapse>

      {notReady && (
        <Alert severity="error" sx={{ mb: 2 }}>
          This company database has not been upgraded yet — migrations <b>V042</b> and <b>V043</b>{" "}
          are missing. Cost stamping cannot run until they are applied. Contact your system
          administrator.
        </Alert>
      )}

      {/* ── Coverage ── */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Typography variant="subtitle2" fontWeight={700} gutterBottom>
          Current coverage
        </Typography>
        {loading && !status ? <CircularProgress size={20} /> : (
          <Box sx={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
            <Box>
              <Typography variant="caption" color="text.secondary" display="block">Costed from</Typography>
              <Typography fontWeight={700}>{fmtD(cov.costed_from)}</Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary" display="block">Costed up to</Typography>
              <Typography fontWeight={700}>{fmtD(cov.costed_to)}</Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary" display="block">Sales lines stored</Typography>
              <Typography fontWeight={700}>{fmtNum(cov.lines)}</Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary" display="block">Without a cost</Typography>
              <Tooltip title="These lines count as sales but are excluded from cost and profit. Set their rate in Cost Price History, then re-run those dates.">
                <Typography fontWeight={700}
                  color={cov.uncosted_lines > 0 ? "warning.main" : "text.primary"}>
                  {fmtNum(cov.uncosted_lines)}
                </Typography>
              </Tooltip>
            </Box>
          </Box>
        )}
        {cov.uncosted_lines > 0 && (
          <Box sx={{ mt: 1.5 }}>
            <Button size="small" variant="outlined" onClick={() => navigate("/cost-price-history")}>
              Set missing cost prices
            </Button>
          </Box>
        )}
      </Paper>

      {/* ── Run ── */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Typography variant="subtitle2" fontWeight={700} gutterBottom>
          Run for a date range
        </Typography>
        <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1.5 }}>
          Dates are the <b>sale</b> dates to re-cost, not today&rsquo;s date.
        </Typography>

        <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", mb: 1.5 }}>
          <Chip label="Last 7 days"  size="small" variant="outlined" onClick={() =>
            preset(dayjs().subtract(7, "day").format("YYYY-MM-DD"), dayjs().subtract(1, "day").format("YYYY-MM-DD"))} />
          <Chip label="This month"   size="small" variant="outlined" onClick={() =>
            preset(dayjs().startOf("month").format("YYYY-MM-DD"), dayjs().format("YYYY-MM-DD"))} />
          <Chip label="Last month"   size="small" variant="outlined" onClick={() =>
            preset(dayjs().subtract(1, "month").startOf("month").format("YYYY-MM-DD"),
                   dayjs().subtract(1, "month").endOf("month").format("YYYY-MM-DD"))} />
        </Box>

        <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap", alignItems: "center" }}>
          <TextField label="From Date" type="date" size="small" value={fromDate}
            onChange={(e) => setFromDate(e.target.value)} InputLabelProps={{ shrink: true }} />
          <TextField label="To Date" type="date" size="small" value={toDate}
            onChange={(e) => setToDate(e.target.value)} InputLabelProps={{ shrink: true }} />
          <Button variant="contained" startIcon={running ? <CircularProgress size={16} color="inherit" /> : <PlayArrowIcon />}
            onClick={runNow} disabled={running || notReady}>
            {running ? "Running…" : "Run Now"}
          </Button>
        </Box>
      </Paper>

      {/* ── History ── */}
      <Paper sx={{ p: 1 }}>
        <Typography variant="subtitle2" fontWeight={700} sx={{ px: 1, py: 0.5 }}>
          Recent runs
        </Typography>
        <TableContainer sx={{ overflowX: "auto" }}>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ "& th": { fontWeight: 700, bgcolor: "#1976d2", color: "#fff" } }}>
                <TableCell sx={{ color: "#fff" }}>Started</TableCell>
                <TableCell sx={{ color: "#fff" }}>Sale Dates Covered</TableCell>
                <TableCell sx={{ color: "#fff" }}>Trigger</TableCell>
                <TableCell sx={{ color: "#fff" }}>Status</TableCell>
                <TableCell align="right" sx={{ color: "#fff" }}>Lines Covered</TableCell>
                <TableCell align="right" sx={{ color: "#fff" }}>Lines Updated</TableCell>
                <TableCell align="right" sx={{ color: "#fff" }}>Without Cost</TableCell>
                <TableCell sx={{ color: "#fff" }}>Finished</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {runs.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} align="center" sx={{ py: 3, color: "text.secondary" }}>
                    No runs recorded yet. The nightly job runs at 01:30, or use Run Now above.
                  </TableCell>
                </TableRow>
              )}
              {runs.map((r) => (
                <TableRow key={r.id}>
                  <TableCell sx={{ whiteSpace: "nowrap" }}>{fmtDt(r.started_at)}</TableCell>
                  <TableCell sx={{ whiteSpace: "nowrap" }}>
                    {fmtD(r.from_date)} → {fmtD(r.to_date)}
                  </TableCell>
                  <TableCell>
                    <Chip size="small" variant="outlined"
                      label={r.trigger_type === "NIGHTLY" ? "Automatic" : "Manual"} />
                  </TableCell>
                  <TableCell>
                    <Tooltip title={r.error_message || ""}>
                      <Chip size="small" label={r.status} color={STATUS_COLOR[r.status] || "default"} />
                    </Tooltip>
                  </TableCell>
                  <TableCell align="right">{fmtNum(r.lines_seen)}</TableCell>
                  <TableCell align="right">{fmtNum(r.lines_written)}</TableCell>
                  <TableCell align="right"
                    sx={{ color: r.lines_uncosted > 0 ? "warning.main" : "text.disabled" }}>
                    {fmtNum(r.lines_uncosted)}
                  </TableCell>
                  <TableCell sx={{ whiteSpace: "nowrap" }}>{fmtDt(r.finished_at)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
        <Typography variant="caption" color="text.secondary" sx={{ px: 1, py: 1, display: "block" }}>
          <b>Lines Covered</b> is every sales line in the range. <b>Lines Updated</b> is only those
          whose cost or amount actually changed — a small number on a repeat run is normal and
          means nothing needed correcting.
        </Typography>
      </Paper>

      <Snackbar open={snack.open} autoHideDuration={6000}
        onClose={() => setSnack(s => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}>
        <Alert severity={snack.severity} onClose={() => setSnack(s => ({ ...s, open: false }))}>
          {snack.msg}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default CostStampingPage;
