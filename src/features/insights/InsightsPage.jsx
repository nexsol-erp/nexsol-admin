import React, { useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  LinearProgress,
  MenuItem,
  Paper,
  Select,
  Stack,
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
import { useNavigate } from "react-router-dom";
import { useInsights, dismissInsight, fetchInsightRows } from "./useInsights";

const SEVERITY_COLOUR = {
  CRITICAL: "error",
  WARNING: "warning",
  INFO: "info",
};

const TYPES = [
  "MARGIN_DECLINE",
  "SALES_DECLINE",
  "INVENTORY_RISK",
  "TRANSFER_OPPORTUNITY",
  "DISCOUNT_ANOMALY",
  "EXPENSE_ANOMALY",
  "COST_COVERAGE",
  "DATA_QUALITY",
];

const money = (amount, currency) => {
  if (amount === null || amount === undefined) return "—";
  const value = Number(amount);
  if (Number.isNaN(value)) return "—";
  return `${currency || "INR"} ${value.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
};

const shortDate = (value) => (value ? String(value).slice(0, 10) : "—");

/**
 * What is at stake, in the unit the rule actually measured.
 *
 * A data-quality rule has no money to report — the amounts on those purchases are right, it is
 * the dates that are wrong — so its materiality is a row count. Rendering that through the
 * money formatter produced "INR 96" against a finding about 96 mistyped dates, which reads as
 * a trivial sum and is the fastest way to have a CRITICAL ignored.
 */
const atStake = (row) =>
  row.insight_type === "DATA_QUALITY"
    ? `${Number(row.materiality_amount || 0).toLocaleString()} rows`
    : money(row.materiality_amount, row.currency);

/**
 * One cell of a drill-down row.
 *
 * The server says how each column should read — text, date, money, number — because it is the
 * rule that knows whether a figure is a count or a value, and a screen guessing from the
 * column name is how a quantity ends up rendered as rupees.
 */
const cell = (value, type, currency) => {
  if (value === null || value === undefined || value === "") return "—";
  if (type === "date") return shortDate(value);
  if (type === "money") return money(value, currency);
  if (type === "number") return Number(value).toLocaleString();
  return String(value);
};

/** Fills {column} placeholders in a route the server supplied, e.g. /x?id={id}. */
const hrefFor = (template, row) =>
  template.replace(/\{(\w+)\}/g, (_, key) => encodeURIComponent(row[key] ?? ""));

/**
 * What the nightly sweep found.
 *
 * Two things this screen deliberately does:
 *
 * It shows `data_through` next to every row. An insight drawn from figures that stopped
 * updating a week ago is not the same claim as one drawn from last night's, and a reader who
 * cannot tell them apart will eventually act on the stale one.
 *
 * It refuses to dismiss without a reason. "This is wrong" and "this is right but not worth
 * acting on" need opposite responses — fix the rule, or leave it alone — and afterwards both
 * look identical: an insight that stopped appearing.
 */
export default function InsightsPage() {
  const tenancyId = localStorage.getItem("tenancyId");

  const [status, setStatus] = useState("OPEN");
  const [type, setType] = useState("");
  const [severity, setSeverity] = useState("");

  const { insights, scope, state, error, reload } = useInsights({
    tenancyId,
    status,
    type,
    severity,
  });

  const navigate = useNavigate();

  // The insight whose rows are being read, and what came back. Held separately from the list
  // so closing the dialog cannot disturb the table underneath it.
  const [openRowsFor, setOpenRowsFor] = useState(null);
  const [rowsState, setRowsState] = useState("idle"); // idle | loading | ready | error
  const [rowsBody, setRowsBody] = useState(null);
  const [rowsError, setRowsError] = useState(null);

  const [dismissing, setDismissing] = useState(null); // the insight being dismissed
  const [reason, setReason] = useState("");
  const [dismissError, setDismissError] = useState(null);
  const [saving, setSaving] = useState(false);

  const showRows = async (insight) => {
    setOpenRowsFor(insight);
    setRowsBody(null);
    setRowsError(null);
    setRowsState("loading");

    const result = await fetchInsightRows(tenancyId, insight.id);
    if (!result.ok) {
      setRowsError(result.error);
      setRowsState("error");
      return;
    }
    setRowsBody(result);
    setRowsState("ready");
  };

  const openDismiss = (insight) => {
    setDismissing(insight);
    setReason("");
    setDismissError(null);
  };

  const confirmDismiss = async () => {
    setSaving(true);
    setDismissError(null);
    const result = await dismissInsight(tenancyId, dismissing.id, reason.trim());
    setSaving(false);

    if (!result.ok) {
      // The dialog stays open and the typed reason survives. Closing on failure would lose
      // what the user wrote and leave them unsure whether it took effect.
      setDismissError(result.error);
      return;
    }
    setDismissing(null);
    reload();
  };

  // Money only. A row count summed into a currency total is not a smaller error than showing
  // it in the column — it is the same error, spread across every other insight on the screen.
  const totalAtStake = useMemo(
    () =>
      insights.reduce((sum, row) => {
        if (row.insight_type === "DATA_QUALITY") return sum;
        const value = Number(row.materiality_amount);
        return Number.isNaN(value) ? sum : sum + value;
      }, 0),
    [insights]
  );

  if (state === "notFound") {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="info">
          Insights are not switched on for this company.
        </Alert>
      </Box>
    );
  }

  if (state === "denied") {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="warning">You do not have access to insights.</Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.5 }}>
        Insights
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Found by the nightly sweep across{" "}
        {scope.length === 1 ? "1 branch" : `${scope.length} branches`} you can see.
      </Typography>

      <Stack direction="row" spacing={2} sx={{ mb: 2, flexWrap: "wrap" }}>
        <FormControl size="small" sx={{ minWidth: 150 }}>
          <InputLabel>Status</InputLabel>
          <Select label="Status" value={status} onChange={(e) => setStatus(e.target.value)}>
            <MenuItem value="OPEN">Open</MenuItem>
            <MenuItem value="DISMISSED">Dismissed</MenuItem>
            <MenuItem value="RESOLVED">Resolved</MenuItem>
            <MenuItem value="">Any</MenuItem>
          </Select>
        </FormControl>

        <FormControl size="small" sx={{ minWidth: 200 }}>
          <InputLabel>Type</InputLabel>
          <Select label="Type" value={type} onChange={(e) => setType(e.target.value)}>
            <MenuItem value="">Any</MenuItem>
            {TYPES.map((t) => (
              <MenuItem key={t} value={t}>
                {t.replace(/_/g, " ")}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl size="small" sx={{ minWidth: 150 }}>
          <InputLabel>Severity</InputLabel>
          <Select label="Severity" value={severity} onChange={(e) => setSeverity(e.target.value)}>
            <MenuItem value="">Any</MenuItem>
            <MenuItem value="CRITICAL">Critical</MenuItem>
            <MenuItem value="WARNING">Warning</MenuItem>
            <MenuItem value="INFO">Info</MenuItem>
          </Select>
        </FormControl>

        <Box sx={{ flexGrow: 1 }} />

        {insights.length > 0 && (
          <Typography variant="body2" sx={{ alignSelf: "center" }} color="text.secondary">
            {insights.length} insight{insights.length === 1 ? "" : "s"} ·{" "}
            {money(totalAtStake, insights[0]?.currency)} at stake
          </Typography>
        )}
      </Stack>

      {state === "loading" && <LinearProgress sx={{ mb: 2 }} />}
      {state === "error" && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {state === "ready" && insights.length === 0 && (
        <Alert severity="success">
          Nothing found. Either the sweep has not run yet, or there is nothing to report.
        </Alert>
      )}

      {insights.length > 0 && (
        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ "& th": { fontWeight: 700, bgcolor: "#1976d2", color: "#fff" } }}>
                <TableCell>Branch</TableCell>
                <TableCell>Severity</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Summary</TableCell>
                <TableCell align="right">At stake</TableCell>
                <TableCell>Data through</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Action</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {insights.map((row) => (
                <TableRow key={row.id} hover>
                  {/* Branch code alone: every branch shares one branch_name. */}
                  <TableCell sx={{ fontFamily: "monospace" }}>{row.branch_code}</TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      label={row.severity}
                      color={SEVERITY_COLOUR[row.severity] || "default"}
                    />
                  </TableCell>
                  <TableCell>{String(row.insight_type || "").replace(/_/g, " ")}</TableCell>
                  <TableCell sx={{ maxWidth: 380 }}>
                    {row.summary}
                    {row.fallback_used && (
                      <Tooltip title="Written without the AI provider — the figures are unaffected, the wording is plainer.">
                        <Chip size="small" label="fallback" sx={{ ml: 1 }} variant="outlined" />
                      </Tooltip>
                    )}
                  </TableCell>
                  <TableCell align="right">{atStake(row)}</TableCell>
                  {/* The age of the data, never the age of the insight. A claim drawn from
                      figures that stopped updating a week ago is a different claim. */}
                  <TableCell>{shortDate(row.data_through)}</TableCell>
                  <TableCell>
                    {row.status}
                    {row.status === "DISMISSED" && row.dismissed_reason && (
                      <Tooltip title={`${row.dismissed_by}: ${row.dismissed_reason}`}>
                        <Chip size="small" label="why" sx={{ ml: 1 }} variant="outlined" />
                      </Tooltip>
                    )}
                  </TableCell>
                  <TableCell align="right">
                    {/* Before Dismiss, deliberately: the rows are what tell somebody whether
                        the finding is worth acting on, and putting the only cheap answer
                        second invites the expensive one. */}
                    <Button size="small" onClick={() => showRows(row)}>
                      Rows
                    </Button>
                    {row.status === "OPEN" && (
                      <Button size="small" onClick={() => openDismiss(row)}>
                        Dismiss
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* The rows behind the count.

          An insight groups on purpose — 96 bad purchases are one item of work, not 96 — and
          that is the right unit for deciding whether to act and the wrong one for acting.
          This is the way through to the documents, and the Correct link is the way to fix
          one without hunting for it in a date-range search. */}
      <Dialog
        open={Boolean(openRowsFor)}
        onClose={() => setOpenRowsFor(null)}
        fullWidth
        maxWidth="lg"
      >
        <DialogTitle>{rowsBody?.title || openRowsFor?.summary || "Rows"}</DialogTitle>
        <DialogContent>
          {rowsState === "loading" && <LinearProgress sx={{ my: 2 }} />}

          {rowsState === "error" && (
            <Alert severity="error" sx={{ my: 1 }}>
              {rowsError}
            </Alert>
          )}

          {rowsState === "ready" && !rowsBody.supported && (
            <Alert severity="info" sx={{ my: 1 }}>
              This kind of insight is a total rather than a list, so there are no individual
              rows behind it. The evidence is in the summary.
            </Alert>
          )}

          {rowsState === "ready" && rowsBody.supported && rowsBody.rows.length === 0 && (
            <Alert severity="success" sx={{ my: 1 }}>
              Nothing left to fix — every row behind this insight has since been corrected. It
              will close on the next sweep.
            </Alert>
          )}

          {rowsState === "ready" && rowsBody.supported && rowsBody.rows.length > 0 && (
            <>
              {rowsBody.truncated && (
                <Alert severity="warning" sx={{ mb: 1 }}>
                  Showing the first {rowsBody.rows.length}. There are more — clear these and
                  reopen for the rest.
                </Alert>
              )}
              <TableContainer component={Paper} sx={{ maxHeight: 460 }}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow
                      sx={{ "& th": { fontWeight: 700, bgcolor: "#1976d2", color: "#fff" } }}
                    >
                      {rowsBody.columns.map((column) => (
                        <TableCell
                          key={column.key}
                          align={
                            column.type === "money" || column.type === "number"
                              ? "right"
                              : "left"
                          }
                        >
                          {column.label}
                        </TableCell>
                      ))}
                      {rowsBody.actionHref && <TableCell align="right">Fix</TableCell>}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {rowsBody.rows.map((row, index) => (
                      <TableRow key={row.id || index} hover>
                        {rowsBody.columns.map((column) => (
                          <TableCell
                            key={column.key}
                            align={
                              column.type === "money" || column.type === "number"
                                ? "right"
                                : "left"
                            }
                            sx={
                              column.key === "voucher_number"
                                ? { fontFamily: "monospace", whiteSpace: "nowrap" }
                                : undefined
                            }
                          >
                            {cell(row[column.key], column.type, openRowsFor?.currency)}
                          </TableCell>
                        ))}
                        {rowsBody.actionHref && (
                          <TableCell align="right">
                            <Button
                              size="small"
                              onClick={() =>
                                navigate(hrefFor(rowsBody.actionHref, row))
                              }
                            >
                              {rowsBody.actionLabel || "Open"}
                            </Button>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenRowsFor(null)}>Close</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(dismissing)} onClose={() => setDismissing(null)} fullWidth maxWidth="sm">
        <DialogTitle>Dismiss this insight</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {dismissing?.summary}
          </Typography>
          <Typography variant="body2" sx={{ mb: 2 }}>
            Why is this not worth acting on? If the insight is simply wrong, say so — that is
            how the rule gets fixed rather than quietly ignored.
          </Typography>
          <TextField
            autoFocus
            fullWidth
            multiline
            minRows={2}
            label="Reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            inputProps={{ maxLength: 500 }}
            helperText={`${reason.length}/500`}
          />
          {dismissError && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {dismissError}
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDismissing(null)} disabled={saving}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={confirmDismiss}
            disabled={saving || reason.trim().length === 0}
          >
            Dismiss
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
