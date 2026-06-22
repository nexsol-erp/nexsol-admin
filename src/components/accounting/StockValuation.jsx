import React, { useState } from "react";
import {
  Box, Typography, TextField, Button, Paper, Table, TableHead,
  TableRow, TableCell, TableBody, TableFooter, Chip,
} from "@mui/material";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import { getStockValuation } from "./accountingApi";

const fmt = (n) => Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 });

export default function StockValuation() {
  const [branch, setBranch]     = useState("");
  const [asOfDate, setAsOfDate] = useState("");
  const [rows, setRows]         = useState([]);

  const load = async () => {
    if (!asOfDate) return;
    const data = await getStockValuation(branch, asOfDate);
    setRows(Array.isArray(data) ? data : []);
  };

  const totalValue = rows.reduce((s, r) => s + Number(r.stockValue || 0), 0);

  const exportXlsx = () => {
    const ws = XLSX.utils.json_to_sheet(rows.map((r) => ({
      "Item Name": r.itemName, Code: r.itemCode, Batch: r.batchCode, Branch: r.branchCode,
      "Closing Qty": r.closingQty, "Purchase Rate": r.purchaseRate, "Stock Value": r.stockValue,
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "StockValuation");
    saveAs(new Blob([XLSX.write(wb, { type: "array", bookType: "xlsx" })]), `StockValuation_${asOfDate}.xlsx`);
  };

  return (
    <Box p={3}>
      <Typography variant="h5" gutterBottom>Stock Valuation</Typography>
      <Paper sx={{ p: 2, mb: 3 }}>
        <Box display="flex" gap={2} flexWrap="wrap" alignItems="flex-end">
          <TextField label="As of Date" type="date" value={asOfDate} onChange={(e) => setAsOfDate(e.target.value)} InputLabelProps={{ shrink: true }} />
          <TextField label="Branch Code" value={branch} onChange={(e) => setBranch(e.target.value)} sx={{ width: 160 }} placeholder="All branches" />
          <Button variant="contained" onClick={load}>Generate</Button>
          {rows.length > 0 && <Button variant="outlined" onClick={exportXlsx}>Export Excel</Button>}
          {rows.length > 0 && <Chip label={`Total Value: ₹ ${fmt(totalValue)}`} color="primary" />}
        </Box>
      </Paper>

      {rows.length > 0 && (
        <Table size="small" component={Paper}>
          <TableHead sx={{ bgcolor: "primary.dark" }}>
            <TableRow>
              {["Item Name", "Code", "Batch", "Branch", "Closing Qty", "Purchase Rate", "Stock Value"].map((h) => (
                <TableCell key={h} sx={{ color: "white" }} align={["Closing Qty", "Purchase Rate", "Stock Value"].includes(h) ? "right" : "left"}>{h}</TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((r, i) => (
              <TableRow key={i} hover>
                <TableCell>{r.itemName}</TableCell>
                <TableCell>{r.itemCode}</TableCell>
                <TableCell>{r.batchCode}</TableCell>
                <TableCell>{r.branchCode}</TableCell>
                <TableCell align="right">{Number(r.closingQty).toFixed(4)}</TableCell>
                <TableCell align="right">₹ {fmt(r.purchaseRate)}</TableCell>
                <TableCell align="right" sx={{ fontWeight: 600 }}>₹ {fmt(r.stockValue)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow sx={{ bgcolor: "action.hover" }}>
              <TableCell colSpan={6} align="right"><b>Total Stock Value</b></TableCell>
              <TableCell align="right"><b>₹ {fmt(totalValue)}</b></TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      )}
    </Box>
  );
}
