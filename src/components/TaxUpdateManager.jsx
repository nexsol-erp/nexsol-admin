import React, { useEffect, useMemo, useState } from "react";
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  OutlinedInput,
  Paper,
  Select,
  Stack,
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
} from "@mui/material";
import { DatePicker, LocalizationProvider } from "@mui/x-date-pickers";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import dayjs from "dayjs";
import axios from "axios";

const TaxUpdateManager = () => {
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);

  // Filters
  const [taxFilterEnabled, setTaxFilterEnabled] = useState(false);
  const [taxFilterValue, setTaxFilterValue] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [search, setSearch] = useState("");

  // Bulk values
  const [bulkTaxRate, setBulkTaxRate] = useState("");
  const [bulkCessRate, setBulkCessRate] = useState("");
  const [effectiveDate, setEffectiveDate] = useState(dayjs().startOf("day"));

  // Loading & errors
  const [loading, setLoading] = useState(false);
  const [posting, setPosting] = useState(false);
  const [rowPosting, setRowPosting] = useState(null);
  const [error, setError] = useState(null);

  // Per-row edits keyed by business itemId
  const [rowEdits, setRowEdits] = useState({});

  const tenancyId = localStorage.getItem("tenancyId");
  const jwtToken = localStorage.getItem("jwtToken");

  const api = axios.create({
    headers: { Authorization: `Bearer ${jwtToken}` },
  });

  const ITEMS_ENDPOINT = `/api/${tenancyId}/items`;
  const CATEGORIES_ENDPOINT = `/api/${tenancyId}/categoriesNames`;
  const BULK_SAVE_ENDPOINT = `/api/${tenancyId}/tax-updates/bulk`;
  const PER_ITEM_SAVE_ENDPOINT = `/api/${tenancyId}/tax-updates/item`;

  const nnum = (v) => (v == null || v === "" ? 0 : Number(v));
  const toNumberOrNull = (v) => (v == null || v === "" ? null : Number(v));

  // Fetch items & categories
  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      setError(null);
      try {
        const [itemsRes, catsRes] = await Promise.all([
          api.get(ITEMS_ENDPOINT),
          api.get(CATEGORIES_ENDPOINT),
        ]);

        // Normalize items (DB PK -> id, business key -> itemId)
        const data = Array.isArray(itemsRes.data) ? itemsRes.data : [];
        setItems(
          data.map((x) => ({
            id: x.id ?? "", // DB primary key (optional, UI key)
            itemId: x.item_id ?? x.itemId ?? "", // BUSINESS ID (used in payloads)
            itemName: x.itemName ?? x.item_name ?? "",
            category: x.category ?? x.categoryName ?? "",
            taxRate: nnum(x.tax_rate ?? x.taxRate ?? x.tax),
            cessRate: nnum(x.cess_rate ?? x.cessRate ?? x.cess),
            itemCode: x.itemCode ?? x.item_code ?? "",
            barcode: x.barcode ?? "",
          }))
        );

        // Normalize categories -> { id, label, value }
        const rawCats = Array.isArray(catsRes.data) ? catsRes.data : [];
        const normalizedCats = rawCats.map((c) => {
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
        setCategories(normalizedCats);
      } catch (err) {
        console.error(err);
        setError("Failed to load items/categories.");
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Derived filtered rows (client-side)
  const filtered = useMemo(() => {
    let rows = items;

    if (taxFilterEnabled && taxFilterValue !== "") {
      const target = Number(taxFilterValue);
      if (!Number.isNaN(target)) {
        rows = rows.filter((r) => Number(r.taxRate) === target);
      }
    }

    if (categoryFilter) {
      rows = rows.filter((r) => (r.category || "") === categoryFilter);
    }

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      rows = rows.filter(
        (r) =>
          (r.itemName || "").toLowerCase().includes(q) ||
          (r.itemCode || "").toLowerCase().includes(q) ||
          (r.barcode || "").toLowerCase().includes(q)
      );
    }

    return rows;
  }, [items, taxFilterEnabled, taxFilterValue, categoryFilter, search]);

  const rowsToPayload = (rows, tax, cess) => {
    const newTax = toNumberOrNull(tax);
    const newCess = toNumberOrNull(cess);
    if (newTax == null || Number.isNaN(newTax)) throw new Error("New Tax Rate is invalid.");
    if (newCess != null && Number.isNaN(newCess)) throw new Error("New Cess Rate is invalid.");

    return rows.map((r) => ({
      itemId: r.itemId, // send BUSINESS ID
      newTaxRate: newTax,
      ...(newCess != null ? { newCessRate: newCess } : {}),
    }));
  };

  // Bulk apply to current filtered set
  const handleApplyToFiltered = async () => {
    try {
      setPosting(true);
      setError(null);

      if (!effectiveDate) throw new Error("Please choose an Applicable Date.");
      if (!filtered.length) throw new Error("No rows match the current filters.");

      const payload = {
        effectiveDate: dayjs(effectiveDate).format("YYYY-MM-DD"),
        rows: rowsToPayload(filtered, bulkTaxRate, bulkCessRate),
      };

      await api.post(BULK_SAVE_ENDPOINT, payload);
      alert(`Saved ${payload.rows.length} tax updates.`);
    } catch (e) {
      console.error(e);
      setError(e?.message || "Bulk save failed.");
    } finally {
      setPosting(false);
    }
  };

  // Bulk apply to an explicit category (ignores current filters and uses that category)
  const handleApplyToCategory = async () => {
    try {
      setPosting(true);
      setError(null);

      if (!effectiveDate) throw new Error("Please choose an Applicable Date.");
      if (!categoryFilter) throw new Error("Select a Category to apply.");

      const rowsInCategory = items.filter((r) => (r.category || "") === categoryFilter);
      if (!rowsInCategory.length) throw new Error("No items found in the selected category.");

      const payload = {
        effectiveDate: dayjs(effectiveDate).format("YYYY-MM-DD"),
        rows: rowsToPayload(rowsInCategory, bulkTaxRate, bulkCessRate),
      };

      await api.post(BULK_SAVE_ENDPOINT, payload);
      alert(`Saved ${payload.rows.length} tax updates for category "${categoryFilter}".`);
    } catch (e) {
      console.error(e);
      setError(e?.message || "Category bulk save failed.");
    } finally {
      setPosting(false);
    }
  };

  // Per-item save
  const handleApplyPerItem = async (row) => {
    const edit = rowEdits[row.itemId] || {};
    const newTax = edit.newTaxRate ?? bulkTaxRate;
    const newCess = edit.newCessRate ?? bulkCessRate;

    try {
      setRowPosting(row.itemId);
      setError(null);

      if (!effectiveDate) throw new Error("Please choose an Applicable Date.");

      const taxNum = toNumberOrNull(newTax);
      if (taxNum == null || Number.isNaN(taxNum)) {
        throw new Error("Please enter a valid New Tax Rate for this item.");
      }

      const payload = {
        itemId: row.itemId, // send BUSINESS ID
        newTaxRate: taxNum,
        effectiveDate: dayjs(effectiveDate).format("YYYY-MM-DD"),
      };

      const cessNum = toNumberOrNull(newCess);
      if (cessNum != null) {
        if (Number.isNaN(cessNum)) throw new Error("New Cess Rate is invalid for this row.");
        payload.newCessRate = cessNum;
      }

      await api.post(PER_ITEM_SAVE_ENDPOINT, payload);
      alert(`Saved tax update for ${row.itemName || row.itemId}.`);
    } catch (e) {
      console.error(e);
      setError(e?.message || "Per-item save failed.");
    } finally {
      setRowPosting(null);
    }
  };

  const setRowEdit = (itemId, key, val) => {
    setRowEdits((prev) => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        [key]: val,
      },
    }));
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <Box sx={{ p: 3 }}>
        <Typography variant="h4" gutterBottom>
          Tax Update Manager
        </Typography>

        {/* Controls */}
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

          <FormControlLabel
            control={
              <Switch
                checked={taxFilterEnabled}
                onChange={(e) => setTaxFilterEnabled(e.target.checked)}
              />
            }
            label="Filter by Current Tax ="
          />

          <TextField
            label="Current Tax ="
            type="number"
            inputProps={{ step: "0.01" }}
            value={taxFilterValue}
            onChange={(e) => setTaxFilterValue(e.target.value)}
            disabled={!taxFilterEnabled}
            sx={{ width: 160 }}
          />

          <DatePicker
            label="Applicable Date"
            value={effectiveDate}
            onChange={(v) => setEffectiveDate(v)}
            slotProps={{ textField: { sx: { width: 200 } } }}
          />
        </Stack>

        {/* Bulk inputs + Actions */}
        <Stack spacing={2} direction="row" flexWrap="wrap" alignItems="center" sx={{ mb: 2 }}>
          <TextField
            label="New Tax Rate (%)"
            type="number"
            inputProps={{ step: "0.01" }}
            value={bulkTaxRate}
            onChange={(e) => setBulkTaxRate(e.target.value)}
            sx={{ width: 200 }}
          />
          <TextField
            label="New Cess Rate (%) (optional)"
            type="number"
            inputProps={{ step: "0.01" }}
            value={bulkCessRate}
            onChange={(e) => setBulkCessRate(e.target.value)}
            sx={{ width: 240 }}
          />

          <Tooltip title="Apply to the currently filtered list">
            <span>
              <Button
                variant="contained"
                color="primary"
                onClick={handleApplyToFiltered}
                disabled={posting || loading || !filtered.length || !bulkTaxRate}
              >
                {posting ? <CircularProgress size={20} /> : "Apply to Filtered"}
              </Button>
            </span>
          </Tooltip>

          <Tooltip title="Apply to the selected Category (ignores other filters)">
            <span>
              <Button
                variant="outlined"
                color="secondary"
                onClick={handleApplyToCategory}
                disabled={posting || loading || !categoryFilter || !bulkTaxRate}
              >
                {posting ? <CircularProgress size={20} /> : "Apply to Category"}
              </Button>
            </span>
          </Tooltip>
        </Stack>

        {error && (
          <Typography color="error" sx={{ mb: 2 }}>
            {error}
          </Typography>
        )}

        {/* Main Table */}
        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Item ID</TableCell>
                <TableCell>Item Name</TableCell>
                <TableCell>Category</TableCell>
                <TableCell align="right">Current Tax %</TableCell>
                <TableCell align="right">Current Cess %</TableCell>
                <TableCell align="center">New Tax %</TableCell>
                <TableCell align="center">New Cess %</TableCell>
                <TableCell align="center">Apply</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} align="center">
                    <CircularProgress />
                  </TableCell>
                </TableRow>
              ) : filtered.length ? (
                filtered.map((row) => {
                  const edit = rowEdits[row.itemId] || {};
                  return (
                    <TableRow key={row.id || row.itemId}>
                      <TableCell>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <span>{row.itemId}</span>
                          {row.itemCode ? <Chip size="small" label={row.itemCode} /> : null}
                        </Stack>
                      </TableCell>
                      <TableCell>{row.itemName}</TableCell>
                      <TableCell>{row.category || "-"}</TableCell>
                      <TableCell align="right">{nnum(row.taxRate).toFixed(2)}</TableCell>
                      <TableCell align="right">{nnum(row.cessRate).toFixed(2)}</TableCell>

                      <TableCell align="center">
                        <TextField
                          type="number"
                          inputProps={{ step: "0.01" }}
                          placeholder={bulkTaxRate !== "" ? `Bulk: ${bulkTaxRate}` : ""}
                          value={edit.newTaxRate ?? ""}
                          onChange={(e) => setRowEdit(row.itemId, "newTaxRate", e.target.value)}
                          sx={{ width: 120 }}
                        />
                      </TableCell>

                      <TableCell align="center">
                        <TextField
                          type="number"
                          inputProps={{ step: "0.01" }}
                          placeholder={bulkCessRate !== "" ? `Bulk: ${bulkCessRate}` : "optional"}
                          value={edit.newCessRate ?? ""}
                          onChange={(e) => setRowEdit(row.itemId, "newCessRate", e.target.value)}
                          sx={{ width: 140 }}
                        />
                      </TableCell>

                      <TableCell align="center">
                        <Button
                          variant="contained"
                          size="small"
                          onClick={() => handleApplyPerItem(row)}
                          disabled={!!rowPosting || !effectiveDate}
                        >
                          {rowPosting === row.itemId ? <CircularProgress size={18} /> : "Save"}
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={8} align="center">
                    No items to display.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>

        <Box sx={{ mt: 2, display: "flex", gap: 2, alignItems: "center" }}>
          <Typography variant="body2" color="text.secondary">
            Saving writes to a separate tax-update table (backend inserts), leaving <code>item_mst</code> unchanged.
          </Typography>
        </Box>
      </Box>
    </LocalizationProvider>
  );
};

export default TaxUpdateManager;
