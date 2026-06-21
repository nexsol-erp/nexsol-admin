import React, { useState, useMemo } from "react";
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import dayjs from "dayjs";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";

const fmt = (v) => (v == null ? "0.00" : parseFloat(v).toFixed(2));

const HsnSalesSummaryReport = () => {
  const [branchCode, setBranchCode] = useState("ALL-BRANCH");
  const [branches, setBranches] = useState([]);
  const [fromDate, setFromDate] = useState(dayjs().subtract(30, "day").format("YYYY-MM-DD"));
  const [toDate, setToDate] = useState(dayjs().format("YYYY-MM-DD"));
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [exportOpen, setExportOpen] = useState(false);
  const [fileName, setFileName] = useState("HSN_Sales_Summary.xlsx");

  const allowedBranches = useMemo(() => {
    try {
      const raw = localStorage.getItem("allowedBranches");
      const list = raw ? JSON.parse(raw) : [];
      return Array.isArray(list) ? list : [];
    } catch {
      return [];
    }
  }, []);

  React.useEffect(() => {
    const fetchBranches = async () => {
      try {
        const tenancyId = localStorage.getItem("tenancyId");
        const token = localStorage.getItem("jwtToken");
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
        if (filtered.length === 1) setBranchCode(filtered[0].branchCode);
      } catch {
        setBranches([]);
      }
    };
    fetchBranches();
  }, [allowedBranches]);

  const fetchData = async () => {
    if (!fromDate || !toDate) return;
    setLoading(true);
    setError("");
    try {
      const tenancyId = localStorage.getItem("tenancyId");
      const token = localStorage.getItem("jwtToken");
      const params = new URLSearchParams({ branchCode, fromDate, toDate });
      const res = await fetch(`/api/${tenancyId}/sales/hsn-summary?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`Server error ${res.status}`);
      const data = await res.json();
      setRows(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e.message || "Failed to fetch data");
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  const totals = useMemo(
    () =>
      rows.reduce(
        (acc, r) => ({
          totalQty:       acc.totalQty       + parseFloat(r.totalQty       || 0),
          taxableValue:   acc.taxableValue   + parseFloat(r.taxableValue   || 0),
          cgstAmount:     acc.cgstAmount     + parseFloat(r.cgstAmount     || 0),
          sgstAmount:     acc.sgstAmount     + parseFloat(r.sgstAmount     || 0),
          totalTaxAmount: acc.totalTaxAmount + parseFloat(r.totalTaxAmount || 0),
          totalAmount:    acc.totalAmount    + parseFloat(r.totalAmount    || 0),
        }),
        { totalQty: 0, taxableValue: 0, cgstAmount: 0, sgstAmount: 0, totalTaxAmount: 0, totalAmount: 0 }
      ),
    [rows]
  );

  const handleExport = () => {
    const sheetData = rows.map((r) => ({
      "HSN Code":       r.hsnCode || "",
      "GST Rate (%)":   fmt(r.taxRate),
      "Total Qty":      fmt(r.totalQty),
      "Taxable Value":  fmt(r.taxableValue),
      "CGST":           fmt(r.cgstAmount),
      "SGST":           fmt(r.sgstAmount),
      "Total Tax":      fmt(r.totalTaxAmount),
      "Total Amount":   fmt(r.totalAmount),
    }));
    const ws = XLSX.utils.json_to_sheet(sheetData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "HSN Sales Summary");
    saveAs(
      new Blob([XLSX.write(wb, { bookType: "xlsx", type: "array" })], { type: "application/octet-stream" }),
      fileName
    );
    setExportOpen(false);
  };

  return (
    <Box sx={{ flexGrow: 1, p: 3, ml: "240px", mt: 2 }}>
      <Typography variant="h5" sx={{ mb: 2, fontWeight: 600 }}>
        HSN Wise Sales Summary
      </Typography>

      {/* Filters */}
      <Box sx={{ display: "flex", gap: 2, mb: 3, flexWrap: "wrap", alignItems: "flex-end" }}>
        <FormControl sx={{ minWidth: 180 }}>
          <InputLabel>Branch</InputLabel>
          <Select value={branchCode} label="Branch" onChange={(e) => setBranchCode(e.target.value)}>
            <MenuItem value="ALL-BRANCH">ALL BRANCHES</MenuItem>
            {branches.map((b) => (
              <MenuItem key={b.branchCode} value={b.branchCode}>
                {b.branchCode}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <TextField
          type="date"
          label="From Date"
          value={fromDate}
          onChange={(e) => setFromDate(e.target.value)}
          InputLabelProps={{ shrink: true }}
          sx={{ width: 170 }}
        />
        <TextField
          type="date"
          label="To Date"
          value={toDate}
          onChange={(e) => setToDate(e.target.value)}
          InputLabelProps={{ shrink: true }}
          sx={{ width: 170 }}
        />

        <Button variant="contained" onClick={fetchData} disabled={loading}>
          {loading ? "Loading…" : "Fetch Report"}
        </Button>
        <Button variant="outlined" onClick={() => setExportOpen(true)} disabled={rows.length === 0}>
          Export to Excel
        </Button>
      </Box>

      {error && (
        <Typography color="error" sx={{ mb: 2 }}>
          {error}
        </Typography>
      )}

      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead sx={{ backgroundColor: "#f0f4f8" }}>
            <TableRow>
              <TableCell sx={{ fontWeight: 700 }}>HSN Code</TableCell>
              <TableCell align="right" sx={{ fontWeight: 700 }}>GST Rate (%)</TableCell>
              <TableCell align="right" sx={{ fontWeight: 700 }}>Total Qty</TableCell>
              <TableCell align="right" sx={{ fontWeight: 700 }}>Taxable Value</TableCell>
              <TableCell align="right" sx={{ fontWeight: 700 }}>CGST</TableCell>
              <TableCell align="right" sx={{ fontWeight: 700 }}>SGST</TableCell>
              <TableCell align="right" sx={{ fontWeight: 700 }}>Total Tax</TableCell>
              <TableCell align="right" sx={{ fontWeight: 700 }}>Total Amount</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} align="center" sx={{ color: "#9ca3af", py: 4 }}>
                  {loading ? "Fetching data…" : "No data. Select filters and click Fetch Report."}
                </TableCell>
              </TableRow>
            ) : (
              <>
                {rows.map((r, i) => (
                  <TableRow key={i} hover>
                    <TableCell>{r.hsnCode || "—"}</TableCell>
                    <TableCell align="right">{fmt(r.taxRate)}</TableCell>
                    <TableCell align="right">{fmt(r.totalQty)}</TableCell>
                    <TableCell align="right">{fmt(r.taxableValue)}</TableCell>
                    <TableCell align="right">{fmt(r.cgstAmount)}</TableCell>
                    <TableCell align="right">{fmt(r.sgstAmount)}</TableCell>
                    <TableCell align="right">{fmt(r.totalTaxAmount)}</TableCell>
                    <TableCell align="right">{fmt(r.totalAmount)}</TableCell>
                  </TableRow>
                ))}
                <TableRow sx={{ backgroundColor: "#f8fafc" }}>
                  <TableCell colSpan={3} sx={{ fontWeight: 700 }}>
                    Total
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>{totals.taxableValue.toFixed(2)}</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>{totals.cgstAmount.toFixed(2)}</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>{totals.sgstAmount.toFixed(2)}</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>{totals.totalTaxAmount.toFixed(2)}</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>{totals.totalAmount.toFixed(2)}</TableCell>
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
          <DialogContentText>Enter the file name for the Excel export.</DialogContentText>
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
          <Button onClick={handleExport} variant="contained">Export</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default HsnSalesSummaryReport;
