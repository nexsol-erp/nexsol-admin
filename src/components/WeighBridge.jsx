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

const WeighBridge = () => {
  const [branch, setBranch] = useState("");
  const [branches, setBranches] = useState([]);
  const [fromDate, setFromDate] = useState(
    dayjs().subtract(30, "day").format("YYYY-MM-DDTHH:mm")
  );
  const [toDate, setToDate] = useState(dayjs().format("YYYY-MM-DDTHH:mm"));
  const [vehicleNumber, setVehicleNumber] = useState("");
  const [weighbridgeData, setWeighbridgeData] = useState([]);
  const [open, setOpen] = useState(false);
  const [fileName, setFileName] = useState("WeighbridgeData.xlsx");

  const fetchBranches = async () => {
    try {
      const tenancyId = localStorage.getItem("tenancyId");
      const token = localStorage.getItem("jwtToken");
      const response = await fetch(`/api/${tenancyId}/branches`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });
      const data = await response.json();
      setBranches(data.branches);
    } catch (error) {
      console.error("Error fetching branches:", error);
    }
  };

  // Branch is optional: leaving it on "All Branches" and typing a vehicle number
  // pulls that vehicle's weighings from every branch for the chosen period.
  const fetchWeighBridgeData = async () => {
    if (fromDate && toDate) {
      try {
        const token = localStorage.getItem("jwtToken");
        const tenancyId = localStorage.getItem("tenancyId");
        const params = new URLSearchParams({ fromDate, toDate });
        if (branch) params.append("branch", branch);
        if (vehicleNumber.trim())
          params.append("vehicleNumber", vehicleNumber.trim());
        const response = await fetch(
          `/api/${tenancyId}/weighbridge?${params.toString()}`,
          {
            method: "GET",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
          }
        );
        const data = await response.json();
        setWeighbridgeData(Array.isArray(data.data) ? data.data : []);
      } catch (error) {
        console.error("Error fetching Wb data:", error);
      }
    }
  };

  useEffect(() => {
    fetchBranches();
  }, []);

  const handleBranchChange = (event) => {
    setBranch(event.target.value);
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
    const worksheet = XLSX.utils.json_to_sheet(weighbridgeData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "WB Data");
    XLSX.write(workbook, { bookType: "xlsx", type: "array" });
    saveAs(
      new Blob([XLSX.write(workbook, { bookType: "xlsx", type: "array" })], {
        type: "application/octet-stream",
      }),
      fileName
    );
    setOpen(false);
  };

  const totalAmount = Array.isArray(weighbridgeData)
    ? weighbridgeData.reduce(
        (total, item) => total + parseFloat(item.amount),
        0
      )
    : 0;

  return (
    <Box sx={{ flexGrow: 1, p: 3, ml: "240px", mt: 2 }}>
      <FormControl fullWidth margin="normal" sx={{ mb: 3 }}>
        <InputLabel id="branch-label">Branch</InputLabel>
        <Select
          labelId="branch-label"
          label="Branch"
          value={branch}
          onChange={handleBranchChange}
          displayEmpty
        >
          <MenuItem value="">All Branches</MenuItem>
          {branches.map((branch) => (
            <MenuItem key={branch.id} value={branch.branchCode}>
              {branch.branchCode}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      <Box sx={{ display: "flex", justifyContent: "space-between", mb: 3 }}>
        <TextField
          type="datetime-local"
          label="From Date"
          value={fromDate}
          onChange={handleFromDateChange}
          InputLabelProps={{
            shrink: true,
          }}
          sx={{ flex: 1, mr: 2 }}
        />
        <TextField
          type="datetime-local"
          label="To Date"
          value={toDate}
          onChange={handleToDateChange}
          InputLabelProps={{
            shrink: true,
          }}
          sx={{ flex: 1 }}
        />
      </Box>

      <TextField
        label="Vehicle Number"
        placeholder="e.g. KL07AB1234 - leave blank for all vehicles"
        value={vehicleNumber}
        onChange={(e) => setVehicleNumber(e.target.value.toUpperCase())}
        onKeyDown={(e) => {
          if (e.key === "Enter") fetchWeighBridgeData();
        }}
        InputLabelProps={{ shrink: true }}
        fullWidth
        sx={{ mb: 3 }}
      />

      <Button
        variant="contained"
        color="primary"
        onClick={fetchWeighBridgeData}
        sx={{ mb: 3 }}
      >
        Fetch WeighBridge Sales
      </Button>

      <Button
        variant="contained"
        color="secondary"
        onClick={handleClickOpen}
        sx={{ mb: 3, ml: 2 }}
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
              <TableCell>Branch</TableCell>
              <TableCell>Voucher Number</TableCell>
              <TableCell>Voucher Date</TableCell>
              <TableCell>Vehicle Number</TableCell>
              <TableCell>Wheel Type</TableCell>
              <TableCell align="right">Machine Weight</TableCell>
              <TableCell align="right">First Weight</TableCell>
              <TableCell align="right">Amount</TableCell>
              <TableCell align="right">RoundTrip</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {weighbridgeData.map((row, index) => (
              <TableRow key={index}>
                <TableCell>{row.branch_code}</TableCell>
                <TableCell>{row.voucher_number}</TableCell>
                <TableCell>{row.voucher_date}</TableCell>
                <TableCell>{row.vehicle_number}</TableCell>
                <TableCell>{row.wheel_type}</TableCell>
                <TableCell align="right">{row.lcd_number}</TableCell>
                <TableCell align="right">{row.first_weight}</TableCell>
                <TableCell align="right">{row.amount}</TableCell>
                <TableCell align="right">{row.round_trip}</TableCell>
              </TableRow>
            ))}
            <TableRow>
              <TableCell colSpan={7} sx={{ fontWeight: "bold" }}>
                Total ({weighbridgeData.length} records)
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

export default WeighBridge;
