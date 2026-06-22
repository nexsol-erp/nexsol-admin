import React, { useState, useEffect } from "react";
import {
  Box, Typography, TextField, MenuItem, Button, Paper, Table, TableHead,
  TableRow, TableCell, TableBody, Alert, Chip, IconButton, Tabs, Tab,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import AddIcon from "@mui/icons-material/Add";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import { getLedgerAccounts, saveBudget, getBudgets, approveBudget } from "./accountingApi";

const fmt = (n) => Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 });
const emptyLine = () => ({ ledgerAccountId: "", budgetedAmount: "" });

export default function BudgetManager() {
  const [tab, setTab]           = useState(0);
  const [accounts, setAccounts] = useState([]);
  const [budgets, setBudgets]   = useState([]);
  const [msg, setMsg]           = useState(null);
  const [form, setForm]         = useState({
    budgetName: "", financialYearId: "", branchCode: "",
    fromDate: "", toDate: "",
  });
  const [lines, setLines]       = useState([emptyLine()]);

  useEffect(() => {
    getLedgerAccounts().then((d) => setAccounts(Array.isArray(d) ? d : []));
    loadBudgets();
  }, []);

  const loadBudgets = async () => {
    const data = await getBudgets();
    setBudgets(Array.isArray(data) ? data : []);
  };

  const updateLine = (i, field, val) => {
    const updated = [...lines];
    updated[i] = { ...updated[i], [field]: val };
    setLines(updated);
  };

  const handleSave = async () => {
    if (!form.budgetName || !form.financialYearId || !form.fromDate || !form.toDate) {
      setMsg({ type: "error", text: "Budget name, FY ID, and date range are required." });
      return;
    }
    try {
      await saveBudget({
        ...form,
        lines: lines.filter((l) => l.ledgerAccountId).map((l) => ({ ledgerAccountId: l.ledgerAccountId, budgetedAmount: Number(l.budgetedAmount || 0) })),
      });
      setMsg({ type: "success", text: "Budget saved." });
      setLines([emptyLine()]);
      loadBudgets();
    } catch { setMsg({ type: "error", text: "Failed to save budget." }); }
  };

  const handleApprove = async (id) => {
    await approveBudget(id);
    setMsg({ type: "success", text: "Budget approved." });
    loadBudgets();
  };

  return (
    <Box p={3}>
      <Typography variant="h5" gutterBottom>Budget Manager</Typography>
      {msg && <Alert severity={msg.type} sx={{ mb: 2 }} onClose={() => setMsg(null)}>{msg.text}</Alert>}

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 3 }}>
        <Tab label="Create / Edit Budget" />
        <Tab label="All Budgets" />
      </Tabs>

      {tab === 0 && (
        <Paper sx={{ p: 2 }}>
          <Box display="flex" gap={2} flexWrap="wrap" mb={2}>
            <TextField label="Budget Name" value={form.budgetName} onChange={(e) => setForm({ ...form, budgetName: e.target.value })} sx={{ width: 240 }} />
            <TextField label="Financial Year ID" value={form.financialYearId} onChange={(e) => setForm({ ...form, financialYearId: e.target.value })} sx={{ width: 200 }} />
            <TextField label="Branch Code" value={form.branchCode} onChange={(e) => setForm({ ...form, branchCode: e.target.value })} sx={{ width: 140 }} placeholder="All" />
            <TextField label="From" type="date" value={form.fromDate} onChange={(e) => setForm({ ...form, fromDate: e.target.value })} InputLabelProps={{ shrink: true }} />
            <TextField label="To" type="date" value={form.toDate} onChange={(e) => setForm({ ...form, toDate: e.target.value })} InputLabelProps={{ shrink: true }} />
          </Box>

          <Typography variant="subtitle2" gutterBottom>Budget Lines</Typography>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Account</TableCell>
                <TableCell align="right">Budgeted Amount</TableCell>
                <TableCell />
              </TableRow>
            </TableHead>
            <TableBody>
              {lines.map((l, i) => (
                <TableRow key={i}>
                  <TableCell>
                    <TextField select size="small" value={l.ledgerAccountId} onChange={(e) => updateLine(i, "ledgerAccountId", e.target.value)} sx={{ width: 280 }}>
                      {accounts.map((a) => <MenuItem key={a.id} value={a.id}>{a.accountName} ({a.accountType})</MenuItem>)}
                    </TextField>
                  </TableCell>
                  <TableCell>
                    <TextField size="small" type="number" value={l.budgetedAmount} onChange={(e) => updateLine(i, "budgetedAmount", e.target.value)} sx={{ width: 140 }} />
                  </TableCell>
                  <TableCell>
                    <IconButton size="small" onClick={() => setLines(lines.filter((_, j) => j !== i))}><DeleteIcon fontSize="small" /></IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Button startIcon={<AddIcon />} size="small" onClick={() => setLines([...lines, emptyLine()])} sx={{ mt: 1, mb: 2 }}>Add Line</Button>

          <Box display="flex" justifyContent="flex-end">
            <Button variant="contained" onClick={handleSave}>Save Budget</Button>
          </Box>
        </Paper>
      )}

      {tab === 1 && (
        <Paper sx={{ p: 2 }}>
          <Table size="small">
            <TableHead sx={{ bgcolor: "primary.dark" }}>
              <TableRow>
                {["Budget Name", "FY ID", "Branch", "From", "To", "Status", "Approve"].map((h) => (
                  <TableCell key={h} sx={{ color: "white" }}>{h}</TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {budgets.map((b) => (
                <TableRow key={b.id} hover>
                  <TableCell>{b.budgetName}</TableCell>
                  <TableCell>{b.financialYearId}</TableCell>
                  <TableCell>{b.branchCode || "All"}</TableCell>
                  <TableCell>{b.fromDate}</TableCell>
                  <TableCell>{b.toDate}</TableCell>
                  <TableCell>
                    <Chip label={b.status} size="small" color={b.status === "APPROVED" ? "success" : "default"} />
                  </TableCell>
                  <TableCell>
                    {b.status === "DRAFT" && (
                      <IconButton size="small" color="success" onClick={() => handleApprove(b.id)}>
                        <CheckCircleIcon fontSize="small" />
                      </IconButton>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Paper>
      )}
    </Box>
  );
}
