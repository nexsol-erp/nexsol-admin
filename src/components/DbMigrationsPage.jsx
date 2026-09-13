import React, { useEffect, useState } from "react";
import {
  Box, Typography, Paper, Button, Alert, CircularProgress, Divider, Chip,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  FormControl, InputLabel, Select, MenuItem,
  Dialog, DialogTitle, DialogContent, DialogActions, DialogContentText,
} from "@mui/material";
import {
  PlayArrow as RunIcon,
  Refresh as RefreshIcon,
  Storage as DbIcon,
  Warning as WarnIcon,
} from "@mui/icons-material";

const API = () => {
  const token = localStorage.getItem("jwtToken");
  return {
    base:    "/api/system/migrations",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  };
};

const stateColor = (state) => {
  if (state === "SUCCESS" || state === "BASELINE") return "success";
  if (state === "PENDING" || state === "OUT_OF_ORDER" || state === "FUTURE_SUCCESS") return "warning";
  if (state && state.includes("FAIL")) return "error";
  if (state === "MISSING_SUCCESS") return "error";
  return "default";
};

function ResultRow({ result }) {
  return (
    <TableRow>
      <TableCell>{result.tenantId}</TableCell>
      <TableCell>
        <Chip size="small" label={result.success ? "OK" : "FAILED"} color={result.success ? "success" : "error"} />
      </TableCell>
      <TableCell align="right">{result.migrationsApplied}</TableCell>
      <TableCell sx={{ color: "error.main", fontFamily: "monospace", fontSize: 12 }}>{result.error || ""}</TableCell>
    </TableRow>
  );
}

