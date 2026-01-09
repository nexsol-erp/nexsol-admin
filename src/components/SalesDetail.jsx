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
  Alert,
} from "@mui/material";
import dayjs from "dayjs";
import "dayjs/locale/en";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";

const SalesDetail = () => {
  const [branch, setBranch] = useState("");
  const [branches, setBranches] = useState([]);
  const [fromDate, setFromDate] = useState(
    dayjs().subtract(30, "day").format("YYYY-MM-DD")
  );
  const [toDate, setToDate] = useState(dayjs().format("YYYY-MM-DD"));
  const [salesData, setSalesData] = useState([]);
  const [open, setOpen] = useState(false);
  const [fileName, setFileName] = useState("SalesData.xlsx");
  const [error, setError] = useState("");

  // ✅ Read allowed branches (stored during login from JWT claims)
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
      setError("");
      const tenancyId = localStorage.getItem("tenancyId");
      const token = localStorage.getItem("jwtToken");

      const response = await fetch(`/api/${tenancyId}/branches`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) throw new Error("Failed to fetch branches");

      const data = await response.json();

      // Normalize: support {branches:[...]} or {data:[...]} or [...]
      const list = Array.isArray(data) ? data : data.branches || data.data || [];

      // ✅ Filter branches by allowedBranches list
      const filtered = allowedBranches.length
        ? list.filter((b) => allowedBranches.includes(b.branchCode))
        : [];

      setBranches(filtered);

      // ✅ Auto-select if only one branch allowed
      if (!branch && filtered.length === 1) {
        setBranch(filtered[0].branchCode);
      }

      // ✅ If current selection is not allowed anymore, clear it
      if (branch && !filtered.some((b) => b.branchCode === branch)) {
        setBranch("");
      }
    } catch (e) {
      console.error("Error fetching branches:", e);
      setError("Failed to load branches.");
      setBranches([]);
      setBranch("");
    }
  };

  const fetchSalesData = async () => {
    if (branch && fromDate && toDate) {
      try {
        setError("");
        const tenancyId = localStorage.getItem("tenancyId");
        const token = localStorage.getItem("jwtToken");

        const response = await fetch(
          `/api/${tenancyId}/sales/salesdata?branch=${encodeURIComponent(
            branch
          )}&fromDate=${encodeURIComponent(fromDate)}&toDate=${encodeURIComponent(
            toDate
          )}`,
          {
            method: "GET",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
          }
        );

        if (!response.ok) throw new Error("Failed to fetch sales data");

        const data = await response.json();
        setSalesData(data.data || []);
      } catch (error) {
        console.error("Error fetching sales data:", error);
        setError("Failed to fetch sales data.");
        setSalesData([]);
      }
    } else {
      setError("Please select branch and date range.");
    }
  };

  useEffect(() => {
    fetchBranches();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleBranchChange = (event) => setBranch(event.target.value);
  const handleFromDateChange = (event) => setFromDate(event.target.value);
  const handleToDateChange = (event) => setToDate(event.target.value);

  const handleClickOpen = () => setOpen(true);
  const handleClose = () => setOpen(false);

  const handleExport = () => {
    const worksheet = XLSX.utils.json_to_sheet(salesData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Sales Data");

    const excelBytes = XLSX.write(workbook, { bookType: "xlsx", type: "array" });

    saveAs(
      new Blob([excelBytes], { type: "application/octet-stream" }),
      fileName
    );

    setOpen(false);
  };

  const totalAmount = Array.isArray(salesData)
    ? salesData.reduce((total, item) => total + parseFloat(item.amount || 0), 0)
    : 0;

  return (
    <Box sx={{ flexGrow: 1, p: 3, ml: "240px", mt: 2 }}>
      {allowedBranches.length === 0 && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          No allowed branches found in login claims. Please login again or check
          branch assignments.
        </Alert>
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <FormControl fullWidth margin="normal" sx={{ mb: 3 }}>
        <InputLabel id="branch-label">Branch</InputLabel>
        <Select
          labelId="branch-label"
          label="Branch"
          value={branch}
          onChange={handleBranchChange}
          disabled={branches.length === 0}
        >
          {branches.map((b) => (
            <MenuItem key={b.branchCode} value={b.branchCode}>
              {b.branchCode}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      <Box sx={{ display: "flex", justifyContent: "space-between", mb: 3 }}>
        <TextField
          type="date"
          label="From Date"
          value={fromDate}
          onChange={handleFromDateChange}
          InputLabelProps={{ shrink: true }}
          sx={{ flex: 1, mr: 2 }}
        />
        <TextField
          type="date"
          label="To Date"
          value={toDate}
          onChange={handleToDateChange}
          InputLabelProps={{ shrink: true }}
          sx={{ flex: 1 }}
        />
      </Box>

      <Button
        variant="contained"
        color="primary"
        onClick={fetchSalesData}
        sx={{ mb: 3 }}
        disabled={!branch}
      >
        Fetch Sales Data
      </Button>

      <Button
        variant="contained"
        color="secondary"
        onClick={handleClickOpen}
        sx={{ mb: 3, ml: 2 }}
        disabled={!salesData || salesData.length === 0}
      >
        Export to Excel
      </Button>

      <Dialog open={open} onClose={handleClose}>
        <DialogTitle>Export to Excel</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Please enter the file name for the Excel file.
          </DialogContentText>
          <TextField
            autoFocus
            margin="dense"
            label="File Name"
            type="text"
            fullWidth
            value={fileName}
            onChange={(e) => setFileName(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose} color="primary">
            Cancel
          </Button>
          <Button onClick={handleExport} color="primary">
            Export
          </Button>
        </DialogActions>
      </Dialog>

      <TableContainer component={Paper} sx={{ width: "100%", mt: 2 }}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Voucher Number</TableCell>
              <TableCell>Voucher Date</TableCell>
              <TableCell>Item Name</TableCell>
              <TableCell align="right">Quantity</TableCell>
              <TableCell align="right">Rate</TableCell>
               <TableCell align="right">TaxRate</TableCell>
              <TableCell align="right">Amount</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {salesData.map((row, index) => (
              <TableRow key={index}>
                <TableCell>{row.voucher_number}</TableCell>
                <TableCell>{row.voucher_date}</TableCell>
                <TableCell>{row.item_name}</TableCell>
                <TableCell align="right">{row.qty}</TableCell>
                <TableCell align="right">{row.rate}</TableCell>
                 <TableCell align="right">{row.tax_rate}</TableCell>
                <TableCell align="right">{row.amount}</TableCell>
              </TableRow>
            ))}

            <TableRow>
              <TableCell colSpan={5} sx={{ fontWeight: "bold" }}>
                Total
              </TableCell>
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

export default SalesDetail;
