// Tally Sync Status: what has reached Tally, what is waiting, and what failed and why. Retry,
// skip, re-send and re-sync from here; the Tally Connector does the sending.
import React, { useCallback, useEffect, useState } from "react";
import {
  Alert, Box, Button, Checkbox, Chip, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, Grid,
  MenuItem, Paper, Stack, Tab, Table, TableBody, TableCell, TableContainer, TableHead, TablePagination, TableRow, Tabs,
  TextField, Tooltip, Typography,
} from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import {
  CATEGORY_LABELS, STATUS_LABELS, actOnItems, getItem, getStatus, listItems, previewItem, resync, retryFailed, syncNow,
} from "./tallyApi";

const STATUS_COLOR = { PENDING: "default", IN_FLIGHT: "info", SYNCED: "success", FAILED: "error", SKIPPED: "warning" };
const ACTION_LABEL = { CREATE: "New", ALTER: "Update", CANCEL: "Cancel", DELETE: "Delete" };
const money = (v) => (v == null ? "" : Number(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
const fmtTime = (t) => (t ? new Date(t).toLocaleString() : "–");
const fmtDate = (d) => (d ? String(d).slice(0, 10) : "");

function Tile({ label, value, color, onClick, active }) {
  return (
    <Paper variant="outlined" onClick={onClick}
      sx={{ p: 1.5, cursor: onClick ? "pointer" : "default", borderColor: active ? "primary.main" : undefined, borderWidth: active ? 2 : 1 }}>
      <Typography variant="body2" color="text.secondary">{label}</Typography>
      <Typography variant="h5" color={color}>{value ?? 0}</Typography>
    </Paper>
  );
}

function ItemDialog({ id, onClose, onChanged }) {
  const [item, setItem] = useState(null);
  const [tab, setTab] = useState(0);
  const [preview, setPreview] = useState(null);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    if (!id) return;
    setItem(null); setPreview(null); setTab(0); setMsg(null);
    getItem(id).then((r) => (r.ok ? setItem(r.data) : setMsg(r.message)));
  }, [id]);

  const loadPreview = async () => {
    setTab(3);
    if (preview) return;
    const r = await previewItem(id);
    setPreview(r.ok ? r.data.xml : `Could not build it: ${r.message}`);
  };
  const act = async (action) => {
    const r = await actOnItems(action, [id]);
    if (!r.ok) return setMsg(r.message);
    onChanged();
    onClose();
  };

  if (!id) return null;
  const pre = (text) => (
    <Box component="pre" sx={{ fontSize: 12, whiteSpace: "pre-wrap", wordBreak: "break-all", bgcolor: "grey.100", p: 1.5, borderRadius: 1, maxHeight: 400, overflow: "auto" }}>
      {text || "Nothing yet."}
    </Box>
  );
  return (
    <Dialog open onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>{item ? `${item.voucher_number || item.item_key} · ${CATEGORY_LABELS[item.category] || item.category}` : "Loading…"}</DialogTitle>
      <DialogContent>
        {msg && <Alert severity="error" sx={{ mb: 2 }}>{msg}</Alert>}
        {item && (
          <>
            <Grid container spacing={1} mb={2}>
              {[
                ["Status", <Chip size="small" color={STATUS_COLOR[item.status]} label={STATUS_LABELS[item.status] || item.status} />],
                ["Next action", ACTION_LABEL[item.action] || item.action],
                ["Date", item.period_end && fmtDate(item.period_end) !== fmtDate(item.voucher_date)
                  ? `${fmtDate(item.voucher_date)} to ${fmtDate(item.period_end)}` : fmtDate(item.voucher_date)],
                ["Branch", item.branch_code],
                ["Amount", money(item.amount)],
                ["Bills in it", item.member_count],
                ["Tally voucher type", item.tally_vch_type],
                ["Tally voucher id", item.tally_vch_id || "–"],
                ["Tries", item.attempts],
                ["Reached Tally", fmtTime(item.synced_at)],
              ].map(([k, v]) => (
                <Grid item xs={6} sm={4} key={k}>
                  <Typography variant="caption" color="text.secondary">{k}</Typography>
                  <Typography variant="body2" component="div">{v}</Typography>
                </Grid>
              ))}
            </Grid>
            {item.last_error && <Alert severity={item.status === "FAILED" ? "error" : "info"} sx={{ mb: 2 }}>{item.last_error}</Alert>}
            {item.changed_after_sync && <Alert severity="warning" sx={{ mb: 2 }}>Changed here after it reached Tally. Re-send to update Tally.</Alert>}
            <Tabs value={tab} onChange={(_, v) => (v === 3 ? loadPreview() : setTab(v))} variant="scrollable">
              <Tab label="Summary" />
              <Tab label="Sent to Tally" />
              <Tab label="Tally's reply" />
              <Tab label="Preview now" />
            </Tabs>
            <Box mt={1}>
              {tab === 0 && (
                <Typography variant="body2" color="text.secondary">
                  Key {item.item_key}. Tally matches it by remote id {item.tally_remote_id}, so sending it again updates the same voucher.
                </Typography>
              )}
              {tab === 1 && pre(item.request_xml)}
              {tab === 2 && pre(item.response_xml)}
              {tab === 3 && pre(preview || "Building…")}
            </Box>
          </>
        )}
      </DialogContent>
      <DialogActions>
        {item && ["FAILED", "SKIPPED"].includes(item.status) && <Button onClick={() => act("retry")}>Retry</Button>}
        {item && ["PENDING", "FAILED"].includes(item.status) && <Button color="warning" onClick={() => act("skip")}>Don't send</Button>}
        {item && ["SYNCED", "FAILED"].includes(item.status) && <Button onClick={() => act("resend")}>Send again</Button>}
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}

function ResyncDialog({ open, onClose, onDone }) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [resendAll, setResendAll] = useState(false);
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const run = async () => {
    setBusy(true); setMsg(null);
    const r = await resync(from, to, resendAll);
    setBusy(false);
    if (!r.ok) return setMsg({ severity: "error", text: r.message });
    setMsg({ severity: "success", text: `Checked: ${r.data.inserted} new, ${r.data.changed} changed, ${r.data.removed} removed${resendAll ? `, ${r.data.resent} to send again` : ""}. They go on the next sync.` });
    onDone();
  };
  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Re-check a date range</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" mb={2}>
          Compares the range with what was sent and queues anything new, changed or cancelled. Use it after editing old bills.
        </Typography>
        <Stack spacing={2}>
          <TextField size="small" type="date" label="From" InputLabelProps={{ shrink: true }} value={from} onChange={(e) => setFrom(e.target.value)} />
          <TextField size="small" type="date" label="To" InputLabelProps={{ shrink: true }} value={to} onChange={(e) => setTo(e.target.value)} />
          <FormControlLabel control={<Checkbox checked={resendAll} onChange={(e) => setResendAll(e.target.checked)} />}
            label="Also send everything in the range again (overwrites those vouchers in Tally)" />
        </Stack>
        {msg && <Alert severity={msg.severity} sx={{ mt: 2 }}>{msg.text}</Alert>}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
        <Button variant="contained" onClick={run} disabled={!from || !to || busy}>Re-check</Button>
      </DialogActions>
    </Dialog>
  );
}

