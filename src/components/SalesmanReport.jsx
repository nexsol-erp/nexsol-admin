import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Divider,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";

function fmt2(v) {
  return Number(v || 0).toFixed(2);
}

const SalesmanReport = () => {
  const tenantId = localStorage.getItem("tenancyId") || "";
  const token    = localStorage.getItem("jwtToken")  || "";
  const headers  = { Authorization: `Bearer ${token}` };

  const [branches, setBranches]             = useState([]);
  const [selectedBranch, setSelectedBranch] = useState("");
  const [selectedDate, setSelectedDate]     = useState(
    () => new Date().toISOString().slice(0, 10)
  );
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);
  const [rows, setRows]       = useState([]);

  const allowedBranches = useMemo(() => {
    try {
      const raw = localStorage.getItem("allowedBranches");
      const list = raw ? JSON.parse(raw) : [];
      return Array.isArray(list) ? list : [];
    } catch {
      return [];
    }
  }, []);

  useEffect(() => {
    fetch(`/api/${tenantId}/branches`, { headers })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data) return;
        const list = Array.isArray(data) ? data : (data?.branches ?? data?.data ?? []);
        const filtered = allowedBranches.length
          ? list.filter((b) => allowedBranches.includes(b.branchCode))
          : [];
        setBranches(filtered);
        if (filtered.length === 1) setSelectedBranch(filtered[0].branchCode);
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchReport = async () => {
    if (!selectedBranch || !selectedDate) return;
    setLoading(true);
    setError(null);
    setRows([]);
    try {
      const res = await fetch(
        `/api/${tenantId}/salesman-summary?branchCode=${selectedBranch}&date=${selectedDate}`,
        { headers }
      );
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      const data = await res.json();
      setRows(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const totalBills  = rows.reduce((s, r) => s + Number(r.totalBills  || 0), 0);
  const totalAmount = rows.reduce((s, r) => s + Number(r.totalAmount || 0), 0);

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h5" gutterBottom>
        Salesman Report
      </Typography>

      {allowedBranches.length === 0 && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          No allowed branches found. Please log in again or check branch assignments.
        </Alert>
      )}

      <Paper elevation={2} sx={{ p: 2, mb: 3 }}>
        <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap", alignItems: "flex-end" }}>
          <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel>Branch</InputLabel>
            <Select
              value={selectedBranch}
              label="Branch"
              onChange={(e) => setSelectedBranch(e.target.value)}
            >
              {branches.map((b) => (
                <MenuItem key={b.branchCode} value={b.branchCode}>
                  {b.branchCode}{b.branchName ? ` — ${b.branchName}` : ""}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl size="small">
            <InputLabel shrink>Date</InputLabel>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              style={{
                marginTop: 16,
                padding: "6px 10px",
                fontSize: 14,
                border: "1px solid #c4c4c4",
                borderRadius: 4,
              }}
            />
          </FormControl>

          <Button
            variant="contained"
            onClick={fetchReport}
            disabled={!selectedBranch || !selectedDate || loading}
          >
            {loading ? <CircularProgress size={20} color="inherit" /> : "View Report"}
          </Button>
        </Box>
      </Paper>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {rows.length > 0 && (
        <Paper elevation={2} sx={{ p: 2 }}>
          <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
            Salesman-wise Sales — {selectedDate}
          </Typography>
          <Divider sx={{ mb: 1 }} />
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ "& th": { fontWeight: "bold" } }}>
                  <TableCell>#</TableCell>
                  <TableCell>Salesman</TableCell>
                  <TableCell align="right">Bills</TableCell>
                  <TableCell align="right">Total Amount</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((row, idx) => (
                  <TableRow key={idx} hover>
                    <TableCell>{idx + 1}</TableCell>
                    <TableCell>{row.salesmanName}</TableCell>
                    <TableCell align="right">{row.totalBills}</TableCell>
                    <TableCell align="right">{fmt2(row.totalAmount)}</TableCell>
                  </TableRow>
                ))}
                <TableRow sx={{ "& td": { fontWeight: "bold", borderTop: "2px solid" } }}>
                  <TableCell colSpan={2}>Total</TableCell>
                  <TableCell align="right">{totalBills}</TableCell>
                  <TableCell align="right">{fmt2(totalAmount)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}

      {!loading && !error && rows.length === 0 && selectedBranch && (
        <Typography variant="body2" color="text.secondary">
          No data. Select a branch and date, then click View Report.
        </Typography>
      )}
    </Box>
  );
};

export default SalesmanReport;
