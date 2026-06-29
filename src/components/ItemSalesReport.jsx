import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Box, Button, TextField, Typography, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Paper, CircularProgress,
  Autocomplete, Alert, Chip, Dialog, DialogTitle, DialogContent,
  DialogContentText, DialogActions,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import DownloadIcon from "@mui/icons-material/Download";
import BarChartIcon from "@mui/icons-material/BarChart";
import dayjs from "dayjs";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";

function r2(v) { return Math.round((Number(v) || 0) * 100) / 100; }
function fmtNum(v) {
  return r2(v).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const HCell = ({ children, align = "left" }) => (
  <TableCell
    align={align}
    sx={{
      fontWeight: 700, fontSize: "0.78rem", color: "#fff",
      bgcolor: "#1e3a5f", whiteSpace: "nowrap", py: 1.2,
      borderBottom: "2px solid #2d5a9e",
    }}
  >
    {children}
  </TableCell>
);

const ItemSalesReport = () => {
  const tenancyId = localStorage.getItem("tenancyId");
  const token     = localStorage.getItem("jwtToken");

  const [fromDate, setFromDate] = useState(dayjs().startOf("month").format("YYYY-MM-DD"));
  const [toDate,   setToDate]   = useState(dayjs().format("YYYY-MM-DD"));

  // ── Multi-select item search ──────────────────────────────────────────────
  const [itemOptions,    setItemOptions]    = useState([]);
  const [itemInputValue, setItemInputValue] = useState("");
  const [selectedItems,  setSelectedItems]  = useState([]);   // array
  const [itemLoading,    setItemLoading]    = useState(false);

  useEffect(() => {
    if (!itemInputValue.trim()) { setItemOptions([]); return; }
    const tid = setTimeout(async () => {
      setItemLoading(true);
      try {
        const res = await fetch(
          `/api/${tenancyId}/items-search?query=${encodeURIComponent(itemInputValue)}&page=0&size=30&sort=itemName,asc`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (!res.ok) return;
        const data = await res.json();
        setItemOptions(data.content || []);
      } catch {
        setItemOptions([]);
      } finally {
        setItemLoading(false);
      }
    }, 300);
    return () => clearTimeout(tid);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemInputValue]);

  // ── Report data ───────────────────────────────────────────────────────────
  const [rows,    setRows]    = useState([]);
  const [loading, setLoading] = useState(false);
  const [fetched, setFetched] = useState(false);
  const [error,   setError]   = useState(null);

  const fetchReport = useCallback(async () => {
    if (!selectedItems.length) {
      setError("Please search and select at least one item.");
      return;
    }
    setError(null);
    setLoading(true);
    setFetched(false);
    try {
      const params = new URLSearchParams({
        startDate: `${fromDate}T00:00:00`,
        endDate:   `${toDate}T23:59:59`,
      });
      // append each itemId separately so Spring gets a List<String>
      selectedItems.forEach((it) => params.append("itemIds", it.itemId));

      const res = await fetch(`/api/${tenancyId}/reports/itemsales/branchwise?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`Server error ${res.status}`);
      const data = await res.json();
      setRows(Array.isArray(data) ? data : []);
      setFetched(true);
    } catch (e) {
      setError("Failed to load report: " + (e.message || "Unknown error"));
    } finally {
      setLoading(false);
    }
  }, [selectedItems, fromDate, toDate, tenancyId, token]);

  // ── Totals ────────────────────────────────────────────────────────────────
  const totalQty   = useMemo(() => rows.reduce((s, r) => s + (Number(r.qty)        || 0), 0), [rows]);
  const totalSales = useMemo(() => rows.reduce((s, r) => s + (Number(r.totalSales) || 0), 0), [rows]);

  // ── Excel export ──────────────────────────────────────────────────────────
  const [exportOpen, setExportOpen] = useState(false);
  const [fileName,   setFileName]   = useState("ItemSalesReport.xlsx");

  const handleExport = () => {
    const sheetRows = rows.map((r, i) => ({
      "#":            i + 1,
      "Branch Code":  r.branchCode  || "",
      "Item Name":    r.itemName    || "",
      "Qty Sold":     r2(r.qty),
      "Total Sales":  r2(r.totalSales),
    }));
    sheetRows.push({
      "#": "", "Branch Code": "", "Item Name": "TOTAL",
      "Qty Sold":    r2(totalQty),
      "Total Sales": r2(totalSales),
    });
    const ws = XLSX.utils.json_to_sheet(sheetRows);
    ws["!cols"] = [6, 14, 32, 12, 14].map((w) => ({ wch: w }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Item Sales");
    const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    saveAs(new Blob([buf], { type: "application/octet-stream" }), fileName);
    setExportOpen(false);
  };

  return (
    <Box sx={{ p: { xs: 1, sm: 3 } }}>

      {/* ── Page header ────────────────────────────────────────────────── */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 3 }}>
        <Box
          sx={{
            width: 38, height: 38, borderRadius: "10px", bgcolor: "#1e3a5f",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >
          <BarChartIcon sx={{ color: "#90caf9", fontSize: 22 }} />
        </Box>
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
            Item Sales Report
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Sales of selected items across all branches
          </Typography>
        </Box>
      </Box>

      {/* ── Filter card ────────────────────────────────────────────────── */}
      <Paper variant="outlined" sx={{ p: 2.5, mb: 3, borderRadius: 2 }}>
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2, alignItems: "flex-start" }}>

          {/* Multi-item search */}
          <Autocomplete
            multiple
            options={itemOptions}
            getOptionLabel={(it) =>
              it.itemName
                ? `${it.itemName}${it.itemCode ? ` (${it.itemCode})` : ""}`
                : ""
            }
            inputValue={itemInputValue}
            value={selectedItems}
            onInputChange={(_, v, reason) => {
              if (reason !== "reset") setItemInputValue(v);
            }}
            onChange={(_, v) => {
              setSelectedItems(v);
              setFetched(false);
              setRows([]);
            }}
            loading={itemLoading}
            isOptionEqualToValue={(o, v) => o.itemId === v.itemId}
            noOptionsText={
              itemInputValue.trim() ? "No items found" : "Type to search items"
            }
            filterSelectedOptions
            disableCloseOnSelect
            renderTags={(value, getTagProps) =>
              value.map((option, index) => (
                <Chip
                  key={option.itemId}
                  label={option.itemName}
                  size="small"
                  color="primary"
                  variant="outlined"
                  {...getTagProps({ index })}
                />
              ))
            }
            renderInput={(params) => (
              <TextField
                {...params}
                label="Search & Select Items"
                size="small"
                placeholder={selectedItems.length ? "" : "Type item name or code…"}
                sx={{ width: { xs: "100%", sm: 380 } }}
                InputProps={{
                  ...params.InputProps,
                  startAdornment: (
                    <>
                      <SearchIcon sx={{ color: "text.disabled", fontSize: 18, mr: 0.5, flexShrink: 0 }} />
                      {params.InputProps.startAdornment}
                    </>
                  ),
                  endAdornment: (
                    <>
                      {itemLoading && <CircularProgress size={16} />}
                      {params.InputProps.endAdornment}
                    </>
                  ),
                }}
              />
            )}
          />

          {/* Date range */}
          <TextField
            type="date" label="From Date" size="small"
            InputLabelProps={{ shrink: true }}
            value={fromDate}
            onChange={(e) => { setFromDate(e.target.value); setFetched(false); }}
            sx={{ width: 160 }}
          />
          <TextField
            type="date" label="To Date" size="small"
            InputLabelProps={{ shrink: true }}
            value={toDate}
            onChange={(e) => { setToDate(e.target.value); setFetched(false); }}
            sx={{ width: 160 }}
          />

          {/* Actions */}
          <Button
            variant="contained"
            size="small"
            onClick={fetchReport}
            disabled={loading || !selectedItems.length}
            sx={{
              bgcolor: "#1e3a5f", "&:hover": { bgcolor: "#2d5a9e" },
              minWidth: 120, height: 40,
            }}
          >
            {loading
              ? <CircularProgress size={16} color="inherit" />
              : "Load Report"}
          </Button>

          {fetched && rows.length > 0 && (
            <Button
              variant="outlined"
              size="small"
              startIcon={<DownloadIcon />}
              onClick={() => setExportOpen(true)}
              sx={{ height: 40 }}
            >
              Export Excel
            </Button>
          )}
        </Box>
      </Paper>

      {/* ── Error / loading ────────────────────────────────────────────── */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      {loading && (
        <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
          <CircularProgress />
        </Box>
      )}

      {/* ── Results ────────────────────────────────────────────────────── */}
      {!loading && fetched && (
        rows.length === 0 ? (
          <Alert severity="info">
            No sales data found for the selected items and date range.
          </Alert>
        ) : (
          <>
            {/* Summary chips */}
            <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap", mb: 2 }}>
              <Chip label={`${rows.length} row${rows.length !== 1 ? "s" : ""}`} size="small" />
              <Chip
                label={`Total Qty: ${fmtNum(totalQty)}`}
                size="small" color="primary" variant="outlined"
              />
              <Chip
                label={`Total Sales: ₹${fmtNum(totalSales)}`}
                size="small" color="success" variant="outlined"
              />
            </Box>

            <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <HCell>#</HCell>
                    <HCell>Branch Code</HCell>
                    <HCell>Item Name</HCell>
                    <HCell align="right">Qty Sold</HCell>
                    <HCell align="right">Total Sales (₹)</HCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rows.map((row, i) => (
                    <TableRow
                      key={i}
                      hover
                      sx={{ "&:nth-of-type(even)": { bgcolor: "action.hover" } }}
                    >
                      <TableCell sx={{ color: "text.secondary", width: 40 }}>
                        {i + 1}
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={row.branchCode || "—"}
                          size="small"
                          sx={{
                            bgcolor: "#e3f2fd", color: "#1565c0",
                            fontWeight: 700, fontSize: "0.72rem",
                          }}
                        />
                      </TableCell>
                      <TableCell sx={{ fontWeight: 500 }}>
                        {row.itemName || "—"}
                      </TableCell>
                      <TableCell align="right">{fmtNum(row.qty)}</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 600 }}>
                        {fmtNum(row.totalSales)}
                      </TableCell>
                    </TableRow>
                  ))}

                  {/* Totals row */}
                  <TableRow sx={{ bgcolor: "#f0f4ff" }}>
                    <TableCell
                      colSpan={3}
                      sx={{ fontWeight: 700, fontSize: "0.82rem", color: "#1e3a5f" }}
                    >
                      TOTAL
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700, color: "#1e3a5f" }}>
                      {fmtNum(totalQty)}
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700, color: "#1e3a5f" }}>
                      {fmtNum(totalSales)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </TableContainer>
          </>
        )
      )}

      {/* ── Export dialog ──────────────────────────────────────────────── */}
      <Dialog open={exportOpen} onClose={() => setExportOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Export to Excel</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 1.5 }}>
            Enter a file name for the export:
          </DialogContentText>
          <TextField
            autoFocus fullWidth size="small" label="File Name"
            value={fileName}
            onChange={(e) => setFileName(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setExportOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleExport} startIcon={<DownloadIcon />}>
            Download
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ItemSalesReport;
