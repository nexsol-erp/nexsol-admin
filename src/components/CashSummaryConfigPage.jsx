import React, { useState, useEffect } from "react";
import {
  Box, Typography, Button, Paper, Table, TableHead, TableRow, TableCell,
  TableBody, Chip, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, MenuItem, Switch, FormControlLabel, Alert, IconButton, Tooltip,
  Select, InputLabel, FormControl, OutlinedInput,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";

/**
 * Configure the daily cash-summary formula - backlog #51/#52.
 *
 * Every category's role in the formula is one of these line items, not a literal name in code:
 * see the Help page's "Daily Cash Summary" section for the generic mechanism and this tenant's
 * specific configuration.
 */
const SIGNS = ["ADD", "SUBTRACT"];
const LEVELS = ["SHOP", "FINAL"];
const SOURCE_TYPES = ["EXPENSE_TYPES", "SALES", "MANUAL", "CONSTANT"];
const EMPTY_FORM = {
  label: "", sign: "ADD", level: "SHOP", sourceType: "EXPENSE_TYPES",
  constantAmount: "", sortOrder: 100, active: true, expenseTypeIds: [],
};

export default function CashSummaryConfigPage() {
  const tenancyId = localStorage.getItem("tenancyId");
  const headers = { Authorization: `Bearer ${localStorage.getItem("jwtToken")}` };
  const jsonHeaders = { ...headers, "Content-Type": "application/json" };

  const [lineItems, setLineItems] = useState([]);
  const [expenseHeads, setExpenseHeads] = useState([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [msg, setMsg] = useState(null);

  const load = () =>
    fetch(`/api/${tenancyId}/cash-summary/line-items`, { headers })
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setLineItems(Array.isArray(d) ? d : []));

  useEffect(() => {
    load();
    fetch(`/api/${tenancyId}/expense-heads`, { headers })
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setExpenseHeads(Array.isArray(d) ? d : []));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const headName = (id) => expenseHeads.find((h) => h.id === id)?.name || id;

  const openCreate = () => { setEditing(null); setForm(EMPTY_FORM); setMsg(null); setDialogOpen(true); };
  const openEdit = (li) => {
    setEditing(li);
    setForm({
      label: li.label || "", sign: li.sign || "ADD", level: li.level || "SHOP",
      sourceType: li.sourceType || "EXPENSE_TYPES", constantAmount: li.constantAmount ?? "",
      sortOrder: li.sortOrder ?? 100, active: li.active !== false,
      expenseTypeIds: li.expenseTypeIds || [],
    });
    setMsg(null);
    setDialogOpen(true);
  };

  const f = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const handleSave = async () => {
    if (!form.label) { setMsg({ type: "error", text: "Label is required." }); return; }
    if (form.sourceType === "CONSTANT" && !form.constantAmount) {
      setMsg({ type: "error", text: "A CONSTANT line item needs an amount." });
      return;
    }
    if (form.sourceType === "EXPENSE_TYPES" && form.expenseTypeIds.length === 0) {
      setMsg({ type: "error", text: "Assign at least one category." });
      return;
    }
    const payload = {
      ...form,
      constantAmount: form.constantAmount ? Number(form.constantAmount) : null,
      sortOrder: Number(form.sortOrder) || 100,
    };
    const url = editing
      ? `/api/${tenancyId}/cash-summary/line-items/${editing.id}`
      : `/api/${tenancyId}/cash-summary/line-items`;
    const res = await fetch(url, { method: editing ? "PUT" : "POST", headers: jsonHeaders, body: JSON.stringify(payload) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { setMsg({ type: "error", text: data.error || "Save failed." }); return; }
    setDialogOpen(false);
    load();
  };

  const handleDelete = async (li) => {
    if (!window.confirm(`Delete "${li.label}"?`)) return;
    await fetch(`/api/${tenancyId}/cash-summary/line-items/${li.id}`, { method: "DELETE", headers });
    load();
  };

  return (
    <Box p={3}>
      <Typography variant="h5" gutterBottom>Cash Summary Line Items</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        A shop's Expected Cash to Bank is the signed sum of its SHOP-level lines. The Final
        Expected Cash to Bank adds every shop's total, then the signed sum of FINAL-level lines.
        An expense category may be mapped to at most one line item.
      </Typography>

      <Box display="flex" justifyContent="flex-end" mb={2}>
        <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>New Line Item</Button>
      </Box>

      <Table size="small" component={Paper}>
        <TableHead sx={{ bgcolor: "#1976d2" }}>
          <TableRow>
            {["Order", "Label", "Sign", "Level", "Source", "Detail", "Active", ""].map((h) => (
              <TableCell key={h} sx={{ color: "#fff", fontWeight: 700 }}>{h}</TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {lineItems.map((li) => (
            <TableRow key={li.id} hover>
              <TableCell>{li.sortOrder}</TableCell>
              <TableCell>{li.label}</TableCell>
              <TableCell><Chip size="small" label={li.sign} color={li.sign === "ADD" ? "success" : "error"} /></TableCell>
              <TableCell><Chip size="small" label={li.level} /></TableCell>
              <TableCell>{li.sourceType}</TableCell>
              <TableCell sx={{ fontSize: 12 }}>
                {li.sourceType === "EXPENSE_TYPES" && (li.expenseTypeIds || []).map((id) => headName(id)).join(", ")}
                {li.sourceType === "CONSTANT" && `₹${li.constantAmount}`}
              </TableCell>
              <TableCell>
                <Chip size="small" label={li.active ? "Active" : "Inactive"} color={li.active ? "success" : "default"} />
              </TableCell>
              <TableCell>
                <Box display="flex" gap={0.5}>
                  <Tooltip title="Edit">
                    <IconButton size="small" onClick={() => openEdit(li)}><EditIcon fontSize="small" /></IconButton>
                  </Tooltip>
                  <Tooltip title="Delete">
                    <IconButton size="small" color="error" onClick={() => handleDelete(li)}>
                      <DeleteOutlineIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Box>
              </TableCell>
            </TableRow>
          ))}
          {lineItems.length === 0 && (
            <TableRow><TableCell colSpan={8} align="center" sx={{ color: "text.secondary", py: 4 }}>
              No line items configured yet.
            </TableCell></TableRow>
          )}
        </TableBody>
      </Table>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editing ? "Edit Line Item" : "New Line Item"}</DialogTitle>
        <DialogContent dividers>
          {msg && <Alert severity={msg.type} sx={{ mb: 2 }}>{msg.text}</Alert>}
          <Box display="flex" flexDirection="column" gap={2}>
            <TextField label="Label *" value={form.label} onChange={(e) => f("label", e.target.value)} fullWidth />
            <Box display="flex" gap={2}>
              <TextField select label="Sign" value={form.sign} onChange={(e) => f("sign", e.target.value)} sx={{ width: 160 }}>
                {SIGNS.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
              </TextField>
              <TextField select label="Level" value={form.level} onChange={(e) => f("level", e.target.value)} sx={{ width: 160 }}>
                {LEVELS.map((l) => <MenuItem key={l} value={l}>{l}</MenuItem>)}
              </TextField>
              <TextField select label="Source" value={form.sourceType} onChange={(e) => f("sourceType", e.target.value)} fullWidth>
                {SOURCE_TYPES.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
              </TextField>
            </Box>

            {form.sourceType === "EXPENSE_TYPES" && (
              <FormControl fullWidth>
                <InputLabel>Categories</InputLabel>
                <Select
                  multiple value={form.expenseTypeIds}
                  onChange={(e) => f("expenseTypeIds", e.target.value)}
                  input={<OutlinedInput label="Categories" />}
                  renderValue={(selected) => selected.map((id) => headName(id)).join(", ")}
                >
                  {expenseHeads.map((h) => <MenuItem key={h.id} value={h.id}>{h.name}</MenuItem>)}
                </Select>
              </FormControl>
            )}

            {form.sourceType === "CONSTANT" && (
              <TextField label="Amount *" type="number" value={form.constantAmount}
                         onChange={(e) => f("constantAmount", e.target.value)} fullWidth />
            )}

            {form.sourceType === "SALES" && (
              <Alert severity="info">Sourced from sales_trans_hdr/sales_dtl - the one built-in, non-configurable source.</Alert>
            )}
            {form.sourceType === "MANUAL" && (
              <Alert severity="info">Enter values against this line item under Cash Summary Manual Entries.</Alert>
            )}

            <Box display="flex" gap={2} alignItems="center">
              <TextField label="Sort Order" type="number" value={form.sortOrder}
                         onChange={(e) => f("sortOrder", e.target.value)} sx={{ width: 140 }} />
              <FormControlLabel control={<Switch checked={form.active} onChange={(e) => f("active", e.target.checked)} />} label="Active" />
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSave}>Save</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
