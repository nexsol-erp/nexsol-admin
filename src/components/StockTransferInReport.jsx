// StockTransferInReport.jsx
import React, { useState, useEffect } from "react";
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
} from "@mui/material";
import dayjs from "dayjs";
import "dayjs/locale/en";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import { useNavigate } from "react-router-dom";


const StockTransferInReport = () => {
  const [fromBranch, setFromBranch] = useState("");
  const [toBranch, setToBranch] = useState("");
  const [branches, setBranches] = useState([]);
  const [fromDate, setFromDate] = useState(
    dayjs().subtract(30, "day").format("YYYY-MM-DD")
  );
  const [toDate, setToDate] = useState(dayjs().format("YYYY-MM-DD"));
  const [transferData, setTransferData] = useState([]);
  const [open, setOpen] = useState(false);
  const [fileName, setFileName] = useState("StockTransferOut.xlsx");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const fetchBranches = async () => {
    try {
      setError("");
      const tenancyId = localStorage.getItem("tenancyId");
      const token = localStorage.getItem("jwtToken");

      const roles = (() => {
        try { return JSON.parse(localStorage.getItem("roles") || "[]"); }
        catch { return []; }
      })();
      const isAdmin = roles.some((r) =>
        ["admin", "system-admin", "ADMIN", "SYSTEM_ADMIN"].includes(r)
      );

      const res = await fetch(`/api/${tenancyId}/branches`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch branches");
      const branchData = await res.json();
      const allBranches = Array.isArray(branchData)
        ? branchData
        : branchData.branches || branchData.data || [];

      const uniqueBranches = [...new Map(allBranches.map((b) => [b.branchCode, b])).values()];

      if (isAdmin) {
        setBranches(uniqueBranches);
        return;
      }

      // Filter to JWT-permitted branches stored at login
      const allowedCodes = (() => {
        try {
          const parsed = JSON.parse(localStorage.getItem("allowedBranches") || "[]");
          return Array.isArray(parsed) ? parsed.map(String) : [];
        } catch { return []; }
      })();

      setBranches(
        allowedCodes.length > 0
          ? uniqueBranches.filter((b) => allowedCodes.includes(b.branchCode))
          : uniqueBranches
      );
    } catch (e) {
      console.error("Error fetching branches:", e);
      setError("Failed to load branches.");
      setBranches([]);
    }
  };

  const fetchTransferData = async () => {
    if (!fromDate || !toDate) return;

    try {
      const tenancyId = localStorage.getItem("tenancyId");
      const token = localStorage.getItem("jwtToken");



    const from = fromBranch || "ALL";
const to = toBranch || "ALL";

if (from === "ALL" && to === "ALL") {
  alert("Please select at least one specific branch (From or To).");
  return;
}



      const params = new URLSearchParams({
        fromBranch: from,
        toBranch: to,
        fromDate,
        toDate,
      });

      const response = await fetch(
        `/api/${tenancyId}/stock-transfers/in?${params.toString()}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );
      const data = await response.json();
      setTransferData(data.data || []);
    } catch (error) {
      console.error("Error fetching stock transfer data:", error);
    }
  };

  useEffect(() => {
    fetchBranches();
  }, []);

  const handleFromBranchChange = (event) => {
    setFromBranch(event.target.value);
  };

  const handleToBranchChange = (event) => {
    setToBranch(event.target.value);
  };

  const handleFromDateChange = (event) => {
    setFromDate(event.target.value);
  };

  const handleToDateChange = (event) => {
    setToDate(event.target.value);
  };

  const handleClickOpen = () => {
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
  };

  const handleExport = () => {
    const worksheet = XLSX.utils.json_to_sheet(transferData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Stock Transfer Out");
    const wbout = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
    saveAs(
      new Blob([wbout], {
        type: "application/octet-stream",
      }),
      fileName
    );
    setOpen(false);
  };

  const totalAmount = Array.isArray(transferData)
    ? transferData.reduce(
        (total, item) => total + (parseFloat(item.amount) || 0),
        0
      )
    : 0;

  const totalQty = Array.isArray(transferData)
    ? transferData.reduce(
        (total, item) => total + (parseFloat(item.qty) || 0),
        0
      )
    : 0;

  // 🔴 IMPORTANT:
  // Replace `row.transId` with your actual header id field
  // e.g. row.id, row.parentId, row.stockTransHdrId etc.
const handleRowClick = (row) => {
  const qs = new URLSearchParams({
    fromBranch: row.branchCode,          // from branch
    voucherDate: row.voucherDate,        // voucher date
  }).toString();

  navigate(`/stock-transfer-out/invoice/${row.voucherNumber}?${qs}`);
};
  
  return (
    <Box sx={{ flexGrow: 1, p: 3, ml: "240px", mt: 2 }}>
      {/* From Branch & To Branch */}
      <Box sx={{ display: "flex", gap: 2, mb: 3 }}>
        <FormControl fullWidth margin="normal">
          <InputLabel id="from-branch-label">From Branch</InputLabel>
          <Select
            labelId="from-branch-label"
            value={fromBranch}
            label="From Branch"
            onChange={handleFromBranchChange}
          >
            <MenuItem value="ALL">ALL</MenuItem>
            {branches.map((b) => (
              <MenuItem key={b.branchCode} value={b.branchCode}>
                {b.branchCode} {b.branchName ? `- ${b.branchName}` : ""}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl fullWidth margin="normal">
          <InputLabel id="to-branch-label">To Branch</InputLabel>
          <Select
            labelId="to-branch-label"
            value={toBranch}
            label="To Branch"
            onChange={handleToBranchChange}
          >
            <MenuItem value="ALL">ALL</MenuItem>
            {branches.map((b) => (
              <MenuItem key={b.branchCode} value={b.branchCode}>
                {b.branchCode} {b.branchName ? `- ${b.branchName}` : ""}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>

      {/* Dates */}
      <Box sx={{ display: "flex", justifyContent: "space-between", mb: 3 }}>
        <TextField
          type="date"
          label="From Date"
          value={fromDate}
          onChange={handleFromDateChange}
          InputLabelProps={{
            shrink: true,
          }}
          sx={{ flex: 1, mr: 2 }}
        />
        <TextField
          type="date"
          label="To Date"
          value={toDate}
          onChange={handleToDateChange}
          InputLabelProps={{
            shrink: true,
          }}
          sx={{ flex: 1 }}
        />
      </Box>

      {/* Buttons */}
      <Box sx={{ mb: 3 }}>
        <Button
          variant="contained"
          color="primary"
          onClick={fetchTransferData}
          sx={{ mr: 2 }}
        >
          Fetch Stock Transfer Out
        </Button>

        <Button variant="contained" color="secondary" onClick={handleClickOpen}>
          Export to Excel
        </Button>
      </Box>

      {/* Export dialog */}
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

      {/* Table */}
      <TableContainer component={Paper} sx={{ width: "100%", mt: 2 }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Voucher No</TableCell>
              <TableCell>Voucher Date</TableCell>
              <TableCell>From Branch</TableCell>
              <TableCell>To Branch</TableCell>
              <TableCell>Item Name</TableCell>
              <TableCell align="right">Qty</TableCell>
              <TableCell align="right">Rate</TableCell>
              <TableCell align="right">Amount</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {transferData.map((row, index) => (
              <TableRow
                key={index}
                hover
                sx={{ cursor: "pointer" }}
                onClick={() => handleRowClick(row)}
              >
                <TableCell>{row.voucherNumber}</TableCell>
                <TableCell>{row.voucherDate}</TableCell>
                <TableCell>{row.branchCode}</TableCell>
                <TableCell>{row.toBranchCode}</TableCell>
                <TableCell>{row.itemName}</TableCell>
                <TableCell align="right">{row.qty}</TableCell>
                <TableCell align="right">{row.rate}</TableCell>
                <TableCell align="right">{row.amount}</TableCell>
              </TableRow>
            ))}

            {/* Totals row */}
            <TableRow>
              <TableCell colSpan={5} sx={{ fontWeight: "bold" }}>
                Total
              </TableCell>
              <TableCell align="right" sx={{ fontWeight: "bold" }}>
                {totalQty.toFixed(2)}
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

export default StockTransferInReport;
