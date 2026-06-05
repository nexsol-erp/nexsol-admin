import React, { useEffect, useState, useCallback } from "react";
import {
  Box, Button, CircularProgress, FormControl, InputLabel, MenuItem,
  Paper, Select, Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, TextField, Typography, Alert, Chip, Tooltip, IconButton,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import SaveIcon from "@mui/icons-material/Save";

const BranchPricePage = () => {
  const tenantId = localStorage.getItem("tenancyId") || "";
  const token    = localStorage.getItem("jwtToken")  || "";
  const headers  = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  const [branches, setBranches]         = useState([]);
  const [selectedBranch, setSelectedBranch] = useState("");
  const [items, setItems]               = useState([]);       // all items with default price
  const [overrides, setOverrides]       = useState({});       // itemId → {standardPrice, taxRate}
  const [edited, setEdited]             = useState({});       // itemId → {standardPrice, taxRate} (unsaved edits)
  const [loading, setLoading]           = useState(false);
  const [saving, setSaving]             = useState(false);
  const [error, setError]               = useState(null);
  const [success, setSuccess]           = useState(null);
  const [search, setSearch]             = useState("");

  // Load branches
  useEffect(() => {
    fetch(`/api/${tenantId}/branches`, { headers })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        const list = Array.isArray(data) ? data : (data?.branches ?? data?.data ?? []);
        setBranches(list);
        if (list.length === 1) setSelectedBranch(list[0].branchCode);
      })
      .catch(() => {});
  }, []);

  const loadData = useCallback(async () => {
    if (!selectedBranch) return;
    setLoading(true);
    setError(null);
    setEdited({});
    try {
      const [itemsRes, overridesRes] = await Promise.all([
        fetch(`/api/${tenantId}/items`, { headers }),
        fetch(`/api/${tenantId}/item-branch-price?branchCode=${selectedBranch}`, { headers }),
      ]);
      const itemsData     = itemsRes.ok     ? await itemsRes.json()     : [];
      const overridesData = overridesRes.ok ? await overridesRes.json() : [];

      setItems(Array.isArray(itemsData) ? itemsData : []);

      const map = {};
      (Array.isArray(overridesData) ? overridesData : []).forEach(o => {
        map[o.itemId] = { standardPrice: o.standardPrice, taxRate: o.taxRate, id: o.id };
      });
      setOverrides(map);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [selectedBranch]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleEdit = (itemId, field, value) => {
    setEdited(prev => ({
      ...prev,
      [itemId]: { ...(prev[itemId] || {}), [field]: value === "" ? null : Number(value) },
    }));
  };

  const saveAll = async () => {
    const entries = Object.entries(edited)
      .filter(([, v]) => v.standardPrice != null)
      .map(([itemId, v]) => ({ itemId, standardPrice: v.standardPrice, taxRate: v.taxRate ?? null }));

    if (!entries.length) { setSuccess("No changes to save"); return; }

    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(`/api/${tenantId}/item-branch-price/bulk/${selectedBranch}`, {
        method: "POST", headers, body: JSON.stringify(entries),
      });
      if (!res.ok) throw new Error(`Save failed (${res.status})`);
      setSuccess(`Saved ${entries.length} price override(s)`);
      await loadData();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const deleteOverride = async (itemId) => {
    try {
      const res = await fetch(`/api/${tenantId}/item-branch-price/${itemId}/${selectedBranch}`, {
        method: "DELETE", headers,
      });
      if (!res.ok) throw new Error(`Delete failed (${res.status})`);
      await loadData();
    } catch (e) {
      setError(e.message);
    }
  };

  const filtered = items.filter(it =>
    !search || (it.itemName || "").toLowerCase().includes(search.toLowerCase()) ||
    (it.barcode || "").includes(search)
  );

  const dirtyCount = Object.keys(edited).length;

  const effectivePrice = (item) => {
    const e = edited[item.itemId];
    if (e?.standardPrice != null) return e.standardPrice;
    return overrides[item.itemId]?.standardPrice ?? null;
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h5" gutterBottom>Branch Price Overrides</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Set branch-specific prices. Branches with no override use the default item price.
      </Typography>

      {/* Filters */}
      <Paper elevation={2} sx={{ p: 2, mb: 2 }}>
        <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap", alignItems: "center" }}>
          <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel>Branch</InputLabel>
            <Select value={selectedBranch} label="Branch"
              onChange={e => { setSelectedBranch(e.target.value); setEdited({}); }}>
              {branches.map(b => (
                <MenuItem key={b.branchCode} value={b.branchCode}>
                  {b.branchCode}{b.branchName ? ` — ${b.branchName}` : ""}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <TextField
            size="small" placeholder="Search item…" value={search}
            onChange={e => setSearch(e.target.value)} sx={{ width: 220 }}
          />

          <Button
            variant="contained" startIcon={<SaveIcon />}
            onClick={saveAll} disabled={!dirtyCount || saving}
          >
            {saving ? <CircularProgress size={20} color="inherit" /> : `Save Changes${dirtyCount ? ` (${dirtyCount})` : ""}`}
          </Button>

          {dirtyCount > 0 && (
            <Button variant="outlined" onClick={() => setEdited({})}>Discard</Button>
          )}
        </Box>
      </Paper>

      {error   && <Alert severity="error"   sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>{success}</Alert>}

      {loading ? (
        <Box sx={{ textAlign: "center", py: 5 }}><CircularProgress /></Box>
      ) : (
        <Paper elevation={2}>
          <TableContainer sx={{ maxHeight: 600 }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell><strong>Item Name</strong></TableCell>
                  <TableCell><strong>Barcode</strong></TableCell>
                  <TableCell align="right"><strong>Default Price</strong></TableCell>
                  <TableCell align="right"><strong>Branch Price</strong></TableCell>
                  <TableCell align="right"><strong>Tax %</strong></TableCell>
                  <TableCell align="center"><strong>Status</strong></TableCell>
                  <TableCell align="center"><strong>Actions</strong></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filtered.map(item => {
                  const override  = overrides[item.itemId];
                  const edit      = edited[item.itemId];
                  const isDirty   = !!edit;
                  const hasOverride = !!override && !isDirty;
                  const ep = effectivePrice(item);

                  return (
                    <TableRow key={item.itemId}
                      sx={{ bgcolor: isDirty ? "#fff8e1" : hasOverride ? "#f0f7ff" : "inherit" }}>
                      <TableCell>{item.itemName}</TableCell>
                      <TableCell sx={{ color: "#666" }}>{item.barcode || "—"}</TableCell>
                      <TableCell align="right">{Number(item.standardPrice || 0).toFixed(2)}</TableCell>
                      <TableCell align="right" sx={{ minWidth: 120 }}>
                        <TextField
                          size="small" type="number" variant="outlined"
                          inputProps={{ style: { textAlign: "right", width: 90 }, min: 0, step: 0.01 }}
                          value={edit?.standardPrice ?? override?.standardPrice ?? ""}
                          placeholder={String(Number(item.standardPrice || 0).toFixed(2))}
                          onChange={e => handleEdit(item.itemId, "standardPrice", e.target.value)}
                        />
                      </TableCell>
                      <TableCell align="right" sx={{ minWidth: 100 }}>
                        <TextField
                          size="small" type="number" variant="outlined"
                          inputProps={{ style: { textAlign: "right", width: 70 }, min: 0, step: 0.01 }}
                          value={edit?.taxRate ?? override?.taxRate ?? ""}
                          placeholder={String(Number(item.taxRate || 0).toFixed(2))}
                          onChange={e => handleEdit(item.itemId, "taxRate", e.target.value)}
                        />
                      </TableCell>
                      <TableCell align="center">
                        {isDirty
                          ? <Chip label="Unsaved" size="small" color="warning" />
                          : hasOverride
                            ? <Chip label="Override" size="small" color="primary" />
                            : <Chip label="Default" size="small" variant="outlined" />
                        }
                      </TableCell>
                      <TableCell align="center">
                        {hasOverride && !isDirty && (
                          <Tooltip title="Remove override — revert to default">
                            <IconButton size="small" color="error"
                              onClick={() => deleteOverride(item.itemId)}>
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}
    </Box>
  );
};

export default BranchPricePage;
