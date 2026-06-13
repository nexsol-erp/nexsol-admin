import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Box,
  Button,
  TextField,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  CircularProgress,
  Autocomplete,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
} from "@mui/material";
import dayjs from "dayjs";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";

function r2(v) { return Math.round((Number(v) || 0) * 100) / 100; }
function fmt(v) { const n = r2(v); return n === 0 ? "" : n.toFixed(2); }

const ItemMovementReport = () => {
  const tenancyId = localStorage.getItem("tenancyId");
  const token = localStorage.getItem("jwtToken");

  const allowedBranches = useMemo(() => {
    try {
      const raw = localStorage.getItem("allowedBranches");
      const list = raw ? JSON.parse(raw) : [];
      return Array.isArray(list) ? list : [];
    } catch { return []; }
  }, []);

  const [branches, setBranches] = useState([]);
  const [selectedBranch, setSelectedBranch] = useState(null);

  const [itemOptions, setItemOptions] = useState([]);
  const [itemInputValue, setItemInputValue] = useState("");
  const [selectedItem, setSelectedItem] = useState(null);
  const [itemLoading, setItemLoading] = useState(false);

  const [fromDate, setFromDate] = useState(dayjs().startOf("month").format("YYYY-MM-DD"));
  const [toDate, setToDate] = useState(dayjs().format("YYYY-MM-DD"));

  const [openingBalance, setOpeningBalance] = useState(null);
  const [closingBalance, setClosingBalance] = useState(null);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fetched, setFetched] = useState(false);
  const [error, setError] = useState(null);

  const [exportOpen, setExportOpen] = useState(false);
  const [fileName, setFileName] = useState("ItemMovementReport.xlsx");

  // Load branches
  useEffect(() => {
    const fetchBranches = async () => {
      try {
        const res = await fetch(`/api/${tenancyId}/branches`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;
        const data = await res.json();
        const list = Array.isArray(data) ? data : data.branches || data.data || [];
        const filtered = allowedBranches.length
          ? list.filter((b) => allowedBranches.includes(b.branchCode))
          : list;
        setBranches(filtered);
        if (filtered.length === 1) setSelectedBranch(filtered[0]);
      } catch {}
    };
    fetchBranches();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debounced item search
  useEffect(() => {
    if (!itemInputValue.trim()) { setItemOptions([]); return; }
    const tid = setTimeout(async () => {
      setItemLoading(true);
      try {
        const res = await fetch(
          `/api/${tenancyId}/items-search?query=${encodeURIComponent(itemInputValue)}&page=0&size=20&sort=itemName,asc`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (!res.ok) return;
        const data = await res.json();
        setItemOptions(data.content || []);
      } catch {} finally {
        setItemLoading(false);
      }
    }, 300);
    return () => clearTimeout(tid);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemInputValue]);

  const fetchReport = useCallback(async () => {
    if (!selectedBranch) { setError("Please select a branch."); return; }
    if (!selectedItem)   { setError("Please select an item.");  return; }
    setError(null);
    setLoading(true);
    try {
      const params = new URLSearchParams({
        itemId: selectedItem.itemId,
        branchCode: selectedBranch.branchCode,
        fromDate,
        toDate,
      });
      const res = await fetch(`/api/${tenancyId}/reports/item-movement?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setRows(Array.isArray(data.rows) ? data.rows : []);
      setOpeningBalance(data.openingBalance ?? 0);
      setClosingBalance(data.closingBalance ?? 0);
      setFetched(true);
    } catch (e) {
      setError("Failed to load report: " + (e.message || "Unknown error"));
    } finally {
      setLoading(false);
    }
  }, [selectedBranch, selectedItem, fromDate, toDate, tenancyId, token]);

  const totalIn  = rows.reduce((s, r) => s + (Number(r.qtyIn)  || 0), 0);
  const totalOut = rows.reduce((s, r) => s + (Number(r.qtyOut) || 0), 0);

  const handleExport = () => {
    const sheetRows = rows.map((r) => ({
      "Date":       r.voucherDate ? String(r.voucherDate).slice(0, 10) : "",
      "Voucher #":  r.voucherNumber || r.sourceVoucher || "",
      "Particulars": r.particulars || "",
      "Batch":      r.batch || "",
      "Qty In":     Number(r.qtyIn)  || 0,
      "Qty Out":    Number(r.qtyOut) || 0,
      "Balance":    r2(r.balance),
    }));
    const ws = XLSX.utils.json_to_sheet(sheetRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Item Movement");
    const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    saveAs(new Blob([buf], { type: "application/octet-stream" }), fileName);
    setExportOpen(false);
  };

  return (
    <Box sx={{ p: { xs: 1, sm: 3 } }}>
      <Typography variant="h6" sx={{ mb: 2, fontWeight: 700 }}>
        Item Movement Report
      </Typography>

      {/* Filters */}
      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2, mb: 2, alignItems: "flex-start" }}>
        {/* Branch */}
        <Autocomplete
          options={branches}
          getOptionLabel={(b) => `${b.branchCode} – ${b.branchName || b.branchCode}`}
          value={selectedBranch}
          onChange={(_, v) => { setSelectedBranch(v); setFetched(false); setRows([]); }}
          renderInput={(params) => (
            <TextField {...params} label="Branch" size="small" sx={{ width: 220 }} />
          )}
          isOptionEqualToValue={(o, v) => o.branchCode === v.branchCode}
        />

        {/* Item */}
        <Autocomplete
          options={itemOptions}
          getOptionLabel={(it) => it.itemName || ""}
          inputValue={itemInputValue}
          value={selectedItem}
          onInputChange={(_, v) => setItemInputValue(v)}
          onChange={(_, v) => { setSelectedItem(v); setFetched(false); setRows([]); }}
          loading={itemLoading}
          filterOptions={(x) => x}
          renderInput={(params) => (
            <TextField
              {...params}
              label="Item"
              size="small"
              sx={{ width: 260 }}
              InputProps={{
                ...params.InputProps,
                endAdornment: (
                  <>
                    {itemLoading ? <CircularProgress color="inherit" size={14} /> : null}
                    {params.InputProps.endAdornment}
                  </>
                ),
              }}
            />
          )}
          isOptionEqualToValue={(o, v) => o.itemId === v.itemId}
        />

        {/* From date */}
        <TextField
          type="date"
          label="From"
          size="small"
          value={fromDate}
          onChange={(e) => { setFromDate(e.target.value); setFetched(false); }}
          InputLabelProps={{ shrink: true }}
          sx={{ width: 155 }}
        />

        {/* To date */}
        <TextField
          type="date"
          label="To"
          size="small"
          value={toDate}
          onChange={(e) => { setToDate(e.target.value); setFetched(false); }}
          InputLabelProps={{ shrink: true }}
          sx={{ width: 155 }}
        />

        <Button variant="contained" onClick={fetchReport} disabled={loading} sx={{ height: 40 }}>
          {loading ? <CircularProgress size={18} color="inherit" /> : "Load"}
        </Button>

        <Button
          variant="outlined"
          onClick={() => setExportOpen(true)}
          disabled={!rows.length}
          sx={{ height: 40 }}
        >
          Export Excel
        </Button>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {/* Opening balance */}
      {fetched && openingBalance !== null && (
        <Box sx={{
          display: "flex", justifyContent: "space-between",
          bgcolor: "action.hover", border: "1px solid", borderColor: "divider",
          borderRadius: 1, px: 2, py: 0.75, mb: 1,
        }}>
          <Typography variant="body2" fontWeight={700}>Opening Balance</Typography>
          <Typography variant="body2" fontWeight={700}
            sx={{ color: openingBalance >= 0 ? "success.main" : "error.main" }}>
            {r2(openingBalance).toFixed(2)}
          </Typography>
        </Box>
      )}

      {/* Table */}
      <TableContainer component={Paper} sx={{ maxHeight: "65vh" }}>
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell>Date</TableCell>
              <TableCell>Voucher #</TableCell>
              <TableCell>Particulars</TableCell>
              <TableCell>Batch</TableCell>
              <TableCell align="right">Qty In</TableCell>
              <TableCell align="right">Qty Out</TableCell>
              <TableCell align="right">Balance</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((row, i) => (
              <TableRow key={i} hover>
                <TableCell>{row.voucherDate ? String(row.voucherDate).slice(0, 10) : ""}</TableCell>
                <TableCell>{row.voucherNumber || row.sourceVoucher || ""}</TableCell>
                <TableCell>{row.particulars || ""}</TableCell>
                <TableCell>{row.batch || ""}</TableCell>
                <TableCell align="right" sx={{ color: "success.main" }}>{fmt(row.qtyIn)}</TableCell>
                <TableCell align="right" sx={{ color: "error.main" }}>{fmt(row.qtyOut)}</TableCell>
                <TableCell align="right"><strong>{r2(row.balance).toFixed(2)}</strong></TableCell>
              </TableRow>
            ))}

            {fetched && rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} align="center" sx={{ color: "text.secondary", py: 3 }}>
                  No movements found for this period
                </TableCell>
              </TableRow>
            )}

            {!fetched && (
              <TableRow>
                <TableCell colSpan={7} align="center" sx={{ color: "text.secondary", py: 3 }}>
                  Select branch, item and date range, then click Load
                </TableCell>
              </TableRow>
            )}

            {/* Totals */}
            {rows.length > 0 && (
              <>
                <TableRow sx={{ bgcolor: "action.selected" }}>
                  <TableCell colSpan={4} align="right"><strong>Total</strong></TableCell>
                  <TableCell align="right" sx={{ color: "success.main" }}>
                    <strong>{r2(totalIn).toFixed(2)}</strong>
                  </TableCell>
                  <TableCell align="right" sx={{ color: "error.main" }}>
                    <strong>{r2(totalOut).toFixed(2)}</strong>
                  </TableCell>
                  <TableCell />
                </TableRow>
                <TableRow sx={{ bgcolor: "primary.dark" }}>
                  <TableCell colSpan={6} align="right" sx={{ color: "primary.contrastText" }}>
                    <strong>Closing Balance</strong>
                  </TableCell>
                  <TableCell align="right" sx={{ color: "primary.contrastText" }}>
                    <strong>{r2(closingBalance ?? 0).toFixed(2)}</strong>
                  </TableCell>
                </TableRow>
              </>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Export dialog */}
      <Dialog open={exportOpen} onClose={() => setExportOpen(false)}>
        <DialogTitle>Export to Excel</DialogTitle>
        <DialogContent>
          <DialogContentText>Enter a file name for the Excel export:</DialogContentText>
          <TextField
            autoFocus
            margin="dense"
            label="File Name"
            fullWidth
            value={fileName}
            onChange={(e) => setFileName(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setExportOpen(false)}>Cancel</Button>
          <Button onClick={handleExport}>Export</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ItemMovementReport;
