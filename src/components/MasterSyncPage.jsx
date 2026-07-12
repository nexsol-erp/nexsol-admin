import React, { useState, useEffect, useCallback } from "react";
import {
  Box, Typography, Paper, Button, Chip, CircularProgress,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Dialog, DialogTitle, DialogContent, DialogActions,
  Alert, Tooltip, IconButton, Collapse, LinearProgress,
  Stack, Divider,
} from "@mui/material";
import {
  Sync as SyncIcon,
  CheckCircle as CheckIcon,
  Error as ErrorIcon,
  Schedule as PendingIcon,
  ExpandMore as ExpandIcon,
  ExpandLess as CollapseIcon,
  Refresh as RefreshIcon,
  Storage as StorageIcon,
} from "@mui/icons-material";

const API_BASE = (tenantId) => `/api/${tenantId}`;

const STATUS_CHIP = {
  SYNCED:  { color: "success", icon: <CheckIcon fontSize="small" /> },
  PENDING: { color: "warning", icon: <PendingIcon fontSize="small" /> },
  FAILED:  { color: "error",   icon: <ErrorIcon fontSize="small" /> },
};

function StatusChip({ status }) {
  const cfg = STATUS_CHIP[status] || { color: "default", icon: null };
  return (
    <Chip
      size="small"
      label={status}
      color={cfg.color}
      icon={cfg.icon}
      sx={{ fontWeight: 600 }}
    />
  );
}

function SyncSummaryCard({ franchise, rows, onFullSync, syncing }) {
  const [expanded, setExpanded] = useState(false);

  const totals = rows.reduce(
    (acc, r) => ({
      total:   acc.total   + Number(r.total   || 0),
      synced:  acc.synced  + Number(r.synced  || 0),
      pending: acc.pending + Number(r.pending || 0),
      failed:  acc.failed  + Number(r.failed  || 0),
    }),
    { total: 0, synced: 0, pending: 0, failed: 0 }
  );

  const pct = totals.total > 0 ? Math.round((totals.synced / totals.total) * 100) : 0;

  return (
    <Paper variant="outlined" sx={{ mb: 2 }}>
      <Box sx={{ p: 2, display: "flex", alignItems: "center", gap: 2, flexWrap: "wrap" }}>
        <StorageIcon color="primary" />
        <Box sx={{ flex: 1, minWidth: 180 }}>
          <Typography variant="subtitle1" fontWeight={700}>{franchise}</Typography>
          <Typography variant="caption" color="text.secondary">
            {totals.total} records across {rows.length} entity type{rows.length !== 1 ? "s" : ""}
          </Typography>
        </Box>

        <Stack direction="row" spacing={1} flexWrap="wrap">
          <Chip size="small" label={`${totals.synced} Synced`}  color="success" variant="outlined" />
          <Chip size="small" label={`${totals.pending} Pending`} color="warning" variant="outlined" />
          {totals.failed > 0 && (
            <Chip size="small" label={`${totals.failed} Failed`} color="error" variant="outlined" />
          )}
        </Stack>

        <Box sx={{ width: 100, mx: 1 }}>
          <LinearProgress variant="determinate" value={pct} sx={{ height: 8, borderRadius: 4 }} />
          <Typography variant="caption" align="center" display="block">{pct}%</Typography>
        </Box>

        <Button
          variant="contained"
          size="small"
          startIcon={syncing ? <CircularProgress size={14} color="inherit" /> : <SyncIcon />}
          onClick={() => onFullSync(franchise)}
          disabled={syncing}
        >
          Full Sync
        </Button>

        <IconButton size="small" onClick={() => setExpanded(!expanded)}>
          {expanded ? <CollapseIcon /> : <ExpandIcon />}
        </IconButton>
      </Box>

      <Collapse in={expanded}>
        <Divider />
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: "#1976d2" }}>
                <TableCell sx={{ color: "#fff", fontWeight: 700 }}>Entity Type</TableCell>
                <TableCell sx={{ color: "#fff", fontWeight: 700 }} align="right">Total</TableCell>
                <TableCell sx={{ color: "#fff", fontWeight: 700 }} align="right">Synced</TableCell>
                <TableCell sx={{ color: "#fff", fontWeight: 700 }} align="right">Pending</TableCell>
                <TableCell sx={{ color: "#fff", fontWeight: 700 }} align="right">Failed</TableCell>
                <TableCell sx={{ color: "#fff", fontWeight: 700 }}>Last Synced</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((row, i) => (
                <TableRow key={i} hover>
                  <TableCell>
                    <Chip label={row.entity_type} size="small" variant="outlined" />
                  </TableCell>
                  <TableCell align="right">{row.total}</TableCell>
                  <TableCell align="right">
                    <Typography color="success.main">{row.synced}</Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Typography color="warning.main">{row.pending}</Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Typography color={Number(row.failed) > 0 ? "error.main" : "text.secondary"}>
                      {row.failed}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="caption" color="text.secondary">
                      {row.last_synced_at
                        ? new Date(row.last_synced_at).toLocaleString()
                        : "—"}
                    </Typography>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Collapse>
    </Paper>
  );
}

