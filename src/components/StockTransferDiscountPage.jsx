import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  FormHelperText,
  FormLabel,
  IconButton,
  InputAdornment,
  MenuItem,
  Paper,
  Radio,
  RadioGroup,
  Select,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import EditIcon from "@mui/icons-material/Edit";
import BlockIcon from "@mui/icons-material/Block";

const EMPTY_FORM = {
  item_id: "",
  item_name: "",
  branch_id: "",
  discount_type: "percent",
  discount_percent: "",
  rate: "",
  effective_from: new Date().toISOString().slice(0, 10),
  effective_to: "",
  remarks: "",
};

export default function StockTransferDiscountPage() {
  const tenantId = localStorage.getItem("tenancyId") || "";
  const token    = localStorage.getItem("jwtToken")  || "";
  const headers  = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  const [rows, setRows]           = useState([]);
  const [branches, setBranches]   = useState([]);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState(null);
  const [success, setSuccess]     = useState(null);

  const [filterActive,  setFilterActive]  = useState("all");
  const [filterBranch,  setFilterBranch]  = useState("");
  const [filterSearch,  setFilterSearch]  = useState("");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId,     setEditId]     = useState(null);
  const [form,       setForm]       = useState(EMPTY_FORM);
  const [formError,  setFormError]  = useState("");
  const [saving,     setSaving]     = useState(false);

  const [itemSearch,      setItemSearch]      = useState("");
  const [itemSuggestions, setItemSuggestions] = useState([]);
  const [searchingItems,  setSearchingItems]  = useState(false);
  const itemDebounce = useRef(null);

  const fetchDiscounts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res  = await fetch(`/api/${tenantId}/stock-transfer-discounts`, { headers });
      const data = res.ok ? await res.json() : [];
      setRows(Array.isArray(data) ? data : []);
    } catch {
      setError("Failed to load discounts.");
    } finally {
      setLoading(false);
    }
  }, [tenantId, token]);

  useEffect(() => {
    fetch(`/api/${tenantId}/branches`, { headers })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        const list = Array.isArray(data) ? data : (data?.branches ?? data?.data ?? []);
        setBranches(list);
      })
      .catch(() => {});
  }, [tenantId, token]);

  useEffect(() => { fetchDiscounts(); }, [fetchDiscounts]);

  useEffect(() => {
    if (success) {
      const t = setTimeout(() => setSuccess(null), 3000);
      return () => clearTimeout(t);
    }
  }, [success]);

  const searchItems = (q) => {
    if (!q.trim()) { setItemSuggestions([]); return; }
    clearTimeout(itemDebounce.current);
    itemDebounce.current = setTimeout(async () => {
      setSearchingItems(true);
      try {
        const params = new URLSearchParams({ q, page: 0, size: 20 });
        const res  = await fetch(`/api/${tenantId}/items/search?${params}`, { headers });
        const data = res.ok ? await res.json() : null;
        setItemSuggestions(data?.content ?? []);
      } catch {
        setItemSuggestions([]);
      } finally {
        setSearchingItems(false);
      }
    }, 300);
  };

  const pickItem = (itm) => {
    setForm(f => ({ ...f, item_id: itm.itemId, item_name: itm.itemName || "" }));
    setItemSearch(itm.itemName || "");
    setItemSuggestions([]);
  };

  const openAdd = () => {
    setEditId(null);
    setForm(EMPTY_FORM);
    setItemSearch("");
    setItemSuggestions([]);
    setFormError("");
    setDialogOpen(true);
  };

  // Backend returns camelCase: itemId, itemName, branchId, discountPercent, effectiveFrom, effectiveTo
  const openEdit = (row) => {
    setEditId(row.id);
    setForm({
      item_id:          row.itemId  || "",
      item_name:        row.itemName || "",
      branch_id:        row.branchId || "",
      discount_type:    row.discountPercent != null ? "percent" : "rate",
      discount_percent: row.discountPercent != null ? String(row.discountPercent) : "",
      rate:             row.rate            != null ? String(row.rate)            : "",
      effective_from:   row.effectiveFrom   ? row.effectiveFrom.slice(0, 10)     : "",
      effective_to:     row.effectiveTo     ? row.effectiveTo.slice(0, 10)       : "",
      remarks:          row.remarks || "",
    });
    setItemSearch(row.itemName || row.itemId || "");
    setItemSuggestions([]);
    setFormError("");
    setDialogOpen(true);
  };

  // Backend entity expects camelCase field names
  const buildPayload = () => {
    const payload = {
      itemId:        form.item_id,
      itemName:      form.item_name,
      branchId:      form.branch_id || null,
      effectiveFrom: form.effective_from,
      effectiveTo:   form.effective_to || null,
      remarks:       form.remarks || null,
    };
    if (form.discount_type === "percent") {
      payload.discountPercent = parseFloat(form.discount_percent);
      payload.rate            = null;
    } else {
      payload.rate            = parseFloat(form.rate);
      payload.discountPercent = null;
    }
    return payload;
  };

  const validateForm = () => {
    if (!form.item_id) return "Please select an item.";
    if (!form.effective_from) return "Effective From is required.";
    if (form.discount_type === "percent") {
      const v = parseFloat(form.discount_percent);
      if (isNaN(v) || v < 0 || v > 100) return "Discount % must be between 0 and 100.";
    } else {
      const v = parseFloat(form.rate);
      if (isNaN(v) || v < 0) return "Rate cannot be negative.";
    }
    if (form.effective_to && form.effective_from > form.effective_to)
      return "Effective To cannot be before Effective From.";
    return null;
  };

  const handleSave = async () => {
    const err = validateForm();
    if (err) { setFormError(err); return; }
    setSaving(true);
    setFormError("");
    try {
      const url    = editId
        ? `/api/${tenantId}/stock-transfer-discounts/${editId}`
        : `/api/${tenantId}/stock-transfer-discounts`;
      const method = editId ? "PUT" : "POST";
      const res    = await fetch(url, { method, headers, body: JSON.stringify(buildPayload()) });
      if (!res.ok) {
        const msg = await res.text().catch(() => "");
        setFormError(msg || "Save failed.");
        return;
      }
      setSuccess(editId ? "Discount updated." : "Discount created.");
      setDialogOpen(false);
      fetchDiscounts();
    } catch {
      setFormError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async (id) => {
    if (!window.confirm("Deactivate this discount?")) return;
    try {
      const res = await fetch(
        `/api/${tenantId}/stock-transfer-discounts/${id}/deactivate`,
        { method: "PATCH", headers }
      );
      if (res.ok) { setSuccess("Discount deactivated."); fetchDiscounts(); }
    } catch {
      setError("Deactivate failed.");
    }
  };

  // Filter uses camelCase keys returned by backend
  const displayed = rows.filter(r => {
    if (filterActive === "active"   && !r.active) return false;
    if (filterActive === "inactive" &&  r.active) return false;
    if (filterBranch && r.branchId !== filterBranch) return false;
    if (filterSearch) {
      const q = filterSearch.toLowerCase();
      if (
        !String(r.itemName || "").toLowerCase().includes(q) &&
        !String(r.itemId   || "").toLowerCase().includes(q)
      ) return false;
    }
    return true;
  });

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h5" fontWeight="bold" mb={2} sx={{ color: "#1a237e" }}>
        Stock Transfer Discount Master
      </Typography>

      {error   && <Alert severity="error"   sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}

      {/* Filters + Add */}
      <Box sx={{ display: "flex", gap: 2, mb: 2, flexWrap: "wrap", alignItems: "center" }}>
        <TextField
          size="small"
          placeholder="Search item…"
          value={filterSearch}
          onChange={e => setFilterSearch(e.target.value)}
          InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small"/></InputAdornment> }}
          sx={{ width: 220 }}
        />

        <FormControl size="small" sx={{ width: 160 }}>
          <Select value={filterBranch} onChange={e => setFilterBranch(e.target.value)} displayEmpty>
            <MenuItem value="">All Branches</MenuItem>
            {branches.map(b => (
              <MenuItem key={b.branchCode} value={b.branchCode}>{b.branchCode}</MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl size="small" sx={{ width: 130 }}>
          <Select value={filterActive} onChange={e => setFilterActive(e.target.value)}>
            <MenuItem value="all">All Status</MenuItem>
            <MenuItem value="active">Active</MenuItem>
            <MenuItem value="inactive">Inactive</MenuItem>
          </Select>
        </FormControl>

        <Button variant="contained" onClick={openAdd} sx={{ ml: "auto" }}>
          + Add Discount
        </Button>
      </Box>

      {/* Table */}
      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", mt: 4 }}><CircularProgress /></Box>
      ) : (
        <TableContainer component={Paper} elevation={2}>
          <Table size="small">
            <TableHead sx={{ background: "#1976d2" }}>
              <TableRow>
                {["Item", "Branch", "Disc %", "Rate", "Effective From", "Effective To", "Status", "Remarks"].map(h => (
                  <TableCell key={h} sx={{ color: "#fff", fontWeight: 700 }}>{h}</TableCell>
                ))}
                <TableCell align="center" sx={{ color: "#fff", fontWeight: 700 }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {displayed.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} align="center" sx={{ color: "#888", py: 3 }}>
                    No discount records found.
                  </TableCell>
                </TableRow>
              )}
              {displayed.map(row => (
                <TableRow key={row.id} hover>
                  <TableCell>
                    <Typography variant="body2" fontWeight={600} sx={{ color: "#212121" }}>
                      {row.itemName || row.itemId}
                    </Typography>
                    {row.itemName && (
                      <Typography variant="caption" sx={{ color: "#666" }}>{row.itemId}</Typography>
                    )}
                  </TableCell>
                  <TableCell sx={{ color: "#333" }}>
                    {row.branchId || <em style={{ color: "#888" }}>Company-wide</em>}
                  </TableCell>
                  <TableCell sx={{ color: "#333" }}>
                    {row.discountPercent != null ? `${row.discountPercent}%` : "—"}
                  </TableCell>
                  <TableCell sx={{ color: "#333" }}>
                    {row.rate != null ? Number(row.rate).toFixed(2) : "—"}
                  </TableCell>
                  <TableCell sx={{ color: "#333" }}>{row.effectiveFrom?.slice(0, 10) || ""}</TableCell>
                  <TableCell sx={{ color: "#333" }}>{row.effectiveTo?.slice(0, 10)   || "—"}</TableCell>
                  <TableCell>
                    <Chip
                      label={row.active ? "Active" : "Inactive"}
                      color={row.active ? "success" : "default"}
                      size="small"
                    />
                  </TableCell>
                  <TableCell sx={{ maxWidth: 160 }}>
                    <Tooltip title={row.remarks || ""}>
                      <Typography variant="body2" noWrap sx={{ color: "#333" }}>{row.remarks || "—"}</Typography>
                    </Tooltip>
                  </TableCell>
                  <TableCell align="center">
                    <Tooltip title="Edit">
                      <IconButton size="small" onClick={() => openEdit(row)}>
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    {row.active && (
                      <Tooltip title="Deactivate">
                        <IconButton size="small" color="warning" onClick={() => handleDeactivate(row.id)}>
                          <BlockIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Add / Edit Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ color: "#1a237e", fontWeight: 700 }}>
          {editId ? "Edit Discount" : "Add Stock Transfer Discount"}
        </DialogTitle>
        <DialogContent dividers sx={{ bgcolor: "#fafafa" }}>
          {formError && <Alert severity="error" sx={{ mb: 2 }}>{formError}</Alert>}

          {/* Item search */}
          <Box sx={{ position: "relative", mb: 2 }}>
            <TextField
              label="Item Search"
              fullWidth size="small"
              value={itemSearch}
              onChange={e => {
                setItemSearch(e.target.value);
                searchItems(e.target.value);
                if (!e.target.value) setForm(f => ({ ...f, item_id: "", item_name: "" }));
              }}
              InputProps={{
                endAdornment: searchingItems
                  ? <InputAdornment position="end"><CircularProgress size={16}/></InputAdornment>
                  : null,
                style: { color: "#212121", backgroundColor: "#fff" },
              }}
              InputLabelProps={{ style: { color: "#555" } }}
              helperText={form.item_id ? `Selected: ${form.item_id}` : "Type item name or code"}
            />
            {itemSuggestions.length > 0 && (
              <Paper
                elevation={6}
                sx={{
                  position: "absolute", top: "100%", left: 0, right: 0,
                  zIndex: 1300, maxHeight: 220, overflowY: "auto",
                  bgcolor: "#ffffff", border: "1px solid #ddd",
                }}
              >
                {itemSuggestions.map(itm => (
                  <Box
                    key={itm.itemId}
                    onClick={() => pickItem(itm)}
                    sx={{
                      px: 2, py: 1, cursor: "pointer",
                      borderBottom: "1px solid #f0f0f0",
                      bgcolor: "#fff",
                      "&:hover": { bgcolor: "#e3f2fd" },
                    }}
                  >
                    <Typography variant="body2" fontWeight={600} sx={{ color: "#212121" }}>
                      {itm.itemName}
                    </Typography>
                    <Typography variant="caption" sx={{ color: "#666" }}>
                      {itm.itemId}
                    </Typography>
                  </Box>
                ))}
              </Paper>
            )}
          </Box>

          {/* Branch */}
          <FormControl fullWidth size="small" sx={{ mb: 2 }}>
            <FormLabel sx={{ fontSize: 12, mb: 0.5, color: "#555" }}>
              Branch (leave blank for company-wide)
            </FormLabel>
            <Select
              value={form.branch_id}
              onChange={e => setForm(f => ({ ...f, branch_id: e.target.value }))}
              displayEmpty
              sx={{ bgcolor: "#fff", color: "#212121" }}
            >
              <MenuItem value="">Company-wide</MenuItem>
              {branches.map(b => (
                <MenuItem key={b.branchCode} value={b.branchCode}>
                  {b.branchCode}{b.branchName ? ` — ${b.branchName}` : ""}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Discount type */}
          <FormControl component="fieldset" sx={{ mb: 1 }}>
            <FormLabel component="legend" sx={{ fontSize: 12, color: "#555" }}>Discount Type</FormLabel>
            <RadioGroup
              row
              value={form.discount_type}
              onChange={e => setForm(f => ({ ...f, discount_type: e.target.value, discount_percent: "", rate: "" }))}
            >
              <FormControlLabel value="percent" control={<Radio size="small"/>} label={<span style={{ color: "#212121" }}>Discount %</span>} />
              <FormControlLabel value="rate"    control={<Radio size="small"/>} label={<span style={{ color: "#212121" }}>Fixed Rate</span>}  />
            </RadioGroup>
            <FormHelperText sx={{ color: "#777" }}>Only one can be entered.</FormHelperText>
          </FormControl>

          {form.discount_type === "percent" ? (
            <TextField
              label="Discount %"
              type="number"
              fullWidth size="small"
              sx={{ mb: 2 }}
              value={form.discount_percent}
              onChange={e => setForm(f => ({ ...f, discount_percent: e.target.value }))}
              inputProps={{ min: 0, max: 100, step: 0.01 }}
              InputProps={{
                endAdornment: <InputAdornment position="end">%</InputAdornment>,
                style: { color: "#212121", backgroundColor: "#fff" },
              }}
              InputLabelProps={{ style: { color: "#555" } }}
            />
          ) : (
            <TextField
              label="Transfer Rate"
              type="number"
              fullWidth size="small"
              sx={{ mb: 2 }}
              value={form.rate}
              onChange={e => setForm(f => ({ ...f, rate: e.target.value }))}
              inputProps={{ min: 0, step: 0.01 }}
              InputProps={{ style: { color: "#212121", backgroundColor: "#fff" } }}
              InputLabelProps={{ style: { color: "#555" } }}
            />
          )}

          <Box sx={{ display: "flex", gap: 2, mb: 2 }}>
            <TextField
              label="Effective From"
              type="date"
              fullWidth size="small"
              value={form.effective_from}
              onChange={e => setForm(f => ({ ...f, effective_from: e.target.value }))}
              InputLabelProps={{ shrink: true, style: { color: "#555" } }}
              InputProps={{ style: { color: "#212121", backgroundColor: "#fff" } }}
            />
            <TextField
              label="Effective To"
              type="date"
              fullWidth size="small"
              value={form.effective_to}
              onChange={e => setForm(f => ({ ...f, effective_to: e.target.value }))}
              InputLabelProps={{ shrink: true, style: { color: "#555" } }}
              InputProps={{ style: { color: "#212121", backgroundColor: "#fff" } }}
              helperText={<span style={{ color: "#777" }}>Leave blank = no end date</span>}
            />
          </Box>

          <TextField
            label="Remarks"
            fullWidth size="small"
            multiline rows={2}
            value={form.remarks}
            onChange={e => setForm(f => ({ ...f, remarks: e.target.value }))}
            InputProps={{ style: { color: "#212121", backgroundColor: "#fff" } }}
            InputLabelProps={{ style: { color: "#555" } }}
          />
        </DialogContent>
        <DialogActions sx={{ bgcolor: "#f5f5f5" }}>
          <Button onClick={() => setDialogOpen(false)} disabled={saving} sx={{ color: "#555" }}>
            Cancel
          </Button>
          <Button variant="contained" onClick={handleSave} disabled={saving}>
            {saving ? <CircularProgress size={18} /> : editId ? "Update" : "Save"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
