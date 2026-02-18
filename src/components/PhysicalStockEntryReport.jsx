import React, { useState, useEffect, useMemo } from "react";
import {
  Box,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  TextField,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Typography,
  Alert,
} from "@mui/material";
import dayjs from "dayjs";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import { useNavigate } from "react-router-dom";

const PhysicalStockEntryReport = () => {
  const [selectedBranch, setSelectedBranch] = useState("ALL");
  const [branches, setBranches] = useState([]);
  const [branch, setBranch] = useState("");

  const [fromDate, setFromDate] = useState(
    dayjs().subtract(30, "day").format("YYYY-MM-DD")
  );
  const [toDate, setToDate] = useState(dayjs().format("YYYY-MM-DD"));

  const [reportData, setReportData] = useState([]);
  const [open, setOpen] = useState(false);
  const [fileName, setFileName] = useState("PhysicalStockReport.xlsx");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();

  const allowedBranches = useMemo(() => {
    try {
      const raw = localStorage.getItem("allowedBranches");
      const list = raw ? JSON.parse(raw) : [];
      return Array.isArray(list) ? list : [];
    } catch {
      return [];
    }
  }, []);

  const fetchBranches = async () => {
    try {
      const tenancyId = localStorage.getItem("tenancyId");
      const token = localStorage.getItem("jwtToken");

      const response = await fetch(`/api/${tenancyId}/branches`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) throw new Error("Failed to fetch branches");
      const data = await response.json();

      const list = Array.isArray(data) ? data : data.branches || data.data || [];
      const filtered = allowedBranches.length
        ? list.filter((b) => allowedBranches.includes(b.branchCode))
        : [];

      setBranches(filtered);

      if (!branch && filtered.length === 1) {
        setSelectedBranch(filtered[0].branchCode);
      }
    } catch (e) {
      setError("Failed to load branches.");
    }
  };

  const fetchStockData = async () => {
    if (!fromDate || !toDate) return;

    try {
      setLoading(true);
      setError("");

      const tenancyId = localStorage.getItem("tenancyId");
      const token = localStorage.getItem("jwtToken");

      const params = new URLSearchParams({
        branchCode: selectedBranch,
        fromDate,
        toDate,
        voucherType: "PHYSICAL_STOCK",
      });

      const response = await fetch(
        `/api/${tenancyId}/physical-stock-entries?${params.toString()}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (!response.ok) throw new Error("Failed to fetch report");

      const data = await response.json();
      const rows = Array.isArray(data) ? data : data.data || [];
      setReportData(rows);
    } catch (e) {
      setError("Failed to fetch physical stock report.");
      setReportData([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBranches();
  }, []);

  // ---- Helpers ----
const getQtyIn = (row) => Number(row.qtyIn ?? 0);
const getQtyOut = (row) => Number(row.qtyOut ?? 0);
const getRate = (row) => Number(row.rate ?? 0);
const getAmount = (row) =>
  (getQtyIn(row) - getQtyOut(row)) * getRate(row);

const fmtDate = (dt) => (dt ? dayjs(dt).format("YYYY-MM-DD") : "-");
  // ---- Totals ----
  const totalQtyIn = reportData.reduce((sum, row) => sum + getQtyIn(row), 0);
  const totalQtyOut = reportData.reduce((sum, row) => sum + getQtyOut(row), 0);
  const totalAmount = reportData.reduce((sum, row) => sum + getAmount(row), 0);

  // ---- Export ----
  const handleExport = () => {
  const excelData = reportData.map((row) => ({
    ID: row.id,
    "Voucher Date": row.voucherDate
      ? dayjs(row.voucherDate).format("YYYY-MM-DD HH:mm:ss")
      : "",
    "Branch Code": row.branchCode || "",
    "Voucher No": row.voucherNumber || "",
    "Item Name": row.itemName || "",
    Barcode: row.barcode || "",
    "Qty In": getQtyIn(row),
    "Qty Out": getQtyOut(row),
    Rate: getRate(row),
    Amount: getAmount(row),
    Description: row.description || "",
  }));

  const worksheet = XLSX.utils.json_to_sheet(excelData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Physical Stock");

  const wbout = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
  saveAs(new Blob([wbout]), fileName);
  setOpen(false);
};


  const handleRowClick = (row) => {
    navigate(`/physical-stock-entry/view/${row.id}`);
  };

  return (
    <Box sx={{ flexGrow: 1, p: 3, ml: "240px", mt: 2 }}>
      <Typography variant="h5" sx={{ mb: 2 }}>
        Physical Stock Report
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* Filters */}
      <Box sx={{ display: "flex", gap: 2, mb: 3 }}>
        <FormControl fullWidth>
          <InputLabel>Branch</InputLabel>
          <Select
            value={selectedBranch}
            label="Branch"
            onChange={(e) => setSelectedBranch(e.target.value)}
          >
            <MenuItem value="ALL">ALL</MenuItem>
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
          fullWidth
        />

        <TextField
          type="date"
          label="To Date"
          value={toDate}
          onChange={(e) => setToDate(e.target.value)}
          InputLabelProps={{ shrink: true }}
          fullWidth
        />
      </Box>

      {/* Buttons */}
      <Box sx={{ mb: 3 }}>
        <Button variant="contained" onClick={fetchStockData} sx={{ mr: 2 }}>
          {loading ? "Fetching..." : "Fetch Report"}
        </Button>
        <Button
          variant="contained"
          color="secondary"
          onClick={() => setOpen(true)}
          disabled={!reportData.length}
        >
          Export Excel
        </Button>
      </Box>

      {/* Table */}
      <TableContainer component={Paper}>
        <Table size="small">
      <TableHead>
  <TableRow sx={{ backgroundColor: "#0e0101" }}>
    <TableCell>Voucher Date</TableCell>
    <TableCell>Voucher No</TableCell>
    <TableCell>Item Name</TableCell>
    <TableCell>Barcode</TableCell>
    <TableCell align="right">Qty In</TableCell>
    <TableCell align="right">Qty Out</TableCell>
    <TableCell align="right">Rate</TableCell>
    <TableCell align="right">Amount</TableCell>
  </TableRow>
</TableHead>


          <TableBody>
  {reportData.map((row) => (
    <TableRow
      key={row.id}
      hover
      onClick={() => handleRowClick(row)}
      sx={{ cursor: "pointer" }}
    >
      <TableCell>{fmtDate(row.voucherDate)}</TableCell>
      <TableCell>{row.voucherNumber || "-"}</TableCell>
      <TableCell>{row.itemName || "-"}</TableCell>
      <TableCell>{row.barcode || "-"}</TableCell>
      <TableCell align="right">
        {getQtyIn(row).toFixed(2)}
      </TableCell>
      <TableCell align="right">
        {getQtyOut(row).toFixed(2)}
      </TableCell>
      <TableCell align="right">
        {getRate(row).toFixed(2)}
      </TableCell>
      <TableCell align="right">
        {getAmount(row).toFixed(2)}
      </TableCell>
    </TableRow>
  ))}

  {/* Totals */}
  <TableRow>
    <TableCell colSpan={4} sx={{ fontWeight: "bold", textAlign: "right" }}>
      Total:
    </TableCell>
    <TableCell align="right" sx={{ fontWeight: "bold" }}>
      {totalQtyIn.toFixed(2)}
    </TableCell>
    <TableCell align="right" sx={{ fontWeight: "bold" }}>
      {totalQtyOut.toFixed(2)}
    </TableCell>
    <TableCell />
    <TableCell align="right" sx={{ fontWeight: "bold" }}>
      {totalAmount.toFixed(2)}
    </TableCell>
  </TableRow>
</TableBody>




        </Table>
      </TableContainer>
    </Box>
  );
};

export default PhysicalStockEntryReport;
