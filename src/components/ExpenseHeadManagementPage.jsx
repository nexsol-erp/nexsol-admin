import React, { useState, useEffect } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
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
import LinkIcon from "@mui/icons-material/Link";
import LinkOffIcon from "@mui/icons-material/LinkOff";
import AutoFixHighIcon from "@mui/icons-material/AutoFixHigh";

const ExpenseHeadManagementPage = () => {
  const theme  = useTheme();
  const isDark = theme.palette.mode === "dark";

  const tenancyId = localStorage.getItem("tenancyId");
  const token     = localStorage.getItem("jwtToken");
  const headers   = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  // ── Data ───────────────────────────────────────────────────────────────────
  const [expenseTypes,    setExpenseTypes]    = useState([]);
  const [typeAccountMaps, setTypeAccountMaps] = useState([]); // { expenseTypeId, drLedgerAccountId }
  const [expenseAccounts, setExpenseAccounts] = useState([]); // ledger accounts of type EXPENSE
  const [loading,         setLoading]         = useState(false);

  // ── Add/Edit Expense Type Dialog ───────────────────────────────────────────
  const [typeDialogOpen, setTypeDialogOpen] = useState(false);
  const [editType,       setEditType]       = useState(null);
  const [typeForm,       setTypeForm]       = useState({ typeName: "", typeCode: "", sortOrder: 100 });
  const [typeSaving,     setTypeSaving]     = useState(false);

  // ── Link GL Account Dialog ─────────────────────────────────────────────────
  const [linkDialogOpen,     setLinkDialogOpen]     = useState(false);
  const [linkingType,        setLinkingType]        = useState(null);
  const [selectedAccountId,  setSelectedAccountId]  = useState("");
  const [linkSaving,         setLinkSaving]         = useState(false);

  // ── Delete Confirm ─────────────────────────────────────────────────────────
  const [deleteTypeId, setDeleteTypeId] = useState(null);

  // ── Snackbar ───────────────────────────────────────────────────────────────
  const [snack, setSnack] = useState({ open: false, msg: "", severity: "success" });
  const showSnack = (msg, severity = "success") => setSnack({ open: true, msg, severity });

  // ── Load data ──────────────────────────────────────────────────────────────
  const loadAll = async () => {
    setLoading(true);
    try {
      const [typesRes, mapsRes, accountsRes] = await Promise.all([
        fetch(`/api/${tenancyId}/expenses/types`, { headers }),
        fetch(`/api/${tenancyId}/expenses/type-accounts`, { headers }),
        fetch(`/api/${tenancyId}/ledger-accounts?accountType=EXPENSE`, { headers }),
      ]);
      setExpenseTypes(typesRes.ok    ? await typesRes.json()    : []);
      setTypeAccountMaps(mapsRes.ok  ? await mapsRes.json()     : []);
      setExpenseAccounts(accountsRes.ok ? await accountsRes.json() : []);
    } catch (e) {
      showSnack("Failed to load data", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadAll(); }, []); // eslint-disable-line

  // ── Helpers ────────────────────────────────────────────────────────────────
  const mapForType = (typeId) =>
    typeAccountMaps.find((m) => m.expenseTypeId === typeId);

  const accountName = (accountId) => {
    const a = expenseAccounts.find((a) => a.id === accountId);
    return a ? `${a.accountCode} - ${a.accountName}` : accountId;
  };

  // ── Init Accounting ────────────────────────────────────────────────────────
  const handleInitAccounting = async () => {
    try {
      const res = await fetch(`/api/${tenancyId}/expenses/init-accounting`, {
        method: "POST", headers,
      });
      const data = await res.json();
      if (res.ok) {
        showSnack(data.message || "Accounting accounts initialised");
        loadAll();
      } else {
        showSnack(data.error || "Initialisation failed", "error");
      }
    } catch (e) {
      showSnack("Network error", "error");
    }
  };

  const handlePostUnposted = async () => {
    try {
      const res  = await fetch(`/api/${tenancyId}/expenses/post-unposted`, {
        method: "POST", headers,
      });
      const data = await res.json();
      if (res.ok) {
        showSnack(`GL posting done — posted: ${data.posted}, skipped: ${data.skipped} (no mapping/account)`);
      } else {
        showSnack(data.error || "Posting failed", "error");
      }
    } catch (e) {
      showSnack("Network error", "error");
    }
  };

  // ── Add/Edit Expense Type ──────────────────────────────────────────────────
  const openAddType = () => {
    setEditType(null);
    setTypeForm({ typeName: "", typeCode: "", sortOrder: 100 });
    setTypeDialogOpen(true);
  };

  const openEditType = (type) => {
    setEditType(type);
    setTypeForm({ typeName: type.typeName, typeCode: type.typeCode, sortOrder: type.sortOrder });
    setTypeDialogOpen(true);
  };

  const handleSaveType = async () => {
    if (!typeForm.typeName.trim()) { showSnack("Type name is required", "warning"); return; }
    setTypeSaving(true);
    try {
      const url    = editType
        ? `/api/${tenancyId}/expenses/types/${editType.id}`
        : `/api/${tenancyId}/expenses/types`;
      const method = editType ? "PUT" : "POST";
      const res    = await fetch(url, { method, headers, body: JSON.stringify(typeForm) });
      const data   = await res.json();
      if (res.ok) {
        showSnack(editType ? "Expense head updated" : "Expense head created");
        setTypeDialogOpen(false);
        loadAll();
      } else {
        showSnack(data.error || "Save failed", "error");
      }
    } catch (e) {
      showSnack("Network error", "error");
    } finally {
      setTypeSaving(false);
    }
  };

  const handleDeleteType = async () => {
    try {
      const res  = await fetch(`/api/${tenancyId}/expenses/types/${deleteTypeId}`, {
        method: "DELETE", headers,
      });
      const data = await res.json();
      if (res.ok) {
        showSnack("Expense head deleted");
        loadAll();
      } else {
        showSnack(data.error || "Delete failed", "error");
      }
    } catch (e) {
      showSnack("Network error", "error");
    } finally {
      setDeleteTypeId(null);
    }
  };

  // ── Link / Unlink GL Account ───────────────────────────────────────────────
  const openLinkDialog = (type) => {
    setLinkingType(type);
    const existing = mapForType(type.id);
    setSelectedAccountId(existing ? existing.drLedgerAccountId : "");
    setLinkDialogOpen(true);
  };

  const handleSaveLink = async () => {
    if (!selectedAccountId) { showSnack("Select a GL account", "warning"); return; }
    setLinkSaving(true);
    try {
      const res = await fetch(`/api/${tenancyId}/expenses/type-accounts`, {
        method: "POST",
        headers,
        body: JSON.stringify({ expenseTypeId: linkingType.id, drLedgerAccountId: selectedAccountId }),
      });
      const data = await res.json();
      if (res.ok) {
        showSnack("GL account linked");
        setLinkDialogOpen(false);
        loadAll();
      } else {
        showSnack(data.error || "Link failed", "error");
      }
    } catch (e) {
      showSnack("Network error", "error");
    } finally {
      setLinkSaving(false);
    }
  };

  const handleUnlink = async (typeId) => {
    try {
      const res = await fetch(`/api/${tenancyId}/expenses/type-accounts/${typeId}`, {
        method: "DELETE", headers,
      });
      if (res.ok) {
        showSnack("GL account unlinked");
        loadAll();
      } else {
        showSnack("Unlink failed", "error");
      }
    } catch (e) {
      showSnack("Network error", "error");
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: "flex", alignItems: "center", mb: 3, gap: 2, flexWrap: "wrap" }}>
        <Typography variant="h5" fontWeight={600}>Expense Head Management</Typography>
        <Box sx={{ flex: 1 }} />
        <Tooltip title="Post all saved expenses that haven't been posted to GL yet">
          <Button
            variant="outlined"
            color="warning"
            onClick={handlePostUnposted}
          >
            Post Unposted
          </Button>
        </Tooltip>
        <Tooltip title="Auto-create GL accounts for all default expense heads">
          <Button
            variant="outlined"
            startIcon={<AutoFixHighIcon />}
            onClick={handleInitAccounting}
          >
            Init Accounting
          </Button>
        </Tooltip>
        <Button variant="contained" startIcon={<AddIcon />} onClick={openAddType}>
          Add Expense Head
        </Button>
      </Box>

      {/* Table */}
      <TableContainer component={Paper} elevation={2}>
        <Table size="small">
          <TableHead sx={{ bgcolor: isDark ? "grey.800" : "grey.100" }}>
            <TableRow>
              <TableCell><b>Code</b></TableCell>
              <TableCell><b>Name</b></TableCell>
              <TableCell><b>Sort</b></TableCell>
              <TableCell><b>Type</b></TableCell>
              <TableCell><b>GL Account (DR)</b></TableCell>
              <TableCell align="center"><b>Actions</b></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {expenseTypes.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} align="center" sx={{ py: 4, color: "text.secondary" }}>
                  {loading ? "Loading..." : "No expense heads found"}
                </TableCell>
              </TableRow>
            )}
            {expenseTypes.map((type) => {
              const map     = mapForType(type.id);
              const isGlobal = !type.companyMstId;
              return (
                <TableRow key={type.id} hover>
                  <TableCell>{type.typeCode}</TableCell>
                  <TableCell>{type.typeName}</TableCell>
                  <TableCell>{type.sortOrder}</TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      label={isGlobal ? "Default" : "Custom"}
                      color={isGlobal ? "default" : "primary"}
                      variant="outlined"
                    />
                  </TableCell>
                  <TableCell>
                    {map ? (
                      <Typography variant="body2" color="success.main">
                        {accountName(map.drLedgerAccountId)}
                      </Typography>
                    ) : (
                      <Typography variant="body2" color="text.disabled">Not linked</Typography>
                    )}
                  </TableCell>
                  <TableCell align="center">
                    <Box sx={{ display: "flex", gap: 0.5, justifyContent: "center" }}>
                      <Tooltip title={map ? "Change GL Account" : "Link GL Account"}>
                        <IconButton size="small" color="primary" onClick={() => openLinkDialog(type)}>
                          <LinkIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      {map && (
                        <Tooltip title="Unlink GL Account">
                          <IconButton size="small" color="warning" onClick={() => handleUnlink(type.id)}>
                            <LinkOffIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                      {!isGlobal && (
                        <>
                          <Tooltip title="Edit">
                            <IconButton size="small" onClick={() => openEditType(type)}>
                              <EditIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Delete">
                            <IconButton size="small" color="error" onClick={() => setDeleteTypeId(type.id)}>
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </>
                      )}
                    </Box>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Add/Edit Expense Head Dialog */}
      <Dialog open={typeDialogOpen} onClose={() => setTypeDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>{editType ? "Edit Expense Head" : "Add Expense Head"}</DialogTitle>
        <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, pt: "16px !important" }}>
          <TextField
            label="Name"
            value={typeForm.typeName}
            onChange={(e) => setTypeForm({ ...typeForm, typeName: e.target.value })}
            fullWidth
            required
          />
          <TextField
            label="Code"
            value={typeForm.typeCode}
            onChange={(e) => setTypeForm({ ...typeForm, typeCode: e.target.value.toUpperCase() })}
            fullWidth
          />
          <TextField
            label="Sort Order"
            type="number"
            value={typeForm.sortOrder}
            onChange={(e) => setTypeForm({ ...typeForm, sortOrder: parseInt(e.target.value, 10) || 0 })}
            fullWidth
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTypeDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSaveType} disabled={typeSaving}>
            {typeSaving ? "Saving..." : "Save"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Link GL Account Dialog */}
      <Dialog open={linkDialogOpen} onClose={() => setLinkDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Link GL Account — {linkingType?.typeName}</DialogTitle>
        <DialogContent sx={{ pt: "16px !important" }}>
          <FormControl fullWidth>
            <InputLabel>Expense Ledger Account (DR)</InputLabel>
            <Select
              value={selectedAccountId}
              label="Expense Ledger Account (DR)"
              onChange={(e) => setSelectedAccountId(e.target.value)}
            >
              {expenseAccounts.map((a) => (
                <MenuItem key={a.id} value={a.id}>
                  {a.accountCode} — {a.accountName}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setLinkDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSaveLink} disabled={linkSaving}>
            {linkSaving ? "Saving..." : "Link"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={!!deleteTypeId} onClose={() => setDeleteTypeId(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Delete Expense Head</DialogTitle>
        <DialogContent>
          <Typography>Are you sure you want to delete this expense head?</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTypeId(null)}>Cancel</Button>
          <Button variant="contained" color="error" onClick={handleDeleteType}>Delete</Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar */}
      <Snackbar
        open={snack.open}
        autoHideDuration={4000}
        onClose={() => setSnack({ ...snack, open: false })}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert severity={snack.severity} onClose={() => setSnack({ ...snack, open: false })}>
          {snack.msg}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default ExpenseHeadManagementPage;
