import React, { useState } from "react";
import {
  Box, Typography, TextField, Button, Paper, Table, TableHead,
  TableRow, TableCell, TableBody,
} from "@mui/material";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import { getInventoryLedger } from "./accountingApi";
import { useFinancialYear } from "./useFinancialYear";

const fmt2 = (n) => Number(n || 0).toFixed(2);
const fmt4 = (n) => Number(n || 0).toFixed(4);

export default function InventoryLedger() {
  const [itemId, setItemId]     = useState("");
  const [branch, setBranch]     = useState("");
  const [from, setFrom]         = useState("");
  const [to, setTo]             = useState("");
  const [rows, setRows]         = useState([]);

  useFinancialYear(setFrom, setTo);

  const load = async () => {
    if (!itemId || !from || !to) return;
    const data = await getInventoryLedger(itemId, branch, from, to);
    setRows(Array.isArray(data) ? data : []);
  };

  const exportXlsx = () => {
    const ws = XLSX.utils.json_to_sheet(rows.map((r) => ({
      Date: r.voucherDate, Voucher: r.voucherNumber, Type: r.voucherType,
      Item: r.itemName, Code: r.itemCode, Batch: r.batchCode, Branch: r.branchCode,
      Description: r.description, "Qty In": r.qtyIn, "Qty Out": r.qtyOut,
      Price: r.standardPrice, "Closing Qty": r.closingQty,
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "InventoryLedger");
    saveAs(new Blob([XLSX.write(wb, { type: "array", bookType: "xlsx" })]), `InventoryLedger_${itemId}.xlsx`);
  };

  return (
    <Box p={3}>
      <Typography variant="h5" gutterBottom>Inventory Ledger</Typography>
      <Paper sx={{ p: 2, mb: 3 }}>
        <Box display="flex" gap={2} flexWrap="wrap" alignItems="flex-end">
          <TextField label="Item ID" value={itemId} onChange={(e) => setItemId(e.target.value)} sx={{ width: 200 }} />
          <TextField label="Branch Code" value={branch} onChange={(e) => setBranch(e.target.value)} sx={{ width: 160 }} placeholder="All branches" />
          <TextField label="From" type="date" value={from} onChange={(e) => setFrom(e.target.value)} InputLabelProps={{ shrink: true }} />
          <TextField label="To" type="date" value={to} onChange={(e) => setTo(e.target.value)} InputLabelProps={{ shrink: true }} />
          <Button variant="contained" onClick={load}>Load</Button>
          {rows.length > 0 && <Button variant="outlined" onClick={exportXlsx}>Export Excel</Button>}
        </Box>
      </Paper>

      {rows.length > 0 && (
        <Table size="small" component={Paper}>
          <TableHead sx={{ bgcolor: "primary.dark" }}>
            <TableRow>
              {["Date", "Voucher", "Type", "Item", "Batch", "Branch", "Description", "Qty In", "Qty Out", "Price", "Closing Qty"].map((h) => (
                <TableCell key={h} sx={{ color: "white" }} align={["Qty In", "Qty Out", "Price", "Closing Qty"].includes(h) ? "right" : "left"}>{h}</TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((r, i) => (
              <TableRow key={i} hover>
                <TableCell>{r.voucherDate}</TableCell>
                <TableCell>{r.voucherNumber}</TableCell>
                <TableCell>{r.voucherType}</TableCell>
                <TableCell>{r.itemName}</TableCell>
                <TableCell>{r.batchCode}</TableCell>
                <TableCell>{r.branchCode}</TableCell>
                <TableCell>{r.description}</TableCell>
                <TableCell align="right" sx={{ color: "success.main" }}>{r.qtyIn > 0 ? fmt4(r.qtyIn) : ""}</TableCell>
                <TableCell align="right" sx={{ color: "error.main" }}>{r.qtyOut > 0 ? fmt4(r.qtyOut) : ""}</TableCell>
                <TableCell align="right">₹ {fmt2(r.standardPrice)}</TableCell>
                <TableCell align="right" sx={{ fontWeight: 600 }}>{fmt4(r.closingQty)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Box>
  );
}