export default function DbMigrationsPage() {
  const [tenants, setTenants]       = useState([]);
  const [tenantId, setTenantId]     = useState("");
  const [status, setStatus]         = useState(null);
  const [statusLoading, setStatusLoading] = useState(false);
  const [running, setRunning]       = useState(false);
  const [runResult, setRunResult]   = useState(null);
  const [runAllOpen, setRunAllOpen] = useState(false);
  const [runAllRunning, setRunAllRunning] = useState(false);
  const [runAllResults, setRunAllResults] = useState(null);
  const [confirmTenantOpen, setConfirmTenantOpen] = useState(false);
  const [err, setErr] = useState(null);

  const loadTenants = async () => {
    const { base, headers } = API();
    try {
      const res = await fetch(`${base}/tenants`, { headers });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to load tenants");
      setTenants(Array.isArray(data) ? data : []);
      setErr(null);
    } catch (e) {
      setErr(e.message);
    }
  };

  useEffect(() => { loadTenants(); }, []);

  const checkStatus = async () => {
    if (!tenantId) return;
    setStatusLoading(true);
    setStatus(null);
    setRunResult(null);
    const { base, headers } = API();
    try {
      const res = await fetch(`${base}/${tenantId}/status`, { headers });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Status check failed");
      setStatus(Array.isArray(data) ? data : []);
      setErr(null);
    } catch (e) {
      setErr(e.message);
    } finally {
      setStatusLoading(false);
    }
  };

  const runOne = async () => {
    setConfirmTenantOpen(false);
    setRunning(true);
    setRunResult(null);
    const { base, headers } = API();
    try {
      const res = await fetch(`${base}/${tenantId}/run`, { method: "POST", headers });
      const data = await res.json();
      setRunResult(data);
      setErr(null);
    } catch (e) {
      setErr(e.message);
    } finally {
      setRunning(false);
      checkStatus();
    }
  };

  const runAll = async () => {
    setRunAllOpen(false);
    setRunAllRunning(true);
    setRunAllResults(null);
    const { base, headers } = API();
    try {
      const res = await fetch(`${base}/run-all`, { method: "POST", headers });
      const data = await res.json();
      setRunAllResults(Array.isArray(data) ? data : []);
      setErr(null);
    } catch (e) {
      setErr(e.message);
    } finally {
      setRunAllRunning(false);
    }
  };

  const pendingCount = status ? status.filter((m) => m.state === "PENDING").length : null;

  return (
    <Box sx={{ p: 2, maxWidth: 1000 }}>
      <Box display="flex" alignItems="center" gap={1} mb={1}>
        <DbIcon color="primary" />
        <Typography variant="h6" fontWeight={700}>DB Migrations</Typography>
      </Box>
      <Alert severity="warning" sx={{ mb: 3 }}>
        Applies the V0xx migration files under src/main/resources/migrations to a tenant's own
        database via Flyway. Every migration is written idempotently, but this still runs real
        DDL against live tenant data — check status before you run, and try one tenant before
        "Run All Tenants".
      </Alert>

      {err && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErr(null)}>{err}</Alert>}

      <Paper sx={{ p: 2, mb: 3 }}>
        <Typography variant="subtitle1" fontWeight={700} mb={2}>Single Tenant</Typography>
        <Box display="flex" gap={2} alignItems="center" flexWrap="wrap">
          <FormControl size="small" sx={{ minWidth: 260 }}>
            <InputLabel>Tenant</InputLabel>
            <Select value={tenantId} label="Tenant" onChange={(e) => { setTenantId(e.target.value); setStatus(null); setRunResult(null); }}>
              {tenants.map((t) => <MenuItem key={t} value={t}>{t}</MenuItem>)}
            </Select>
          </FormControl>
          <Button
            variant="outlined"
            startIcon={statusLoading ? <CircularProgress size={14} /> : <RefreshIcon />}
            onClick={checkStatus}
            disabled={!tenantId || statusLoading}
          >
            Check Status
          </Button>
          <Button
            variant="contained"
            startIcon={running ? <CircularProgress size={14} color="inherit" /> : <RunIcon />}
            onClick={() => setConfirmTenantOpen(true)}
            disabled={!tenantId || running}
          >
            {running ? "Running…" : "Run Pending Migrations"}
          </Button>
          <Button size="small" onClick={loadTenants}>Reload tenant list</Button>
        </Box>

        {status && (
          <>
            <Typography variant="body2" color="text.secondary" mt={2} mb={1}>
              {pendingCount === 0 ? "Up to date — nothing pending." : `${pendingCount} migration(s) pending.`}
            </Typography>
            <TableContainer sx={{ maxHeight: 320, overflow: "auto" }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow sx={{ "& th": { bgcolor: "#1976d2", color: "#fff", fontWeight: 700 } }}>
                    <TableCell>Version</TableCell>
                    <TableCell>Description</TableCell>
                    <TableCell>State</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {status.map((m, i) => (
                    <TableRow key={i}>
                      <TableCell>{m.version}</TableCell>
                      <TableCell>{m.description}</TableCell>
                      <TableCell><Chip size="small" label={m.state} color={stateColor(m.state)} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </>
        )}

        {runResult && (
          <Alert severity={runResult.success ? "success" : "error"} sx={{ mt: 2 }}>
            {runResult.success
              ? `Applied ${runResult.migrationsApplied} migration(s) to ${runResult.tenantId}.`
              : `Failed for ${runResult.tenantId}: ${runResult.error}`}
          </Alert>
        )}
      </Paper>

      <Divider sx={{ my: 3 }} />

      <Paper sx={{ p: 2 }}>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Typography variant="subtitle1" fontWeight={700}>All Tenants</Typography>
          <Button
            variant="contained"
            color="warning"
            startIcon={runAllRunning ? <CircularProgress size={14} color="inherit" /> : <WarnIcon />}
            onClick={() => setRunAllOpen(true)}
            disabled={runAllRunning}
          >
            {runAllRunning ? "Running…" : "Run All Tenants"}
          </Button>
        </Box>

        {runAllResults && (
          <TableContainer sx={{ mt: 2, maxHeight: 400, overflow: "auto" }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow sx={{ "& th": { bgcolor: "#1976d2", color: "#fff", fontWeight: 700 } }}>
                  <TableCell>Tenant</TableCell>
                  <TableCell>Result</TableCell>
                  <TableCell align="right">Applied</TableCell>
                  <TableCell>Error</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {runAllResults.map((r) => <ResultRow key={r.tenantId} result={r} />)}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      {/* Confirm: run one tenant */}
      <Dialog open={confirmTenantOpen} onClose={() => setConfirmTenantOpen(false)}>
        <DialogTitle>Run pending migrations for {tenantId}?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            This applies real DDL/data changes to that tenant's live database. Idempotent, but not reversible.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmTenantOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={runOne}>Run</Button>
        </DialogActions>
      </Dialog>

      {/* Confirm: run all tenants */}
      <Dialog open={runAllOpen} onClose={() => setRunAllOpen(false)}>
        <DialogTitle>Run pending migrations for every tenant?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            This applies real DDL/data changes to every tenant database on this server, one at a
            time. A failure on one tenant is reported and does not stop the rest — but this is
            not reversible. Consider running one tenant first if you haven't validated these
            migrations against this server yet.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRunAllOpen(false)}>Cancel</Button>
          <Button variant="contained" color="warning" onClick={runAll}>Run All</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
