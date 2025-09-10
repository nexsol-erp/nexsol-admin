import React, { useEffect, useMemo, useState } from "react";
import {
  Box,
  Typography,
  Autocomplete,
  TextField,
  Button,
  CircularProgress,
  Snackbar,
  Alert,
  List,
  ListItem,
  ListItemText,
  IconButton,
  Divider,
  Grid,
  Paper,
  Stack,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";

const ItemCategoryLinker = ({ itemId: propItemId, onLinked }) => {
  const [itemId, setItemId] = useState(propItemId || "");
  const [currentItemName, setCurrentItemName] = useState("");

  const [items, setItems] = useState([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [selectedItemOpt, setSelectedItemOpt] = useState(null);

  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [loadingCats, setLoadingCats] = useState(false);

  const [mappings, setMappings] = useState([]);
  const [loadingMaps, setLoadingMaps] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const [submitting, setSubmitting] = useState(false);
  const [snack, setSnack] = useState({ open: false, msg: "", severity: "success" });

  useEffect(() => {
    setItemId(propItemId || "");
  }, [propItemId]);

  useEffect(() => {
    const tenancyId = localStorage.getItem("tenancyId");
    const token = localStorage.getItem("jwtToken");
    if (!tenancyId || !token) return;

    (async () => {
      // categories
      try {
        setLoadingCats(true);
        const res = await fetch(`/api/${tenancyId}/categoriesNames`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setCategories(Array.isArray(data) ? data : []);
      } catch (e) {
        console.error("Failed to load categories", e);
        setSnack({ open: true, msg: "Failed to load categories", severity: "error" });
      } finally {
        setLoadingCats(false);
      }

      // items
      try {
        setLoadingItems(true);
        const res = await fetch(`/api/${tenancyId}/items`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const raw = await res.json();
        const list = Array.isArray(raw) ? raw : [];
        const normalized = list.map((x) => ({
          itemId: x.item_id ?? x.itemId ?? "",
          itemName: x.item_name ?? x.itemName ?? "",
          itemCode: x.item_code ?? x.itemCode ?? "",
          barcode: x.barcode ?? "",
        }));
        setItems(normalized);
      } catch (e) {
        console.error("Failed to load items", e);
        setSnack({ open: true, msg: "Failed to load items", severity: "error" });
      } finally {
        setLoadingItems(false);
      }
    })();
  }, []);

  useEffect(() => {
    const found = items.find((it) => it.itemId === itemId);
    setCurrentItemName(found?.itemName || "");
    setSelectedItemOpt(found ?? null);
  }, [itemId, items]);

  useEffect(() => {
    const tenancyId = localStorage.getItem("tenancyId");
    const token = localStorage.getItem("jwtToken");
    if (!tenancyId || !token || !itemId) {
      setMappings([]);
      return;
    }
    (async () => {
      setLoadingMaps(true);
      try {
        const res = await fetch(
          `/api/${tenancyId}/item-category-map/by-item/${encodeURIComponent(itemId)}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setMappings(Array.isArray(data) ? data : []);
      } catch (e) {
        console.error("Failed to load mappings", e);
        setSnack({ open: true, msg: "Failed to load existing mappings", severity: "error" });
        setMappings([]);
      } finally {
        setLoadingMaps(false);
      }
    })();
  }, [itemId]);

  const refreshMappings = async () => {
    const tenancyId = localStorage.getItem("tenancyId");
    const token = localStorage.getItem("jwtToken");
    if (!tenancyId || !token || !itemId) return;

    setLoadingMaps(true);
    try {
      const res = await fetch(
        `/api/${tenancyId}/item-category-map/by-item/${encodeURIComponent(itemId)}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setMappings(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error("Failed to refresh mappings", e);
      setSnack({ open: true, msg: "Failed to refresh mappings", severity: "error" });
    } finally {
      setLoadingMaps(false);
    }
  };

  const linkCategory = async () => {
    const tenancyId = localStorage.getItem("tenancyId");
    const token = localStorage.getItem("jwtToken");
    if (!tenancyId || !token) {
      setSnack({ open: true, msg: "Not authenticated", severity: "error" });
      return;
    }
    if (!itemId || !selectedCategory) return;

    setSubmitting(true);
    try {
      const body = {
        itemId,
        categoryId: selectedCategory.id ?? selectedCategory.categoryId,
      };

      const res = await fetch(`/api/${tenancyId}/item-category-map`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        let msg = `HTTP ${res.status}`;
        try {
          const t = await res.json();
          if (t?.message) msg = t.message;
        } catch {}
        throw new Error(msg);
      }

      setSnack({ open: true, msg: "Category linked successfully.", severity: "success" });
      if (!propItemId) setItemId("");
      setSelectedCategory(null);
      onLinked?.(body);
      await refreshMappings();
    } catch (e) {
      console.error(e);
      setSnack({ open: true, msg: e.message || "Link failed", severity: "error" });
    } finally {
      setSubmitting(false);
    }
  };

  const deleteMapping = async (mapId) => {
    if (!mapId) return;
    const tenancyId = localStorage.getItem("tenancyId");
    const token = localStorage.getItem("jwtToken");
    if (!tenancyId || !token) {
      setSnack({ open: true, msg: "Not authenticated", severity: "error" });
      return;
    }

    setDeletingId(mapId);
    try {
      const res = await fetch(
        `/api/${tenancyId}/item-category-map/${encodeURIComponent(mapId)}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      if (!res.ok && res.status !== 204) {
        let msg = `HTTP ${res.status}`;
        try {
          const t = await res.text();
          if (t) msg = t;
        } catch {}
        throw new Error(msg);
      }
      setSnack({ open: true, msg: "Mapping deleted.", severity: "success" });
      await refreshMappings();
    } catch (e) {
      console.error(e);
      setSnack({ open: true, msg: e.message || "Delete failed", severity: "error" });
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 1280, mx: "auto" }}>
      <Typography variant="h5" gutterBottom>
        Item Category Linking
      </Typography>

      {/* Controls */}
      <Paper elevation={0} variant="outlined" sx={{ p: { xs: 2, md: 3 }, mb: 2 }}>
        <Grid container spacing={{ xs: 2, md: 3 }}>
          {/* Search by Item Name */}
          <Grid item xs={12} md={6} lg={5}>
            <Autocomplete
              options={items}
              loading={loadingItems}
              value={selectedItemOpt}
              onChange={(_e, val) => {
                setSelectedItemOpt(val);
                setItemId(val?.itemId || "");
              }}
              getOptionLabel={(opt) =>
                typeof opt === "string"
                  ? opt
                  : opt?.itemName
                  ? `${opt.itemName} (${opt.itemId})`
                  : ""
              }
              noOptionsText="No items"
              sx={{ minWidth: 0 }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Search Item by Name"
                  placeholder="Type item name..."
                  fullWidth
                  InputProps={{
                    ...params.InputProps,
                    endAdornment: (
                      <>
                        {loadingItems ? <CircularProgress size={18} /> : null}
                        {params.InputProps.endAdornment}
                      </>
                    ),
                  }}
                />
              )}
            />
          </Grid>

          {/* Item ID */}
          <Grid item xs={12} sm={6} md={3} lg={3}>
            <TextField
              label="Item ID"
              value={itemId}
              onChange={(e) => setItemId(e.target.value)}
              disabled={!!propItemId}
              placeholder="Enter Item ID"
              fullWidth
            />
          </Grid>

          {/* Item Name (readonly) */}
          <Grid item xs={12} sm={6} md={3} lg={4}>
            <TextField
              label="Item Name"
              value={currentItemName}
              placeholder="-"
              disabled
              fullWidth
            />
          </Grid>

          {/* Category picker */}
          <Grid item xs={12} md={8} lg={8}>
            <Autocomplete
              options={categories}
              loading={loadingCats}
              isOptionEqualToValue={(opt, val) =>
                (opt?.id ?? opt?.categoryId) === (val?.id ?? val?.categoryId)
              }
              getOptionLabel={(opt) =>
                typeof opt === "string"
                  ? opt
                  : `${opt.categoryName ?? opt.name ?? ""} (${opt.id ?? opt.categoryId ?? ""})`
              }
              value={selectedCategory}
              onChange={(_e, val) => setSelectedCategory(val)}
              noOptionsText="No categories"
              sx={{ minWidth: 0 }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Select Category"
                  fullWidth
                  InputProps={{
                    ...params.InputProps,
                    endAdornment: (
                      <>
                        {loadingCats ? <CircularProgress size={18} /> : null}
                        {params.InputProps.endAdornment}
                      </>
                    ),
                  }}
                />
              )}
            />
          </Grid>

          {/* Buttons */}
          <Grid item xs={12} md={4} lg={4}>
            <Stack direction="row" spacing={2} sx={{ height: "100%" }} alignItems="center">
              <Button
                variant="contained"
                onClick={linkCategory}
                disabled={!itemId || !selectedCategory || submitting}
              >
                {submitting ? <CircularProgress size={20} /> : "Link Category"}
              </Button>
              <Button
                variant="outlined"
                onClick={refreshMappings}
                disabled={!itemId || loadingMaps}
              >
                {loadingMaps ? <CircularProgress size={20} /> : "Refresh"}
              </Button>
            </Stack>
          </Grid>
        </Grid>
      </Paper>

      <Divider sx={{ my: 2 }} />

      {/* Mappings list */}
      <Typography variant="h6" gutterBottom>
        Existing Mappings {itemId ? `for Item ${itemId}` : ""}
      </Typography>

      <Paper elevation={0} variant="outlined" sx={{ p: { xs: 1, md: 2 } }}>
        <Box sx={{ maxHeight: 300, overflowY: "auto" }}>
          {loadingMaps ? (
            <Box sx={{ p: 2 }}>
              <CircularProgress size={22} />
            </Box>
          ) : mappings.length === 0 ? (
            <Box sx={{ p: 2, color: "text.secondary" }}>No mappings found.</Box>
          ) : (
            <List dense>
              {mappings.map((m) => (
                <ListItem
                  key={m.id ?? `${m.itemId}-${m.categoryId}`}
                  secondaryAction={
                    <IconButton
                      edge="end"
                      aria-label="delete"
                      onClick={() => deleteMapping(m.id)}
                      disabled={deletingId === m.id}
                    >
                      {deletingId === m.id ? <CircularProgress size={18} /> : <DeleteIcon />}
                    </IconButton>
                  }
                >
                  <ListItemText
                    primary={`Item: ${m.itemName ?? m.itemId} → Category: ${m.categoryName ?? m.categoryId}`}
                    secondary={m.id ? `Map ID: ${m.id}` : null}
                  />
                </ListItem>
              ))}
            </List>
          )}
        </Box>
      </Paper>

      <Snackbar
        open={snack.open}
        autoHideDuration={3500}
        onClose={() => setSnack({ ...snack, open: false })}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          severity={snack.severity}
          onClose={() => setSnack({ ...snack, open: false })}
          sx={{ width: "100%" }}
        >
          {snack.msg}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default ItemCategoryLinker;
