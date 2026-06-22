import React, { useState, useEffect } from "react";
import {
  Box, Typography, TextField, MenuItem, Button, Table, TableHead,
  TableRow, TableCell, TableBody, Paper, Chip,
} from "@mui/material";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import { getLedgerAccounts, getLedgerStatement } from "./accountingApi";

const fmt = (n) => Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 });

export default function LedgerStatement() {
  const [accounts, setAccounts]     = useState([]);
  const [accountId, setAccountId]   = useState("");
  const [from, setFrom]             = useState("");
  const [to, setTo]                 = useState("");
  const [branchCode, setBranch]     = useState("");
  const [result, setResult]         = useState(null);

  useEffect(() => {
    getLedgerAccounts().then((d) => setAccounts(Array.isArray(d) ? d : []));
  }, []);

  const load = async () => {
    if (!accountId || !from || !to) return;
    const data = await getLedgerStatement(accountId, from, to, branchCode);
    setResult(data);
  };

  const exportXlsx = () => {
    if (!result) return;
    const rows = result.lines.map((l) => ({
      Date: l.voucherDate, Voucher: l.voucherNumber, Type: l.voucherTypeCode,
      Description: l.description, Debit: l.debit, Credit: l.credit, Balance: l.balance,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Ledger");
    saveAs(new Blob([XLSX.write(wb, { type: "array", bookType: "xlsx" })]), `Ledger_${result.accountName}.xlsx`);
  };

  return (
    <Box p={3}>
      <Typography variant="h5" gutterBottom>Ledger Statement</Typography>
      <Paper sx={{ p: 2, mb: 3 }}>
        <Box display="flex" gap={2} flexWrap="wrap" alignItems="flex-end">
          <TextField select label="Account" value={accountId} onChange={(e) => setAccountId(e.target.value)} sx={{ width: 260 }}>
            {accounts.map((a) => <MenuItem key={a.id} value={a.id}>{a.accountName}</MenuItem>)}
          </TextField>
          <TextField label="From" type="date" value={from} onChange={(e) => setFrom(e.target.value)} InputLabelProps={{ shrink: true }} />
          <TextField label="To" type="date" value={to} onChange={(e) => setTo(e.target.value)} InputLabelProps={{ shrink: true }} />
          <TextField label="Branch" value={branchCode} onChange={(e) => setBranch(e.target.value)} sx={{ width: 140 }} placeholder="All" />
          <Button variant="contained" onClick={load}>Load</Button>
          {result && <Button variant="outlined" onClick={exportXlsx}>Export Excel</Button>}
        </Box>
      </Paper>

      {result && (
        <>
          <Box display="flex" gap={3} mb={2}>
            <Typography><b>{result.accountName}</b> ({result.accountCode}) — {result.accountType}</Typography>
            <Chip label={`Opening: ₹ ${fmt(result.openingBalance)}`} color="info" />
            <Chip label={`Closing: ₹ ${fmt(result.closingBalance)}`} color="primary" />
          </Box>
          <Table size="small" component={Paper}>
            <TableHead sx={{ bgcolor: "primary.dark" }}>
              <TableRow>
                {["Date", "Voucher No", "Type", "Description", "Debit", "Credit", "Balance"].map((h) => (
                  <TableCell key={h} align={["Debit", "Credit", "Balance"].includes(h) ? "right" : "left"} sx={{ color: "white" }}>{h}</TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {(result.lines || []).map((l, i) => (
                <TableRow key={i} hover>
                  <TableCell>{l.voucherDate}</TableCell>
                  <TableCell>{l.voucherNumber}</TableCell>
                  <TableCell>{l.voucherTypeCode}</TableCell>
                  <TableCell>{l.description}</TableCell>
                  <TableCell align="right">{l.debit > 0 ? fmt(l.debit) : ""}</TableCell>
                  <TableCell align="right">{l.credit > 0 ? fmt(l.credit) : ""}</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 600 }}>{fmt(l.balance)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </>
      )}
    </Box>
  );
}
