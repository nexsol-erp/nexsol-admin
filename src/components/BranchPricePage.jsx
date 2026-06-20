import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  Box, Button, CircularProgress, FormControl, InputLabel, MenuItem,
  Paper, Select, Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, TextField, Typography, Alert, Chip, Tooltip, IconButton,
  InputAdornment,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import SaveIcon from "@mui/icons-material/Save";
import SearchIcon from "@mui/icons-material/Search";

const PAGE_SIZE = 10;
const SEARCH_SIZE = 200; // fetch a wider net when the user is actively searching

const BranchPricePage = () => {
  const tenantId = localStorage.getItem("tenancyId") || "";
  const token    = localStorage.getItem("jwtToken")  || "";
  const headers  = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  const [branches, setBranches]             = useState([]);
  const [selectedBranch, setSelectedBranch] = useState("");
  const [items, setItems]                   = useState([]);
  const [totalItems, setTotalItems]         = useState(0);
  const [overrides, setOverrides]           = useState({});
  const [edited, setEdited]                 = useState({});
  const [loading, setLoading]               = useState(false);
  const [saving, setSaving]                 = useState(false);
  const [error, setError]                   = useState(null);
  const [success, setSuccess]               = useState(null);
  const [search, setSearch]                 = useState("");

  const debounceRef = useRef(null);

  const allowedBranches = (() => {
    try {
      const raw = localStorage.getItem("allowedBranches");
      const list = raw ? JSON.parse(raw) : [];
      return Array.isArray(list) ? list : [];
    } catch { return []; }
  })();

  // Load branches once, filtered to allowed list
  useEffect(() => {
    fetch(`/api/${tenantId}/branches`, { headers })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        const list = Array.isArray(data) ? data : (data?.branches ?? data?.data ?? []);
        const filtered = allowedBranches.length
          ? list.filter(b => allowedBranches.includes(b.branchCode))
          : list;
        setBranches(filtered);
        if (filtered.length === 1) setSelectedBranch(filtered[0].branchCode);
      })
      .catch(() => {});
  }, []);

  // Load branch overrides — lightweight, just price entries
  const loadOverrides = useCallback(async (branch) => {
    if (!branch) return;
    try {
      const res = await fetch(`/api/${tenantId}/item-branch-price?branchCode=${branch}`, { headers });
      const data = res.ok ? await res.json() : [];
      const map = {};
      (Array.isArray(data) ? data : []).forEach(o => {
        map[o.itemId] = { standardPrice: o.standardPrice, taxRate: o.taxRate, id: o.id };
      });
      setOverrides(map);
    } catch {
      setOverrides({});
    }
  }, [tenantId, token]);

  // Load items from paginated search endpoint.
  // Results are re-sorted client-side so exact/starts-with matches surface before
  // "contains" matches (e.g. searching "COFFEE" shows the item named "COFFEE" before
  // "AMUL COFFEE CUP" even though both contain the keyword).
  const loadItems = useCallback(async (q) => {
    setLoading(true);
    try {
      const trimmed = q.trim();
      const params = new URLSearchParams({ q: trimmed, page: 0, size: trimmed ? SEARCH_SIZE : PAGE_SIZE });
      const res = await fetch(`/api/${tenantId}/items/search?${params}`, { headers });
      const data = res.ok ? await res.json() : null;
      const content = data?.content ?? [];
      if (trimmed) {
        const lower = trimmed.toLowerCase();
        const rank = (name) => {
          const n = (name || "").toLowerCase();
          if (n === lower) return 0;
          if (n.startsWith(lower)) return 1;
          return 2;
        };
        content.sort((a, b) => rank(a.itemName) - rank(b.itemName));
      }
      setItems(content);
      setTotalItems(data?.totalElements ?? 0);
    } catch {
      setItems([]);
      setTotalItems(0);
    } finally {
      setLoading(false);
    }
  }, [tenantId, token]);

  // When branch changes — reload overrides + first page of items
  useEffect(() => {
    if (!selectedBranch) return;
    setEdited({});
    setSearch("");
    loadOverrides(selectedBranch);
    loadItems("");
  }, [selectedBranch]);

  // Debounced search
  const handleSearchChange = (e) => {
    const val = e.target.value;
    setSearch(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => loadItems(val), 350);
  };

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
      setEdited({});
      await loadOverrides(selectedBranch);
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
      await loadOverrides(selectedBranch);
    } catch (e) {
      setError(e.message);
    }
  };

  const dirtyCount = Object.keys(edited).length;

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
            size="small"
            placeholder="Search by name or barcode…"
            value={search}
            onChange={handleSearchChange}
            sx={{ width: 260 }}
            disabled={!selectedBranch}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" color="action" />
                </InputAdornment>
              ),
            }}
          />

          <Button
            variant="contained" startIcon={<SaveIcon />}
            onClick={saveAll} disabled={!dirtyCount || saving}
          >
            {saving
              ? <CircularProgress size={20} color="inherit" />
              : `Save Changes${dirtyCount ? ` (${dirtyCount})` : ""}`}
          </Button>

          {dirtyCount > 0 && (
            <Button variant="outlined" onClick={() => setEdited({})}>Discard</Button>
          )}
        </Box>
      </Paper>

      {error   && <Alert severity="error"   sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>{success}</Alert>}

      {!selectedBranch ? (
        <Typography color="text.secondary" sx={{ py: 4, textAlign: "center" }}>
          Select a branch to view and edit prices.
        </Typography>
      ) : loading ? (
        <Box sx={{ textAlign: "center", py: 5 }}><CircularProgress /></Box>
      ) : (
        <>
          {totalItems > 0 && (
            <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: "block" }}>
              Showing {items.length} of {totalItems} items
              {totalItems > PAGE_SIZE && !search && " — use search to find more"}
            </Typography>
          )}
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
                  {items.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} align="center" sx={{ py: 4, color: "text.secondary" }}>
                        {search ? `No items found for "${search}"` : "No items found"}
                      </TableCell>
                    </TableRow>
                  ) : items.map(item => {
                    const override    = overrides[item.itemId];
                    const edit        = edited[item.itemId];
                    const isDirty     = !!edit;
                    const hasOverride = !!override && !isDirty;

                    return (
                      <TableRow key={item.itemId}
                        sx={{
                          bgcolor: isDirty
                            ? "#FDE68A"
                            : hasOverride
                              ? "#BFDBFE"
                              : "inherit",
                          "& .MuiTableCell-root": {
                            color: (isDirty || hasOverride) ? "#1a1a1a" : "inherit",
                          },
                          "& .MuiInputBase-input": {
                            color: (isDirty || hasOverride) ? "#1a1a1a" : "inherit",
                          },
                        }}>
                        <TableCell>{item.itemName}</TableCell>
                        <TableCell>{item.barcode || "—"}</TableCell>
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
        </>
      )}
    </Box>
  );
};

export default BranchPricePage;
