import React, { useState, useEffect, useCallback, useRef } from "react";
import axios from "axios";
import {
  Box, Typography, Paper, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, TablePagination, Chip, IconButton, Button,
  TextField, MenuItem, Select, FormControl, InputLabel, Stack,
  Dialog, DialogTitle, DialogContent, DialogActions, CircularProgress,
  Tooltip, Alert, Card, CardContent, Grid
} from "@mui/material";
import {
  Refresh, Replay, DeleteForever, Visibility, CheckCircle,
  Error as ErrorIcon, HourglassEmpty, RadioButtonUnchecked,
  Send, Block, WifiTethering, WifiOff
} from "@mui/icons-material";

const apiClient = axios.create();
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem("jwtToken");
  const tenancyId = localStorage.getItem("tenancyId");
  config.baseURL = `/api/${tenancyId}`;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

const STATUS_COLORS = {
  PENDING:      "warning",
  PUBLISHING:   "info",
  PUBLISHED:    "success",
  FAILED:       "error",
  RETRY_PENDING:"warning",
  DEAD_LETTERED:"default",
};

const STATUS_ICONS = {
  PENDING:      <HourglassEmpty fontSize="small" />,
  PUBLISHING:   <Send fontSize="small" />,
  PUBLISHED:    <CheckCircle fontSize="small" />,
  FAILED:       <ErrorIcon fontSize="small" />,
  RETRY_PENDING:<Replay fontSize="small" />,
  DEAD_LETTERED:<Block fontSize="small" />,
};

const ALL_STATUSES = ["PENDING","PUBLISHING","PUBLISHED","FAILED","RETRY_PENDING","DEAD_LETTERED"];

