import React, { useState } from "react";
import {
  Box, Typography, TextField, Button, Paper, Table, TableHead,
  TableRow, TableCell, TableBody, TableFooter, Chip,
} from "@mui/material";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import { getCashFlow } from "./accountingApi";
import { useFinancialYear } from "./useFinancialYear";

const fmt = (n) => Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 });

export default function CashFlow() {
  const [from, setFrom]     = useState("");
  const [to, setTo]         = useState("");
  const [branch, setBranch] = useState("");
  const [data, setData]     = useState(null);

  useFinancialYear(setFrom, setTo);

  const load = async () => {
    if (!from || !to) return;
    const res = await getCashFlow(from, to, branch);
    setData(res);
  };

  const exportXlsx = () => {
    if (!data) return;
    const rows = data.lines.map((l) => ({
      Date: l.voucherDate, Voucher: l.voucherNumber, Account: l.accountName,
      Module: l.sourceModule, Description: l.description,
      Inflow: l.inflow, Outflow: l.outflow, Balance: l.runningBalance,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "CashFlow");
    saveAs(new Blob([XLSX.write(wb, { type: "array", bookType: "xlsx" })]), `CashFlow_${from}_${to}.xlsx`);
  };

  return (
    <Box p={3}>
      <Typography variant="h5" gutterBottom>Cash & Bank Flow</Typography>
      <Paper sx={{ p: 2, mb: 3 }}>
        <Box display="flex" gap={2} flexWrap="wrap" alignItems="flex-end">
          <TextField label="From" type="date" value={from} onChange={(e) => setFrom(e.target.value)} InputLabelProps={{ shrink: true }} />
          <TextField label="To" type="date" value={to} onChange={(e) => setTo(e.target.value)} InputLabelProps={{ shrink: true }} />
          <TextField label="Branch" value={branch} onChange={(e) => setBranch(e.target.value)} sx={{ width: 140 }} placeholder="All" />
          <Button variant="contained" onClick={load}>Generate</Button>
          {data && <Button variant="outlined" onClick={exportXlsx}>Export Excel</Button>}
        </Box>
        {data && (
          <Box display="flex" gap={2} mt={2} flexWrap="wrap">
            <Chip label={`Opening: ₹ ${fmt(data.openingCashBalance)}`} color="info" />
            <Chip label={`Inflow: ₹ ${fmt(data.totalInflow)}`} color="success" />
            <Chip label={`Outflow: ₹ ${fmt(data.totalOutflow)}`} color="error" />
            <Chip label={`Closing: ₹ ${fmt(data.closingCashBalance)}`} color="primary" />
          </Box>
        )}
      </Paper>

      {data && (
        <Table size="small" component={Paper}>
          <TableHead sx={{ bgcolor: "primary.dark" }}>
            <TableRow>
              {["Date", "Voucher", "Account", "Module", "Description", "Inflow", "Outflow", "Balance"].map((h) => (
                <TableCell key={h} align={["Inflow", "Outflow", "Balance"].includes(h) ? "right" : "left"} sx={{ color: "white" }}>{h}</TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {data.lines.map((l, i) => (
              <TableRow key={i} hover>
                <TableCell>{l.voucherDate}</TableCell>
                <TableCell>{l.voucherNumber}</TableCell>
                <TableCell>{l.accountName}</TableCell>
                <TableCell>{l.sourceModule}</TableCell>
                <TableCell>{l.description}</TableCell>
                <TableCell align="right" sx={{ color: "success.main" }}>{l.inflow > 0 ? fmt(l.inflow) : ""}</TableCell>
                <TableCell align="right" sx={{ color: "error.main" }}>{l.outflow > 0 ? fmt(l.outflow) : ""}</TableCell>
                <TableCell align="right" sx={{ fontWeight: 600 }}>{fmt(l.runningBalance)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow sx={{ bgcolor: "action.hover" }}>
              <TableCell colSpan={5}><b>Net Cash Movement</b></TableCell>
              <TableCell align="right"><b>{fmt(data.totalInflow)}</b></TableCell>
              <TableCell align="right"><b>{fmt(data.totalOutflow)}</b></TableCell>
              <TableCell align="right"><b>₹ {fmt(data.closingCashBalance)}</b></TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      )}
    </Box>
  );
}
