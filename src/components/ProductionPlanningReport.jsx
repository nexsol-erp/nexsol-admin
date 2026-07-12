// ProductionPlanningReport.jsx
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

const ProductionPlanningReport = () => {
  const [branchCode, setBranchCode] = useState("ALL");
  const [branches, setBranches] = useState([]);
  const [fromDate, setFromDate] = useState(
    dayjs().subtract(30, "day").format("YYYY-MM-DD")
  );
  const [toDate, setToDate] = useState(dayjs().format("YYYY-MM-DD"));
  const [planningData, setPlanningData] = useState([]);
  const [open, setOpen] = useState(false);
  const [fileName, setFileName] = useState("ProductionPlanningReport.xlsx");

  const fetchBranches = async () => {
    try {
      const tenancyId = localStorage.getItem("tenancyId");
      const token = localStorage.getItem("jwtToken");
      const res = await fetch(`/api/${tenancyId}/branches`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch branches");
      const data = await res.json();
      const allBranches = Array.isArray(data) ? data : data.branches || data.data || [];
      const uniqueBranches = [...new Map(allBranches.map((b) => [b.branchCode, b])).values()];
      setBranches(uniqueBranches);
    } catch (e) {
      console.error("Error fetching branches:", e);
      setBranches([]);
    }
  };

  const fetchPlanningData = async () => {
    if (!fromDate || !toDate) return;
    if (!branchCode || branchCode === "ALL") {
      alert("Please select a branch.");
      return;
    }
    try {
      const tenancyId = localStorage.getItem("tenancyId");
      const token = localStorage.getItem("jwtToken");
      const params = new URLSearchParams({ branchCode, fromDate, toDate });
      const response = await fetch(
        `/api/${tenancyId}/production-planning?${params.toString()}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );
      const data = await response.json();
      setPlanningData(Array.isArray(data) ? data : data.data || []);
    } catch (error) {
      console.error("Error fetching production planning data:", error);
    }
  };

  useEffect(() => {
    fetchBranches();
  }, []);

  const handleClickOpen = () => setOpen(true);
  const handleClose = () => setOpen(false);

  const handleExport = () => {
    const worksheet = XLSX.utils.json_to_sheet(planningData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Production Planning");
    const wbout = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
    saveAs(new Blob([wbout], { type: "application/octet-stream" }), fileName);
    setOpen(false);
  };

  const totalQty = Array.isArray(planningData)
    ? planningData.reduce((total, item) => total + (parseFloat(item.qty) || 0), 0)
    : 0;

  const totalAmount = Array.isArray(planningData)
    ? planningData.reduce((total, item) => total + (parseFloat(item.amount) || 0), 0)
    : 0;

  return (
    <Box sx={{ flexGrow: 1, p: 3, ml: "240px", mt: 2 }}>
      {/* Branch */}
      <Box sx={{ display: "flex", gap: 2, mb: 3 }}>
        <FormControl fullWidth margin="normal">
          <InputLabel id="branch-label">Branch</InputLabel>
          <Select
            labelId="branch-label"
            value={branchCode}
            label="Branch"
            onChange={(e) => setBranchCode(e.target.value)}
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
          onChange={(e) => setFromDate(e.target.value)}
          InputLabelProps={{ shrink: true }}
          sx={{ flex: 1, mr: 2 }}
        />
        <TextField
          type="date"
          label="To Date"
          value={toDate}
          onChange={(e) => setToDate(e.target.value)}
          InputLabelProps={{ shrink: true }}
          sx={{ flex: 1 }}
        />
      </Box>

      {/* Buttons */}
      <Box sx={{ mb: 3 }}>
        <Button variant="contained" color="primary" onClick={fetchPlanningData} sx={{ mr: 2 }}>
          Fetch Production Planning
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
          <Button onClick={handleClose} color="primary">Cancel</Button>
          <Button onClick={handleExport} color="primary">Export</Button>
        </DialogActions>
      </Dialog>

      {/* Table */}
      <TableContainer component={Paper} sx={{ width: "100%", mt: 2 }}>
        <Table size="small">
          <TableHead sx={{ bgcolor: "#1976d2" }}>
            <TableRow>
              <TableCell sx={{ color: "#fff" }}>Voucher No</TableCell>
              <TableCell sx={{ color: "#fff" }}>Voucher Date</TableCell>
              <TableCell sx={{ color: "#fff" }}>Branch</TableCell>
              <TableCell sx={{ color: "#fff" }}>Item Name</TableCell>
              <TableCell sx={{ color: "#fff" }}>Batch</TableCell>
              <TableCell sx={{ color: "#fff" }} align="right">Qty</TableCell>
              <TableCell sx={{ color: "#fff" }}>Unit</TableCell>
              <TableCell sx={{ color: "#fff" }} align="right">Standard Price</TableCell>
              <TableCell sx={{ color: "#fff" }} align="right">Amount</TableCell>
              <TableCell sx={{ color: "#fff" }}>Status</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {planningData.map((row, index) => (
              <TableRow key={index} hover>
                <TableCell>{row.voucherNumber}</TableCell>
                <TableCell>{row.voucherDate}</TableCell>
                <TableCell>{row.branchCode}</TableCell>
                <TableCell>{row.itemName}</TableCell>
                <TableCell>{row.batch}</TableCell>
                <TableCell align="right">{row.qty}</TableCell>
                <TableCell>{row.unit}</TableCell>
                <TableCell align="right">{row.standardPrice}</TableCell>
                <TableCell align="right">{row.amount}</TableCell>
                <TableCell>
                  {row.processedProduction ? "Executed" : "Pending"}
                </TableCell>
              </TableRow>
            ))}

            {/* Totals row */}
            <TableRow>
              <TableCell colSpan={5} sx={{ fontWeight: "bold" }}>Total</TableCell>
              <TableCell align="right" sx={{ fontWeight: "bold" }}>{totalQty.toFixed(2)}</TableCell>
              <TableCell />
              <TableCell />
              <TableCell align="right" sx={{ fontWeight: "bold" }}>{totalAmount.toFixed(2)}</TableCell>
              <TableCell />
            </TableRow>
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
};

export default ProductionPlanningReport;
