import React, { useState, useEffect, useRef } from "react";
import {
  Box,
  Typography,
  Autocomplete,
  TextField,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  CircularProgress,
  Divider,
  Chip,
  Stack,
} from "@mui/material";
import PrintIcon from "@mui/icons-material/Print";
import DownloadIcon from "@mui/icons-material/Download";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";

const CategoryItemReport = () => {
  const [categories, setCategories] = useState([]);
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [loadingCats, setLoadingCats] = useState(false);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [fetched, setFetched] = useState(false);
  const printRef = useRef();

  useEffect(() => {
    const tenancyId = localStorage.getItem("tenancyId");
    const token = localStorage.getItem("jwtToken");
    if (!tenancyId || !token) return;
    setLoadingCats(true);
    fetch(`/api/${tenancyId}/categoriesNames`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((data) => setCategories(Array.isArray(data) ? data : []))
      .catch((e) => console.error("Failed to load categories", e))
      .finally(() => setLoadingCats(false));
  }, []);

  const fetchItems = async () => {
    if (!selectedCategories.length) return;
    const tenancyId = localStorage.getItem("tenancyId");
    const token = localStorage.getItem("jwtToken");
    const catIds = selectedCategories.map((c) => c.id ?? c.categoryId);
    setLoading(true);
    setError(null);
    setFetched(false);
    try {
      const params = new URLSearchParams();
      catIds.forEach((id) => params.append("categoryIds", id));
      const res = await fetch(
        `/api/${tenancyId}/item-category-map/by-categories?${params.toString()}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setItems(Array.isArray(data) ? data : []);
      setFetched(true);
    } catch (e) {
      setError("Failed to fetch items for the selected categories.");
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    const content = printRef.current;
    if (!content) return;
    const win = window.open("", "_blank", "width=900,height=700");
    win.document.write(`
      <html>
        <head>
          <title>Category Item Report</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 24px; color: #000; }
            h2 { text-align: center; margin-bottom: 4px; font-size: 18px; }
            .subtitle { text-align: center; color: #555; font-size: 13px; margin-bottom: 16px; }
            .meta { display: flex; justify-content: space-between; font-size: 12px; color: #333; margin-bottom: 16px; border-bottom: 1px solid #ccc; padding-bottom: 8px; }
            table { width: 100%; border-collapse: collapse; font-size: 13px; }
            thead tr { background: #2c3e50; color: #fff; }
            th { padding: 8px 10px; text-align: left; }
            td { padding: 7px 10px; border-bottom: 1px solid #e0e0e0; }
            tr:nth-child(even) td { background: #f7f7f7; }
            .footer { margin-top: 20px; font-size: 11px; color: #888; text-align: right; }
            .total-row td { font-weight: bold; background: #ecf0f1; border-top: 2px solid #2c3e50; }
          </style>
        </head>
        <body>${content.innerHTML}</body>
      </html>
    `);
    win.document.close();
    win.focus();
    win.print();
    win.close();
  };

  const handleExcel = () => {
    const rows = items.map((item, idx) => ({
      "#": idx + 1,
      Category: item.categoryName ?? item.category_name ?? "",
      "Item ID": item.itemId ?? item.item_id ?? "",
      "Item Name": item.itemName ?? item.item_name ?? "",
      "HSN Code": item.hsnCode ?? item.hsn_code ?? "",
      Unit: item.unitName ?? item.unit_name ?? "",
      "Tax Rate (%)": item.taxRate ?? item.tax_rate ?? "",
      "Standard Price": item.standardPrice ?? item.standard_price ?? "",
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Category Items");
    const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    const fileTag =
      selectedCategories.length === 1
        ? (selectedCategories[0]?.categoryName ?? selectedCategories[0]?.name ?? "report")
        : `${selectedCategories.length}_categories`;
    saveAs(
      new Blob([buf], { type: "application/octet-stream" }),
      `Category_Items_${fileTag}.xlsx`
    );
  };

  const catNames = selectedCategories.map((c) => c.categoryName ?? c.name ?? "").filter(Boolean);
  const today = new Date().toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 1100, mx: "auto" }}>
      <Typography variant="h5" fontWeight={600} gutterBottom>
        Category Wise Item List
      </Typography>

      {/* Controls */}
      <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems="center">
          <Autocomplete
            multiple
            options={categories}
            loading={loadingCats}
            value={selectedCategories}
            onChange={(_, val) => {
              setSelectedCategories(val);
              setItems([]);
              setFetched(false);
              setError(null);
            }}
            getOptionLabel={(opt) =>
              typeof opt === "string"
                ? opt
                : opt?.categoryName ?? opt?.name ?? ""
            }
            isOptionEqualToValue={(opt, val) =>
              (opt?.id ?? opt?.categoryId) === (val?.id ?? val?.categoryId)
            }
            renderTags={(value, getTagProps) =>
              value.map((option, index) => (
                <Chip
                  size="small"
                  label={option?.categoryName ?? option?.name ?? ""}
                  {...getTagProps({ index })}
                />
              ))
            }
            noOptionsText="No categories"
            sx={{ minWidth: 280, flexGrow: 1 }}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Select Categories"
                size="small"
                InputProps={{
                  ...params.InputProps,
                  endAdornment: (
                    <>
                      {loadingCats ? <CircularProgress size={16} /> : null}
                      {params.InputProps.endAdornment}
                    </>
                  ),
                }}
              />
            )}
          />
          <Button
            variant="contained"
            onClick={fetchItems}
            disabled={!selectedCategories.length || loading}
            sx={{ minWidth: 130 }}
          >
            {loading ? <CircularProgress size={20} color="inherit" /> : "Get Items"}
          </Button>
          {items.length > 0 && (
            <>
              <Button
                variant="outlined"
                startIcon={<PrintIcon />}
                onClick={handlePrint}
              >
                Print
              </Button>
              <Button
                variant="outlined"
                color="success"
                startIcon={<DownloadIcon />}
                onClick={handleExcel}
              >
                Excel
              </Button>
            </>
          )}
        </Stack>
      </Paper>

      {error && (
        <Typography color="error" sx={{ mb: 2 }}>
          {error}
        </Typography>
      )}

      {/* Printable Report Area */}
      {fetched && (
        <Box ref={printRef}>
          {/* Report Header (visible in print) */}
          <Box sx={{ mb: 2 }}>
            <Typography variant="h6" fontWeight={700} align="center">
              Category Wise Item List
            </Typography>
            <Typography variant="body2" align="center" color="text.secondary">
              Printed on: {today}
            </Typography>
            <Divider sx={{ my: 1 }} />
            <Stack direction="row" justifyContent="space-between" alignItems="flex-start" flexWrap="wrap" gap={1}>
              <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                <Typography variant="body2" color="text.secondary">
                  {catNames.length > 1 ? "Categories:" : "Category:"}
                </Typography>
                {catNames.map((name) => (
                  <Chip key={name} label={name} size="small" color="primary" />
                ))}
              </Stack>
              <Typography variant="body2" color="text.secondary">
                Total Items: <strong>{items.length}</strong>
              </Typography>
            </Stack>
          </Box>

          {items.length === 0 ? (
            <Paper
              variant="outlined"
              sx={{ p: 4, textAlign: "center", color: "text.secondary" }}
            >
              No items found for the selected categories.
            </Paper>
          ) : (
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ backgroundColor: "#2c3e50" }}>
                    {["#", "Category", "Item ID", "Item Name", "HSN Code", "Unit", "Tax %", "Std. Price"].map(
                      (h) => (
                        <TableCell
                          key={h}
                          sx={{
                            color: "#fff",
                            fontWeight: 700,
                            fontSize: "0.8rem",
                            py: 1.2,
                            whiteSpace: "nowrap",
                          }}
                        >
                          {h}
                        </TableCell>
                      )
                    )}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {items.map((row, idx) => (
                    <TableRow
                      key={row.itemId ?? row.id ?? idx}
                      sx={{
                        backgroundColor: idx % 2 === 0 ? "#ffffff" : "#f0f4f8",
                        "&:hover": { backgroundColor: "#dbeafe" },
                      }}
                    >
                      <TableCell sx={{ color: "#555", fontSize: "0.8rem" }}>
                        {idx + 1}
                      </TableCell>
                      <TableCell sx={{ color: "#212121", fontSize: "0.82rem" }}>
                        {row.categoryName ?? row.category_name ?? "—"}
                      </TableCell>
                      <TableCell sx={{ color: "#212121", fontSize: "0.82rem", fontFamily: "monospace" }}>
                        {row.itemId ?? row.item_id ?? "—"}
                      </TableCell>
                      <TableCell sx={{ color: "#212121", fontSize: "0.85rem", fontWeight: 600 }}>
                        {row.itemName ?? row.item_name ?? "—"}
                      </TableCell>
                      <TableCell sx={{ color: "#212121", fontSize: "0.82rem" }}>
                        {row.hsnCode ?? row.hsn_code ?? "—"}
                      </TableCell>
                      <TableCell sx={{ color: "#212121", fontSize: "0.82rem" }}>
                        {row.unitName ?? row.unit_name ?? "—"}
                      </TableCell>
                      <TableCell align="right" sx={{ color: "#212121", fontSize: "0.82rem" }}>
                        {row.taxRate ?? row.tax_rate ?? "—"}
                      </TableCell>
                      <TableCell align="right" sx={{ color: "#212121", fontSize: "0.82rem" }}>
                        {row.standardPrice != null || row.standard_price != null
                          ? Number(row.standardPrice ?? row.standard_price).toLocaleString("en-IN", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })
                          : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow sx={{ backgroundColor: "#dde3ea" }}>
                    <TableCell
                      colSpan={8}
                      sx={{ color: "#212121", fontWeight: 700, fontSize: "0.85rem", py: 1 }}
                    >
                      Total Items: {items.length}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Box>
      )}
    </Box>
  );
};

export default CategoryItemReport;