export default function TallySyncStatusPage() {
  const [status, setStatus] = useState(null);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({ status: "", category: "", branch: "", from: "", to: "", q: "", changedOnly: false });
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(50);
  const [data, setData] = useState({ rows: [], total: 0 });
  const [selected, setSelected] = useState([]);
  const [openId, setOpenId] = useState(null);
  const [resyncOpen, setResyncOpen] = useState(false);
  const [msg, setMsg] = useState(null);

  const loadStatus = useCallback(async () => {
    const r = await getStatus();
    if (r.ok) { setStatus(r.data); setError(null); } else setError(r.message);
  }, []);
  const loadItems = useCallback(async () => {
    const r = await listItems({ ...filters, page, size });
    if (r.ok) setData(r.data); else setError(r.message);
    setSelected([]);
  }, [filters, page, size]);
  const reload = useCallback(() => { loadStatus(); loadItems(); }, [loadStatus, loadItems]);

  useEffect(() => { loadStatus(); }, [loadStatus]);
  useEffect(() => { if (status?.installed) loadItems(); }, [loadItems, status?.installed]);
  useEffect(() => {
    const t = setInterval(loadStatus, 30000);
    return () => clearInterval(t);
  }, [loadStatus]);

  const setF = (k) => (e) => { setPage(0); setFilters((f) => ({ ...f, [k]: e.target.value })); };
  const pickStatus = (st) => { setPage(0); setFilters((f) => ({ ...f, status: f.status === st ? "" : st })); };

  const bulk = async (action) => {
    const r = await actOnItems(action, selected);
    setMsg(r.ok ? { severity: "success", text: `${r.data.updated} updated.` } : { severity: "error", text: r.message });
    reload();
  };
  const doSyncNow = async () => {
    const r = await syncNow();
    setMsg(r.ok ? { severity: "info", text: "The connector starts a sync at its next check-in (within a minute)." } : { severity: "error", text: r.message });
    loadStatus();
  };
  const doRetryFailed = async () => {
    const r = await retryFailed();
    setMsg(r.ok ? { severity: "success", text: `${r.data.updated} failed voucher(s) queued again.` } : { severity: "error", text: r.message });
    reload();
  };

  if (error && !status) return <Box p={3}><Alert severity="error">{error}</Alert></Box>;
  if (!status) return <Box p={3}>Loading…</Box>;
  if (!status.installed) {
    return <Box p={3}><Alert severity="warning">Tally integration isn't set up on the server for this company yet (migration V076). Ask your administrator.</Alert></Box>;
  }

  const c = status.counts || {};
  const connectors = (status.connectors || []).filter((x) => !x.revoked_at && x.paired);
  const online = connectors.filter((x) => x.online);
  const allIds = data.rows.map((r) => r.id);
  const toggle = (id) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  return (
    <Box sx={{ p: { xs: 1.5, sm: 3 }, width: "100%", minWidth: 0, maxWidth: "100vw", overflowX: "hidden" }}>
      <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ sm: "center" }} mb={2} spacing={1}>
        <Box>
          <Typography variant="h5">Tally Sync Status</Typography>
          <Typography variant="body2" color="text.secondary">
            {status.enabled ? `Sending ${status.source === "ITEM" ? "item invoices" : "GL vouchers"}.` : "Sync is off (Tally Integration > Settings)."}
            {" "}Last sync started {fmtTime(status.lastRunStarted)}.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          <Button variant="contained" onClick={doSyncNow} disabled={!status.enabled || status.syncRequested}>
            {status.syncRequested ? "Sync requested" : "Sync now"}
          </Button>
          <Button onClick={() => setResyncOpen(true)}>Re-check dates</Button>
          <Tooltip title="Refresh"><Button onClick={reload}><RefreshIcon /></Button></Tooltip>
        </Stack>
      </Stack>

      {status.problems?.length > 0 && <Alert severity="warning" sx={{ mb: 2 }}>Sync can't start: {status.problems.join(" ")}</Alert>}
      {connectors.length === 0 && (
        <Alert severity="warning" sx={{ mb: 2 }}>No connector is paired yet. Add one in Tally Integration &gt; Connectors.</Alert>
      )}
      {connectors.length > 0 && online.length === 0 && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          The Tally Connector is offline (last seen {fmtTime(connectors[0].last_seen_at)}). Check that the PC is on and the app is running in the tray.
        </Alert>
      )}
      {online.some((x) => x.tally_reachable === false) && (
        <Alert severity="error" sx={{ mb: 2 }}>
          The connector can't reach Tally: {online.find((x) => x.tally_reachable === false)?.tally?.tallyError || "is Tally open with the company loaded?"}
        </Alert>
      )}
      {msg && <Alert severity={msg.severity} sx={{ mb: 2 }} onClose={() => setMsg(null)}>{msg.text}</Alert>}

      <Grid container spacing={1.5} mb={2}>
        <Grid item xs={6} sm={4} md={2}><Tile label="Waiting" value={c.PENDING} onClick={() => pickStatus("PENDING")} active={filters.status === "PENDING"} /></Grid>
        <Grid item xs={6} sm={4} md={2}><Tile label="Sending" value={c.IN_FLIGHT} color="info.main" onClick={() => pickStatus("IN_FLIGHT")} active={filters.status === "IN_FLIGHT"} /></Grid>
        <Grid item xs={6} sm={4} md={2}><Tile label="In Tally" value={c.SYNCED} color="success.main" onClick={() => pickStatus("SYNCED")} active={filters.status === "SYNCED"} /></Grid>
        <Grid item xs={6} sm={4} md={2}><Tile label="Reached Tally today" value={status.syncedToday} color="success.main" /></Grid>
        <Grid item xs={6} sm={4} md={2}><Tile label="Failed" value={c.FAILED} color="error.main" onClick={() => pickStatus("FAILED")} active={filters.status === "FAILED"} /></Grid>
        <Grid item xs={6} sm={4} md={2}><Tile label="Skipped" value={c.SKIPPED} color="warning.main" onClick={() => pickStatus("SKIPPED")} active={filters.status === "SKIPPED"} /></Grid>
      </Grid>
      {(status.waitingForPeriodClose > 0 || status.changedAfterSync > 0) && (
        <Typography variant="body2" color="text.secondary" mb={2}>
          {status.waitingForPeriodClose > 0 && `${status.waitingForPeriodClose} summary voucher(s) wait for their day or month to end. `}
          {status.changedAfterSync > 0 && `${status.changedAfterSync} voucher(s) changed here after reaching Tally.`}
        </Typography>
      )}

      <Paper variant="outlined" sx={{ p: 1.5, mb: 2 }}>
        <Grid container spacing={1.5}>
          <Grid item xs={6} sm={2}>
            <TextField select fullWidth size="small" label="Status" value={filters.status} onChange={setF("status")}>
              <MenuItem value="">All</MenuItem>
              {Object.entries(STATUS_LABELS).map(([k, v]) => <MenuItem key={k} value={k}>{v}</MenuItem>)}
            </TextField>
          </Grid>
          <Grid item xs={6} sm={2}>
            <TextField select fullWidth size="small" label="Type" value={filters.category} onChange={setF("category")}>
              <MenuItem value="">All</MenuItem>
              {Object.entries(CATEGORY_LABELS).map(([k, v]) => <MenuItem key={k} value={k}>{v}</MenuItem>)}
            </TextField>
          </Grid>
          <Grid item xs={6} sm={2}><TextField fullWidth size="small" label="Branch" value={filters.branch} onChange={setF("branch")} /></Grid>
          <Grid item xs={6} sm={2}><TextField fullWidth size="small" type="date" label="From" InputLabelProps={{ shrink: true }} value={filters.from} onChange={setF("from")} /></Grid>
          <Grid item xs={6} sm={2}><TextField fullWidth size="small" type="date" label="To" InputLabelProps={{ shrink: true }} value={filters.to} onChange={setF("to")} /></Grid>
          <Grid item xs={6} sm={2}><TextField fullWidth size="small" label="Voucher no. or error" value={filters.q} onChange={setF("q")} /></Grid>
        </Grid>
        <FormControlLabel sx={{ mt: 1 }} control={<Checkbox checked={filters.changedOnly}
          onChange={(e) => { setPage(0); setFilters((f) => ({ ...f, changedOnly: e.target.checked })); }} />}
          label="Only changed here after reaching Tally" />
      </Paper>

      <Stack direction="row" spacing={1} mb={1} flexWrap="wrap" useFlexGap>
        <Button size="small" disabled={!selected.length} onClick={() => bulk("retry")}>Retry selected</Button>
        <Button size="small" disabled={!selected.length} onClick={() => bulk("resend")}>Send selected again</Button>
        <Button size="small" color="warning" disabled={!selected.length} onClick={() => bulk("skip")}>Don't send selected</Button>
        <Button size="small" disabled={!c.FAILED} onClick={doRetryFailed}>Retry all failed</Button>
      </Stack>

      <Paper variant="outlined">
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell padding="checkbox">
                  <Checkbox checked={allIds.length > 0 && selected.length === allIds.length}
                    indeterminate={selected.length > 0 && selected.length < allIds.length}
                    onChange={(e) => setSelected(e.target.checked ? allIds : [])} />
                </TableCell>
                <TableCell>Date</TableCell><TableCell>Voucher</TableCell><TableCell>Type</TableCell><TableCell>Branch</TableCell>
                <TableCell align="right">Amount</TableCell><TableCell>Status</TableCell><TableCell>Tally / error</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {data.rows.length === 0 && <TableRow><TableCell colSpan={8}>Nothing here.</TableCell></TableRow>}
              {data.rows.map((r) => (
                <TableRow key={r.id} hover sx={{ cursor: "pointer" }} onClick={() => setOpenId(r.id)}>
                  <TableCell padding="checkbox" onClick={(e) => e.stopPropagation()}>
                    <Checkbox checked={selected.includes(r.id)} onChange={() => toggle(r.id)} />
                  </TableCell>
                  <TableCell sx={{ whiteSpace: "nowrap" }}>
                    {r.period_end && fmtDate(r.period_end) !== fmtDate(r.voucher_date)
                      ? `${fmtDate(r.voucher_date).slice(0, 7)} (month)` : fmtDate(r.voucher_date)}
                  </TableCell>
                  <TableCell>
                    {r.voucher_number}
                    {r.member_count > 1 && <Typography variant="caption" color="text.secondary" display="block">{r.member_count} bills</Typography>}
                  </TableCell>
                  <TableCell>{CATEGORY_LABELS[r.category] || r.category}</TableCell>
                  <TableCell>{r.branch_code}</TableCell>
                  <TableCell align="right">{money(r.amount)}</TableCell>
                  <TableCell>
                    <Chip size="small" color={STATUS_COLOR[r.status]} label={r.waiting_period ? "Waits for period end" : STATUS_LABELS[r.status] || r.status} />
                    {r.status !== "SYNCED" && r.action !== "CREATE" && (
                      <Typography variant="caption" color="text.secondary" display="block">{ACTION_LABEL[r.action]}</Typography>
                    )}
                    {r.changed_after_sync && <Typography variant="caption" color="warning.main" display="block">Changed here</Typography>}
                  </TableCell>
                  <TableCell sx={{ maxWidth: 320 }}>
                    {r.status === "SYNCED"
                      ? <Typography variant="body2" color="text.secondary">{fmtTime(r.synced_at)}{r.tally_vch_id ? ` · id ${r.tally_vch_id}` : ""}</Typography>
                      : <Typography variant="body2" color={r.status === "FAILED" ? "error" : "text.secondary"} noWrap title={r.last_error || ""}>{r.last_error || ""}</Typography>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination component="div" count={Number(data.total) || 0} page={page} rowsPerPage={size}
          onPageChange={(_, p) => setPage(p)} onRowsPerPageChange={(e) => { setSize(Number(e.target.value)); setPage(0); }}
          rowsPerPageOptions={[25, 50, 100, 200]} />
      </Paper>

      <Typography variant="subtitle1" fontWeight={600} mt={3} mb={1}>Recent syncs</Typography>
      <Paper variant="outlined">
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow><TableCell>Started</TableCell><TableCell>Finished</TableCell><TableCell>By</TableCell><TableCell align="right">Sent</TableCell><TableCell align="right">In Tally</TableCell><TableCell align="right">Failed</TableCell><TableCell>Notes</TableCell></TableRow>
            </TableHead>
            <TableBody>
              {(status.runs || []).length === 0 && <TableRow><TableCell colSpan={7}>No syncs yet.</TableCell></TableRow>}
              {(status.runs || []).map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{fmtTime(r.started_at)}</TableCell>
                  <TableCell>{r.finished_at ? fmtTime(r.finished_at) : <Chip size="small" color="info" label="Running" />}</TableCell>
                  <TableCell>{r.trigger_kind === "MANUAL" ? "Sync now" : "Schedule"}</TableCell>
                  <TableCell align="right">{r.handed_out}</TableCell>
                  <TableCell align="right">{r.synced}</TableCell>
                  <TableCell align="right">{r.failed}</TableCell>
                  <TableCell sx={{ maxWidth: 360 }}><Typography variant="body2" noWrap title={r.message || ""}>{r.message}</Typography></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      <ItemDialog id={openId} onClose={() => setOpenId(null)} onChanged={reload} />
      <ResyncDialog open={resyncOpen} onClose={() => setResyncOpen(false)} onDone={reload} />
    </Box>
  );
}
