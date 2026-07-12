import React, { useState, useEffect, useCallback } from "react";
import {
  Box, Typography, Paper, Button, Chip, CircularProgress,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, MenuItem, Alert, Tooltip, IconButton, Divider,
  Grid, Stack, InputAdornment,
} from "@mui/material";
import {
  Add as AddIcon,
  LocalShipping as DispatchIcon,
  CheckCircle as ReceiveIcon,
  Cancel as CancelIcon,
  Visibility as ViewIcon,
  Refresh as RefreshIcon,
  DeleteOutline as RemoveIcon,
} from "@mui/icons-material";

const API = (tid) => `/api/${tid}`;

const STATUS_COLOR = {
  DRAFT:            "default",
  PENDING_APPROVAL: "warning",
  APPROVED:         "info",
  DISPATCHED:       "info",
  RECEIVED:         "success",
  SHORT_RECEIVED:   "warning",
  REJECTED:         "error",
  CANCELLED:        "default",
};

function StatusChip({ status }) {
  return (
    <Chip
      size="small"
      label={status?.replace("_", " ")}
      color={STATUS_COLOR[status] || "default"}
      sx={{ fontWeight: 600 }}
    />
  );
}

const emptyItem = () => ({
  itemId: "", itemName: "", itemCode: "", barcode: "",
  unitName: "", qtyDispatched: "", rate: "", taxRate: "", mrp: "",
});

// ── Create / Edit Dialog ──────────────────────────────────────────────────────

