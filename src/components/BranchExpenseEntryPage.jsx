import React, { useState, useEffect, useMemo } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Snackbar,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
  useTheme,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import RefreshIcon from "@mui/icons-material/Refresh";

const MONTHS = [
  { value: 1, label: "January" }, { value: 2, label: "February" },
  { value: 3, label: "March" },   { value: 4, label: "April" },
  { value: 5, label: "May" },     { value: 6, label: "June" },
  { value: 7, label: "July" },    { value: 8, label: "August" },
  { value: 9, label: "September"},{ value: 10, label: "October" },
  { value: 11, label: "November"},{ value: 12, label: "December" },
];

const currentYear  = new Date().getFullYear();
const currentMonth = new Date().getMonth() + 1;
const YEARS = Array.from({ length: 5 }, (_, i) => currentYear - i);

function fmtCurrency(v) {
  return new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v ?? 0);
}

// ── Empty form state ──────────────────────────────────────────────────────────
const emptyForm = () => ({
  expenseTypeId: "",
  amount: "",
  remarks: "",
});

// ── Main Component ────────────────────────────────────────────────────────────
const BranchExpenseEntryPage = () => {
  const theme  = useTheme();
  const isDark = theme.palette.mode === "dark";

  // ── Filters ────────────────────────────────────────────────────────────────
  const [branchCode, setBranchCode] = useState("");
  const [month,      setMonth]      = useState(currentMonth);
  const [year,       setYear]       = useState(currentYear);

  // ── Data ───────────────────────────────────────────────────────────────────
  const [branches,      setBranches]      = useState([]);
  const [expenseTypes,  setExpenseTypes]  = useState([]);
  const [expenses,      setExpenses]      = useState([]);
  const [loading,       setLoading]       = useState(false);

  // ── Dialog ─────────────────────────────────────────────────────────────────
  const [dialogOpen,  setDialogOpen]  = useState(false);
  const [editRow,     setEditRow]     = useState(null);
  const [form,        setForm]        = useState(emptyForm());
  const [saving,      setSaving]      = useState(false);
  const [deleteId,    setDeleteId]    = useState(null);

  // ── Snackbar ───────────────────────────────────────────────────────────────
  const [snack, setSnack] = useState({ open: false, msg: "", severity: "success" });
  const showSnack = (msg, severity = "success") =>
    setSnack({ open: true, msg, severity });

  const allowedBranches = useMemo(() => {
    try {
      const raw = localStorage.getItem("allowedBranches");
      const list = raw ? JSON.parse(raw) : [];
      return Array.isArray(list) ? list : [];
    } catch { return []; }
  }, []);

  const tenancyId = localStorage.getItem("tenancyId");
  const token     = localStorage.getItem("jwtToken");
  const headers   = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  // ── Load branches ──────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const res  = await fetch(`/api/${tenancyId}/branches`, { headers });
        const data = res.ok ? await res.json() : [];
        const list = Array.isArray(data) ? data : data.branches || [];
        const filtered = allowedBranches.length
          ? list.filter(b => allowedBranches.includes(b.branchCode))
          : list;
        setBranches(filtered);
        if (filtered.length === 1) setBranchCode(filtered[0].branchCode);
      } catch (e) { console.error(e); }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Load expense types ─────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const res  = await fetch(`/api/${tenancyId}/expenses/types`, { headers });
        const data = res.ok ? await res.json() : [];
        setExpenseTypes(Array.isArray(data) ? data : []);
      } catch (e) { console.error(e); }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Load expenses ──────────────────────────────────────────────────────────
  const loadExpenses = async () => {
    if (!branchCode) return;
    setLoading(true);
    try {
      const url = `/api/${tenancyId}/expenses/monthly?branchCode=${encodeURIComponent(branchCode)}&month=${month}&year=${year}`;
      const res  = await fetch(url, { headers });
      const data = res.ok ? await res.json() : [];
      setExpenses(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
      setExpenses([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadExpenses(); }, [branchCode, month, year]); // eslint-disable-line

  // ── Total ──────────────────────────────────────────────────────────────────
  const total = useMemo(
    () => expenses.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0),
    [expenses]
  );

  // ── Expense type name lookup ───────────────────────────────────────────────
  const typeName = (id) => expenseTypes.find(t => t.id === id)?.typeName || id;

  // ── Dialog helpers ─────────────────────────────────────────────────────────
  const openAdd = () => {
    setEditRow(null);
    setForm(emptyForm());
    setDialogOpen(true);
  };

  const openEdit = (row) => {
    setEditRow(row);
    setForm({ expenseTypeId: row.expenseTypeId, amount: row.amount, remarks: row.remarks || "" });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.expenseTypeId) { showSnack("Select an expense type.", "error"); return; }
    if (!form.amount || isNaN(form.amount) || parseFloat(form.amount) < 0) {
      showSnack("Enter a valid amount.", "error"); return;
    }
    setSaving(true);
    try {
      const branchObj = branches.find(b => b.branchCode === branchCode);
      const payload = {
        ...(editRow ? { id: editRow.id } : {}),
        companyMstId:  tenancyId,
        branchCode,
        branchName:    branchObj?.branchName || branchCode,
        expenseTypeId: form.expenseTypeId,
        expenseMonth:  month,
        expenseYear:   year,
        amount:        parseFloat(form.amount),
        remarks:       form.remarks,
      };
      const method = editRow ? "PUT" : "POST";
      const url    = editRow
        ? `/api/${tenancyId}/expenses/monthly/${editRow.id}`
        : `/api/${tenancyId}/expenses/monthly`;
      const res = await fetch(url, { method, headers, body: JSON.stringify(payload) });
      const data = await res.json();
      if (!res.ok) { showSnack(data.error || "Save failed.", "error"); return; }
      showSnack(editRow ? "Expense updated." : "Expense added.");
      setDialogOpen(false);
      loadExpenses();
    } catch (e) {
      showSnack("Network error.", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await fetch(`/api/${tenancyId}/expenses/monthly/${deleteId}`, { method: "DELETE", headers });
      showSnack("Expense deleted.");
      setDeleteId(null);
      loadExpenses();
    } catch { showSnack("Delete failed.", "error"); }
  };

  // ── Used expense type IDs (for preventing dup adds in UI) ─────────────────
  const usedTypeIds = useMemo(() => new Set(expenses.map(e => e.expenseTypeId)), [expenses]);

  const headerSx = {
    bgcolor: isDark ? theme.palette.background.default : "#f5f5f5",
    fontWeight: 700, fontSize: 13,
  };

  return (
    <Box sx={{ p: 2, maxWidth: 900, mx: "auto" }}>
      <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
        Branch Monthly Expenses
      </Typography>

      {/* ── Filter Bar ── */}
      <Paper sx={{ p: 2, mb: 2, display: "flex", gap: 2, flexWrap: "wrap", alignItems: "center" }}>
        <FormControl size="small" sx={{ minWidth: 180 }}>
          <InputLabel>Branch</InputLabel>
          <Select value={branchCode} label="Branch" onChange={e => setBranchCode(e.target.value)}>
            {branches.map(b => (
              <MenuItem key={b.branchCode} value={b.branchCode}>{b.branchCode} - {b.branchName}</MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl size="small" sx={{ minWidth: 140 }}>
          <InputLabel>Month</InputLabel>
          <Select value={month} label="Month" onChange={e => setMonth(e.target.value)}>
            {MONTHS.map(m => <MenuItem key={m.value} value={m.value}>{m.label}</MenuItem>)}
          </Select>
        </FormControl>

        <FormControl size="small" sx={{ minWidth: 100 }}>
          <InputLabel>Year</InputLabel>
          <Select value={year} label="Year" onChange={e => setYear(e.target.value)}>
            {YEARS.map(y => <MenuItem key={y} value={y}>{y}</MenuItem>)}
          </Select>
        </FormControl>

        <IconButton onClick={loadExpenses} title="Refresh"><RefreshIcon /></IconButton>

        <Box sx={{ flex: 1 }} />

        <Button
          variant="contained" startIcon={<AddIcon />}
          onClick={openAdd} disabled={!branchCode}
          size="small"
        >
          Add Expense
        </Button>
      </Paper>

      {/* ── Summary Card ── */}
      {branchCode && (
        <Card sx={{ mb: 2, borderLeft: "4px solid #1976d2" }}>
          <CardContent sx={{ p: 1.5, "&:last-child": { pb: 1.5 }, display: "flex", gap: 4, flexWrap: "wrap" }}>
            <Box>
              <Typography variant="caption" color="text.secondary">Branch</Typography>
              <Typography variant="body1" sx={{ fontWeight: 700 }}>
                {branchCode} - {branches.find(b => b.branchCode === branchCode)?.branchName || branchCode}
              </Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">Period</Typography>
              <Typography variant="body1" sx={{ fontWeight: 700 }}>
                {MONTHS.find(m => m.value === month)?.label} {year}
              </Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">Total Expenses</Typography>
              <Typography variant="body1" sx={{ fontWeight: 700, color: "#e53935" }}>
                ₹ {fmtCurrency(total)}
              </Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">Entries</Typography>
              <Typography variant="body1" sx={{ fontWeight: 700 }}>{expenses.length}</Typography>
            </Box>
          </CardContent>
        </Card>
      )}

      {/* ── Table ── */}
      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={headerSx}>#</TableCell>
              <TableCell sx={headerSx}>Expense Type</TableCell>
              <TableCell sx={{ ...headerSx, textAlign: "right" }}>Amount (₹)</TableCell>
              <TableCell sx={headerSx}>Remarks</TableCell>
              <TableCell sx={headerSx}>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {!branchCode ? (
              <TableRow><TableCell colSpan={5} align="center" sx={{ py: 4, color: "text.secondary" }}>
                Select a branch to view expenses.
              </TableCell></TableRow>
            ) : loading ? (
              <TableRow><TableCell colSpan={5} align="center" sx={{ py: 4, color: "text.secondary" }}>
                Loading...
              </TableCell></TableRow>
            ) : expenses.length === 0 ? (
              <TableRow><TableCell colSpan={5} align="center" sx={{ py: 4, color: "text.secondary" }}>
                No expenses recorded for this period. Click "Add Expense" to begin.
              </TableCell></TableRow>
            ) : (
              expenses.map((row, idx) => (
                <TableRow key={row.id} hover>
                  <TableCell>{idx + 1}</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>{typeName(row.expenseTypeId)}</TableCell>
                  <TableCell align="right">{fmtCurrency(row.amount)}</TableCell>
                  <TableCell sx={{ color: "text.secondary", fontSize: 12 }}>{row.remarks || "—"}</TableCell>
                  <TableCell>
                    <Tooltip title="Edit">
                      <IconButton size="small" onClick={() => openEdit(row)}><EditIcon fontSize="small" /></IconButton>
                    </Tooltip>
                    <Tooltip title="Delete">
                      <IconButton size="small" color="error" onClick={() => setDeleteId(row.id)}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))
            )}
            {expenses.length > 0 && (
              <TableRow sx={{ bgcolor: isDark ? "rgba(255,255,255,0.05)" : "#f9f9f9" }}>
                <TableCell colSpan={2} sx={{ fontWeight: 700 }}>Total</TableCell>
                <TableCell align="right" sx={{ fontWeight: 700, color: "#e53935" }}>
                  {fmtCurrency(total)}
                </TableCell>
                <TableCell colSpan={2} />
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* ── Add / Edit Dialog ── */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editRow ? "Edit Expense" : "Add Expense"}</DialogTitle>
        <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, pt: "12px !important" }}>
          <FormControl fullWidth size="small" required>
            <InputLabel>Expense Type</InputLabel>
            <Select
              value={form.expenseTypeId}
              label="Expense Type"
              onChange={e => setForm(f => ({ ...f, expenseTypeId: e.target.value }))}
            >
              {expenseTypes.map(t => (
                <MenuItem
                  key={t.id} value={t.id}
                  disabled={!editRow && usedTypeIds.has(t.id)}
                >
                  {t.typeName}
                  {!editRow && usedTypeIds.has(t.id) && " (already added)"}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <TextField
            label="Amount (₹)" type="number" size="small" required
            value={form.amount}
            onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
            inputProps={{ min: 0, step: 0.01 }}
          />

          <TextField
            label="Remarks" size="small" multiline rows={2}
            value={form.remarks}
            onChange={e => setForm(f => ({ ...f, remarks: e.target.value }))}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleSave} variant="contained" disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Delete Confirm Dialog ── */}
      <Dialog open={!!deleteId} onClose={() => setDeleteId(null)}>
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>Are you sure you want to delete this expense entry?</DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteId(null)}>Cancel</Button>
          <Button color="error" variant="contained" onClick={handleDelete}>Delete</Button>
        </DialogActions>
      </Dialog>

      {/* ── Snackbar ── */}
      <Snackbar
        open={snack.open} autoHideDuration={3500}
        onClose={() => setSnack(s => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert severity={snack.severity} onClose={() => setSnack(s => ({ ...s, open: false }))}>
          {snack.msg}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default BranchExpenseEntryPage;
