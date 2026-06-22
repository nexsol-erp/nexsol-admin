import React, { useState } from "react";
import {
  Box, Typography, TextField, Button, Table, TableHead, TableRow,
  TableCell, TableBody, Paper, TableFooter, Chip,
} from "@mui/material";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import { getTrialBalance } from "./accountingApi";

const fmt = (n) => Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 });

const TYPE_COLOR = { ASSET: "primary", LIABILITY: "warning", EQUITY: "success", INCOME: "info", EXPENSE: "error" };

export default function TrialBalance() {
  const [from, setFrom]           = useState("");
  const [to, setTo]               = useState("");
  const [branchCode, setBranch]   = useState("");
  const [rows, setRows]           = useState([]);
  const [loading, setLoading]     = useState(false);

  const load = async () => {
    if (!from || !to) return;
    setLoading(true);
    const data = await getTrialBalance(from, to, branchCode);
    setRows(Array.isArray(data) ? data : []);
    setLoading(false);
  };

  const totalDr = rows.reduce((s, r) => s + Number(r.debit || 0), 0);
  const totalCr = rows.reduce((s, r) => s + Number(r.credit || 0), 0);

  const exportXlsx = () => {
    const ws = XLSX.utils.json_to_sheet(rows.map((r) => ({
      "Account Code": r.accountCode, "Account Name": r.accountName,
      "Type": r.accountType, "Debit": r.debit, "Credit": r.credit, "Net Balance": r.netBalance,
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Trial Balance");
    saveAs(new Blob([XLSX.write(wb, { type: "array", bookType: "xlsx" })]), `TrialBalance_${from}_${to}.xlsx`);
  };

  return (
    <Box p={3}>
      <Typography variant="h5" gutterBottom>Trial Balance</Typography>
      <Paper sx={{ p: 2, mb: 3 }}>
        <Box display="flex" gap={2} flexWrap="wrap" alignItems="flex-end">
          <TextField label="From" type="date" value={from} onChange={(e) => setFrom(e.target.value)} InputLabelProps={{ shrink: true }} />
          <TextField label="To" type="date" value={to} onChange={(e) => setTo(e.target.value)} InputLabelProps={{ shrink: true }} />
          <TextField label="Branch Code" value={branchCode} onChange={(e) => setBranch(e.target.value)} sx={{ width: 160 }} placeholder="All branches" />
          <Button variant="contained" onClick={load} disabled={loading}>Generate</Button>
          {rows.length > 0 && <Button variant="outlined" onClick={exportXlsx}>Export Excel</Button>}
        </Box>
      </Paper>

      {rows.length > 0 && (
        <Table size="small" component={Paper}>
          <TableHead sx={{ bgcolor: "primary.dark" }}>
            <TableRow>
              <TableCell sx={{ color: "white" }}>Code</TableCell>
              <TableCell sx={{ color: "white" }}>Account Name</TableCell>
              <TableCell sx={{ color: "white" }}>Type</TableCell>
              <TableCell align="right" sx={{ color: "white" }}>Debit</TableCell>
              <TableCell align="right" sx={{ color: "white" }}>Credit</TableCell>
              <TableCell align="right" sx={{ color: "white" }}>Net Balance</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((r, i) => (
              <TableRow key={i} hover>
                <TableCell>{r.accountCode}</TableCell>
                <TableCell>{r.accountName}</TableCell>
                <TableCell>
                  <Chip label={r.accountType} size="small" color={TYPE_COLOR[r.accountType] || "default"} />
                </TableCell>
                <TableCell align="right">{r.debit > 0 ? fmt(r.debit) : ""}</TableCell>
                <TableCell align="right">{r.credit > 0 ? fmt(r.credit) : ""}</TableCell>
                <TableCell align="right" sx={{ fontWeight: 600 }}>{fmt(r.netBalance)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow sx={{ bgcolor: "action.hover" }}>
              <TableCell colSpan={3}><b>Total</b></TableCell>
              <TableCell align="right"><b>{fmt(totalDr)}</b></TableCell>
              <TableCell align="right"><b>{fmt(totalCr)}</b></TableCell>
              <TableCell align="right">
                <Chip label={totalDr === totalCr ? "✓ Balanced" : "✗ Unbalanced"} color={totalDr === totalCr ? "success" : "error"} size="small" />
              </TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      )}
    </Box>
  );
}