export default function MasterSyncPage() {
  const tenantId  = localStorage.getItem("tenancyId") || "";
  const token     = localStorage.getItem("jwtToken")  || "";
  const headers   = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  const [statusData,    setStatusData]    = useState([]);
  const [franchises,    setFranchises]    = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [syncingAll,    setSyncingAll]    = useState(false);
  const [syncingMap,    setSyncingMap]    = useState({});
  const [alertMsg,      setAlertMsg]      = useState(null);
  const [alertSeverity, setAlertSeverity] = useState("success");

  // Detail dialog
  const [detailOpen,    setDetailOpen]    = useState(false);
  const [detailFranchise, setDetailFranchise] = useState(null);
  const [detailRows,    setDetailRows]    = useState([]);
  const [detailLoading, setDetailLoading] = useState(false);

  const flash = (msg, severity = "success") => {
    setAlertMsg(msg);
    setAlertSeverity(severity);
    setTimeout(() => setAlertMsg(null), 5000);
  };

  const loadStatus = useCallback(async () => {
    setLoading(true);
    try {
      const [statusRes, franchiseRes] = await Promise.all([
        fetch(`${API_BASE(tenantId)}/master-sync/status`, { headers }),
        fetch(`${API_BASE(tenantId)}/master-sync/franchises`, { headers }),
      ]);
      const [statusJson, franchiseJson] = await Promise.all([
        statusRes.json(),
        franchiseRes.json(),
      ]);
      setStatusData(Array.isArray(statusJson) ? statusJson : []);
      setFranchises(Array.isArray(franchiseJson) ? franchiseJson : []);
    } catch (e) {
      flash("Failed to load sync status: " + e.message, "error");
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => { loadStatus(); }, [loadStatus]);

  const handleFullSyncAll = async () => {
    setSyncingAll(true);
    try {
      const res = await fetch(`${API_BASE(tenantId)}/master-sync/full`, { method: "POST", headers });
      const data = await res.json();
      flash(data.message || "Full sync queued for all franchises");
      setTimeout(loadStatus, 3000);
    } catch (e) {
      flash("Full sync failed: " + e.message, "error");
    } finally {
      setSyncingAll(false);
    }
  };

  const handleFullSyncFranchise = async (franchiseTenant) => {
    setSyncingMap((m) => ({ ...m, [franchiseTenant]: true }));
    try {
      const res = await fetch(
        `${API_BASE(tenantId)}/master-sync/full/${encodeURIComponent(franchiseTenant)}`,
        { method: "POST", headers }
      );
      const data = await res.json();
      flash(data.message || `Sync queued for ${franchiseTenant}`);
      setTimeout(loadStatus, 3000);
    } catch (e) {
      flash("Sync failed: " + e.message, "error");
    } finally {
      setSyncingMap((m) => ({ ...m, [franchiseTenant]: false }));
    }
  };

  const openDetail = async (franchiseTenant) => {
    setDetailFranchise(franchiseTenant);
    setDetailOpen(true);
    setDetailLoading(true);
    try {
      const res = await fetch(
        `${API_BASE(tenantId)}/master-sync/status/${encodeURIComponent(franchiseTenant)}`,
        { headers }
      );
      const data = await res.json();
      setDetailRows(Array.isArray(data) ? data : []);
    } catch (e) {
      setDetailRows([]);
    } finally {
      setDetailLoading(false);
    }
  };

  // Group statusData by franchise_tenant
  const grouped = statusData.reduce((acc, row) => {
    const ft = row.franchise_tenant;
    if (!acc[ft]) acc[ft] = [];
    acc[ft].push(row);
    return acc;
  }, {});

  // Franchises with no sync log entries yet
  const knownFranchises = new Set(Object.keys(grouped));
  const unsynced = franchises.filter((f) => !knownFranchises.has(f.dbName));

  return (
    <Box sx={{ p: 3, maxWidth: 1200, mx: "auto" }}>
      {/* Header */}
      <Box sx={{ display: "flex", alignItems: "center", mb: 3, gap: 2, flexWrap: "wrap" }}>
        <Box sx={{ flex: 1 }}>
          <Typography variant="h5" fontWeight={700}>Master Data Sync</Typography>
          <Typography variant="body2" color="text.secondary">
            Synchronise items, categories and UOMs from central to franchise branches
          </Typography>
        </Box>
        <Tooltip title="Refresh status">
          <IconButton onClick={loadStatus} disabled={loading}>
            <RefreshIcon />
          </IconButton>
        </Tooltip>
        <Button
          variant="contained"
          color="primary"
          startIcon={syncingAll ? <CircularProgress size={16} color="inherit" /> : <SyncIcon />}
          onClick={handleFullSyncAll}
          disabled={syncingAll || loading}
        >
          Full Sync All Franchises
        </Button>
      </Box>

      {alertMsg && (
        <Alert severity={alertSeverity} sx={{ mb: 2 }} onClose={() => setAlertMsg(null)}>
          {alertMsg}
        </Alert>
      )}

      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
          <CircularProgress />
        </Box>
      ) : (
        <>
          {/* Franchises with sync history */}
          {Object.keys(grouped).length === 0 && unsynced.length === 0 && (
            <Paper sx={{ p: 4, textAlign: "center" }}>
              <Typography color="text.secondary">
                No provisioned franchises found. Provision a franchise first.
              </Typography>
            </Paper>
          )}

          {Object.entries(grouped).map(([franchise, rows]) => (
            <SyncSummaryCard
              key={franchise}
              franchise={franchise}
              rows={rows}
              onFullSync={handleFullSyncFranchise}
              syncing={!!syncingMap[franchise]}
            />
          ))}

          {/* Franchises not yet synced */}
          {unsynced.map((f) => (
            <Paper key={f.dbName} variant="outlined" sx={{ mb: 2 }}>
              <Box sx={{ p: 2, display: "flex", alignItems: "center", gap: 2, flexWrap: "wrap" }}>
                <StorageIcon color="disabled" />
                <Box sx={{ flex: 1 }}>
                  <Typography variant="subtitle1" fontWeight={700}>{f.dbName}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    Never synced • provisioned {f.provisionedAt ? new Date(f.provisionedAt).toLocaleDateString() : ""}
                  </Typography>
                </Box>
                <Chip label="No sync history" color="default" size="small" />
                <Button
                  variant="contained"
                  size="small"
                  startIcon={syncingMap[f.dbName] ? <CircularProgress size={14} color="inherit" /> : <SyncIcon />}
                  onClick={() => handleFullSyncFranchise(f.dbName)}
                  disabled={!!syncingMap[f.dbName]}
                >
                  Full Sync
                </Button>
              </Box>
            </Paper>
          ))}
        </>
      )}

      {/* Detail dialog */}
      <Dialog open={detailOpen} onClose={() => setDetailOpen(false)} maxWidth="lg" fullWidth>
        <DialogTitle>
          Sync Detail — {detailFranchise}
          <Typography variant="caption" display="block" color="text.secondary">
            Per-entity sync status
          </Typography>
        </DialogTitle>
        <DialogContent dividers>
          {detailLoading ? (
            <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
              <CircularProgress />
            </Box>
          ) : detailRows.length === 0 ? (
            <Typography color="text.secondary" align="center">No sync records found</Typography>
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: "#1976d2" }}>
                    <TableCell sx={{ color: "#fff", fontWeight: 700 }}>Entity Type</TableCell>
                    <TableCell sx={{ color: "#fff", fontWeight: 700 }}>Entity Name</TableCell>
                    <TableCell sx={{ color: "#fff", fontWeight: 700 }}>Status</TableCell>
                    <TableCell sx={{ color: "#fff", fontWeight: 700 }}>Version</TableCell>
                    <TableCell sx={{ color: "#fff", fontWeight: 700 }}>Last Synced</TableCell>
                    <TableCell sx={{ color: "#fff", fontWeight: 700 }}>Error</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {detailRows.map((r, i) => (
                    <TableRow key={i} hover>
                      <TableCell>
                        <Chip label={r.entity_type} size="small" variant="outlined" />
                      </TableCell>
                      <TableCell>{r.entity_name || r.entity_id}</TableCell>
                      <TableCell><StatusChip status={r.sync_status} /></TableCell>
                      <TableCell>{r.sync_version}</TableCell>
                      <TableCell>
                        <Typography variant="caption">
                          {r.last_synced_at ? new Date(r.last_synced_at).toLocaleString() : "—"}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        {r.error_message && (
                          <Tooltip title={r.error_message}>
                            <Typography variant="caption" color="error" noWrap sx={{ maxWidth: 200, display: "block" }}>
                              {r.error_message}
                            </Typography>
                          </Tooltip>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </DialogContent>
        <DialogActions>
          <Button
            variant="contained"
            size="small"
            startIcon={<SyncIcon />}
            onClick={() => handleFullSyncFranchise(detailFranchise)}
            disabled={!!syncingMap[detailFranchise]}
          >
            Full Sync This Franchise
          </Button>
          <Button onClick={() => setDetailOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
