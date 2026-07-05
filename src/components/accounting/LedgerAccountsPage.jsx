import React, { useState, useEffect } from "react";
import {
  Box, Typography, Button, Paper, Table, TableHead, TableRow, TableCell,
  TableBody, Chip, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, MenuItem, Switch, FormControlLabel, Alert, Divider,
  InputAdornment, IconButton, Tooltip,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import BlockIcon from "@mui/icons-material/Block";
import SearchIcon from "@mui/icons-material/Search";

const BASE = () => `/api/${localStorage.getItem("tenancyId")}`;
const HDR  = () => ({ Authorization: `Bearer ${localStorage.getItem("jwtToken")}`, "Content-Type": "application/json" });

const TYPE_COLOR = { ASSET: "primary", LIABILITY: "warning", EQUITY: "success", INCOME: "info", EXPENSE: "error" };
const EMPTY_FORM = {
  accountGroupId: "", accountCode: "", accountName: "",
  cash: false, bank: false,
  customerControl: false, supplierControl: false,
  gstInput: false, gstOutput: false, cogs: false, inventory: false,
  bankName: "", bankAccountNumber: "", bankIfsc: "",
  openingBalanceDr: "", openingBalanceCr: "",
  active: true,
};

export default function LedgerAccountsPage() {
  const [accounts, setAccounts]     = useState([]);
  const [groups, setGroups]         = useState([]);
  const [filterType, setFilterType] = useState("");
  const [search, setSearch]         = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing]       = useState(null);
  const [form, setForm]             = useState(EMPTY_FORM);
  const [msg, setMsg]               = useState(null);

  const load = () => {
    const qs = filterType ? `?accountType=${filterType}` : "";
    fetch(`${BASE()}/ledger-accounts${qs}`, { headers: HDR() })
      .then((r) => r.json())
      .then((d) => setAccounts(Array.isArray(d) ? d : []));
  };

  useEffect(() => {
    load();
    fetch(`${BASE()}/account-groups`, { headers: HDR() })
      .then((r) => r.json())
      .then((d) => setGroups(Array.isArray(d) ? d : []));
  }, []); // eslint-disable-line

  useEffect(() => { load(); }, [filterType]); // eslint-disable-line

  const selectedGroup = groups.find((g) => g.id === form.accountGroupId);
  const derivedType   = selectedGroup?.accountType || "";

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setMsg(null);
    setDialogOpen(true);
  };

  const openEdit = (acc) => {
    setEditing(acc);
    setForm({
      accountGroupId: acc.accountGroupId || "",
      accountCode: acc.accountCode || "",
      accountName: acc.accountName || "",
      cash: acc.cash || acc.isCash || false,
      bank: acc.bank || acc.isBank || false,
      customerControl: acc.customerControl || acc.isCustomerControl || false,
      supplierControl: acc.supplierControl || acc.isSupplierControl || false,
      gstInput: acc.gstInput || acc.isGstInput || false,
      gstOutput: acc.gstOutput || acc.isGstOutput || false,
      cogs: acc.cogs || acc.isCogs || false,
      inventory: acc.inventory || acc.isInventory || false,
      bankName: acc.bankName || "",
      bankAccountNumber: acc.bankAccountNumber || "",
      bankIfsc: acc.bankIfsc || "",
      openingBalanceDr: acc.openingBalanceDr || "",
      openingBalanceCr: acc.openingBalanceCr || "",
      active: acc.active !== false,
    });
    setMsg(null);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.accountGroupId || !form.accountCode || !form.accountName) {
      setMsg({ type: "error", text: "Account Group, Code and Name are required." });
      return;
    }
    const payload = {
      ...form,
      openingBalanceDr: form.openingBalanceDr ? Number(form.openingBalanceDr) : 0,
      openingBalanceCr: form.openingBalanceCr ? Number(form.openingBalanceCr) : 0,
    };
    try {
      const url    = editing ? `${BASE()}/ledger-accounts/${editing.id}` : `${BASE()}/ledger-accounts`;
      const method = editing ? "PUT" : "POST";
      const res    = await fetch(url, { method, headers: HDR(), body: JSON.stringify(payload) });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setMsg({ type: "error", text: err.message || "Save failed." });
        return;
      }
      setDialogOpen(false);
      load();
    } catch {
      setMsg({ type: "error", text: "Network error." });
    }
  };

  const handleDeactivate = async (id) => {
    if (!window.confirm("Deactivate this account?")) return;
    await fetch(`${BASE()}/ledger-accounts/${id}`, { method: "DELETE", headers: HDR() });
    load();
  };

  const f = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const displayed = search
    ? accounts.filter((a) =>
        a.accountName?.toLowerCase().includes(search.toLowerCase()) ||
        a.accountCode?.toLowerCase().includes(search.toLowerCase())
      )
    : accounts;

  return (
    <Box p={3}>
      <Typography variant="h5" gutterBottom>Ledger Accounts</Typography>

      <Paper sx={{ p: 2, mb: 2 }}>
        <Box display="flex" gap={2} flexWrap="wrap" alignItems="center">
          <TextField
            placeholder="Search code / name…"
            size="small" sx={{ width: 240 }}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
          />
          <TextField select label="Type" size="small" sx={{ width: 160 }}
            value={filterType} onChange={(e) => setFilterType(e.target.value)}>
            <MenuItem value="">All Types</MenuItem>
            {["ASSET", "LIABILITY", "EQUITY", "INCOME", "EXPENSE"].map((t) => (
              <MenuItem key={t} value={t}>{t}</MenuItem>
            ))}
          </TextField>
          <Box flex={1} />
          <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
            New Account
          </Button>
        </Box>
      </Paper>

      <Table size="small" component={Paper}>
        <TableHead sx={{ bgcolor: "primary.dark" }}>
          <TableRow>
            {["Code", "Account Name", "Type", "Group", "Flags", "Active", ""].map((h) => (
              <TableCell key={h} sx={{ color: "white" }}>{h}</TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {displayed.map((a) => (
            <TableRow key={a.id} hover>
              <TableCell sx={{ fontFamily: "monospace", fontWeight: 600 }}>{a.accountCode}</TableCell>
              <TableCell>{a.accountName}</TableCell>
              <TableCell>
                <Chip label={a.accountType} size="small" color={TYPE_COLOR[a.accountType] || "default"} />
              </TableCell>
              <TableCell sx={{ fontSize: 12, color: "text.secondary" }}>{a.accountGroupId?.slice(0, 8)}…</TableCell>
              <TableCell>
                <Box display="flex" gap={0.5} flexWrap="wrap">
                  {(a.cash || a.isCash)           && <Chip label="Cash"     size="small" color="success"  variant="outlined" />}
                  {(a.bank || a.isBank)            && <Chip label="Bank"     size="small" color="info"     variant="outlined" />}
                  {(a.isSystem)                    && <Chip label="System"   size="small" color="default"  variant="outlined" />}
                  {(a.gstInput || a.isGstInput)    && <Chip label="GST-In"   size="small" color="warning"  variant="outlined" />}
                  {(a.gstOutput || a.isGstOutput)  && <Chip label="GST-Out"  size="small" color="warning"  variant="outlined" />}
                  {(a.cogs || a.isCogs)            && <Chip label="COGS"     size="small" color="error"    variant="outlined" />}
                </Box>
              </TableCell>
              <TableCell>
                <Chip label={a.active ? "Active" : "Inactive"} size="small"
                  color={a.active ? "success" : "default"} />
              </TableCell>
              <TableCell>
                <Box display="flex" gap={0.5}>
                  <Tooltip title="Edit">
                    <IconButton size="small" onClick={() => openEdit(a)} disabled={a.isSystem}>
                      <EditIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  {a.active && !a.isSystem && (
                    <Tooltip title="Deactivate">
                      <IconButton size="small" color="error" onClick={() => handleDeactivate(a.id)}>
                        <BlockIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  )}
                </Box>
              </TableCell>
            </TableRow>
          ))}
          {displayed.length === 0 && (
            <TableRow>
              <TableCell colSpan={7} align="center" sx={{ color: "text.secondary", py: 4 }}>
                No accounts found.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editing ? "Edit Account" : "New Ledger Account"}</DialogTitle>
        <DialogContent dividers>
          {msg && <Alert severity={msg.type} sx={{ mb: 2 }}>{msg.text}</Alert>}

          <Box display="flex" flexDirection="column" gap={2}>
            {/* Group */}
            <TextField select label="Account Group *" value={form.accountGroupId}
              onChange={(e) => f("accountGroupId", e.target.value)} fullWidth>
              {groups.map((g) => (
                <MenuItem key={g.id} value={g.id}>
                  {g.groupName} <span style={{ marginLeft: 8, fontSize: 11, opacity: 0.6 }}>({g.accountType})</span>
                </MenuItem>
              ))}
            </TextField>

            {derivedType && (
              <Box display="flex" alignItems="center" gap={1}>
                <Typography variant="body2" color="text.secondary">Account Type:</Typography>
                <Chip label={derivedType} size="small" color={TYPE_COLOR[derivedType] || "default"} />
              </Box>
            )}

            <Box display="flex" gap={2}>
              <TextField label="Account Code *" value={form.accountCode}
                onChange={(e) => f("accountCode", e.target.value)}
                disabled={!!editing} sx={{ width: 140 }} />
              <TextField label="Account Name *" value={form.accountName}
                onChange={(e) => f("accountName", e.target.value)} fullWidth />
            </Box>

            <Divider>Flags</Divider>
            <Box display="flex" flexWrap="wrap" gap={1}>
              <FormControlLabel control={<Switch checked={form.cash} onChange={(e) => f("cash", e.target.checked)} />} label="Cash Account" />
              <FormControlLabel control={<Switch checked={form.bank} onChange={(e) => f("bank", e.target.checked)} />} label="Bank Account" />
              <FormControlLabel control={<Switch checked={form.gstInput} onChange={(e) => f("gstInput", e.target.checked)} />} label="GST Input" />
              <FormControlLabel control={<Switch checked={form.gstOutput} onChange={(e) => f("gstOutput", e.target.checked)} />} label="GST Output" />
              <FormControlLabel control={<Switch checked={form.cogs} onChange={(e) => f("cogs", e.target.checked)} />} label="COGS" />
              <FormControlLabel control={<Switch checked={form.inventory} onChange={(e) => f("inventory", e.target.checked)} />} label="Inventory" />
            </Box>

            {/* Bank details — shown only when bank flag is on */}
            {form.bank && (
              <>
                <Divider>Bank Details</Divider>
                <Box display="flex" gap={2} flexWrap="wrap">
                  <TextField label="Bank Name" value={form.bankName} onChange={(e) => f("bankName", e.target.value)} sx={{ flexGrow: 1 }} />
                  <TextField label="Account Number" value={form.bankAccountNumber} onChange={(e) => f("bankAccountNumber", e.target.value)} sx={{ width: 180 }} />
                  <TextField label="IFSC" value={form.bankIfsc} onChange={(e) => f("bankIfsc", e.target.value)} sx={{ width: 140 }} />
                </Box>
              </>
            )}

            <Divider>Opening Balance</Divider>
            <Box display="flex" gap={2}>
              <TextField label="Opening Dr" type="number" value={form.openingBalanceDr}
                onChange={(e) => f("openingBalanceDr", e.target.value)}
                inputProps={{ min: 0, step: 0.01 }} sx={{ flex: 1 }} />
              <TextField label="Opening Cr" type="number" value={form.openingBalanceCr}
                onChange={(e) => f("openingBalanceCr", e.target.value)}
                inputProps={{ min: 0, step: 0.01 }} sx={{ flex: 1 }} />
            </Box>

            {editing && (
              <FormControlLabel
                control={<Switch checked={form.active} onChange={(e) => f("active", e.target.checked)} />}
                label="Active"
              />
            )}
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
