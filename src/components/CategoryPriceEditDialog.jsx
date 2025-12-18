import React, { useEffect, useMemo, useState } from "react";
import {
  Container,
  Paper,
  Typography,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Button,
  Alert,
  CircularProgress,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  TableContainer,
  Stack,
} from "@mui/material";
import SaveIcon from "@mui/icons-material/Save";

const money = (v) => {
  if (v === null || v === undefined || v === "") return "";
  const n = Number(v);
  return Number.isFinite(n) ? n.toFixed(2) : "";
};

const calcDiscounted = (standardPrice, discountPercent) => {
  const sp = Number(standardPrice);
  const dp = Number(discountPercent);
  if (!Number.isFinite(sp) || sp < 0) return "";
  if (!Number.isFinite(dp) || dp < 0) return money(sp);
  const discounted = sp - (sp * dp) / 100;
  return money(Math.max(0, discounted));
};

async function safeError(res) {
  try {
    const data = await res.json();
    return data?.errorMessage || data?.message || `${res.status} ${res.statusText}`;
  } catch {
    return `${res.status} ${res.statusText}`;
  }
}

export default function CategoryPriceEditorPage() {
  const tenancyId = localStorage.getItem("tenancyId");
  const token = localStorage.getItem("jwtToken");

  const authHeaders = useMemo(
    () => ({
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    }),
    [token]
  );

  // reference data
  const [branches, setBranches] = useState([]);
  const [categories, setCategories] = useState([]);

  // selections (force string)
  const [branchId, setBranchId] = useState("");
  const [categoryNameId, setCategoryNameId] = useState("");

  // table state
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(10);

  // data
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);

  // discount
  const [discountPercent, setDiscountPercent] = useState("");
  const [savingBulk, setSavingBulk] = useState(false);

  // per-item override { [itemId]: discountedPrice }
  const [overrides, setOverrides] = useState({});
  const [savingRowId, setSavingRowId] = useState(null);

  // UI
  const [loadingRefs, setLoadingRefs] = useState(false);
  const [loadingItems, setLoadingItems] = useState(false);
  const [error, setError] = useState("");

  const totalPages = Math.max(1, Math.ceil(total / size));

  // Load branches + categories once
  useEffect(() => {
    loadReferenceData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep category selection if still exists; otherwise clear
  useEffect(() => {
    if (!categories?.length) return;
    if (!categoryNameId) return;

    const exists = categories.some(
      (c) => String(c.categoryNameId) === String(categoryNameId)
    );
    if (!exists) setCategoryNameId("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categories]);

  // Keep branch selection if still exists; otherwise clear
  useEffect(() => {
    if (!branches?.length) return;
    if (!branchId) return;

    const exists = branches.some((b) => String(b.id) === String(branchId));
    if (!exists) setBranchId("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branches]);

  // Load items when selection or paging/search changes
  useEffect(() => {
    if (!branchId || !categoryNameId) {
      setItems([]);
      setTotal(0);
      return;
    }
    loadItems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchId, categoryNameId, query, page, size]);

  const loadReferenceData = async () => {
    setLoadingRefs(true);
    setError("");
    try {
      const [bRes, cRes] = await Promise.all([
        fetch(`/api/${tenancyId}/pricing/branches`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`/api/${tenancyId}/pricing/categories`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      if (!bRes.ok) throw new Error(await safeError(bRes));
      if (!cRes.ok) throw new Error(await safeError(cRes));

      const bData = await bRes.json();
      const cData = await cRes.json();

      // Normalize to ensure stable fields/types
      const normBranches = (bData || []).map((b) => ({
        id: String(b.id),
        branchCode: b.branchCode ?? b.branch_code ?? "",
        branchName: b.branchName ?? b.branch_name ?? "",
      }));

      const normCategories = (cData || []).map((c) => ({
        categoryNameId: String(
          c.categoryNameId ?? c.category_name_id ?? c.id ?? ""
        ),
        categoryName: c.categoryName ?? c.category_name ?? c.name ?? "",
      }));

      setBranches(normBranches);
      setCategories(normCategories);
    } catch (e) {
      setError(e.message || "Failed to load branches/categories");
      setBranches([]);
      setCategories([]);
    } finally {
      setLoadingRefs(false);
    }
  };

  const loadItems = async () => {
    setLoadingItems(true);
    setError("");
    try {
      const url =
        `/api/${tenancyId}/pricing/items` +
        `?branchId=${encodeURIComponent(branchId)}` +
        `&categoryNameId=${encodeURIComponent(categoryNameId)}` +
        `&query=${encodeURIComponent(query)}` +
        `&page=${page}` +
        `&size=${size}`;

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(await safeError(res));

      const data = await res.json();

      // Expected backend DTO fields:
      // itemId, itemName, itemCode, globalStandardPrice, discountedPrice, effectivePrice
      const normItems = (data.content || []).map((it) => ({
        itemId: String(it.itemId ?? it.id ?? ""),
        itemName: it.itemName ?? it.item_name ?? "",
        itemCode: it.itemCode ?? it.item_code ?? "",
        globalStandardPrice:
          it.globalStandardPrice ?? it.standardPrice ?? it.standard_price ?? 0,
        discountedPrice:
          it.discountedPrice ?? it.discounted_price ?? null,
        effectivePrice:
          it.effectivePrice ?? it.effective_price ?? null,
      }));

      setItems(normItems);
      setTotal(data.totalElements ?? 0);

      // IMPORTANT: do NOT clear category selection here.
      // Clearing overrides is OK, but it can feel annoying if you are editing multiple rows.
      // If you want to keep typed overrides across pagination, remove the next line.
      setOverrides({});
    } catch (e) {
      setError(e.message || "Failed to load items");
      setItems([]);
      setTotal(0);
    } finally {
      setLoadingItems(false);
    }
  };

  const handleApplyCategoryDiscount = async () => {
    setError("");
    const dp = Number(discountPercent);

    if (!branchId) return setError("Select a branch first.");
    if (!categoryNameId) return setError("Select a category first.");
    if (!Number.isFinite(dp) || dp < 0) return setError("Discount % must be >= 0.");

    setSavingBulk(true);
    try {
      const res = await fetch(`/api/${tenancyId}/pricing/category-discount`, {
        method: "PUT",
        headers: authHeaders,
        body: JSON.stringify({
          branchId,
          categoryNameId,
          discountPercent: dp,
        }),
      });

      if (!res.ok) throw new Error(await safeError(res));

      await loadItems();
    } catch (e) {
      setError(e.message || "Bulk update failed");
    } finally {
      setSavingBulk(false);
    }
  };

  const handleOverrideChange = (itemId, value) => {
    setOverrides((prev) => ({ ...prev, [itemId]: value }));
  };

 const handleSaveRow = async (itemId) => {
  setError("");

  const it = items.find((x) => String(x.itemId) === String(itemId));
  if (!it) return setError("Item not found in list.");

  // What user sees in the textbox
  const baseStd = it.globalStandardPrice;
  const suggested = calcDiscounted(baseStd, discountPercent);

  const displayVal =
    overrides[itemId] ?? (it.discountedPrice ?? suggested ?? "");

  const price = Number(displayVal);

  if (!branchId) return setError("Select a branch first.");
  if (!Number.isFinite(price) || price < 0) {
    return setError("Discounted price must be a number >= 0.");
  }

  setSavingRowId(itemId);
  try {
    const res = await fetch(`/api/${tenancyId}/pricing/item-price`, {
      method: "PUT",
      headers: authHeaders,
      body: JSON.stringify({
        branchId,
        itemId,
        discountedPrice: price,
        discountPercent: Number(discountPercent || 0),
      }),
    });

    if (!res.ok) throw new Error(await safeError(res));

    await loadItems();
  } catch (e) {
    setError(e.message || "Row update failed");
  } finally {
    setSavingRowId(null);
  }
};


  return (
    <Container maxWidth="xl" sx={{ py: 3 }}>
      <Typography variant="h5" sx={{ mb: 2, fontWeight: 700 }}>
        Category-wise Branch Price Editor
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Paper sx={{ p: 2, mb: 2 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={4}>
            <FormControl fullWidth>
              <InputLabel id="branch-label">Branch</InputLabel>
              <Select
                labelId="branch-label"
                label="Branch"
                value={branchId || ""}
                onChange={(e) => {
                  setBranchId(String(e.target.value));
                  setPage(0);
                }}
                disabled={loadingRefs}
              >
                {branches.map((b) => (
                  <MenuItem key={String(b.id)} value={String(b.id)}>
                    {b.branchCode} - {b.branchName}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12} md={4}>
            <FormControl fullWidth>
              <InputLabel id="cat-label">Category</InputLabel>
              <Select
                labelId="cat-label"
                label="Category"
                value={categoryNameId || ""}
                onChange={(e) => {
                  setCategoryNameId(String(e.target.value)); // force string to make it stick
                  setPage(0);
                }}
                disabled={loadingRefs}
              >
                {categories.map((c) => (
                  <MenuItem
                    key={String(c.categoryNameId)}
                    value={String(c.categoryNameId)}
                  >
                    {c.categoryName}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12} md={2}>
            <TextField
              fullWidth
              label="Discount %"
              type="number"
              inputProps={{ min: 0 }}
              value={discountPercent}
              onChange={(e) => setDiscountPercent(e.target.value)}
              disabled={!branchId || !categoryNameId}
            />
          </Grid>

          <Grid item xs={12} md={2}>
            <Button
              fullWidth
              variant="contained"
              onClick={handleApplyCategoryDiscount}
              disabled={!branchId || !categoryNameId || savingBulk}
              startIcon={savingBulk ? <CircularProgress size={18} /> : <SaveIcon />}
            >
              Apply
            </Button>
          </Grid>

          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Search items"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(0);
              }}
              placeholder="Type item name / code / barcode"
              disabled={!branchId || !categoryNameId}
            />
          </Grid>

          <Grid item xs={12} md={6}>
            <Stack direction="row" spacing={1} justifyContent="flex-end" alignItems="center">
              <Button
                variant="outlined"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={!branchId || !categoryNameId || page <= 0 || loadingItems}
              >
                Prev
              </Button>

              <Typography variant="body2">
                Page {page + 1} / {totalPages} &nbsp; | &nbsp; Items: {total}
              </Typography>

              <Button
                variant="outlined"
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={!branchId || !categoryNameId || page >= totalPages - 1 || loadingItems}
              >
                Next
              </Button>

              <TextField
                label="Rows"
                type="number"
                size="small"
                value={size}
                onChange={(e) => {
                  const v = Math.max(1, Math.min(100, Number(e.target.value || 10)));
                  setSize(v);
                  setPage(0);
                }}
                sx={{ width: 90 }}
              />
            </Stack>
          </Grid>
        </Grid>
      </Paper>

      <Paper sx={{ p: 2 }}>
        {loadingRefs || loadingItems ? (
          <Stack alignItems="center" sx={{ py: 6 }}>
            <CircularProgress />
          </Stack>
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Item</TableCell>
                  <TableCell>Code</TableCell>
                  <TableCell align="right">Global Std</TableCell>
                  <TableCell align="right">Current (Branch)</TableCell>
                  <TableCell align="right">Suggested (by %)</TableCell>
                  <TableCell align="right">Set Discounted Price</TableCell>
                  <TableCell align="center">Save</TableCell>
                </TableRow>
              </TableHead>

              <TableBody>
                {!branchId || !categoryNameId ? (
                  <TableRow>
                    <TableCell colSpan={7} align="center" sx={{ py: 3 }}>
                      Select Branch and Category to load items.
                    </TableCell>
                  </TableRow>
                ) : items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} align="center" sx={{ py: 3 }}>
                      No items found.
                    </TableCell>
                  </TableRow>
                ) : (
                  items.map((it) => {
                    const baseStd = it.globalStandardPrice;
                    const suggested = calcDiscounted(baseStd, discountPercent);
                    const currentBranchPrice = it.effectivePrice ?? it.discountedPrice ?? baseStd;

                    const overrideVal =
                      overrides[it.itemId] ??
                      (it.discountedPrice ?? suggested ?? "");

                    return (
                      <TableRow key={it.itemId}>
                        <TableCell>{it.itemName}</TableCell>
                        <TableCell>{it.itemCode || "-"}</TableCell>
                        <TableCell align="right">{money(it.globalStandardPrice)}</TableCell>
                        <TableCell align="right">{money(currentBranchPrice)}</TableCell>
                        <TableCell align="right">{suggested}</TableCell>
                        <TableCell align="right" sx={{ width: 220 }}>
                          <TextField
                            fullWidth
                            size="small"
                            type="number"
                            inputProps={{ min: 0, step: "0.01" }}
                            value={overrideVal}
                            onChange={(e) => handleOverrideChange(it.itemId, e.target.value)}
                          />
                        </TableCell>
                        <TableCell align="center">
                          <Button
                            variant="contained"
                            size="small"
                            onClick={() => handleSaveRow(it.itemId)}
                            disabled={savingRowId === it.itemId}
                            startIcon={
                              savingRowId === it.itemId ? (
                                <CircularProgress size={16} />
                              ) : (
                                <SaveIcon fontSize="small" />
                              )
                            }
                          >
                            Save
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>
    </Container>
  );
}
