import React, { useState } from "react";
import {
  Box, Typography, TextField, Button, Paper, Table, TableHead,
  TableRow, TableCell, TableBody, Chip, Grid,
} from "@mui/material";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import { getBalanceSheet } from "./accountingApi";

const fmt = (n) => Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 });

function BSSection({ title, rows, total, color }) {
  return (
    <Box mb={3}>
      <Typography variant="subtitle1" fontWeight={700} sx={{ bgcolor: "action.selected", p: 1, borderRadius: 1 }}>
        {title}
      </Typography>
      <Table size="small">
        <TableBody>
          {rows.map((r, i) => (
            <TableRow key={i} hover>
              <TableCell sx={{ pl: 3 }}>{r.accountCode}</TableCell>
              <TableCell>{r.accountName}</TableCell>
              <TableCell align="right">₹ {fmt(r.openingBalance)}</TableCell>
              <TableCell align="right">{r.periodMovement >= 0 ? "+" : ""}{fmt(r.periodMovement)}</TableCell>
              <TableCell align="right" fontWeight={600}>₹ {fmt(r.closingBalance)}</TableCell>
            </TableRow>
          ))}
          <TableRow sx={{ bgcolor: "action.hover" }}>
            <TableCell colSpan={4} align="right"><b>Total {title}</b></TableCell>
            <TableCell align="right"><Chip label={`₹ ${fmt(total)}`} color={color} size="small" /></TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </Box>
  );
}

export default function BalanceSheet() {
  const [asOfDate, setAsOfDate] = useState("");
  const [branch, setBranch]     = useState("");
  const [data, setData]         = useState(null);

  const load = async () => {
    if (!asOfDate) return;
    const res = await getBalanceSheet(asOfDate, branch);
    setData(res);
  };

  const exportXlsx = () => {
    if (!data) return;
    const rows = [
      ...data.assets.map((r) => ({ Side: "Assets", Code: r.accountCode, Name: r.accountName, Opening: r.openingBalance, Movement: r.periodMovement, Closing: r.closingBalance })),
      { Side: "TOTAL ASSETS", Code: "", Name: "", Closing: data.totalAssets },
      ...data.liabilities.map((r) => ({ Side: "Liabilities", Code: r.accountCode, Name: r.accountName, Opening: r.openingBalance, Movement: r.periodMovement, Closing: r.closingBalance })),
      ...data.equity.map((r) => ({ Side: "Equity", Code: r.accountCode, Name: r.accountName, Opening: r.openingBalance, Movement: r.periodMovement, Closing: r.closingBalance })),
      { Side: "Current Year Profit", Closing: data.currentYearProfit },
      { Side: "TOTAL LIABILITIES + EQUITY", Closing: data.totalLiabilitiesAndEquity },
    ];
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "BalanceSheet");
    saveAs(new Blob([XLSX.write(wb, { type: "array", bookType: "xlsx" })]), `BalanceSheet_${asOfDate}.xlsx`);
  };

  return (
    <Box p={3}>
      <Typography variant="h5" gutterBottom>Balance Sheet</Typography>
      <Paper sx={{ p: 2, mb: 3 }}>
        <Box display="flex" gap={2} flexWrap="wrap" alignItems="flex-end">
          <TextField label="As of Date" type="date" value={asOfDate} onChange={(e) => setAsOfDate(e.target.value)} InputLabelProps={{ shrink: true }} />
          <TextField label="Branch" value={branch} onChange={(e) => setBranch(e.target.value)} sx={{ width: 140 }} placeholder="All" />
          <Button variant="contained" onClick={load}>Generate</Button>
          {data && <Button variant="outlined" onClick={exportXlsx}>Export Excel</Button>}
          {data && (
            <Chip
              label={data.balanced ? "✓ Balanced" : "✗ Out of Balance"}
              color={data.balanced ? "success" : "error"}
            />
          )}
        </Box>
      </Paper>

      {data && (
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 2 }}>
              <Table size="small" sx={{ mb: 1 }}>
                <TableHead>
                  <TableRow>
                    <TableCell>Code</TableCell><TableCell>Account</TableCell>
                    <TableCell align="right">Opening</TableCell>
                    <TableCell align="right">Movement</TableCell>
                    <TableCell align="right">Closing</TableCell>
                  </TableRow>
                </TableHead>
              </Table>
              <BSSection title="Assets" rows={data.assets} total={data.totalAssets} color="primary" />
            </Paper>
          </Grid>
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 2 }}>
              <Table size="small" sx={{ mb: 1 }}>
                <TableHead>
                  <TableRow>
                    <TableCell>Code</TableCell><TableCell>Account</TableCell>
                    <TableCell align="right">Opening</TableCell>
                    <TableCell align="right">Movement</TableCell>
                    <TableCell align="right">Closing</TableCell>
                  </TableRow>
                </TableHead>
              </Table>
              <BSSection title="Liabilities" rows={data.liabilities} total={data.totalLiabilities} color="error" />
              <BSSection title="Equity" rows={data.equity} total={data.totalEquity} color="success" />
              <Box display="flex" justifyContent="space-between" px={1} mt={1}>
                <Typography>Current Year Profit</Typography>
                <Typography fontWeight={700}>₹ {fmt(data.currentYearProfit)}</Typography>
              </Box>
              <Box display="flex" justifyContent="space-between" px={1} mt={1} sx={{ bgcolor: "primary.light", p: 1, borderRadius: 1 }}>
                <Typography fontWeight={700}>Total Liabilities + Equity</Typography>
                <Typography fontWeight={700}>₹ {fmt(data.totalLiabilitiesAndEquity)}</Typography>
              </Box>
            </Paper>
          </Grid>
        </Grid>
      )}
    </Box>
  );
}
