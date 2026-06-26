import React, { useState, useEffect, useCallback } from "react";
import {
  Box,
  Typography,
  Autocomplete,
  TextField,
  Chip,
  Button,
  CircularProgress,
  Alert,
  Paper,
} from "@mui/material";
import FilterListOffIcon from "@mui/icons-material/FilterListOff";

export default function StockReportExclusionPage() {
  const tenancyId = localStorage.getItem("tenancyId");
  const token     = localStorage.getItem("jwtToken");

  const [exclusions, setExclusions] = useState([]);
  const [allCategories, setAll]     = useState([]);
  const [selected, setSelected]     = useState(null);
  const [saving, setSaving]         = useState(false);
  const [error, setError]           = useState(null);

  const headers = { Authorization: `Bearer ${token}` };

  const loadExclusions = useCallback(async () => {
    try {
      const res = await fetch(`/api/${tenancyId}/reports/excluded-categories`, { headers });
      if (res.ok) setExclusions(await res.json());
    } catch {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenancyId]);

  const loadCategories = useCallback(async () => {
    try {
      const res = await fetch(`/api/${tenancyId}/categoriesNames`, { headers });
      if (!res.ok) return;
      const data = await res.json();
      const names = [...new Set(
        (Array.isArray(data) ? data : [])
          .map((c) => c.categoryName)
          .filter(Boolean)
      )].sort();
      setAll(names);
    } catch {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenancyId]);

  useEffect(() => {
    loadExclusions();
    loadCategories();
  }, [loadExclusions, loadCategories]);

  const handleAdd = async () => {
    if (!selected) return;
    setError(null);
    setSaving(true);
    try {
      const res = await fetch(`/api/${tenancyId}/reports/excluded-categories`, {
        method:  "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body:    JSON.stringify({ categoryName: selected }),
      });
      if (!res.ok) {
        setError((await res.text()) || "Failed to add exclusion");
      } else {
        setSelected(null);
        await loadExclusions();
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    setError(null);
    try {
      await fetch(`/api/${tenancyId}/reports/excluded-categories/${id}`, {
        method: "DELETE",
        headers,
      });
      await loadExclusions();
    } catch (e) {
      setError(e.message);
    }
  };

  const excludedNames = new Set(exclusions.map((e) => e.categoryName?.toLowerCase()));
  const available = allCategories.filter((n) => !excludedNames.has(n?.toLowerCase()));

  return (
    <Box sx={{ p: 3, maxWidth: 720 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 0.5 }}>
        <FilterListOffIcon color="primary" />
        <Typography variant="h5" fontWeight={700}>
          Report Category Exclusions
        </Typography>
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Categories listed here are hidden from all stock analysis reports (Stock Anomaly, Item Velocity, etc.).
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Paper variant="outlined" sx={{ p: 2, mb: 3, borderRadius: 2 }}>
        <Typography variant="subtitle2" sx={{ mb: 1.5, fontWeight: 600 }}>
          Currently Excluded
        </Typography>
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, minHeight: 36 }}>
          {exclusions.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              No categories excluded yet.
            </Typography>
          ) : (
            exclusions.map((exc) => (
              <Chip
                key={exc.id}
                label={exc.categoryName}
                onDelete={() => handleDelete(exc.id)}
                color="default"
                variant="outlined"
              />
            ))
          )}
        </Box>
      </Paper>

      <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
        <Typography variant="subtitle2" sx={{ mb: 1.5, fontWeight: 600 }}>
          Add Category to Exclude
        </Typography>
        <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
          <Autocomplete
            sx={{ flex: 1 }}
            options={available}
            value={selected}
            onChange={(_, v) => setSelected(v)}
            renderInput={(params) => (
              <TextField {...params} label="Select category" size="small" />
            )}
          />
          <Button
            variant="contained"
            onClick={handleAdd}
            disabled={!selected || saving}
            sx={{ height: 40, whiteSpace: "nowrap" }}
          >
            {saving ? <CircularProgress size={16} color="inherit" /> : "Exclude"}
          </Button>
        </Box>
      </Paper>
    </Box>
  );
}
