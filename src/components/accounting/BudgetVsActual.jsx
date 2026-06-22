import React, { useState, useEffect } from "react";
import {
  Box, Typography, TextField, MenuItem, Button, Paper, Table, TableHead,
  TableRow, TableCell, TableBody, TableFooter, Chip, LinearProgress,
} from "@mui/material";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import { getBudgets, getBudgetVsActual } from "./accountingApi";

const fmt = (n) => Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 });

export default function BudgetVsActual() {
  const [budgets, setBudgets]   = useState([]);
  const [budgetId, setBudgetId] = useState("");
  const [data, setData]         = useState(null);

  useEffect(() => {
    getBudgets().then((d) => setBudgets(Array.isArray(d) ? d : []));
  }, []);

  const load = async () => {
    if (!budgetId) return;
    const res = await getBudgetVsActual(budgetId);
    setData(res);
  };

  const exportXlsx = () => {
    if (!data) return;
    const ws = XLSX.utils.json_to_sheet(data.lines.map((l) => ({
      Code: l.accountCode, Account: l.accountName, Type: l.accountType,
      Budgeted: l.budgeted, Actual: l.actual, Variance: l.variance,
      "Variance %": l.variancePct.toFixed(1) + "%",
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "BudgetVsActual");
    saveAs(new Blob([XLSX.write(wb, { type: "array", bookType: "xlsx" })]), `BudgetVsActual_${data.budgetName}.xlsx`);
  };

  const pct = (actual, budgeted) => {
    if (!budgeted) return 0;
    return Math.min(100, Math.round((actual / budgeted) * 100));
  };

  return (
    <Box p={3}>
      <Typography variant="h5" gutterBottom>Budget vs Actual</Typography>
      <Paper sx={{ p: 2, mb: 3 }}>
        <Box display="flex" gap={2} flexWrap="wrap" alignItems="flex-end">
          <TextField select label="Select Budget" value={budgetId} onChange={(e) => setBudgetId(e.target.value)} sx={{ width: 300 }}>
            {budgets.map((b) => <MenuItem key={b.id} value={b.id}>{b.budgetName} ({b.fromDate} → {b.toDate})</MenuItem>)}
          </TextField>
          <Button variant="contained" onClick={load}>Generate</Button>
          {data && <Button variant="outlined" onClick={exportXlsx}>Export Excel</Button>}
        </Box>
        {data && (
          <Box display="flex" gap={2} mt={2} flexWrap="wrap">
            <Chip label={`${data.budgetName}`} color="primary" />
            {data.branchCode && <Chip label={`Branch: ${data.branchCode}`} />}
            <Chip label={`${data.from} → ${data.to}`} variant="outlined" />
            <Chip label={`Total Budgeted: ₹ ${fmt(data.totalBudgeted)}`} color="info" />
            <Chip label={`Total Actual: ₹ ${fmt(data.totalActual)}`} color={data.totalActual <= data.totalBudgeted ? "success" : "error"} />
            <Chip label={`Variance: ₹ ${fmt(data.totalVariance)}`} color={data.totalVariance >= 0 ? "success" : "error"} />
          </Box>
        )}
      </Paper>

      {data?.lines?.length > 0 && (
        <Table size="small" component={Paper}>
          <TableHead sx={{ bgcolor: "primary.dark" }}>
            <TableRow>
              {["Code", "Account", "Type", "Budgeted", "Actual", "Variance", "Var %", "Utilisation"].map((h) => (
                <TableCell key={h} sx={{ color: "white" }} align={["Budgeted", "Actual", "Variance", "Var %"].includes(h) ? "right" : "left"}>{h}</TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {data.lines.map((l, i) => {
              const over = l.actual > l.budgeted;
              return (
                <TableRow key={i} hover>
                  <TableCell>{l.accountCode}</TableCell>
                  <TableCell>{l.accountName}</TableCell>
                  <TableCell><Chip label={l.accountType} size="small" /></TableCell>
                  <TableCell align="right">₹ {fmt(l.budgeted)}</TableCell>
                  <TableCell align="right">₹ {fmt(l.actual)}</TableCell>
                  <TableCell align="right" sx={{ color: l.variance >= 0 ? "success.main" : "error.main" }}>
                    {l.variance >= 0 ? "+" : ""}₹ {fmt(l.variance)}
                  </TableCell>
                  <TableCell align="right" sx={{ color: over ? "error.main" : "success.main" }}>
                    {l.variancePct.toFixed(1)}%
                  </TableCell>
                  <TableCell sx={{ minWidth: 120 }}>
                    <LinearProgress
                      variant="determinate"
                      value={pct(l.actual, l.budgeted)}
                      color={over ? "error" : "success"}
                      sx={{ height: 8, borderRadius: 4 }}
                    />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
          <TableFooter>
            <TableRow sx={{ bgcolor: "action.hover" }}>
              <TableCell colSpan={3}><b>Total</b></TableCell>
              <TableCell align="right"><b>₹ {fmt(data.totalBudgeted)}</b></TableCell>
              <TableCell align="right"><b>₹ {fmt(data.totalActual)}</b></TableCell>
              <TableCell align="right" sx={{ color: data.totalVariance >= 0 ? "success.main" : "error.main" }}>
                <b>{data.totalVariance >= 0 ? "+" : ""}₹ {fmt(data.totalVariance)}</b>
              </TableCell>
              <TableCell colSpan={2} />
            </TableRow>
          </TableFooter>
        </Table>
      )}
    </Box>
  );
}
