import React, { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Autocomplete,
  TextField,
  Chip,
  Box,
  Typography,
  CircularProgress,
  Alert,
  IconButton,
  Tooltip,
} from "@mui/material";
import FilterListOffIcon from "@mui/icons-material/FilterListOff";

/**
 * Button + Dialog for managing the report_category_exclusion list.
 * Embed in any stock analysis report page.
 *
 * Usage:
 *   <StockReportExclusionSettings />
 */
export default function StockReportExclusionSettings() {
  const tenancyId = localStorage.getItem("tenancyId");
  const token     = localStorage.getItem("jwtToken");

  const [open, setOpen]               = useState(false);
  const [exclusions, setExclusions]   = useState([]);   // {id, categoryName}[]
  const [allCategories, setAll]       = useState([]);   // string[]
  const [selected, setSelected]       = useState(null);
  const [saving, setSaving]           = useState(false);
  const [error, setError]             = useState(null);

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
    if (open) {
      loadExclusions();
      loadCategories();
    }
  }, [open, loadExclusions, loadCategories]);

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
        const msg = await res.text();
        setError(msg || "Failed to add exclusion");
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
    <>
      <Tooltip title="Excluded categories">
        <IconButton onClick={() => setOpen(true)} size="small">
          <FilterListOffIcon fontSize="small" />
        </IconButton>
      </Tooltip>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ pb: 1 }}>
          Excluded Categories
          <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 400 }}>
            Items in these categories are hidden from all stock analysis reports.
          </Typography>
        </DialogTitle>

        <DialogContent>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
              {error}
            </Alert>
          )}

          {/* Current exclusions */}
          <Box sx={{ mb: 2, minHeight: 40, display: "flex", flexWrap: "wrap", gap: 1 }}>
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

          {/* Add new */}
          <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
            <Autocomplete
              sx={{ flex: 1 }}
              options={available}
              value={selected}
              onChange={(_, v) => setSelected(v)}
              renderInput={(params) => (
                <TextField {...params} label="Add category to exclude" size="small" />
              )}
            />
            <Button
              variant="contained"
              onClick={handleAdd}
              disabled={!selected || saving}
              sx={{ whiteSpace: "nowrap", height: 40 }}
            >
              {saving ? <CircularProgress size={16} color="inherit" /> : "Exclude"}
            </Button>
          </Box>
        </DialogContent>

        <DialogActions>
          <Button onClick={() => setOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
