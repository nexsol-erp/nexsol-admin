import React, { useState, useEffect } from "react";
import {
  Box, Typography, TextField, MenuItem, Button, Paper, Table, TableHead,
  TableRow, TableCell, TableBody, Alert, IconButton, Divider,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import AddIcon from "@mui/icons-material/Add";
import { getLedgerAccounts, createInterBranchTransfer, getInterBranchTransfers } from "./accountingApi";
import { useFinancialYear } from "./useFinancialYear";

const fmt = (n) => Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 });

const emptyLine = () => ({ itemId: "", description: "", quantity: "", unitCost: "" });

export default function InterBranchTransfer() {
  const [accounts, setAccounts] = useState([]);
  const [form, setForm]         = useState({
    fromBranchCode: "", toBranchCode: "", transferDate: new Date().toISOString().split("T")[0],
    interBranchReceivableAccountId: "", interBranchPayableAccountId: "", narration: "",
  });
  const [lines, setLines]       = useState([emptyLine()]);
  const [history, setHistory]   = useState([]);
  const [from, setFrom]         = useState("");
  const [to, setTo]             = useState("");
  const [msg, setMsg]           = useState(null);

  useFinancialYear(setFrom, setTo);

  useEffect(() => {
    getLedgerAccounts().then((d) => setAccounts(Array.isArray(d) ? d : []));
  }, []);

  const loadHistory = async () => {
    if (!from || !to) return;
    const data = await getInterBranchTransfers(from, to);
    setHistory(Array.isArray(data) ? data : []);
  };

  const updateLine = (i, field, val) => {
    const updated = [...lines];
    updated[i] = { ...updated[i], [field]: val };
    setLines(updated);
  };

  const totalAmount = lines.reduce((s, l) => s + Number(l.quantity || 0) * Number(l.unitCost || 0), 0);

  const handleSubmit = async () => {
    if (!form.fromBranchCode || !form.toBranchCode || !form.interBranchReceivableAccountId || !form.interBranchPayableAccountId) {
      setMsg({ type: "error", text: "All branch and account fields are required." });
      return;
    }
    try {
      await createInterBranchTransfer({
        ...form,
        lines: lines.map((l) => ({ ...l, quantity: Number(l.quantity), unitCost: Number(l.unitCost) })),
      });
      setMsg({ type: "success", text: "Transfer posted successfully." });
      setLines([emptyLine()]);
    } catch { setMsg({ type: "error", text: "Failed to post transfer." }); }
  };

  return (
    <Box p={3}>
      <Typography variant="h5" gutterBottom>Inter-Branch Transfer</Typography>
      {msg && <Alert severity={msg.type} sx={{ mb: 2 }} onClose={() => setMsg(null)}>{msg.text}</Alert>}

      <Paper sx={{ p: 2, mb: 3 }}>
        <Typography variant="subtitle1" gutterBottom>Transfer Details</Typography>
        <Box display="flex" gap={2} flexWrap="wrap">
          <TextField label="From Branch" value={form.fromBranchCode} onChange={(e) => setForm({ ...form, fromBranchCode: e.target.value })} sx={{ width: 160 }} />
          <TextField label="To Branch" value={form.toBranchCode} onChange={(e) => setForm({ ...form, toBranchCode: e.target.value })} sx={{ width: 160 }} />
          <TextField label="Transfer Date" type="date" value={form.transferDate} onChange={(e) => setForm({ ...form, transferDate: e.target.value })} InputLabelProps={{ shrink: true }} />
          <TextField select label="Inter-Branch Receivable A/c" value={form.interBranchReceivableAccountId}
            onChange={(e) => setForm({ ...form, interBranchReceivableAccountId: e.target.value })} sx={{ width: 260 }}>
            {accounts.map((a) => <MenuItem key={a.id} value={a.id}>{a.accountName}</MenuItem>)}
          </TextField>
          <TextField select label="Inter-Branch Payable A/c" value={form.interBranchPayableAccountId}
            onChange={(e) => setForm({ ...form, interBranchPayableAccountId: e.target.value })} sx={{ width: 260 }}>
            {accounts.map((a) => <MenuItem key={a.id} value={a.id}>{a.accountName}</MenuItem>)}
          </TextField>
          <TextField label="Narration" value={form.narration} onChange={(e) => setForm({ ...form, narration: e.target.value })} sx={{ flexGrow: 1 }} />
        </Box>

        <Box mt={2}>
          <Typography variant="subtitle2" gutterBottom>Line Items</Typography>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Item ID</TableCell><TableCell>Description</TableCell>
                <TableCell align="right">Qty</TableCell><TableCell align="right">Unit Cost</TableCell>
                <TableCell align="right">Amount</TableCell><TableCell />
              </TableRow>
            </TableHead>
            <TableBody>
              {lines.map((l, i) => (
                <TableRow key={i}>
                  <TableCell><TextField size="small" value={l.itemId} onChange={(e) => updateLine(i, "itemId", e.target.value)} sx={{ width: 120 }} /></TableCell>
                  <TableCell><TextField size="small" value={l.description} onChange={(e) => updateLine(i, "description", e.target.value)} sx={{ width: 200 }} /></TableCell>
                  <TableCell><TextField size="small" type="number" value={l.quantity} onChange={(e) => updateLine(i, "quantity", e.target.value)} sx={{ width: 90 }} /></TableCell>
                  <TableCell><TextField size="small" type="number" value={l.unitCost} onChange={(e) => updateLine(i, "unitCost", e.target.value)} sx={{ width: 110 }} /></TableCell>
                  <TableCell align="right">₹ {fmt(Number(l.quantity || 0) * Number(l.unitCost || 0))}</TableCell>
                  <TableCell><IconButton size="small" onClick={() => setLines(lines.filter((_, j) => j !== i))}><DeleteIcon fontSize="small" /></IconButton></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Button startIcon={<AddIcon />} size="small" onClick={() => setLines([...lines, emptyLine()])} sx={{ mt: 1 }}>Add Line</Button>
        </Box>

        <Divider sx={{ my: 2 }} />
        <Box display="flex" justifyContent="flex-end" alignItems="center" gap={3}>
          <Typography variant="h6">Total: ₹ {fmt(totalAmount)}</Typography>
          <Button variant="contained" onClick={handleSubmit} disabled={totalAmount <= 0}>Post Transfer</Button>
        </Box>
      </Paper>

      <Paper sx={{ p: 2 }}>
        <Typography variant="subtitle1" gutterBottom>Transfer History</Typography>
        <Box display="flex" gap={2} mb={2} alignItems="flex-end">
          <TextField label="From" type="date" value={from} onChange={(e) => setFrom(e.target.value)} InputLabelProps={{ shrink: true }} />
          <TextField label="To" type="date" value={to} onChange={(e) => setTo(e.target.value)} InputLabelProps={{ shrink: true }} />
          <Button variant="outlined" onClick={loadHistory}>Load</Button>
        </Box>
        {history.length > 0 && (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Transfer No</TableCell><TableCell>Date</TableCell>
                <TableCell>From</TableCell><TableCell>To</TableCell>
                <TableCell>Narration</TableCell><TableCell>Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {history.map((h, i) => (
                <TableRow key={i} hover>
                  <TableCell>{h.transferNumber}</TableCell>
                  <TableCell>{h.transferDate}</TableCell>
                  <TableCell>{h.fromBranchCode}</TableCell>
                  <TableCell>{h.toBranchCode}</TableCell>
                  <TableCell>{h.narration}</TableCell>
                  <TableCell>{h.status}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Paper>
    </Box>
  );
}
