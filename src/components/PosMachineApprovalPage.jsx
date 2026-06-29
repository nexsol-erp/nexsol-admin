import React, { useEffect, useState, useCallback } from "react";
import {
  Box, Typography, Paper, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Button, Chip, CircularProgress, Alert,
  Select, MenuItem, FormControl, InputLabel, Tooltip, Stack,
} from "@mui/material";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import CancelOutlinedIcon from "@mui/icons-material/CancelOutlined";
import RefreshIcon from "@mui/icons-material/Refresh";

function statusChip(status) {
  const map = {
    PENDING:  { label: "Pending",  color: "warning" },
    APPROVED: { label: "Approved", color: "success" },
    REJECTED: { label: "Rejected", color: "error"   },
  };
  const s = map[status] || { label: status, color: "default" };
  return <Chip label={s.label} color={s.color} size="small" />;
}

function fmt(dt) {
  if (!dt) return "—";
  return new Date(dt).toLocaleString();
}

export default function PosMachineApprovalPage() {
  const tenancyId = localStorage.getItem("tenancyId") || "";
  const token     = localStorage.getItem("jwtToken")  || "";
  const headers   = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  const [machines, setMachines]   = useState([]);
  const [filter, setFilter]       = useState("PENDING");
  const [loading, setLoading]     = useState(false);
  const [actionMsg, setActionMsg] = useState(null); // { type: "success"|"error", text }
  const [acting, setActing]       = useState(null); // id being acted on

  const load = useCallback(async () => {
    if (!tenancyId) return;
    setLoading(true);
    setActionMsg(null);
    try {
      const url = filter === "PENDING"
        ? `/api/${tenancyId}/pos-machines/pending`
        : filter === "ALL"
          ? `/api/${tenancyId}/pos-machines/all`
          : `/api/${tenancyId}/pos-machines/all?status=${filter}`;

      const resp = await fetch(url, { headers });

      if (resp.status === 403) {
        setActionMsg({ type: "error", text: "You do not have permission to view this page (admin or MACHINE_ADMIN role required)." });
        setMachines([]);
        return;
      }
      if (!resp.ok) throw new Error("Failed to load");
      setMachines(await resp.json());
    } catch (e) {
      setActionMsg({ type: "error", text: e.message || "Failed to load machines" });
    } finally {
      setLoading(false);
    }
  }, [tenancyId, filter, token]);

  useEffect(() => { load(); }, [load]);

  const act = async (id, action) => {
    setActing(id);
    setActionMsg(null);
    try {
      const resp = await fetch(`/api/${tenancyId}/pos-machines/${id}/${action}`, {
        method: "POST",
        headers,
      });
      if (resp.status === 403) {
        setActionMsg({ type: "error", text: "Insufficient permissions to perform this action." });
        return;
      }
      if (!resp.ok) throw new Error(await resp.text());
      const updated = await resp.json();
      setMachines((prev) =>
        prev.map((m) => (m.id === id ? { ...m, machineCode: updated.machineCode, status: updated.status } : m))
      );
      setActionMsg({
        type: "success",
        text: action === "approve"
          ? `Machine approved — assigned code ${updated.machineCode}`
          : "Machine rejected",
      });
    } catch (e) {
      setActionMsg({ type: "error", text: e.message || "Action failed" });
    } finally {
      setActing(null);
    }
  };

  const visible = machines.filter((m) => filter === "ALL" || m.status === filter);

  return (
    <Box sx={{ p: 3, maxWidth: 1100, mx: "auto" }}>
      <Typography variant="h5" fontWeight={700} mb={0.5}>
        POS Machine Approval
      </Typography>
      <Typography variant="body2" color="text.secondary" mb={3}>
        New POS terminals appear here as <strong>Pending</strong>. Approve them to assign a machine code and allow billing, or reject them to block access.
      </Typography>

      {actionMsg && (
        <Alert severity={actionMsg.type} sx={{ mb: 2 }} onClose={() => setActionMsg(null)}>
          {actionMsg.text}
        </Alert>
      )}

      <Stack direction="row" spacing={2} alignItems="center" mb={2}>
        <FormControl size="small" sx={{ minWidth: 160 }}>
          <InputLabel>Show</InputLabel>
          <Select value={filter} label="Show" onChange={(e) => setFilter(e.target.value)}>
            <MenuItem value="PENDING">Pending only</MenuItem>
            <MenuItem value="APPROVED">Approved only</MenuItem>
            <MenuItem value="REJECTED">Rejected only</MenuItem>
            <MenuItem value="ALL">All</MenuItem>
          </Select>
        </FormControl>
        <Button
          size="small"
          startIcon={loading ? <CircularProgress size={14} /> : <RefreshIcon fontSize="small" />}
          onClick={load}
          disabled={loading}
          variant="outlined"
        >
          Refresh
        </Button>
      </Stack>

      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow sx={{ bgcolor: "action.hover" }}>
              <TableCell><strong>Branch</strong></TableCell>
              <TableCell><strong>Machine Code</strong></TableCell>
              <TableCell><strong>Machine Name</strong></TableCell>
              <TableCell><strong>Device Key</strong></TableCell>
              <TableCell><strong>Registered</strong></TableCell>
              <TableCell><strong>Last Seen</strong></TableCell>
              <TableCell><strong>Status</strong></TableCell>
              <TableCell><strong>Actions</strong></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading && (
              <TableRow>
                <TableCell colSpan={8} align="center" sx={{ py: 4 }}>
                  <CircularProgress size={28} />
                </TableCell>
              </TableRow>
            )}
            {!loading && visible.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} align="center" sx={{ py: 4, color: "text.secondary" }}>
                  No machines found
                </TableCell>
              </TableRow>
            )}
            {!loading && visible.map((m) => (
              <TableRow key={m.id} hover>
                <TableCell>{m.branchCode}</TableCell>
                <TableCell>{m.machineCode || <span style={{ color: "#9ca3af" }}>Not assigned</span>}</TableCell>
                <TableCell>{m.machineName || "—"}</TableCell>
                <TableCell>
                  <Tooltip title={m.deviceKey}>
                    <Typography variant="caption" sx={{ fontFamily: "monospace" }}>
                      {m.deviceKey?.slice(0, 12)}…
                    </Typography>
                  </Tooltip>
                </TableCell>
                <TableCell sx={{ whiteSpace: "nowrap", fontSize: 12 }}>{fmt(m.registeredAt)}</TableCell>
                <TableCell sx={{ whiteSpace: "nowrap", fontSize: 12 }}>{fmt(m.lastSeenAt)}</TableCell>
                <TableCell>{statusChip(m.status)}</TableCell>
                <TableCell>
                  <Stack direction="row" spacing={1}>
                    {m.status === "PENDING" && (
                      <>
                        <Button
                          size="small"
                          variant="contained"
                          color="success"
                          startIcon={acting === m.id ? <CircularProgress size={12} color="inherit" /> : <CheckCircleOutlineIcon fontSize="small" />}
                          disabled={acting === m.id}
                          onClick={() => act(m.id, "approve")}
                        >
                          Approve
                        </Button>
                        <Button
                          size="small"
                          variant="outlined"
                          color="error"
                          startIcon={<CancelOutlinedIcon fontSize="small" />}
                          disabled={acting === m.id}
                          onClick={() => act(m.id, "reject")}
                        >
                          Reject
                        </Button>
                      </>
                    )}
                    {m.status === "APPROVED" && (
                      <Button
                        size="small"
                        variant="outlined"
                        color="error"
                        startIcon={<CancelOutlinedIcon fontSize="small" />}
                        disabled={acting === m.id}
                        onClick={() => act(m.id, "reject")}
                      >
                        Revoke
                      </Button>
                    )}
                    {m.status === "REJECTED" && (
                      <Button
                        size="small"
                        variant="contained"
                        color="success"
                        startIcon={<CheckCircleOutlineIcon fontSize="small" />}
                        disabled={acting === m.id}
                        onClick={() => act(m.id, "approve")}
                      >
                        Approve
                      </Button>
                    )}
                  </Stack>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: "block" }}>
        Only users with the <strong>admin</strong> or <strong>MACHINE_ADMIN</strong> role can approve or reject machines.
      </Typography>
    </Box>
  );
}
