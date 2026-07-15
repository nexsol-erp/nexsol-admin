import React, { useCallback, useEffect, useState } from "react";
import {
  Box,
  Paper,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  Stack,
  CircularProgress,
  Alert,
  Chip,
} from "@mui/material";
import { Popconfirm } from "antd";
import RefreshIcon from "@mui/icons-material/Refresh";
import PowerSettingsNewIcon from "@mui/icons-material/PowerSettingsNew";

const API = () => {
  const tenancyId = localStorage.getItem("tenancyId");
  const token = localStorage.getItem("jwtToken");
  return {
    base: `/api/${tenancyId}`,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  };
};

export default function PosSessionsPage() {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [kickingKey, setKickingKey] = useState("");
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const { base, headers } = API();

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${base}/pos-sessions`, { headers });
      if (!res.ok) throw new Error(`status ${res.status}`);
      const data = await res.json();
      setSessions(Array.isArray(data.sessions) ? data.sessions : []);
    } catch (e) {
      setError("Failed to load connected terminals: " + (e.message || "Unknown error"));
    } finally {
      setLoading(false);
    }
  }, [base]);

  useEffect(() => {
    load();
  }, [load]);

  const kick = async (row) => {
    setKickingKey(row.key);
    setError("");
    setSuccessMsg("");
    try {
      const res = await fetch(`${base}/pos-sessions/kick`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          branch: row.branch,
          machine: row.machine,
          reason: "Disconnected by admin — please log in again to continue",
        }),
      });
      if (!res.ok) throw new Error(`status ${res.status}`);
      setSuccessMsg(`Disconnected terminal ${row.machine || row.key} (branch ${row.branch}).`);
      await load();
    } catch (e) {
      setError("Failed to disconnect terminal: " + (e.message || "Unknown error"));
    } finally {
      setKickingKey("");
    }
  };

  const formatTime = (iso) => {
    if (!iso) return "—";
    try {
      return new Date(iso).toLocaleString();
    } catch {
      return iso;
    }
  };

  return (
    <Box sx={{ flexGrow: 1, p: 3, ml: "240px", mt: 2 }}>
      <Paper sx={{ width: "100%", maxWidth: 900, padding: 3 }} elevation={3}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" mb={1}>
          <Typography variant="h4">Connected POS Terminals</Typography>
          <Button variant="outlined" size="small" startIcon={<RefreshIcon />} onClick={load} disabled={loading}>
            Refresh
          </Button>
        </Stack>
        <Typography variant="body2" color="text.secondary" gutterBottom>
          Force-disconnect a terminal to make it log in again — useful for pushing a stale
          session to pick up an app update on next launch.
        </Typography>

        <Stack spacing={2} sx={{ mt: 2 }}>
          {error && <Alert severity="error">{error}</Alert>}
          {successMsg && <Alert severity="success" onClose={() => setSuccessMsg("")}>{successMsg}</Alert>}

          {loading ? (
            <Box display="flex" justifyContent="center" py={4}>
              <CircularProgress size={28} />
            </Box>
          ) : sessions.length === 0 ? (
            <Alert severity="info">No POS terminals currently connected for this tenant.</Alert>
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: "#1976d2" }}>
                    <TableCell sx={{ color: "#fff", fontWeight: 700 }}>Branch</TableCell>
                    <TableCell sx={{ color: "#fff", fontWeight: 700 }}>Machine</TableCell>
                    <TableCell sx={{ color: "#fff", fontWeight: 700 }}>Version</TableCell>
                    <TableCell sx={{ color: "#fff", fontWeight: 700 }}>Connected Since</TableCell>
                    <TableCell sx={{ color: "#fff", fontWeight: 700 }} align="right">Action</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {sessions.map((row) => (
                    <TableRow key={row.key} hover>
                      <TableCell>
                        <Chip label={row.branch || "—"} size="small" color="primary" variant="outlined" />
                      </TableCell>
                      <TableCell>{row.machine || "—"}</TableCell>
                      <TableCell>{row.version || "—"}</TableCell>
                      <TableCell>{formatTime(row.connectedAt)}</TableCell>
                      <TableCell align="right">
                        <Popconfirm
                          title="Disconnect this terminal?"
                          description="The terminal will be logged out and must sign in again to reconnect."
                          onConfirm={() => kick(row)}
                          okText="Disconnect"
                          okButtonProps={{ danger: true }}
                          cancelText="Cancel"
                        >
                          <Button
                            size="small"
                            color="error"
                            variant="outlined"
                            startIcon={<PowerSettingsNewIcon />}
                            disabled={kickingKey === row.key}
                          >
                            {kickingKey === row.key ? "Disconnecting…" : "Disconnect"}
                          </Button>
                        </Popconfirm>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Stack>
      </Paper>
    </Box>
  );
}
