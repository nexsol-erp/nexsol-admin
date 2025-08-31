import React, { useEffect, useState } from "react";
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
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";

const ItemCategoryLinker = ({ itemId: propItemId, onLinked }) => {
  const [itemId, setItemId] = useState(propItemId || "");
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);

  const [loadingCats, setLoadingCats] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [mappings, setMappings] = useState([]);
  const [loadingMaps, setLoadingMaps] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const [snack, setSnack] = useState({ open: false, msg: "", severity: "success" });

  // Keep itemId in sync if prop changes
  useEffect(() => {
    setItemId(propItemId || "");
  }, [propItemId]);

  // Load categories once
  useEffect(() => {
    const tenancyId = localStorage.getItem("tenancyId");
    const token = localStorage.getItem("jwtToken");
    if (!tenancyId || !token) return;

    (async () => {
      setLoadingCats(true);
      try {
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
    })();
  }, []);

  // Load existing mappings whenever itemId is present/changes
  useEffect(() => {
    const loadMappings = async () => {
      const tenancyId = localStorage.getItem("tenancyId");
      const token = localStorage.getItem("jwtToken");
      if (!tenancyId || !token || !itemId) {
        setMappings([]);
        return;
      }

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
    };

    if (itemId) loadMappings();
    else setMappings([]);
  }, [itemId]);

  const refreshMappings = async () => {
    // trigger the effect by setting the same value (or fetch directly again)
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
        itemId: itemId,
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
      if (!propItemId) setItemId(""); // reset only if user entered manually
      setSelectedCategory(null);
      onLinked?.(body);

      // refresh mappings for the item (if still present)
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
    <Box sx={{ p: 2, maxWidth: 680 }}>
      <Typography variant="h5" gutterBottom>
        Item Category Linking
      </Typography>

      <Box sx={{ display: "flex", gap: 2, alignItems: "center", flexWrap: "wrap", mb: 2 }}>
        <TextField
          label="Item ID"
          value={itemId}
          onChange={(e) => setItemId(e.target.value)}
          sx={{ width: 320 }}
          disabled={!!propItemId}
          placeholder="Enter Item ID"
        />

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
          renderInput={(params) => (
            <TextField
              {...params}
              label="Select Category"
              sx={{ width: 300 }}
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
          {loadingMaps ? <CircularProgress size={20} /> : "Refresh Mappings"}
        </Button>
      </Box>

      <Divider sx={{ my: 2 }} />

      <Typography variant="h6" gutterBottom>
        Existing Mappings {itemId ? `for Item ${itemId}` : ""}
      </Typography>

      <Box sx={{ maxHeight: 260, overflowY: "auto", borderRadius: 1, border: "1px solid #eee" }}>
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