export default function EventMonitorPage() {
  const [events, setEvents]           = useState([]);
  const [total, setTotal]             = useState(0);
  const [page, setPage]               = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(50);
  const [loading, setLoading]         = useState(false);
  const [stats, setStats]             = useState([]);
  const [kafkaHealth, setKafkaHealth] = useState(null);
  const [healthLoading, setHealthLoading] = useState(false);

  // Filters
  const [filterStatus, setFilterStatus]     = useState("");
  const [filterEventType, setFilterEventType] = useState("");
  const [filterEntityType, setFilterEntityType] = useState("");
  const [filterFrom, setFilterFrom]         = useState("");
  const [filterTo, setFilterTo]             = useState("");

  // Detail dialog
  const [detailOpen, setDetailOpen]   = useState(false);
  const [detailEvent, setDetailEvent] = useState(null);

  // Replay dialog
  const [replayOpen, setReplayOpen]   = useState(false);
  const [replayFrom, setReplayFrom]   = useState("");
  const [replayTo, setReplayTo]       = useState("");
  const [replayType, setReplayType]   = useState("");

  const [actionMsg, setActionMsg] = useState(null);

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, size: rowsPerPage };
      if (filterStatus)     params.status     = filterStatus;
      if (filterEventType)  params.eventType  = filterEventType;
      if (filterEntityType) params.entityType = filterEntityType;
      if (filterFrom)       params.from       = filterFrom;
      if (filterTo)         params.to         = filterTo;

      const res = await apiClient.get("/events", { params });
      setEvents(res.data.events || []);
      setTotal(res.data.total  || 0);
    } catch (e) {
      console.error("fetchEvents error", e);
    } finally {
      setLoading(false);
    }
  }, [page, rowsPerPage, filterStatus, filterEventType, filterEntityType, filterFrom, filterTo]);

  const fetchStats = useCallback(async () => {
    try {
      const res = await apiClient.get("/events/stats");
      setStats(res.data.stats || []);
    } catch (e) { /* silent */ }
  }, []);

  const fetchKafkaHealth = useCallback(async () => {
    setHealthLoading(true);
    try {
      const res = await apiClient.get("/events/kafka-health");
      setKafkaHealth(res.data);
    } catch (e) {
      setKafkaHealth({ status: "DOWN", error: e.message });
    } finally {
      setHealthLoading(false);
    }
  }, []);

  useEffect(() => { fetchEvents(); fetchStats(); }, [fetchEvents, fetchStats]);
  useEffect(() => { fetchKafkaHealth(); }, [fetchKafkaHealth]);

  const handleRetry = async (id) => {
    try {
      await apiClient.post(`/events/${id}/retry`);
      setActionMsg({ type: "success", text: `Event ${id} queued for retry` });
      fetchEvents(); fetchStats();
    } catch (e) {
      setActionMsg({ type: "error", text: e.response?.data?.message || e.message });
    }
  };

  const handleDlq = async (id) => {
    if (!window.confirm("Move this event to Dead Letter Queue?")) return;
    try {
      await apiClient.post(`/events/${id}/dlq`);
      setActionMsg({ type: "success", text: `Event ${id} moved to DLQ` });
      fetchEvents(); fetchStats();
    } catch (e) {
      setActionMsg({ type: "error", text: e.response?.data?.message || e.message });
    }
  };

  const handleViewDetail = async (eventId) => {
    try {
      const res = await apiClient.get(`/events/${eventId}`);
      setDetailEvent(res.data);
      setDetailOpen(true);
    } catch (e) { console.error(e); }
  };

  const handleReplay = async () => {
    try {
      const body = {};
      if (replayFrom) body.from = replayFrom;
      if (replayTo)   body.to   = replayTo;
      if (replayType) body.eventType = replayType;
      const res = await apiClient.post("/events/replay", body);
      setActionMsg({ type: "success", text: `Replayed ${res.data.requeued} events` });
      setReplayOpen(false);
      fetchEvents(); fetchStats();
    } catch (e) {
      setActionMsg({ type: "error", text: e.message });
    }
  };

  const statMap = {};
  stats.forEach(s => { statMap[s.status] = s.count; });

  return (
    <Box p={3}>
      {/* Header */}
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h5" fontWeight={700}>Event Monitor</Typography>
        <Stack direction="row" spacing={1} alignItems="center">
          {kafkaHealth && (
            <Chip
              icon={kafkaHealth.status === "UP" ? <WifiTethering /> : <WifiOff />}
              label={`Kafka: ${kafkaHealth.status}${kafkaHealth.erpTopics ? ` · ${kafkaHealth.erpTopics} topics` : ""}`}
              color={kafkaHealth.status === "UP" ? "success" : "error"}
              size="small"
            />
          )}
          {healthLoading && <CircularProgress size={18} />}
          <Tooltip title="Refresh Kafka health">
            <IconButton size="small" onClick={fetchKafkaHealth}><Refresh fontSize="small" /></IconButton>
          </Tooltip>
          <Button variant="outlined" size="small" onClick={() => setReplayOpen(true)}>
            Replay Events
          </Button>
          <Button variant="contained" size="small" onClick={fetchEvents} startIcon={<Refresh />}>
            Refresh
          </Button>
        </Stack>
      </Stack>

      {actionMsg && (
        <Alert severity={actionMsg.type} onClose={() => setActionMsg(null)} sx={{ mb: 2 }}>
          {actionMsg.text}
        </Alert>
      )}

      {/* Stats cards */}
      <Grid container spacing={1} mb={2}>
        {ALL_STATUSES.map(s => (
          <Grid item key={s}>
            <Card variant="outlined" sx={{ minWidth: 100, textAlign: "center", cursor: "pointer" }}
                  onClick={() => setFilterStatus(filterStatus === s ? "" : s)}>
              <CardContent sx={{ p: "8px 12px!important" }}>
                <Typography variant="h6" fontWeight={700}>{statMap[s] || 0}</Typography>
                <Chip label={s} size="small" color={STATUS_COLORS[s] || "default"} />
              </CardContent>
            </Card>
          </Grid>
        ))}
        {kafkaHealth?.pendingEvents !== undefined && (
          <Grid item>
            <Card variant="outlined" sx={{ minWidth: 100, textAlign: "center" }}>
              <CardContent sx={{ p: "8px 12px!important" }}>
                <Typography variant="h6" fontWeight={700}>{kafkaHealth.pendingEvents}</Typography>
                <Typography variant="caption" color="text.secondary">Pending (live)</Typography>
              </CardContent>
            </Card>
          </Grid>
        )}
      </Grid>

      {/* Filters */}
      <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} sm={2}>
            <FormControl fullWidth size="small">
              <InputLabel>Status</InputLabel>
              <Select value={filterStatus} label="Status" onChange={e => { setFilterStatus(e.target.value); setPage(0); }}>
                <MenuItem value="">All</MenuItem>
                {ALL_STATUSES.map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={2}>
            <TextField fullWidth size="small" label="Event Type" value={filterEventType}
              onChange={e => { setFilterEventType(e.target.value); setPage(0); }} />
          </Grid>
          <Grid item xs={12} sm={2}>
            <TextField fullWidth size="small" label="Entity Type" value={filterEntityType}
              onChange={e => { setFilterEntityType(e.target.value); setPage(0); }} />
          </Grid>
          <Grid item xs={12} sm={2}>
            <TextField fullWidth size="small" label="From" type="datetime-local"
              InputLabelProps={{ shrink: true }} value={filterFrom}
              onChange={e => { setFilterFrom(e.target.value); setPage(0); }} />
          </Grid>
          <Grid item xs={12} sm={2}>
            <TextField fullWidth size="small" label="To" type="datetime-local"
              InputLabelProps={{ shrink: true }} value={filterTo}
              onChange={e => { setFilterTo(e.target.value); setPage(0); }} />
          </Grid>
          <Grid item xs={12} sm={2}>
            <Button variant="outlined" fullWidth onClick={() => {
              setFilterStatus(""); setFilterEventType(""); setFilterEntityType("");
              setFilterFrom(""); setFilterTo(""); setPage(0);
            }}>Clear</Button>
          </Grid>
        </Grid>
      </Paper>

      {/* Table */}
      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead sx={{ backgroundColor: "#1976d2" }}>
            <TableRow>
              <TableCell sx={{ color: "#fff", fontWeight: 700 }}>ID</TableCell>
              <TableCell sx={{ color: "#fff", fontWeight: 700 }}>Event Type</TableCell>
              <TableCell sx={{ color: "#fff", fontWeight: 700 }}>Entity</TableCell>
              <TableCell sx={{ color: "#fff", fontWeight: 700 }}>Source → Target</TableCell>
              <TableCell sx={{ color: "#fff", fontWeight: 700 }}>Status</TableCell>
              <TableCell sx={{ color: "#fff", fontWeight: 700 }}>Retries</TableCell>
              <TableCell sx={{ color: "#fff", fontWeight: 700 }}>Created</TableCell>
              <TableCell sx={{ color: "#fff", fontWeight: 700 }}>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={8} align="center" sx={{ py: 4 }}>
                  <CircularProgress size={28} />
                </TableCell>
              </TableRow>
            ) : events.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} align="center" sx={{ py: 4, color: "text.secondary" }}>
                  No events found
                </TableCell>
              </TableRow>
            ) : events.map((ev) => (
              <TableRow key={ev.id} hover>
                <TableCell sx={{ fontFamily: "monospace", fontSize: 11 }}>
                  {String(ev.id).padStart(6, "0")}
                </TableCell>
                <TableCell>
                  <Typography variant="body2" fontWeight={500}>{ev.event_type}</Typography>
                  {ev.entity_type && (
                    <Typography variant="caption" color="text.secondary">{ev.entity_type}</Typography>
                  )}
                </TableCell>
                <TableCell>
                  <Typography variant="caption" sx={{ fontFamily: "monospace" }}>
                    {ev.entity_id ? ev.entity_id.substring(0, 12) + "…" : "—"}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="caption">
                    {ev.source_tenant}
                    {ev.target_tenant && ev.target_tenant !== ev.source_tenant
                      ? ` → ${ev.target_tenant}` : ""}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Chip
                    icon={STATUS_ICONS[ev.status]}
                    label={ev.status}
                    size="small"
                    color={STATUS_COLORS[ev.status] || "default"}
                  />
                </TableCell>
                <TableCell align="center">
                  {ev.retry_count > 0 ? (
                    <Chip label={`${ev.retry_count}/${ev.max_retries}`} size="small"
                          color={ev.retry_count >= ev.max_retries ? "error" : "warning"} />
                  ) : "—"}
                </TableCell>
                <TableCell>
                  <Typography variant="caption">
                    {ev.created_at ? new Date(ev.created_at).toLocaleString() : "—"}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Stack direction="row" spacing={0.5}>
                    <Tooltip title="View payload">
                      <IconButton size="small" onClick={() => handleViewDetail(ev.event_id || ev.id)}>
                        <Visibility fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    {(ev.status === "FAILED" || ev.status === "DEAD_LETTERED") && (
                      <Tooltip title="Retry">
                        <IconButton size="small" color="primary" onClick={() => handleRetry(ev.id)}>
                          <Replay fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                    {ev.status !== "DEAD_LETTERED" && ev.status !== "PUBLISHED" && (
                      <Tooltip title="Move to DLQ">
                        <IconButton size="small" color="error" onClick={() => handleDlq(ev.id)}>
                          <DeleteForever fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                  </Stack>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      <TablePagination
        component="div"
        count={total}
        page={page}
        onPageChange={(_, p) => setPage(p)}
        rowsPerPage={rowsPerPage}
        onRowsPerPageChange={e => { setRowsPerPage(+e.target.value); setPage(0); }}
        rowsPerPageOptions={[25, 50, 100]}
      />

      {/* Detail Dialog */}
      <Dialog open={detailOpen} onClose={() => setDetailOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Event Detail</DialogTitle>
        <DialogContent dividers>
          {detailEvent && (
            <Box>
              <Grid container spacing={1} mb={2}>
                {["event_id","event_type","status","source_tenant","target_tenant","entity_type","entity_id",
                  "retry_count","created_at","published_at"].map(k => (
                  detailEvent[k] != null && (
                    <Grid item xs={12} sm={6} key={k}>
                      <Typography variant="caption" color="text.secondary">{k}</Typography>
                      <Typography variant="body2" sx={{ fontFamily: "monospace", wordBreak: "break-all" }}>
                        {String(detailEvent[k])}
                      </Typography>
                    </Grid>
                  )
                ))}
              </Grid>
              {detailEvent.error_message && (
                <Alert severity="error" sx={{ mb: 2 }}>
                  <Typography variant="body2" sx={{ fontFamily: "monospace", whiteSpace: "pre-wrap" }}>
                    {detailEvent.error_message}
                  </Typography>
                </Alert>
              )}
              <Typography variant="caption" color="text.secondary">Payload</Typography>
              <Box component="pre" sx={{
                mt: 0.5, p: 1.5, backgroundColor: "#1e1e1e", color: "#d4d4d4",
                borderRadius: 1, overflow: "auto", maxHeight: 300, fontSize: 12,
                fontFamily: "monospace", border: "1px solid #444"
              }}>
                {(() => { try { return JSON.stringify(JSON.parse(detailEvent.payload_json), null, 2); }
                          catch { return detailEvent.payload_json; } })()}
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          {detailEvent && (detailEvent.status === "FAILED" || detailEvent.status === "DEAD_LETTERED") && (
            <Button onClick={() => { handleRetry(detailEvent.id); setDetailOpen(false); }} color="primary">
              Retry
            </Button>
          )}
          <Button onClick={() => setDetailOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Replay Dialog */}
      <Dialog open={replayOpen} onClose={() => setReplayOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Replay Published Events</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} mt={1}>
            <TextField size="small" label="Event Type (optional)" value={replayType}
              onChange={e => setReplayType(e.target.value)} fullWidth />
            <TextField size="small" label="From" type="datetime-local"
              InputLabelProps={{ shrink: true }} value={replayFrom}
              onChange={e => setReplayFrom(e.target.value)} fullWidth />
            <TextField size="small" label="To" type="datetime-local"
              InputLabelProps={{ shrink: true }} value={replayTo}
              onChange={e => setReplayTo(e.target.value)} fullWidth />
            <Alert severity="warning">
              Replaying re-queues already-published events. Consumers use idempotency to skip duplicates.
            </Alert>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setReplayOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleReplay}>Replay</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
