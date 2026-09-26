// SubmissionsPanel.jsx
// Every invoice sent to a tax authority: totals, a filterable list, and the full history of one
// submission with Retry / Check status / Cancel.
import React, { useCallback, useEffect, useState } from "react";
import {
  Alert, Box, Button, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle,
  Grid, MenuItem, Paper, Stack, Table, TableBody, TableCell, TableHead, TablePagination, TableRow,
  TextField, Typography,
} from "@mui/material";
import {
  ALL_STATUSES, cancelSubmission, dashboard, formatDateTime, listSubmissions, refreshSubmission,
  retrySubmission, statusColor, submissionDetail,
} from "./regulatoryApi";

const TILES = [
  ["submitted", "Submitted"],
  ["accepted", "Accepted"],
  ["rejected", "Rejected"],
  ["pending", "Pending"],
  ["retryRequired", "Waiting to retry"],
  ["validationFailed", "Failed validation"],
  ["overdue", "Overdue"],
  ["certificatesExpiring", "Certificates expiring"],
];

const PAGE_SIZE = 25;

const SubmissionsPanel = () => {
  const [filters, setFilters] = useState({ status: "", invoiceNumber: "", from: "", to: "" });
  const [applied, setApplied] = useState(filters);
  const [page, setPage] = useState(0);
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [totals, setTotals] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [openId, setOpenId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [list, dash] = await Promise.all([
      listSubmissions({ ...applied, page, size: PAGE_SIZE }),
      dashboard({ from: applied.from, to: applied.to }),
    ]);
    setError(list.ok ? "" : list.message);
    setRows(list.ok ? list.data.items : []);
    setTotal(list.ok ? list.data.total : 0);
    setTotals(dash.ok ? dash.data : null);
    setLoading(false);
  }, [applied, page]);

  useEffect(() => {
    load();
  }, [load]);

  const set = (field) => (e) => setFilters((f) => ({ ...f, [field]: e.target.value }));

  return (
    <Box>
      {totals && (
        <Grid container spacing={1} mb={2}>
          {TILES.map(([key, label]) => (
            <Grid item xs={6} sm={3} md={1.5} key={key}>
              <Paper variant="outlined" sx={{ p: 1.5, textAlign: "center" }}>
                <Typography variant="h6">{totals[key] ?? 0}</Typography>
                <Typography variant="caption" color="text.secondary">{label}</Typography>
              </Paper>
            </Grid>
          ))}
        </Grid>
      )}

      <Stack direction={{ xs: "column", sm: "row" }} spacing={1} mb={2}>
        <TextField select size="small" label="Status" value={filters.status} onChange={set("status")} sx={{ minWidth: 170 }}>
          <MenuItem value="">All</MenuItem>
          {ALL_STATUSES.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
        </TextField>
        <TextField size="small" label="Invoice number" value={filters.invoiceNumber} onChange={set("invoiceNumber")} />
        <TextField size="small" type="date" label="From" InputLabelProps={{ shrink: true }} value={filters.from} onChange={set("from")} />
        <TextField size="small" type="date" label="To" InputLabelProps={{ shrink: true }} value={filters.to} onChange={set("to")} />
        <Button variant="contained" onClick={() => { setPage(0); setApplied(filters); }}>Search</Button>
        <Button onClick={load}>Refresh</Button>
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {loading ? (
        <Box textAlign="center" py={4}><CircularProgress /></Box>
      ) : (
        <>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Invoice</TableCell>
                <TableCell>Branch</TableCell>
                <TableCell>Provider</TableCell>
                <TableCell align="right">Amount</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Attempts</TableCell>
                <TableCell>Created</TableCell>
                <TableCell>Problem</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((s) => (
                <TableRow key={s.id} hover sx={{ cursor: "pointer" }} onClick={() => setOpenId(s.id)}>
                  <TableCell>{s.invoiceNumber || s.sourceId}</TableCell>
                  <TableCell>{s.branchCode || "-"}</TableCell>
                  <TableCell>{s.providerCode} ({s.environment})</TableCell>
                  <TableCell align="right">{s.totalAmount != null ? `${Number(s.totalAmount).toFixed(2)} ${s.currency || ""}` : "-"}</TableCell>
                  <TableCell><Chip size="small" color={statusColor(s.status)} label={s.status} /></TableCell>
                  <TableCell align="right">{s.attemptCount}</TableCell>
                  <TableCell>{formatDateTime(s.createdAt)}</TableCell>
                  <TableCell sx={{ maxWidth: 280, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {s.lastError || ""}
                  </TableCell>
                </TableRow>
              ))}
              {rows.length === 0 && (
                <TableRow><TableCell colSpan={8}>No submissions match.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
          <TablePagination
            component="div"
            count={total}
            page={page}
            rowsPerPage={PAGE_SIZE}
            rowsPerPageOptions={[PAGE_SIZE]}
            onPageChange={(e, p) => setPage(p)}
          />
        </>
      )}

      {openId && <SubmissionDialog id={openId} onClose={() => setOpenId(null)} onChanged={load} />}
    </Box>
  );
};

const SubmissionDialog = ({ id, onClose, onChanged }) => {
  const [detail, setDetail] = useState(null);
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const r = await submissionDetail(id);
    if (r.ok) setDetail(r.data);
    else setNotice({ severity: "error", text: r.message });
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const act = async (fn, done) => {
    setBusy(true);
    const r = await fn();
    setBusy(false);
    setNotice(r.ok ? { severity: "success", text: done } : { severity: "error", text: r.message });
    if (r.ok) {
      load();
      onChanged();
    }
  };

  const cancel = () => {
    const reason = window.prompt("Why cancel this submission?");
    if (reason && reason.trim()) act(() => cancelSubmission(id, reason.trim()), "Cancelled.");
  };

  const s = detail?.submission;
  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>Submission {s ? s.invoiceNumber || s.sourceId : ""}</DialogTitle>
      <DialogContent dividers>
        {notice && <Alert severity={notice.severity} sx={{ mb: 2 }} onClose={() => setNotice(null)}>{notice.text}</Alert>}
        {!detail ? (
          <Box textAlign="center" py={3}><CircularProgress /></Box>
        ) : (
          <>
            <Grid container spacing={1} mb={2}>
              {[
                ["Status", <Chip size="small" color={statusColor(s.status)} label={s.status} />],
                ["Provider", `${s.providerCode} (${s.environment})`],
                ["Operation", s.operation],
                ["Document", `${s.documentType || ""} ${s.invoiceType || ""}`],
                ["Source", `${s.sourceType} ${s.sourceId} v${s.sourceVersion}`],
                ["Regulator reference", s.externalReference || s.externalSubmissionId || "-"],
                ["Attempts", s.attemptCount],
                ["Next attempt", formatDateTime(s.nextAttemptAt) || "-"],
                ["Deadline", formatDateTime(s.submissionDeadline) || "-"],
                ["Invoice language", s.invoiceLanguageMode || "-"],
              ].map(([label, value]) => (
                <Grid item xs={6} sm={4} key={label}>
                  <Typography variant="caption" color="text.secondary">{label}</Typography>
                  <Typography variant="body2" component="div">{value}</Typography>
                </Grid>
              ))}
            </Grid>
            {s.lastError && <Alert severity="warning" sx={{ mb: 2 }}>{s.lastError}</Alert>}

            <Typography variant="subtitle1">History</Typography>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>When</TableCell>
                  <TableCell>Change</TableCell>
                  <TableCell>Message</TableCell>
                  <TableCell>By</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {detail.events.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell>{formatDateTime(e.createdAt)}</TableCell>
                    <TableCell>{e.fromStatus ? `${e.fromStatus} -> ${e.status}` : e.status || e.eventType}</TableCell>
                    <TableCell>{e.message}{e.providerResponseCode ? ` (${e.providerResponseCode})` : ""}</TableCell>
                    <TableCell>{e.createdBy || "system"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {detail.documents.length > 0 && (
              <>
                <Typography variant="subtitle1" mt={2}>Documents</Typography>
                <Table size="small">
                  <TableBody>
                    {detail.documents.map((d) => (
                      <TableRow key={d.id}>
                        <TableCell>{d.documentType}</TableCell>
                        <TableCell>{d.contentType}</TableCell>
                        <TableCell>{d.documentUuid || d.externalReference || ""}</TableCell>
                        <TableCell>{d.hasQr ? "QR" : ""}</TableCell>
                        <TableCell>{formatDateTime(d.createdAt)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </>
            )}
          </>
        )}
      </DialogContent>
      <DialogActions>
        {s && (
          <>
            <Button disabled={busy} onClick={() => act(() => refreshSubmission(id), "Status checked.")}>Check status</Button>
            {["FAILED", "VALIDATION_FAILED", "RETRY_PENDING"].includes(s.status) && (
              <Button disabled={busy} onClick={() => act(() => retrySubmission(id), "Sent again.")}>Retry</Button>
            )}
            {s.status !== "CANCELLED" && (
              <Button disabled={busy} color="error" onClick={cancel}>Cancel submission</Button>
            )}
          </>
        )}
        <Box flexGrow={1} />
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
};

export default SubmissionsPanel;
