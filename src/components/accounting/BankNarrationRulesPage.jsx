import React, { useState, useEffect } from "react";
import {
  Box, Typography, Button, Paper, Table, TableHead, TableRow, TableCell,
  TableBody, Chip, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, MenuItem, Switch, FormControlLabel, Alert, IconButton, Tooltip, Autocomplete,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import {
  getBankNarrationRules, createBankNarrationRule, updateBankNarrationRule, deleteBankNarrationRule,
  getKnownCounterparties, TXN_CATEGORIES,
} from "./accountingApi";

/**
 * Tenant-editable narration rules that drive counterparty resolution - backlog #37.
 *
 * A rule needs a counterparty, a category, or both - the server enforces this too, this is
 * just so the form doesn't let someone submit an empty outcome and wonder why nothing matches.
 */
const MATCH_TYPES = ["CONTAINS", "REGEX", "PREFIX"];
const EMPTY_FORM = {
  bankName: "", matchType: "CONTAINS", pattern: "",
  counterparty: "", txnCategory: "", priority: 100, active: true,
};

export default function BankNarrationRulesPage() {
  const [rules, setRules] = useState([]);
  const [counterpartyOptions, setCounterpartyOptions] = useState([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [msg, setMsg] = useState(null);

  const load = () => getBankNarrationRules().then((d) => setRules(Array.isArray(d) ? d : []));
  useEffect(() => {
    load();
    getKnownCounterparties().then((d) => setCounterpartyOptions(Array.isArray(d) ? d : []));
  }, []);

  const openCreate = () => { setEditing(null); setForm(EMPTY_FORM); setMsg(null); setDialogOpen(true); };
  const openEdit = (r) => {
    setEditing(r);
    setForm({
      bankName: r.bankName || "", matchType: r.matchType || "CONTAINS", pattern: r.pattern || "",
      counterparty: r.counterparty || "", txnCategory: r.txnCategory || "",
      priority: r.priority ?? 100, active: r.active !== false,
    });
    setMsg(null);
    setDialogOpen(true);
  };

  const f = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const handleSave = async () => {
    if (!form.pattern) { setMsg({ type: "error", text: "Pattern is required." }); return; }
    if (!form.counterparty && !form.txnCategory) {
      setMsg({ type: "error", text: "Set a counterparty, a category, or both." });
      return;
    }
    const payload = { ...form, priority: Number(form.priority) || 100 };
    const res = editing
      ? await updateBankNarrationRule(editing.id, payload)
      : await createBankNarrationRule(payload);
    if (res?.error) { setMsg({ type: "error", text: res.error }); return; }
    setDialogOpen(false);
    load();
  };

  const handleDelete = async (r) => {
    if (!window.confirm(`Delete the rule for "${r.pattern}"?`)) return;
    await deleteBankNarrationRule(r.id);
    load();
  };

  return (
    <Box p={3}>
      <Typography variant="h5" gutterBottom>Bank Narration Rules</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Applied by priority (lower first) when a bank statement line is imported. Anything no
        rule claims is left unresolved rather than guessed - fix it in Bank Statement Review.
      </Typography>

      <Box display="flex" justifyContent="flex-end" mb={2}>
        <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>New Rule</Button>
      </Box>

      <Table size="small" component={Paper}>
        <TableHead sx={{ bgcolor: "#1976d2" }}>
          <TableRow>
            {["Priority", "Bank", "Match", "Pattern", "Counterparty", "Category", "Active", ""].map((h) => (
              <TableCell key={h} sx={{ color: "#fff", fontWeight: 700 }}>{h}</TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {rules.map((r) => (
            <TableRow key={r.id} hover>
              <TableCell>{r.priority}</TableCell>
              <TableCell>{r.bankName || <em>any</em>}</TableCell>
              <TableCell><Chip size="small" label={r.matchType} /></TableCell>
              <TableCell sx={{ fontFamily: "monospace" }}>{r.pattern}</TableCell>
              <TableCell>{r.counterparty || "—"}</TableCell>
              <TableCell>{r.txnCategory || "—"}</TableCell>
              <TableCell>
                <Chip size="small" label={r.active ? "Active" : "Inactive"} color={r.active ? "success" : "default"} />
              </TableCell>
              <TableCell>
                <Box display="flex" gap={0.5}>
                  <Tooltip title="Edit">
                    <IconButton size="small" onClick={() => openEdit(r)}><EditIcon fontSize="small" /></IconButton>
                  </Tooltip>
                  <Tooltip title="Delete">
                    <IconButton size="small" color="error" onClick={() => handleDelete(r)}>
                      <DeleteOutlineIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Box>
              </TableCell>
            </TableRow>
          ))}
          {rules.length === 0 && (
            <TableRow><TableCell colSpan={8} align="center" sx={{ color: "text.secondary", py: 4 }}>
              No rules yet.
            </TableCell></TableRow>
          )}
        </TableBody>
      </Table>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editing ? "Edit Rule" : "New Narration Rule"}</DialogTitle>
        <DialogContent dividers>
          {msg && <Alert severity={msg.type} sx={{ mb: 2 }}>{msg.text}</Alert>}
          <Box display="flex" flexDirection="column" gap={2}>
            <TextField label="Bank (leave blank for any)" value={form.bankName}
                       onChange={(e) => f("bankName", e.target.value)} fullWidth />
            <Box display="flex" gap={2}>
              <TextField select label="Match Type" value={form.matchType}
                         onChange={(e) => f("matchType", e.target.value)} sx={{ width: 160 }}>
                {MATCH_TYPES.map((t) => <MenuItem key={t} value={t}>{t}</MenuItem>)}
              </TextField>
              <TextField label="Pattern *" value={form.pattern}
                         onChange={(e) => f("pattern", e.target.value)} fullWidth
                         helperText={form.matchType === "REGEX" ? "Java regex" : form.matchType === "PREFIX" ? "Narration must start with this" : "Substring, case-insensitive"} />
            </Box>
            <Box display="flex" gap={2}>
              <Autocomplete
                freeSolo fullWidth
                options={counterpartyOptions}
                value={form.counterparty}
                onInputChange={(_, v) => f("counterparty", v)}
                renderInput={(params) => <TextField {...params} label="Counterparty" />}
              />
              <TextField select label="Category" value={form.txnCategory}
                         onChange={(e) => f("txnCategory", e.target.value)} sx={{ width: 200 }}>
                <MenuItem value=""><em>None</em></MenuItem>
                {TXN_CATEGORIES.map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
              </TextField>
            </Box>
            <Box display="flex" gap={2} alignItems="center">
              <TextField label="Priority" type="number" value={form.priority}
                         onChange={(e) => f("priority", e.target.value)} sx={{ width: 140 }}
                         helperText="Lower runs first" />
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
