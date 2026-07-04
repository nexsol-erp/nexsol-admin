import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  Paper,
  Snackbar,
  Switch,
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
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon   from "@mui/icons-material/Edit";
import AddIcon    from "@mui/icons-material/Add";
import dayjs      from "dayjs";
import { useNavigate } from "react-router-dom";

const EMPTY_FORM = {
  itemId: "", itemName: "", itemCode: "",
  branchCode: "", branchName: "", branchType: "",
  costRate: "", notes: "",
};

const ItemCostOverridePage = () => {
  const theme    = useTheme();
  const navigate = useNavigate();
  const isDark   = theme.palette.mode === "dark";
  const headerBg = isDark ? theme.palette.background.default : "#f5f5f5";

  const tenancyId = localStorage.getItem("tenancyId") || "";
  const token     = localStorage.getItem("jwtToken")  || "";
  const userId    = localStorage.getItem("userId")    || "admin";
  const headers   = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  const allowedBranches = useMemo(() => {
    try {
      const list = JSON.parse(localStorage.getItem("allowedBranches") || "[]");
      return Array.isArray(list) ? list : [];
    } catch { return []; }
  }, []);

  const [rows,    setRows]    = useState([]);
  const [loading, setLoading] = useState(false);
  const [search,  setSearch]  = useState("");

  // ── Edit / add dialog ──────────────────────────────────────────────────────
  const [dialogOpen,    setDialogOpen]    = useState(false);
  const [editingId,     setEditingId]     = useState(null);   // null = new record
  const [form,          setForm]          = useState(EMPTY_FORM);
  const [allBranch,     setAllBranch]     = useState(false);
  const [saving,        setSaving]        = useState(false);

  // ── Delete confirm ─────────────────────────────────────────────────────────
  const [deleteId,      setDeleteId]      = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleting,      setDeleting]      = useState(false);

  const [snack, setSnack] = useState({ open: false, msg: "", severity: "success" });
  const toast = (msg, severity = "success") => setSnack({ open: true, msg, severity });

  // ── Load all overrides ─────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await fetch(`/api/${tenancyId}/item-cost-override`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      setRows(Array.isArray(data) ? data : []);
    } catch (e) {
      toast("Failed to load overrides: " + e.message, "error");
    } finally {
      setLoading(false);
    }
  }, [tenancyId, token]);

  useEffect(() => { load(); }, [load]);

  // ── Open dialog ────────────────────────────────────────────────────────────
  const openAdd = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setAllBranch(false);
    setDialogOpen(true);
  };

  const openEdit = (row) => {
    setEditingId(row.id);
    setForm({
      itemId:     row.itemId    || "",
      itemName:   row.itemName  || "",
      itemCode:   row.itemCode  || "",
      branchCode: row.branchCode|| "",
      branchName: row.branchName|| "",
      branchType: row.branchType|| "",
      costRate:   String(row.costRate ?? ""),
      notes:      row.notes     || "",
    });
    setAllBranch(!row.branchCode);
    setDialogOpen(true);
  };

  // ── Save ───────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    const rate = parseFloat(form.costRate);
    if (!form.itemId?.trim()) { toast("Item ID is required", "error"); return; }
    if (isNaN(rate) || rate <= 0) { toast("Cost rate must be > 0", "error"); return; }

    setSaving(true);
    try {
      const payload = {
        ...form,
        costRate:   rate,
        branchCode: allBranch ? null : (form.branchCode || null),
        updatedBy:  userId,
      };
      const res  = await fetch(`/api/${tenancyId}/item-cost-override`, {
        method: "POST", headers, body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.success) {
        toast(editingId ? "Override updated." : "Override added.");
        setDialogOpen(false);
        load();
      } else {
        toast(data.message || "Save failed", "error");
      }
    } catch (e) {
      toast(e.message, "error");
    } finally {
      setSaving(false);
    }
  };

  // ── Delete ─────────────────────────────────────────────────────────────────
  const confirmDelete = (id) => { setDeleteId(id); setDeleteConfirm(true); };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await fetch(`/api/${tenancyId}/item-cost-override/${deleteId}`, {
        method: "DELETE", headers: { Authorization: `Bearer ${token}` },
      });
      toast("Override deleted.");
      setDeleteConfirm(false);
      load();
    } catch (e) {
      toast(e.message, "error");
    } finally {
      setDeleting(false);
    }
  };

  // ── Filtered rows ──────────────────────────────────────────────────────────
  const q = search.trim().toLowerCase();
  const filtered = q
    ? rows.filter(r =>
        (r.itemName  || "").toLowerCase().includes(q) ||
        (r.itemCode  || "").toLowerCase().includes(q) ||
        (r.itemId    || "").toLowerCase().includes(q) ||
        (r.branchCode|| "").toLowerCase().includes(q)
      )
    : rows;

  const fmt = (n) => (n ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const fld = (label, key, props = {}) => (
    <TextField
      label={label} size="small" fullWidth
      value={form[key]}
      onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
      sx={{ mb: 2 }}
      {...props}
    />
  );

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2 }}>
        <Box>
          <Typography variant="h5" fontWeight={700}>Item Cost Overrides</Typography>
          <Typography variant="body2" color="text.secondary">
            Manual cost rates used as fallback when automatic costing returns no result
          </Typography>
        </Box>
        <Box sx={{ display: "flex", gap: 1 }}>
          <Button variant="outlined" size="small" onClick={() => navigate("/branch-profit-report")}>
            ← Profit Report
          </Button>
          <Button variant="contained" startIcon={<AddIcon />} onClick={openAdd}>
            Add Override
          </Button>
        </Box>
      </Box>

      {/* ── Search ── */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <TextField
          label="Search by item name / code / branch"
          size="small"
          fullWidth
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </Paper>

      {/* ── Table ── */}
      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow sx={{ "& th": { fontWeight: 700, bgcolor: headerBg, color: "text.primary" } }}>
              <TableCell>Item</TableCell>
              <TableCell>Branch</TableCell>
              <TableCell align="right">Cost Rate</TableCell>
              <TableCell>Scope</TableCell>
              <TableCell>Notes</TableCell>
              <TableCell>Updated By</TableCell>
              <TableCell>Updated At</TableCell>
              <TableCell align="center">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading && (
              <TableRow>
                <TableCell colSpan={8} align="center">Loading…</TableCell>
              </TableRow>
            )}
            {!loading && filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} align="center" sx={{ py: 4, color: "text.secondary" }}>
                  {q ? "No matching overrides found." : "No overrides yet. Click \"Add Override\" to create one."}
                </TableCell>
              </TableRow>
            )}
            {filtered.map(row => (
              <TableRow key={row.id} hover>
                <TableCell>
                  <Typography variant="body2" fontWeight={500}>{row.itemName}</Typography>
                  <Typography variant="caption" color="text.secondary">{row.itemCode} · {row.itemId}</Typography>
                </TableCell>
                <TableCell>
                  {row.branchCode
                    ? <><Typography variant="body2">{row.branchName || row.branchCode}</Typography>
                        <Typography variant="caption" color="text.secondary">{row.branchType}</Typography></>
                    : <Chip label="All Branches" size="small" color="info" variant="outlined" />}
                </TableCell>
                <TableCell align="right" sx={{ fontWeight: 700 }}>{fmt(row.costRate)}</TableCell>
                <TableCell>
                  <Chip
                    label={row.branchCode ? "Branch-specific" : "Global"}
                    size="small"
                    color={row.branchCode ? "default" : "primary"}
                    variant="outlined"
                  />
                </TableCell>
                <TableCell>
                  <Typography variant="caption">{row.notes || "—"}</Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="caption">{row.updatedBy || "—"}</Typography>
                </TableCell>
                <TableCell sx={{ whiteSpace: "nowrap" }}>
                  <Typography variant="caption">
                    {row.updatedAt ? dayjs(row.updatedAt).format("DD-MM-YYYY HH:mm") : "—"}
                  </Typography>
                </TableCell>
                <TableCell align="center">
                  <Tooltip title="Edit">
                    <IconButton size="small" onClick={() => openEdit(row)}><EditIcon fontSize="small" /></IconButton>
                  </Tooltip>
                  <Tooltip title="Delete">
                    <IconButton size="small" color="error" onClick={() => confirmDelete(row.id)}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: "block" }}>
        {rows.length} override{rows.length !== 1 ? "s" : ""} total
      </Typography>

      {/* ── Add / Edit dialog ── */}
      <Dialog open={dialogOpen} onClose={() => !saving && setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editingId ? "Edit Cost Override" : "Add Cost Override"}</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          {fld("Item ID *", "itemId", { disabled: !!editingId })}
          {fld("Item Name", "itemName")}
          {fld("Item Code", "itemCode")}
          {allowedBranches.length === 0 && (
            <FormControlLabel
              sx={{ mb: 1 }}
              control={<Switch checked={allBranch} onChange={e => setAllBranch(e.target.checked)} size="small" />}
              label={<Typography variant="body2">Apply to <b>all branches</b></Typography>}
            />
          )}
          {(!allBranch || allowedBranches.length > 0) && (
            <>
              {fld("Branch Code", "branchCode")}
              {fld("Branch Name", "branchName")}
              {fld("Branch Type", "branchType")}
            </>
          )}
          {fld("Cost Rate *", "costRate", { type: "number", inputProps: { min: 0, step: "0.01" } })}
          {fld("Notes (optional)", "notes")}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} variant="contained" disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Delete confirm dialog ── */}
      <Dialog open={deleteConfirm} onClose={() => !deleting && setDeleteConfirm(false)} maxWidth="xs">
        <DialogTitle>Delete Override?</DialogTitle>
        <DialogContent>
          <Typography>
            This will remove the manual cost rate. Affected profit report rows will revert to NOT_FOUND
            unless the automatic costing source is available.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirm(false)} disabled={deleting}>Cancel</Button>
          <Button onClick={handleDelete} color="error" variant="contained" disabled={deleting}>
            {deleting ? "Deleting…" : "Delete"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Snackbar ── */}
      <Snackbar open={snack.open} autoHideDuration={4000}
        onClose={() => setSnack(s => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}>
        <Alert severity={snack.severity} onClose={() => setSnack(s => ({ ...s, open: false }))}>
          {snack.msg}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default ItemCostOverridePage;
