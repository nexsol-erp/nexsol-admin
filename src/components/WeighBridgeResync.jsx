import React, { useState, useEffect, useCallback } from "react";
import {
  Box,
  Paper,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Alert,
} from "@mui/material";
import dayjs from "dayjs";

/**
 * Weighbridge re-sync requests.
 *
 * A voucher that never reached the server exists only on the POS terminal, so
 * the back office cannot pull it. What it can do is leave an instruction: pick a
 * branch and a date, and the terminal re-queues everything it holds for that day
 * the next time it logs in.
 */
const WeighBridgeResync = () => {
  const [branch, setBranch] = useState("");
  const [branches, setBranches] = useState([]);
  const [date, setDate] = useState(dayjs().format("YYYY-MM-DD"));
  const [requests, setRequests] = useState([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);

  const tenancyId = localStorage.getItem("tenancyId");
  const token = localStorage.getItem("jwtToken");

  const authHeaders = useCallback(
    () => ({
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    }),
    [token]
  );

  const fetchBranches = useCallback(async () => {
    try {
      const response = await fetch(`/api/${tenancyId}/branches`, {
        method: "GET",
        headers: authHeaders(),
      });
      const data = await response.json();
      // /branches returns objects ({ id, branchCode, branchName }); normalise once
      // here so the render stays dumb - handing MUI a raw object as a child blanks
      // the whole page.
      const list = Array.isArray(data.branches) ? data.branches : [];
      setBranches(
        list.map((b) =>
          typeof b === "string"
            ? { code: b, label: b }
            : {
                code: b.branchCode,
                label: b.branchName ? `${b.branchCode} - ${b.branchName}` : b.branchCode,
              }
        )
      );
    } catch (error) {
      console.error("Error fetching branches:", error);
    }
  }, [tenancyId, authHeaders]);

  const fetchRequests = useCallback(async () => {
    try {
      const query = branch ? `?branch=${encodeURIComponent(branch)}` : "";
      const response = await fetch(
        `/api/${tenancyId}/weighbridge/resync-request${query}`,
        { method: "GET", headers: authHeaders() }
      );
      const data = await response.json();
      setRequests(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Error fetching resync requests:", error);
    }
  }, [tenancyId, branch, authHeaders]);

  useEffect(() => {
    fetchBranches();
  }, [fetchBranches]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const handleFetch = async () => {
    if (!branch || !date) {
      setMessage({ severity: "warning", text: "Select a branch and a date first." });
      return;
    }

    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/${tenancyId}/weighbridge/resync-request`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ branchCode: branch, date }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        setMessage({ severity: "error", text: err.error || `Request failed (HTTP ${response.status})` });
        return;
      }

      setMessage({
        severity: "success",
        text: `Requested. ${branch} will re-push ${dayjs(date).format(
          "DD-MM-YYYY"
        )} the next time that terminal logs in.`,
      });
      fetchRequests();
    } catch (error) {
      setMessage({ severity: "error", text: error.message });
    } finally {
      setBusy(false);
    }
  };

  const statusChip = (row) => {
    if (row.status === "DONE") {
      return (
        <Chip
          size="small"
          color="success"
          label={`Done (${row.queuedCount ?? 0} queued)`}
        />
      );
    }
    return <Chip size="small" color="warning" label="Waiting for terminal" />;
  };

  const fmt = (value, pattern = "DD-MM-YYYY HH:mm") =>
    value ? dayjs(value).format(pattern) : "-";

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h6" sx={{ mb: 1 }}>
        Weighbridge Re-sync
      </Typography>
      <Typography variant="body2" sx={{ mb: 2, color: "text.secondary" }}>
        Ask a terminal to re-send the vouchers it holds for a given day. The
        terminal acts on it at its next login.
      </Typography>

      <Paper sx={{ p: 2, mb: 2, display: "flex", gap: 2, flexWrap: "wrap", alignItems: "center" }}>
        <FormControl sx={{ minWidth: 200 }} size="small">
          <InputLabel id="wb-resync-branch-label">Branch</InputLabel>
          <Select
            labelId="wb-resync-branch-label"
            label="Branch"
            value={branch}
            onChange={(e) => setBranch(e.target.value)}
          >
            {branches.map((b) => (
              <MenuItem key={b.code} value={b.code}>
                {b.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <TextField
          size="small"
          label="Date"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          InputLabelProps={{ shrink: true }}
        />

        <Button variant="contained" onClick={handleFetch} disabled={busy}>
          Fetch
        </Button>
      </Paper>

      {message && (
        <Alert severity={message.severity} sx={{ mb: 2 }} onClose={() => setMessage(null)}>
          {message.text}
        </Alert>
      )}

      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Branch</TableCell>
              <TableCell>Date</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Requested By</TableCell>
              <TableCell>Requested At</TableCell>
              <TableCell>Completed At</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {requests.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} align="center">
                  No re-sync requests yet.
                </TableCell>
              </TableRow>
            )}
            {requests.map((row) => (
              <TableRow key={row.id}>
                <TableCell>{row.branchCode}</TableCell>
                <TableCell>{fmt(row.resyncDate, "DD-MM-YYYY")}</TableCell>
                <TableCell>{statusChip(row)}</TableCell>
                <TableCell>{row.requestedBy || "-"}</TableCell>
                <TableCell>{fmt(row.requestedAt)}</TableCell>
                <TableCell>{fmt(row.completedAt)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
};

export default WeighBridgeResync;
