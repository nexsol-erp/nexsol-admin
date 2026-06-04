import React, { useEffect, useState } from "react";
import {
  Box, Button, CircularProgress, Divider, FormControl, InputLabel,
  MenuItem, Paper, Select, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Typography, Alert,
} from "@mui/material";

const DENOMINATIONS = [2000, 500, 200, 100, 50, 20, 10, 5, 2, 1];

function fmt2(v) {
  return Number(v || 0).toFixed(2);
}

const DayEndReport = () => {
  const tenantId = localStorage.getItem("tenancyId") || "";
  const token    = localStorage.getItem("jwtToken")  || "";
  const headers  = { Authorization: `Bearer ${token}` };

  const [branches, setBranches]         = useState([]);
  const [selectedBranch, setSelectedBranch] = useState("");
  const [selectedDate, setSelectedDate] = useState(
    () => new Date().toISOString().slice(0, 10)
  );

  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState(null);
  const [denomRows, setDenomRows] = useState([]);   // [{currency, quantity, amount}]
  const [summary, setSummary]     = useState(null);  // {totalSales, billCount, totalReceipts, byMode}

  // Fetch branch list
  useEffect(() => {
    fetch(`/api/${tenantId}/branches`, { headers })
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (!data) return;
        const list = Array.isArray(data) ? data : (data?.branches ?? data?.data ?? []);
        setBranches(list);
        if (list.length === 1) setSelectedBranch(list[0].branchCode);
      })
      .catch(() => {});
  }, []);

  const fetchReport = async () => {
    if (!selectedBranch || !selectedDate) return;
    setLoading(true);
    setError(null);
    setDenomRows([]);
    setSummary(null);

    try {
      const [detRes, sumRes] = await Promise.all([
        fetch(`/api/${tenantId}/day-end/details/${selectedBranch}/${selectedDate}`, { headers }),
        fetch(`/api/${tenantId}/day-end/summary/${selectedBranch}/${selectedDate}`, { headers }),
      ]);

      if (!detRes.ok) throw new Error(`Details fetch failed (${detRes.status})`);
      if (!sumRes.ok) throw new Error(`Summary fetch failed (${sumRes.status})`);

      const detData = await detRes.json();
      const sumData = await sumRes.json();

      // Normalise denomination rows — fill in all denominations with 0 if missing
      const detMap = {};
      if (Array.isArray(detData)) {
        detData.forEach((r) => { detMap[Number(r.currency)] = r; });
      }
      const rows = DENOMINATIONS.map((d) => ({
        currency: d,
        quantity: Number(detMap[d]?.quantity || 0),
        amount:   Number(detMap[d]?.amount   || detMap[d]?.quantity * d || 0),
      }));
      setDenomRows(rows);
      setSummary(sumData);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const cashTotal    = denomRows.reduce((s, r) => s + r.amount, 0);
  const nonZeroRows  = denomRows.filter((r) => r.quantity > 0);
  const branchInfo   = branches.find((b) => b.branchCode === selectedBranch);

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h5" gutterBottom>Day End Report</Typography>

      {/* Filters */}
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
                marginTop: 16, padding: "6px 10px", fontSize: 14,
                border: "1px solid #c4c4c4", borderRadius: 4,
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

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {summary && (
        <Box sx={{ display: "flex", gap: 3, flexWrap: "wrap" }}>

          {/* Left — Branch info + denomination */}
          <Paper elevation={2} sx={{ p: 2, flex: "1 1 340px" }}>
            {/* Branch header */}
            {branchInfo && (
              <Box sx={{ mb: 2, textAlign: "center" }}>
                <Typography variant="h6">{branchInfo.branchName || selectedBranch}</Typography>
                {branchInfo.branchAddress1 && (
                  <Typography variant="body2" color="text.secondary">{branchInfo.branchAddress1}</Typography>
                )}
                {branchInfo.branchGst && (
                  <Typography variant="body2" color="text.secondary">GST: {branchInfo.branchGst}</Typography>
                )}
              </Box>
            )}

            <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
              Day End Collection Report
            </Typography>
            <Box sx={{ display: "flex", justifyContent: "space-between", mb: 1 }}>
              <Typography variant="body2" color="text.secondary">Branch: {selectedBranch}</Typography>
              <Typography variant="body2" color="text.secondary">Date: {selectedDate}</Typography>
            </Box>
            <Divider sx={{ mb: 1 }} />

            <Typography variant="subtitle2" gutterBottom>Cash Denomination</Typography>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ "& th": { fontWeight: "bold" } }}>
                    <TableCell>Currency</TableCell>
                    <TableCell align="right">Qty</TableCell>
                    <TableCell align="right">Amount</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {nonZeroRows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} align="center">
                        <Typography variant="body2" color="text.secondary">No cash recorded</Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    nonZeroRows.map((r) => (
                      <TableRow key={r.currency}>
                        <TableCell>{r.currency}</TableCell>
                        <TableCell align="right">{r.quantity}</TableCell>
                        <TableCell align="right">{fmt2(r.amount)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>

            <Divider sx={{ my: 1 }} />
            <Box sx={{ display: "flex", justifyContent: "space-between" }}>
              <Typography variant="subtitle2">Cash Total</Typography>
              <Typography variant="subtitle2">{fmt2(cashTotal)}</Typography>
            </Box>
          </Paper>

          {/* Right — Sales summary */}
          <Paper elevation={2} sx={{ p: 2, flex: "1 1 300px" }}>
            <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
              Sales Summary
            </Typography>
            <Divider sx={{ mb: 1 }} />

            <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.5 }}>
              <Typography variant="body2">Total Bills</Typography>
              <Typography variant="body2" fontWeight="bold">{summary.billCount ?? 0}</Typography>
            </Box>
            <Box sx={{ display: "flex", justifyContent: "space-between", mb: 1 }}>
              <Typography variant="body2">Total Sales</Typography>
              <Typography variant="body2" fontWeight="bold">{fmt2(summary.totalSales)}</Typography>
            </Box>

            <Divider sx={{ mb: 1 }} />
            <Typography variant="subtitle2" gutterBottom>Receipt Mode Breakdown</Typography>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ "& th": { fontWeight: "bold" } }}>
                    <TableCell>Mode</TableCell>
                    <TableCell align="right">Amount</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(summary.byMode || []).map((m) => (
                    <TableRow key={m.receiptMode}>
                      <TableCell>{m.receiptMode}</TableCell>
                      <TableCell align="right">{fmt2(m.amount)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>

            <Divider sx={{ my: 1 }} />
            <Box sx={{ display: "flex", justifyContent: "space-between" }}>
              <Typography variant="subtitle2">Total Receipts</Typography>
              <Typography variant="subtitle2">{fmt2(summary.totalReceipts)}</Typography>
            </Box>
          </Paper>

        </Box>
      )}
    </Box>
  );
};

export default DayEndReport;
