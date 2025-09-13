import React, { useEffect, useState } from "react";
import {
  Box,
  Button,
  CircularProgress,
  FormControl,
  InputLabel,
  MenuItem,
  OutlinedInput,
  Paper,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Snackbar,
  Alert,
} from "@mui/material";
import { DatePicker, LocalizationProvider } from "@mui/x-date-pickers";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import dayjs from "dayjs";
import axios from "axios";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";

/**
 * Shows server-side preview (item_mst ⨝ item_tax_updates) and exports/applies to server.
 * Displays both current and proposed rates for the selected effective date.
 */
const TaxUpdatePreview = () => {
  const [categories, setCategories] = useState([]);

  // Filters
  const [categoryFilter, setCategoryFilter] = useState("");
  const [taxFilterEnabled] = useState(false); // kept for payload compatibility
  const [taxFilterValue, setTaxFilterValue] = useState("");
  const [search, setSearch] = useState("");
  const [limit, setLimit] = useState(200);
  const [effectiveDate, setEffectiveDate] = useState(dayjs().startOf("day"));

  // Data
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [preview, setPreview] = useState(null); // { count, limited, items: [...] }

  // Apply flow
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [applying, setApplying] = useState(false);
  const [toast, setToast] = useState({ open: false, msg: "", sev: "success" });

  const tenancyId = localStorage.getItem("tenancyId");
  const jwtToken = localStorage.getItem("jwtToken");

  const api = axios.create({
    headers: { Authorization: `Bearer ${jwtToken}` },
  });

  const CATEGORIES_ENDPOINT = `/api/${tenancyId}/categoriesNames`;
  const PREVIEW_ENDPOINT = `/api/${tenancyId}/tax-updates/preview`;
  const APPLY_ENDPOINT = `/api/${tenancyId}/tax-updates/apply`;

  const nnum = (v) => (v == null || v === "" ? 0 : Number(v));

  // Fetch categories only
  useEffect(() => {
    const fetchCats = async () => {
      try {
        const res = await api.get(CATEGORIES_ENDPOINT);
        const rawCats = Array.isArray(res.data) ? res.data : [];
        const normalized = rawCats.map((c) => {
          if (typeof c === "string") return { id: c, label: c, value: c };
          const id =
            c.id ??
            c.categoryId ??
            c.category_id ??
            c.categoryName ??
            c.category_type ??
            "cat";
          const label =
            c.categoryName ??
            c.category ??
            c.categoryType ??
            c.category_type ??
            String(id);
          return { id: String(id), label: String(label), value: String(label) };
        });
        setCategories(normalized);
      } catch (e) {
        console.error(e);
        setCategories([]);
      }
    };
    fetchCats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadPreview = async () => {
    try {
      setLoading(true);
      setError(null);
      const payload = {
        category: categoryFilter || null,
        currentTaxEquals:
          taxFilterEnabled && taxFilterValue !== "" ? Number(taxFilterValue) : null,
        search: search || null,
        limit: Number(limit) || 200,
        effectiveDate: effectiveDate ? dayjs(effectiveDate).format("YYYY-MM-DD") : null,
      };
      const res = await api.post(PREVIEW_ENDPOINT, payload);
      setPreview(res.data || null);
    } catch (e) {
      console.error(e);
      setError("Failed to load preview.");
      setPreview(null);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    if (!preview || !Array.isArray(preview.items) || preview.items.length === 0) return;
    const eff = effectiveDate ? dayjs(effectiveDate).format("YYYY-MM-DD") : "no-date";
    const rows = preview.items.map((r) => ({
      "Item ID": r.itemId ?? r.id ?? "",
      "Item Name": r.itemName ?? "",
      Categories: r.categories ?? r.category ?? r.categoryName ?? "-",
      "Current Tax %": nnum(r.currentTaxRate),
      "Current Cess %": nnum(r.currentCessRate),
      "Proposed Tax %": r.proposedTaxRate != null ? nnum(r.proposedTaxRate) : null,
      "Proposed Cess %": r.proposedCessRate != null ? nnum(r.proposedCessRate) : null,
      "Item Code": r.itemCode ?? "",
      Barcode: r.barcode ?? "",
      "Effective Date": eff,
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Tax Preview");
    const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
    const blob = new Blob([excelBuffer], { type: "application/octet-stream" });
    const fname = `Tax_Preview_${eff}${categoryFilter ? `_${categoryFilter}` : ""}.xlsx`;
    saveAs(blob, fname);
  };

  // Build apply payload from preview
  const buildApplyPayload = () => {
    const eff = effectiveDate ? dayjs(effectiveDate).format("YYYY-MM-DD") : null;
    if (!preview || !Array.isArray(preview.items) || preview.items.length === 0 || !eff) {
      return null;
    }
    // Only include items that actually have any proposed change
    const items = preview.items
      .map((r) => ({
        itemId: r.itemId ?? r.id,
        proposedTaxRate: r.proposedTaxRate,
        proposedCessRate: r.proposedCessRate,
      }))
      .filter(
        (x) =>
          x.itemId != null &&
          (x.proposedTaxRate != null || x.proposedCessRate != null)
      );

    return {
      effectiveDate: eff,
      items,
      // Optional: include filters for auditing at server side
      meta: {
        category: categoryFilter || null,
        search: search || null,
        limit: Number(limit) || 200,
      },
    };
  };

  const handleApply = async () => {
    const payload = buildApplyPayload();
    if (!payload || payload.items.length === 0) {
      setToast({
        open: true,
        msg: "Nothing to apply. No proposed changes found.",
        sev: "error",
      });
      setConfirmOpen(false);
      return;
    }
    try {
      setApplying(true);
      const res = await api.post(APPLY_ENDPOINT, payload);
      setToast({
        open: true,
        msg:
          (res && res.data && res.data.message) ||
          `Applied ${payload.items.length} change(s) for ${payload.effectiveDate}.`,
        sev: "success",
      });
      // Optional: refresh the preview after apply
      await loadPreview();
    } catch (e) {
      console.error(e);
      const msg =
        (e && e.response && e.response.data && e.response.data.message) ||
        e?.message ||
        "Failed to apply tax updates.";
      setToast({ open: true, msg, sev: "error" });
    } finally {
      setApplying(false);
      setConfirmOpen(false);
    }
  };

  const applyDisabled =
    !preview || !Array.isArray(preview.items) || preview.items.length === 0 || loading;

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <Box sx={{ p: 3 }}>
        <Typography variant="h4" gutterBottom>
          Tax Update Preview
        </Typography>

        {/* Filters */}
        <Stack spacing={2} direction="row" flexWrap="wrap" alignItems="center" sx={{ mb: 2 }}>
          <TextField
            label="Search (Name/Code/Barcode)"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            sx={{ minWidth: 300 }}
          />

          <FormControl sx={{ minWidth: 220 }}>
            <InputLabel id="category-select-label">Category</InputLabel>
            <Select
              labelId="category-select-label"
              label="Category"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              input={<OutlinedInput label="Category" />}
            >
              <MenuItem value="">
                <em>All</em>
              </MenuItem>
              {categories.map((c) => (
                <MenuItem key={c.id} value={c.value}>
                  {c.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <TextField
            label="Filter Current Tax ="
            type="number"
            inputProps={{ step: "0.01" }}
            value={taxFilterValue}
            onChange={(e) => setTaxFilterValue(e.target.value)}
            sx={{ width: 180 }}
          />

          <DatePicker
            label="Effective Date"
            value={effectiveDate}
            onChange={(v) => setEffectiveDate(v)}
            slotProps={{ textField: { sx: { width: 200 } } }}
          />

          <TextField
            label="Limit"
            type="number"
            inputProps={{ min: 1 }}
            value={limit}
            onChange={(e) => setLimit(e.target.value)}
            sx={{ width: 120 }}
          />

          <Button variant="contained" onClick={loadPreview} disabled={loading}>
            {loading ? <CircularProgress size={20} /> : "Load Preview"}
          </Button>

          <Button
            variant="outlined"
            onClick={handleExport}
            disabled={!preview || !preview.items || preview.items.length === 0}
          >
            Export to Excel
          </Button>

          <Button
            color="success"
            variant="contained"
            onClick={() => setConfirmOpen(true)}
            disabled={applyDisabled || applying}
          >
            {applying ? <CircularProgress size={20} /> : "Apply Changes"}
          </Button>
        </Stack>

        {error && (
          <Typography color="error" sx={{ mb: 2 }}>
            {error}
          </Typography>
        )}

        {/* Preview Table */}
        <Paper variant="outlined">
          <TableContainer sx={{ maxHeight: 480 }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell>Item ID</TableCell>
                  <TableCell>Item Name</TableCell>
                  <TableCell>Categories</TableCell>
                  <TableCell align="right">Current Tax %</TableCell>
                  <TableCell align="right">Current Cess %</TableCell>
                  <TableCell align="right">Proposed Tax %</TableCell>
                  <TableCell align="right">Proposed Cess %</TableCell>
                  <TableCell>Code</TableCell>
                  <TableCell>Barcode</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {!preview || !Array.isArray(preview.items) ? (
                  <TableRow>
                    <TableCell colSpan={9} align="center">
                      {loading ? <CircularProgress /> : "No data"}
                    </TableCell>
                  </TableRow>
                ) : preview.items.length ? (
                  preview.items.map((r) => {
                    const pid = r.itemId ?? r.id ?? "";
                    const cats = r.categories ?? r.category ?? r.categoryName ?? "-";
                    return (
                      <TableRow key={pid || Math.random()}>
                        <TableCell>{pid}</TableCell>
                        <TableCell>{r.itemName}</TableCell>
                        <TableCell>{cats}</TableCell>
                        <TableCell align="right">{nnum(r.currentTaxRate).toFixed(2)}</TableCell>
                        <TableCell align="right">{nnum(r.currentCessRate).toFixed(2)}</TableCell>
                        <TableCell align="right">
                          {r.proposedTaxRate != null ? nnum(r.proposedTaxRate).toFixed(2) : "-"}
                        </TableCell>
                        <TableCell align="right">
                          {r.proposedCessRate != null ? nnum(r.proposedCessRate).toFixed(2) : "-"}
                        </TableCell>
                        <TableCell>{r.itemCode || "-"}</TableCell>
                        <TableCell>{r.barcode || "-"}</TableCell>
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={9} align="center">
                      No matching items in preview.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>

          {preview && (
            <Box sx={{ p: 1.5 }}>
              <Typography variant="body2" color="text.secondary">
                Total matches: <strong>{preview.count ?? (preview.items?.length ?? 0)}</strong>
                {preview.limited ? " (showing first batch)" : ""}.
              </Typography>
            </Box>
          )}
        </Paper>

        {/* Confirm Apply Dialog */}
        <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)} fullWidth maxWidth="sm">
          <DialogTitle>Apply Tax/Cess Changes</DialogTitle>
          <DialogContent>
            <DialogContentText>
              This will apply the proposed tax/cess rates for{" "}
              <strong>{effectiveDate ? dayjs(effectiveDate).format("YYYY-MM-DD") : "-"}</strong>.
              Only rows with proposed values will be sent. Do you want to proceed?
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setConfirmOpen(false)} disabled={applying}>
              Cancel
            </Button>
            <Button onClick={handleApply} color="success" variant="contained" disabled={applying}>
              {applying ? <CircularProgress size={20} /> : "Yes, Apply"}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Toast */}
        <Snackbar
          open={toast.open}
          autoHideDuration={4000}
          onClose={() => setToast((t) => ({ ...t, open: false }))}
          anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
        >
          <Alert
            onClose={() => setToast((t) => ({ ...t, open: false }))}
            severity={toast.sev}
            variant="filled"
            sx={{ width: "100%" }}
          >
            {toast.msg}
          </Alert>
        </Snackbar>
      </Box>
    </LocalizationProvider>
  );
};

export default TaxUpdatePreview;
