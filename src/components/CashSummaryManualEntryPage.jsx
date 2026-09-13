import React, { useState, useEffect, useCallback } from "react";
import {
  Box, Typography, Button, Paper, Table, TableHead, TableRow, TableCell,
  TableBody, TextField, MenuItem, Alert, IconButton, Tooltip,
} from "@mui/material";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";

/**
 * Generic manual-entry capture for any FINAL/SHOP line item whose figure has no home
 * elsewhere in the ERP - e.g. Chachan Cash Receipts (backlog #52). Reusable by any tenant:
 * pick the configured line item, a date, an optional branch, and an amount.
 */
export default function CashSummaryManualEntryPage() {
  const tenancyId = localStorage.getItem("tenancyId");
  const headers = { Authorization: `Bearer ${localStorage.getItem("jwtToken")}` };
  const jsonHeaders = { ...headers, "Content-Type": "application/json" };

  const [lineItems, setLineItems] = useState([]);
  const [branches, setBranches] = useState([]);
  const [selectedLineItem, setSelectedLineItem] = useState("");
  const [entries, setEntries] = useState([]);
  const [msg, setMsg] = useState(null);

  const [form, setForm] = useState({ entryDate: "", branchCode: "", amount: "", remarks: "" });

  useEffect(() => {
    fetch(`/api/${tenancyId}/cash-summary/line-items`, { headers })
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => {
        const manual = (Array.isArray(d) ? d : []).filter((li) => li.sourceType === "MANUAL");
        setLineItems(manual);
        if (manual.length) setSelectedLineItem(manual[0].id);
      });
    fetch(`/api/${tenancyId}/branches`, { headers })
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setBranches(Array.isArray(d) ? d : d.branches || d.data || []));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadEntries = useCallback(() => {
    if (!selectedLineItem) { setEntries([]); return; }
    fetch(`/api/${tenancyId}/cash-summary/manual-entries?lineItemId=${selectedLineItem}`, { headers })
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setEntries(Array.isArray(d) ? d : []));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLineItem]);

  useEffect(() => { loadEntries(); }, [loadEntries]);

  const f = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const handleAdd = async () => {
    setMsg(null);
    if (!selectedLineItem) { setMsg({ type: "error", text: "No manual-entry line item is configured yet." }); return; }
    if (!form.entryDate || !form.amount) { setMsg({ type: "error", text: "Date and amount are required." }); return; }
    const payload = {
      lineItemId: selectedLineItem,
      entryDate: form.entryDate,
      branchCode: form.branchCode || null,
      amount: Number(form.amount),
      remarks: form.remarks,
    };
    const res = await fetch(`/api/${tenancyId}/cash-summary/manual-entries`, {
      method: "POST", headers: jsonHeaders, body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { setMsg({ type: "error", text: data.error || "Save failed." }); return; }
    setForm({ entryDate: "", branchCode: "", amount: "", remarks: "" });
    loadEntries();
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this entry?")) return;
    await fetch(`/api/${tenancyId}/cash-summary/manual-entries/${id}`, { method: "DELETE", headers });
    loadEntries();
  };

  return (
    <Box p={3}>
      <Typography variant="h5" gutterBottom>Cash Summary Manual Entries</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Enter figures for line items with no source elsewhere in the ERP (e.g. Chachan Cash Receipts).
        Configure which line items accept manual entries under Cash Summary Line Items (source type MANUAL).
      </Typography>

      {msg && <Alert severity={msg.type} sx={{ mb: 2 }}>{msg.text}</Alert>}

      {lineItems.length === 0 ? (
        <Alert severity="info">No line item is configured with source type MANUAL yet.</Alert>
      ) : (
        <>
          <Box display="flex" gap={2} flexWrap="wrap" alignItems="center" mb={2}>
            <TextField select label="Line Item" value={selectedLineItem}
                       onChange={(e) => setSelectedLineItem(e.target.value)} sx={{ minWidth: 220 }}>
              {lineItems.map((li) => <MenuItem key={li.id} value={li.id}>{li.label}</MenuItem>)}
            </TextField>
            <TextField label="Date" type="date" value={form.entryDate}
                       onChange={(e) => f("entryDate", e.target.value)} InputLabelProps={{ shrink: true }} />
            <TextField select label="Branch (optional)" value={form.branchCode}
                       onChange={(e) => f("branchCode", e.target.value)} sx={{ minWidth: 200 }}>
              <MenuItem value="">(company-wide)</MenuItem>
              {branches.map((b) => (
                <MenuItem key={b.branchCode} value={b.branchCode}>{b.branchCode} - {b.branchName}</MenuItem>
              ))}
            </TextField>
            <TextField label="Amount" type="number" value={form.amount}
                       onChange={(e) => f("amount", e.target.value)} sx={{ width: 140 }} />
            <TextField label="Remarks" value={form.remarks}
                       onChange={(e) => f("remarks", e.target.value)} sx={{ minWidth: 200 }} />
            <Button variant="contained" onClick={handleAdd}>Add</Button>
          </Box>

          <Table size="small" component={Paper}>
            <TableHead sx={{ bgcolor: "#1976d2" }}>
              <TableRow>
                {["Date", "Branch", "Amount", "Remarks", "Entered By", ""].map((h) => (
                  <TableCell key={h} sx={{ color: "#fff", fontWeight: 700 }}>{h}</TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {entries.map((e) => (
                <TableRow key={e.id} hover>
                  <TableCell>{e.entryDate}</TableCell>
                  <TableCell>{e.branchCode || "(company-wide)"}</TableCell>
                  <TableCell>{e.amount}</TableCell>
                  <TableCell>{e.remarks}</TableCell>
                  <TableCell>{e.enteredBy}</TableCell>
                  <TableCell>
                    <Tooltip title="Delete">
                      <IconButton size="small" color="error" onClick={() => handleDelete(e.id)}>
                        <DeleteOutlineIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
              {entries.length === 0 && (
                <TableRow><TableCell colSpan={6} align="center" sx={{ color: "text.secondary", py: 4 }}>
                  No entries yet for this line item.
                </TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </>
      )}
    </Box>
  );
}
