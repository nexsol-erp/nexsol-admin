import React, { useState, useEffect } from "react";
import {
  Box, Typography, TextField, MenuItem, Button, Table, TableHead,
  TableRow, TableCell, TableBody, Paper, Alert, Divider, Chip,
} from "@mui/material";
import Autocomplete from "@mui/material/Autocomplete";
import { getLedgerAccounts, getCustomers, getCustomerOutstanding, createReceipt } from "./accountingApi";

const fmt = (n) => Number(n || 0).toFixed(2);

export default function ReceiptEntry() {
  const [accounts, setAccounts]         = useState([]);
  const [customers, setCustomers]       = useState([]);
  const [selectedCustomer, setSelected] = useState(null);
  const [outstanding, setOutstanding]   = useState([]);
  const [allocation, setAllocation]     = useState({});
  const [form, setForm]                 = useState({
    receiptDate: new Date().toISOString().split("T")[0],
    paymentMode: "CASH", cashBankAccountId: "", narration: "",
  });
  const [msg, setMsg] = useState(null);

  const customerId = selectedCustomer?.id || "";

  useEffect(() => {
    getLedgerAccounts().then((data) => setAccounts(Array.isArray(data) ? data : []));
    getCustomers().then((data) => setCustomers(Array.isArray(data) ? data : []));
  }, []);

  const loadOutstanding = (id) => {
    if (!id) return;
    getCustomerOutstanding(id).then((data) => {
      setOutstanding(Array.isArray(data) ? data : []);
      setAllocation({});
    });
  };

  const totalAllocated = Object.values(allocation).reduce((s, v) => s + Number(v || 0), 0);

  const handleSubmit = async () => {
    if (!customerId || !form.cashBankAccountId) {
      setMsg({ type: "error", text: "Customer and Cash/Bank account are required." });
      return;
    }
    const lines = outstanding
      .filter((inv) => Number(allocation[inv.voucherNumber] || 0) > 0)
      .map((inv) => ({ salesVoucherNumber: inv.voucherNumber, allocatedAmount: Number(allocation[inv.voucherNumber]) }));

    try {
      await createReceipt({ customerId, ...form, totalAmount: totalAllocated, allocations: lines });
      setMsg({ type: "success", text: "Receipt posted successfully." });
      setOutstanding([]); setAllocation({}); setSelected(null);
    } catch {
      setMsg({ type: "error", text: "Failed to post receipt." });
    }
  };

  return (
    <Box p={3}>
      <Typography variant="h5" gutterBottom>Receipt Entry</Typography>
      {msg && <Alert severity={msg.type} sx={{ mb: 2 }} onClose={() => setMsg(null)}>{msg.text}</Alert>}

      <Paper sx={{ p: 2, mb: 3 }}>
        <Typography variant="subtitle1" gutterBottom>Customer & Invoice</Typography>
        <Box display="flex" gap={2} flexWrap="wrap" alignItems="flex-end">
          <Autocomplete
            options={customers}
            getOptionLabel={(c) => c.name || ""}
            value={selectedCustomer}
            onChange={(_, val) => {
              setSelected(val);
              setOutstanding([]);
              setAllocation({});
              if (val) loadOutstanding(val.id);
            }}
            sx={{ width: 300 }}
            renderInput={(params) => <TextField {...params} label="Customer" placeholder="Search customer…" />}
            isOptionEqualToValue={(o, v) => o.id === v.id}
          />
        </Box>

        {outstanding.length > 0 && (
          <Box mt={2}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Voucher No</TableCell>
                  <TableCell>Date</TableCell>
                  <TableCell align="right">Invoice Amount</TableCell>
                  <TableCell align="right">Paid</TableCell>
                  <TableCell align="right">Outstanding</TableCell>
                  <TableCell align="right">Allocate</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {outstanding.map((inv) => (
                  <TableRow key={inv.voucherNumber}>
                    <TableCell>{inv.voucherNumber}</TableCell>
                    <TableCell>{inv.voucherDate}</TableCell>
                    <TableCell align="right">₹ {fmt(inv.invoiceAmount)}</TableCell>
                    <TableCell align="right">₹ {fmt(inv.paidAmount)}</TableCell>
                    <TableCell align="right">
                      <Chip label={`₹ ${fmt(inv.outstanding)}`} size="small" color="warning" />
                    </TableCell>
                    <TableCell align="right">
                      <TextField
                        size="small" type="number" sx={{ width: 110 }}
                        inputProps={{ min: 0, max: inv.outstanding, step: 0.01 }}
                        value={allocation[inv.voucherNumber] || ""}
                        onChange={(e) => setAllocation({ ...allocation, [inv.voucherNumber]: e.target.value })}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Box>
        )}
      </Paper>

      <Paper sx={{ p: 2, mb: 3 }}>
        <Typography variant="subtitle1" gutterBottom>Receipt Details</Typography>
        <Box display="flex" gap={2} flexWrap="wrap">
          <TextField label="Receipt Date" type="date" value={form.receiptDate}
            onChange={(e) => setForm({ ...form, receiptDate: e.target.value })} InputLabelProps={{ shrink: true }} />
          <TextField select label="Payment Mode" value={form.paymentMode}
            onChange={(e) => setForm({ ...form, paymentMode: e.target.value })} sx={{ width: 160 }}>
            {["CASH", "CHEQUE", "NEFT", "UPI", "CARD"].map((m) => <MenuItem key={m} value={m}>{m}</MenuItem>)}
          </TextField>
          <TextField select label="Cash / Bank Account" value={form.cashBankAccountId}
            onChange={(e) => setForm({ ...form, cashBankAccountId: e.target.value })} sx={{ width: 240 }}>
            {accounts.filter((a) => a.cash || a.bank).map((a) => (
              <MenuItem key={a.id} value={a.id}>{a.accountName}</MenuItem>
            ))}
          </TextField>
          <TextField label="Narration" value={form.narration}
            onChange={(e) => setForm({ ...form, narration: e.target.value })} sx={{ flexGrow: 1 }} />
        </Box>
      </Paper>

      <Divider sx={{ my: 2 }} />
      <Box display="flex" justifyContent="flex-end" alignItems="center" gap={3}>
        <Typography variant="h6">Total: ₹ {fmt(totalAllocated)}</Typography>
        <Button variant="contained" color="primary" onClick={handleSubmit} disabled={totalAllocated <= 0}>
          Post Receipt
        </Button>
      </Box>
    </Box>
  );
}