function TransferFormDialog({ open, onClose, onSaved, tenantId, token, franchises }) {
  const [form, setForm] = useState({
    franchiseId: "", franchiseTenant: "", franchiseBranchCode: "", sourceBranch: "",
    transferDate: new Date().toISOString().slice(0, 10),
    expectedReceiptDate: "", transferCost: "", notes: "",
  });
  const [items, setItems] = useState([emptyItem()]);
  const [branches, setBranches] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  const handleFranchiseChange = async (e) => {
    const val = e.target.value;
    const fr = franchises.find((f) => f.dbName === val);
    setForm((p) => ({ ...p, franchiseTenant: val, franchiseId: fr?.franchiseId || "", franchiseBranchCode: "" }));
    setBranches([]);
    if (val) {
      try {
        const res = await fetch(`${API(tenantId)}/franchise-branches/by-tenant/${val}/active`, { headers });
        if (res.ok) setBranches(await res.json());
      } catch (_) {}
    }
  };

  const setItem = (idx, field, val) =>
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, [field]: val } : it)));

  const addItem = () => setItems((p) => [...p, emptyItem()]);
  const removeItem = (idx) => setItems((p) => p.filter((_, i) => i !== idx));

  const handleSave = async () => {
    if (!form.franchiseTenant) { setError("Select a franchise"); return; }
    const validItems = items.filter((i) => i.itemId && Number(i.qtyDispatched) > 0);
    if (validItems.length === 0) { setError("Add at least one item with qty > 0"); return; }
    setSaving(true); setError(null);
    try {
      const body = {
        ...form,
        franchiseId: form.franchiseId ? Number(form.franchiseId) : null,
        items: validItems.map((i) => ({
          ...i,
          qtyDispatched: Number(i.qtyDispatched),
          rate: Number(i.rate) || 0,
          taxRate: Number(i.taxRate) || 0,
          mrp: Number(i.mrp) || 0,
        })),
      };
      const res = await fetch(`${API(tenantId)}/franchise-transfers`, {
        method: "POST", headers, body: JSON.stringify(body),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || "Save failed"); }
      onSaved(); onClose();
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle>New Franchise Stock Transfer</DialogTitle>
      <DialogContent dividers>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        <Grid container spacing={2} sx={{ mb: 2 }}>
          <Grid item xs={12} sm={3}>
            <TextField select fullWidth label="Franchise *" size="small"
              value={form.franchiseTenant} onChange={handleFranchiseChange}>
              {franchises.map((f) => (
                <MenuItem key={f.dbName} value={f.dbName}>{f.dbName}</MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid item xs={12} sm={3}>
            <TextField select fullWidth label="Franchise Branch *" size="small"
              value={form.franchiseBranchCode}
              disabled={!form.franchiseTenant}
              onChange={(e) => setForm((p) => ({ ...p, franchiseBranchCode: e.target.value }))}>
              {branches.length === 0
                ? <MenuItem value="" disabled>{form.franchiseTenant ? "No active branches" : "Select franchise first"}</MenuItem>
                : branches.map((b) => (
                  <MenuItem key={b.branchCode} value={b.branchCode}>
                    {b.branchCode} – {b.branchName}
                  </MenuItem>
                ))
              }
            </TextField>
          </Grid>
          <Grid item xs={12} sm={2}>
            <TextField fullWidth label="Source Branch" size="small"
              value={form.sourceBranch} onChange={(e) => setForm((p) => ({ ...p, sourceBranch: e.target.value }))} />
          </Grid>
          <Grid item xs={6} sm={2}>
            <TextField fullWidth label="Transfer Date" type="date" size="small"
              value={form.transferDate} onChange={(e) => setForm((p) => ({ ...p, transferDate: e.target.value }))}
              InputLabelProps={{ shrink: true }} />
          </Grid>
          <Grid item xs={6} sm={2}>
            <TextField fullWidth label="Exp. Receipt" type="date" size="small"
              value={form.expectedReceiptDate}
              onChange={(e) => setForm((p) => ({ ...p, expectedReceiptDate: e.target.value }))}
              InputLabelProps={{ shrink: true }} />
          </Grid>
          <Grid item xs={12} sm={2}>
            <TextField fullWidth label="Transfer Cost" size="small" type="number"
              value={form.transferCost} onChange={(e) => setForm((p) => ({ ...p, transferCost: e.target.value }))} />
          </Grid>
          <Grid item xs={12}>
            <TextField fullWidth label="Notes" size="small" multiline rows={2}
              value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} />
          </Grid>
        </Grid>

        <Divider sx={{ mb: 2 }} />
        <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>Items</Typography>

        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: "#1976d2" }}>
                {["Item ID", "Item Name", "Code", "Barcode", "Unit", "Qty", "Rate", "Tax%", "MRP", ""].map((h) => (
                  <TableCell key={h} sx={{ color: "#fff", fontWeight: 700, whiteSpace: "nowrap" }}>{h}</TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {items.map((item, idx) => (
                <TableRow key={idx}>
                  <TableCell><TextField size="small" variant="standard" value={item.itemId}
                    onChange={(e) => setItem(idx, "itemId", e.target.value)} sx={{ width: 90 }} /></TableCell>
                  <TableCell><TextField size="small" variant="standard" value={item.itemName}
                    onChange={(e) => setItem(idx, "itemName", e.target.value)} sx={{ width: 120 }} /></TableCell>
                  <TableCell><TextField size="small" variant="standard" value={item.itemCode}
                    onChange={(e) => setItem(idx, "itemCode", e.target.value)} sx={{ width: 80 }} /></TableCell>
                  <TableCell><TextField size="small" variant="standard" value={item.barcode}
                    onChange={(e) => setItem(idx, "barcode", e.target.value)} sx={{ width: 90 }} /></TableCell>
                  <TableCell><TextField size="small" variant="standard" value={item.unitName}
                    onChange={(e) => setItem(idx, "unitName", e.target.value)} sx={{ width: 60 }} /></TableCell>
                  <TableCell><TextField size="small" variant="standard" type="number" value={item.qtyDispatched}
                    onChange={(e) => setItem(idx, "qtyDispatched", e.target.value)} sx={{ width: 60 }} /></TableCell>
                  <TableCell><TextField size="small" variant="standard" type="number" value={item.rate}
                    onChange={(e) => setItem(idx, "rate", e.target.value)} sx={{ width: 70 }} /></TableCell>
                  <TableCell><TextField size="small" variant="standard" type="number" value={item.taxRate}
                    onChange={(e) => setItem(idx, "taxRate", e.target.value)} sx={{ width: 60 }} /></TableCell>
                  <TableCell><TextField size="small" variant="standard" type="number" value={item.mrp}
                    onChange={(e) => setItem(idx, "mrp", e.target.value)} sx={{ width: 70 }} /></TableCell>
                  <TableCell>
                    <IconButton size="small" onClick={() => removeItem(idx)} disabled={items.length === 1}>
                      <RemoveIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
        <Button size="small" startIcon={<AddIcon />} onClick={addItem} sx={{ mt: 1 }}>
          Add Row
        </Button>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={handleSave} disabled={saving}>
          {saving ? <CircularProgress size={18} color="inherit" /> : "Save as Draft"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ── Transfer Detail Dialog ────────────────────────────────────────────────────

function DetailDialog({ open, onClose, transfer, onAction, tenantId, token }) {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionPending, setActionPending] = useState(false);
  const [receiveItems, setReceiveItems] = useState([]);
  const [showReceive, setShowReceive] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [showCancel, setShowCancel] = useState(false);
  const [alert, setAlert] = useState(null);

  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  useEffect(() => {
    if (!open || !transfer) return;
    setLoading(true); setShowReceive(false); setShowCancel(false); setAlert(null);
    fetch(`${API(tenantId)}/franchise-transfers/${transfer.id}`, { headers })
      .then((r) => r.json())
      .then((d) => {
        setDetail(d);
        setReceiveItems((d.items || []).map((i) => ({
          itemId: i.itemId, itemName: i.itemName, qtyDispatched: i.qtyDispatched, qtyReceived: i.qtyDispatched,
        })));
      })
      .catch(() => setAlert("Failed to load details"))
      .finally(() => setLoading(false));
  }, [open, transfer]);

  const doAction = async (path, body, method = "POST") => {
    setActionPending(true); setAlert(null);
    try {
      const res = await fetch(`${API(tenantId)}/franchise-transfers/${transfer.id}/${path}`, {
        method, headers, body: body ? JSON.stringify(body) : undefined,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Action failed");
      onAction();
      onClose();
    } catch (e) { setAlert(e.message); }
    finally { setActionPending(false); }
  };

  const hdr = detail?.transfer || {};
  const items = detail?.items || [];

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        Transfer Detail
        {hdr.transferNo && (
          <Typography variant="caption" display="block" color="text.secondary">
            {hdr.transferNo} · <StatusChip status={hdr.status} />
          </Typography>
        )}
      </DialogTitle>
      <DialogContent dividers>
        {alert && <Alert severity="error" sx={{ mb: 2 }}>{alert}</Alert>}
        {loading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}><CircularProgress /></Box>
        ) : (
          <>
            <Grid container spacing={1} sx={{ mb: 2 }}>
              <Grid item xs={6} sm={3}><Typography variant="caption" color="text.secondary">Franchise</Typography>
                <Typography variant="body2" fontWeight={600}>{hdr.franchiseTenant}</Typography></Grid>
              <Grid item xs={6} sm={3}><Typography variant="caption" color="text.secondary">Transfer Date</Typography>
                <Typography variant="body2">{hdr.transferDate}</Typography></Grid>
              <Grid item xs={6} sm={3}><Typography variant="caption" color="text.secondary">Source Branch</Typography>
                <Typography variant="body2">{hdr.sourceBranch || "—"}</Typography></Grid>
              <Grid item xs={6} sm={3}><Typography variant="caption" color="text.secondary">Expected Receipt</Typography>
                <Typography variant="body2">{hdr.expectedReceiptDate || "—"}</Typography></Grid>
              <Grid item xs={6} sm={3}><Typography variant="caption" color="text.secondary">Qty Total</Typography>
                <Typography variant="body2">{hdr.qtyTotal}</Typography></Grid>
              <Grid item xs={6} sm={3}><Typography variant="caption" color="text.secondary">Qty Received</Typography>
                <Typography variant="body2">{hdr.qtyReceived || 0}</Typography></Grid>
              <Grid item xs={6} sm={3}><Typography variant="caption" color="text.secondary">Transfer Cost</Typography>
                <Typography variant="body2">₹{hdr.transferCost || 0}</Typography></Grid>
              <Grid item xs={6} sm={3}><Typography variant="caption" color="text.secondary">Dispatched By</Typography>
                <Typography variant="body2">{hdr.dispatchedBy || "—"}</Typography></Grid>
              {hdr.notes && (
                <Grid item xs={12}><Typography variant="caption" color="text.secondary">Notes</Typography>
                  <Typography variant="body2">{hdr.notes}</Typography></Grid>
              )}
            </Grid>

            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: "#1976d2" }}>
                    {["Item", "Code", "Barcode", "Unit", "Qty Dispatched", "Qty Received", "Rate", "Tax%", "Amount"].map((h) => (
                      <TableCell key={h} sx={{ color: "#fff", fontWeight: 700 }}>{h}</TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {items.map((i) => (
                    <TableRow key={i.id} hover>
                      <TableCell>{i.itemName || i.itemId}</TableCell>
                      <TableCell>{i.itemCode}</TableCell>
                      <TableCell>{i.barcode}</TableCell>
                      <TableCell>{i.unitName}</TableCell>
                      <TableCell align="right">{i.qtyDispatched}</TableCell>
                      <TableCell align="right">{i.qtyReceived || 0}</TableCell>
                      <TableCell align="right">{i.rate}</TableCell>
                      <TableCell align="right">{i.taxRate}%</TableCell>
                      <TableCell align="right">{i.amount}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>

            {/* Receive form */}
            {showReceive && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>Enter Received Quantities</Typography>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ bgcolor: "#1976d2" }}>
                      <TableCell sx={{ color: "#fff", fontWeight: 700 }}>Item</TableCell>
                      <TableCell sx={{ color: "#fff", fontWeight: 700 }}>Dispatched</TableCell>
                      <TableCell sx={{ color: "#fff", fontWeight: 700 }}>Received</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {receiveItems.map((ri, idx) => (
                      <TableRow key={ri.itemId}>
                        <TableCell>{ri.itemName || ri.itemId}</TableCell>
                        <TableCell>{ri.qtyDispatched}</TableCell>
                        <TableCell>
                          <TextField size="small" type="number" variant="standard"
                            value={ri.qtyReceived}
                            onChange={(e) => setReceiveItems((p) =>
                              p.map((x, i) => i === idx ? { ...x, qtyReceived: e.target.value } : x))} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                  <Button variant="contained" color="success" disabled={actionPending}
                    onClick={() => doAction("receive", {
                      items: receiveItems.map((ri) => ({ itemId: ri.itemId, qtyReceived: Number(ri.qtyReceived) })),
                    })}>
                    {actionPending ? <CircularProgress size={16} color="inherit" /> : "Confirm Receipt"}
                  </Button>
                  <Button onClick={() => setShowReceive(false)}>Cancel</Button>
                </Stack>
              </Box>
            )}

            {/* Cancel form */}
            {showCancel && (
              <Box sx={{ mt: 2 }}>
                <TextField fullWidth label="Cancellation Reason" size="small" value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)} sx={{ mb: 1 }} />
                <Stack direction="row" spacing={1}>
                  <Button variant="contained" color="error" disabled={actionPending}
                    onClick={() => doAction("cancel", { reason: cancelReason })}>
                    {actionPending ? <CircularProgress size={16} color="inherit" /> : "Confirm Cancel"}
                  </Button>
                  <Button onClick={() => setShowCancel(false)}>Back</Button>
                </Stack>
              </Box>
            )}
          </>
        )}
      </DialogContent>
      <DialogActions>
        {hdr.status === "DRAFT" && !showCancel && (
          <>
            <Button variant="outlined" color="warning" size="small" disabled={actionPending}
              onClick={() => doAction("submit")}>
              Submit for Approval
            </Button>
            <Button variant="contained" startIcon={<DispatchIcon />} disabled={actionPending}
              onClick={() => doAction("dispatch")}>
              Dispatch
            </Button>
            <Button color="error" startIcon={<CancelIcon />} onClick={() => setShowCancel(true)}>
              Cancel
            </Button>
          </>
        )}
        {hdr.status === "PENDING_APPROVAL" && !showCancel && (
          <>
            <Button variant="contained" color="success" size="small" disabled={actionPending}
              onClick={() => doAction("approve", { approved: true })}>
              Approve
            </Button>
            <Button variant="outlined" color="error" size="small" disabled={actionPending}
              onClick={() => doAction("approve", { approved: false })}>
              Reject
            </Button>
            <Button color="error" startIcon={<CancelIcon />} onClick={() => setShowCancel(true)}>
              Cancel
            </Button>
          </>
        )}
        {hdr.status === "APPROVED" && !showCancel && (
          <>
            <Button variant="contained" startIcon={<DispatchIcon />} disabled={actionPending}
              onClick={() => doAction("dispatch")}>
              Dispatch
            </Button>
            <Button color="error" startIcon={<CancelIcon />} onClick={() => setShowCancel(true)}>
              Cancel
            </Button>
          </>
        )}
        {hdr.status === "DISPATCHED" && !showReceive && !showCancel && (
          <>
            <Button variant="contained" color="success" startIcon={<ReceiveIcon />}
              onClick={() => setShowReceive(true)}>
              Confirm Receipt
            </Button>
            <Button color="error" startIcon={<CancelIcon />} onClick={() => setShowCancel(true)}>
              Cancel Transfer
            </Button>
          </>
        )}
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function FranchiseStockTransferPage() {
  const tenantId = localStorage.getItem("tenancyId") || "";
  const token    = localStorage.getItem("jwtToken")  || "";
  const headers  = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  const [transfers,   setTransfers]   = useState([]);
  const [franchises,  setFranchises]  = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [ftFilter,    setFtFilter]    = useState("");
  const [createOpen,  setCreateOpen]  = useState(false);
  const [selected,    setSelected]    = useState(null);
  const [alertMsg,    setAlertMsg]    = useState(null);
  const [alertSev,    setAlertSev]    = useState("success");

  const flash = (msg, sev = "success") => {
    setAlertMsg(msg); setAlertSev(sev);
    setTimeout(() => setAlertMsg(null), 4000);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.append("status", statusFilter);
      if (ftFilter)     params.append("franchiseTenant", ftFilter);

      const [tRes, fRes] = await Promise.all([
        fetch(`${API(tenantId)}/franchise-transfers?${params}`, { headers }),
        fetch(`${API(tenantId)}/master-sync/franchises`, { headers }),
      ]);
      setTransfers(tRes.ok ? await tRes.json() : []);
      setFranchises(fRes.ok ? await fRes.json() : []);
    } catch (e) {
      flash("Failed to load transfers: " + e.message, "error");
    } finally { setLoading(false); }
  }, [tenantId, statusFilter, ftFilter]);

  useEffect(() => { load(); }, [load]);

  const STATUSES = ["DRAFT", "DISPATCHED", "RECEIVED", "SHORT_RECEIVED", "REJECTED", "CANCELLED"];

  return (
    <Box sx={{ p: 3, maxWidth: 1400, mx: "auto" }}>
      {/* Header */}
      <Box sx={{ display: "flex", alignItems: "center", mb: 3, gap: 2, flexWrap: "wrap" }}>
        <Box sx={{ flex: 1 }}>
          <Typography variant="h5" fontWeight={700}>Franchise Stock Transfers</Typography>
          <Typography variant="body2" color="text.secondary">
            Dispatch stock from central to franchise branches
          </Typography>
        </Box>
        <Tooltip title="Refresh"><IconButton onClick={load}><RefreshIcon /></IconButton></Tooltip>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreateOpen(true)}>
          New Transfer
        </Button>
      </Box>

      {alertMsg && (
        <Alert severity={alertSev} sx={{ mb: 2 }} onClose={() => setAlertMsg(null)}>{alertMsg}</Alert>
      )}

      {/* Filters */}
      <Stack direction="row" spacing={2} sx={{ mb: 2, flexWrap: "wrap" }}>
        <TextField select label="Status" size="small" value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)} sx={{ minWidth: 150 }}>
          <MenuItem value="">All Statuses</MenuItem>
          {STATUSES.map((s) => <MenuItem key={s} value={s}>{s.replace("_", " ")}</MenuItem>)}
        </TextField>
        <TextField select label="Franchise" size="small" value={ftFilter}
          onChange={(e) => setFtFilter(e.target.value)} sx={{ minWidth: 180 }}>
          <MenuItem value="">All Franchises</MenuItem>
          {franchises.map((f) => <MenuItem key={f.dbName} value={f.dbName}>{f.dbName}</MenuItem>)}
        </TextField>
      </Stack>

      {/* Table */}
      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}><CircularProgress /></Box>
      ) : (
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: "#1976d2" }}>
                {["Transfer No", "Franchise", "Source Branch", "Date", "Status", "Qty", "Received", "Dispatched By", "Actions"].map((h) => (
                  <TableCell key={h} sx={{ color: "#fff", fontWeight: 700, bgcolor: "#1976d2", whiteSpace: "nowrap" }}>{h}</TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {transfers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} align="center">
                    <Typography color="text.secondary" sx={{ py: 3 }}>No transfers found</Typography>
                  </TableCell>
                </TableRow>
              ) : transfers.map((t) => (
                <TableRow key={t.id} hover>
                  <TableCell>
                    <Typography variant="body2" fontWeight={600}>{t.transferNo}</Typography>
                  </TableCell>
                  <TableCell>{t.franchiseTenant}</TableCell>
                  <TableCell>{t.sourceBranch || "—"}</TableCell>
                  <TableCell>{t.transferDate}</TableCell>
                  <TableCell><StatusChip status={t.status} /></TableCell>
                  <TableCell align="right">{t.qtyTotal}</TableCell>
                  <TableCell align="right">{t.qtyReceived || 0}</TableCell>
                  <TableCell>{t.dispatchedBy || "—"}</TableCell>
                  <TableCell>
                    <Tooltip title="View / Actions">
                      <IconButton size="small" onClick={() => setSelected(t)}>
                        <ViewIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Create dialog */}
      <TransferFormDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSaved={() => { load(); flash("Transfer created"); }}
        tenantId={tenantId}
        token={token}
        franchises={franchises}
      />

      {/* Detail / action dialog */}
      {selected && (
        <DetailDialog
          open={!!selected}
          onClose={() => setSelected(null)}
          transfer={selected}
          onAction={() => { load(); flash("Action completed successfully"); }}
          tenantId={tenantId}
          token={token}
        />
      )}
    </Box>
  );
}
