import React, { useState } from "react";
import {
  Box, Typography, TextField, Button, Table, TableHead,
  TableRow, TableCell, TableBody, Paper, Chip,
} from "@mui/material";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import { getSupplierStatement } from "./accountingApi";

const fmt = (n) => Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 });

const TYPE_COLOR = { INVOICE: "warning", RECEIPT: "success", PAYMENT: "info" };

export default function SupplierStatement() {
  const [supplierId, setSupplierId] = useState("");
  const [from, setFrom]             = useState("");
  const [to, setTo]                 = useState("");
  const [lines, setLines]           = useState([]);

  const load = async () => {
    if (!supplierId || !from || !to) return;
    const data = await getSupplierStatement(supplierId, from, to);
    setLines(Array.isArray(data) ? data : []);
  };

  const exportXlsx = () => {
    const ws = XLSX.utils.json_to_sheet(lines.map((l) => ({
      Date: l.voucherDate, Voucher: l.voucherNumber, Type: l.type,
      Narration: l.narration, Debit: l.debit, Credit: l.credit, Balance: l.balance,
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "SupplierStatement");
    saveAs(new Blob([XLSX.write(wb, { type: "array", bookType: "xlsx" })]), `SupplierStatement_${supplierId}.xlsx`);
  };

  const closing = lines.length ? lines[lines.length - 1].balance : 0;

  return (
    <Box p={3}>
      <Typography variant="h5" gutterBottom>Supplier Statement</Typography>
      <Paper sx={{ p: 2, mb: 3 }}>
        <Box display="flex" gap={2} flexWrap="wrap" alignItems="flex-end">
          <TextField label="Supplier ID" value={supplierId} onChange={(e) => setSupplierId(e.target.value)} sx={{ width: 200 }} />
          <TextField label="From" type="date" value={from} onChange={(e) => setFrom(e.target.value)} InputLabelProps={{ shrink: true }} />
          <TextField label="To" type="date" value={to} onChange={(e) => setTo(e.target.value)} InputLabelProps={{ shrink: true }} />
          <Button variant="contained" onClick={load}>Load</Button>
          {lines.length > 0 && <Button variant="outlined" onClick={exportXlsx}>Export Excel</Button>}
        </Box>
      </Paper>

      {lines.length > 0 && (
        <>
          <Box mb={2}>
            <Chip label={`Closing Balance: ₹ ${fmt(closing)}`} color={closing >= 0 ? "warning" : "success"} />
          </Box>
          <Table size="small" component={Paper}>
            <TableHead sx={{ bgcolor: "primary.dark" }}>
              <TableRow>
                {["Date", "Voucher No", "Type", "Narration", "Debit", "Credit (AP)", "Balance"].map((h) => (
                  <TableCell key={h} align={["Debit", "Credit (AP)", "Balance"].includes(h) ? "right" : "left"} sx={{ color: "white" }}>{h}</TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {lines.map((l, i) => (
                <TableRow key={i} hover>
                  <TableCell>{l.voucherDate}</TableCell>
                  <TableCell>{l.voucherNumber}</TableCell>
                  <TableCell><Chip label={l.type} size="small" color={TYPE_COLOR[l.type] || "default"} /></TableCell>
                  <TableCell>{l.narration}</TableCell>
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
