import React, { useState } from "react";
import {
  Box, Typography, TextField, Button, Paper, Table, TableHead,
  TableRow, TableCell, TableBody, TableFooter, Chip,
} from "@mui/material";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import { getCustomerAging } from "./accountingApi";

const fmt = (n) => Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 });

export default function CustomerAging() {
  const [asOfDate, setAsOfDate] = useState("");
  const [data, setData]         = useState(null);

  const load = async () => {
    if (!asOfDate) return;
    const res = await getCustomerAging(asOfDate);
    setData(res);
  };

  const exportXlsx = () => {
    if (!data) return;
    const ws = XLSX.utils.json_to_sheet(data.lines.map((l) => ({
      "Customer ID": l.customerId, "Customer Name": l.customerName,
      "0-30 Days": l.current, "31-60 Days": l.days31to60,
      "61-90 Days": l.days61to90, "90+ Days": l.over90, "Total": l.total,
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "CustomerAging");
    saveAs(new Blob([XLSX.write(wb, { type: "array", bookType: "xlsx" })]), `CustomerAging_${asOfDate}.xlsx`);
  };

  const s = data?.summary;

  return (
    <Box p={3}>
      <Typography variant="h5" gutterBottom>Customer Aging (AR)</Typography>
      <Paper sx={{ p: 2, mb: 3 }}>
        <Box display="flex" gap={2} flexWrap="wrap" alignItems="flex-end">
          <TextField label="As of Date" type="date" value={asOfDate} onChange={(e) => setAsOfDate(e.target.value)} InputLabelProps={{ shrink: true }} />
          <Button variant="contained" onClick={load}>Generate</Button>
          {data && <Button variant="outlined" onClick={exportXlsx}>Export Excel</Button>}
        </Box>
        {s && (
          <Box display="flex" gap={2} mt={2} flexWrap="wrap">
            <Chip label={`0-30d: ₹ ${fmt(s.current)}`} color="success" />
            <Chip label={`31-60d: ₹ ${fmt(s.days31to60)}`} color="warning" />
            <Chip label={`61-90d: ₹ ${fmt(s.days61to90)}`} color="error" variant="outlined" />
            <Chip label={`90+d: ₹ ${fmt(s.over90)}`} color="error" />
            <Chip label={`Total: ₹ ${fmt(s.total)}`} color="primary" />
          </Box>
        )}
      </Paper>

      {data?.lines?.length > 0 && (
        <Table size="small" component={Paper}>
          <TableHead sx={{ bgcolor: "primary.dark" }}>
            <TableRow>
              {["Customer", "Name", "0-30 Days", "31-60 Days", "61-90 Days", "90+ Days", "Total"].map((h) => (
                <TableCell key={h} sx={{ color: "white" }} align={["0-30 Days", "31-60 Days", "61-90 Days", "90+ Days", "Total"].includes(h) ? "right" : "left"}>{h}</TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {data.lines.map((l, i) => (
              <TableRow key={i} hover>
                <TableCell>{l.customerId}</TableCell>
                <TableCell>{l.customerName}</TableCell>
                <TableCell align="right" sx={{ color: "success.main" }}>{l.current > 0 ? fmt(l.current) : ""}</TableCell>
                <TableCell align="right" sx={{ color: "warning.main" }}>{l.days31to60 > 0 ? fmt(l.days31to60) : ""}</TableCell>
                <TableCell align="right" sx={{ color: "error.main" }}>{l.days61to90 > 0 ? fmt(l.days61to90) : ""}</TableCell>
                <TableCell align="right" sx={{ color: "error.dark" }}>{l.over90 > 0 ? fmt(l.over90) : ""}</TableCell>
                <TableCell align="right" sx={{ fontWeight: 600 }}>₹ {fmt(l.total)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow sx={{ bgcolor: "action.hover" }}>
              <TableCell colSpan={2}><b>Total</b></TableCell>
              <TableCell align="right"><b>{fmt(s?.current)}</b></TableCell>
              <TableCell align="right"><b>{fmt(s?.days31to60)}</b></TableCell>
              <TableCell align="right"><b>{fmt(s?.days61to90)}</b></TableCell>
              <TableCell align="right"><b>{fmt(s?.over90)}</b></TableCell>
              <TableCell align="right"><b>₹ {fmt(s?.total)}</b></TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      )}
    </Box>
  );
}
