import React, { useState } from "react";
import {
  Box, Typography, TextField, Button, Paper, Table, TableHead,
  TableRow, TableCell, TableBody, Divider, Chip,
} from "@mui/material";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import { getProfitLoss } from "./accountingApi";
import { useFinancialYear } from "./useFinancialYear";

const fmt = (n) => Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 });

function Section({ title, rows, total, color }) {
  return (
    <>
      <TableRow sx={{ bgcolor: "action.selected" }}>
        <TableCell colSpan={3}><b>{title}</b></TableCell>
      </TableRow>
      {rows.map((r, i) => (
        <TableRow key={i} hover>
          <TableCell sx={{ pl: 4 }}>{r.accountCode}</TableCell>
          <TableCell>{r.accountName}</TableCell>
          <TableCell align="right">₹ {fmt(r.amount)}</TableCell>
        </TableRow>
      ))}
      <TableRow>
        <TableCell colSpan={2} align="right" sx={{ fontWeight: 700 }}>Total {title}</TableCell>
        <TableCell align="right"><Chip label={`₹ ${fmt(total)}`} color={color} size="small" /></TableCell>
      </TableRow>
    </>
  );
}

export default function ProfitLoss() {
  const [from, setFrom]         = useState("");
  const [to, setTo]             = useState("");
  const [branch, setBranch]     = useState("");
  const [data, setData]         = useState(null);

  useFinancialYear(setFrom, setTo);

  const load = async () => {
    if (!from || !to) return;
    const res = await getProfitLoss(from, to, branch);
    setData(res);
  };

  const exportXlsx = () => {
    if (!data) return;
    const rows = [
      ...data.revenue.map((r) => ({ Section: "Revenue", Code: r.accountCode, Name: r.accountName, Amount: r.amount })),
      { Section: "TOTAL REVENUE", Code: "", Name: "", Amount: data.totalRevenue },
      ...data.costOfGoodsSold.map((r) => ({ Section: "COGS", Code: r.accountCode, Name: r.accountName, Amount: r.amount })),
      { Section: "GROSS PROFIT", Code: "", Name: "", Amount: data.grossProfit },
      ...data.operatingExpenses.map((r) => ({ Section: "Operating Expenses", Code: r.accountCode, Name: r.accountName, Amount: r.amount })),
      { Section: "NET PROFIT", Code: "", Name: "", Amount: data.netProfit },
    ];
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "P&L");
    saveAs(new Blob([XLSX.write(wb, { type: "array", bookType: "xlsx" })]), `ProfitLoss_${from}_${to}.xlsx`);
  };

  return (
    <Box p={3}>
      <Typography variant="h5" gutterBottom>Profit & Loss Statement</Typography>
      <Paper sx={{ p: 2, mb: 3 }}>
        <Box display="flex" gap={2} flexWrap="wrap" alignItems="flex-end">
          <TextField label="From" type="date" value={from} onChange={(e) => setFrom(e.target.value)} InputLabelProps={{ shrink: true }} />
          <TextField label="To" type="date" value={to} onChange={(e) => setTo(e.target.value)} InputLabelProps={{ shrink: true }} />
          <TextField label="Branch" value={branch} onChange={(e) => setBranch(e.target.value)} sx={{ width: 140 }} placeholder="All" />
          <Button variant="contained" onClick={load}>Generate</Button>
          {data && <Button variant="outlined" onClick={exportXlsx}>Export Excel</Button>}
        </Box>
      </Paper>

      {data && (
        <Table size="small" component={Paper}>
          <TableHead sx={{ bgcolor: "primary.dark" }}>
            <TableRow>
              <TableCell sx={{ color: "white" }}>Code</TableCell>
              <TableCell sx={{ color: "white" }}>Account</TableCell>
              <TableCell align="right" sx={{ color: "white" }}>Amount</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            <Section title="Revenue" rows={data.revenue} total={data.totalRevenue} color="success" />
            <Section title="Cost of Goods Sold" rows={data.costOfGoodsSold} total={data.totalCogs} color="error" />
            <TableRow sx={{ bgcolor: "primary.light" }}>
              <TableCell colSpan={2} align="right"><b>Gross Profit</b></TableCell>
              <TableCell align="right"><b>₹ {fmt(data.grossProfit)}</b></TableCell>
            </TableRow>
            <Section title="Operating Expenses" rows={data.operatingExpenses} total={data.totalOperatingExpenses} color="warning" />
            <Divider component="tr" />
            <TableRow sx={{ bgcolor: data.netProfit >= 0 ? "success.light" : "error.light" }}>
              <TableCell colSpan={2} align="right">
                <Typography variant="h6">{data.netProfit >= 0 ? "Net Profit" : "Net Loss"}</Typography>
              </TableCell>
              <TableCell align="right">
                <Typography variant="h6">₹ {fmt(Math.abs(data.netProfit))}</Typography>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      )}
    </Box>
  );
}
