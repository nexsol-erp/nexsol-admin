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
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";

const WeighBridgeEngageReport = () => {
  const [branch, setBranch] = useState("");
  const [branches, setBranches] = useState([]);
  const [fromDate, setFromDate] = useState(dayjs().subtract(7, "day").format("YYYY-MM-DDTHH:mm"));
  const [toDate, setToDate] = useState(dayjs().format("YYYY-MM-DDTHH:mm"));
  const [engageData, setEngageData] = useState([]);
  const [open, setOpen] = useState(false);
  const [fileName, setFileName] = useState("WeighBridgeEngage.xlsx");

  const fetchBranches = async () => {
    const tenancyId = localStorage.getItem("tenancyId");
    const token = localStorage.getItem("jwtToken");
    try {
      const response = await fetch(`/api/${tenancyId}/branches`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await response.json();
      setBranches(data.branches);
    } catch (error) {
      console.error("Error fetching branches:", error);
    }
  };

  const fetchEngageData = async () => {
    if (branch && fromDate && toDate) {
      const tenancyId = localStorage.getItem("tenancyId");
      const token = localStorage.getItem("jwtToken");
      try {
        const response = await fetch(
          `/api/${tenancyId}/weighbridge/engage?branch=${branch}&fromDate=${fromDate}&toDate=${toDate}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );
        const data = await response.json();
        setEngageData(data || []);

      } catch (error) {
        console.error("Error fetching engage data:", error);
      }
    }
  };

  useEffect(() => {
    fetchBranches();
  }, []);

  const handleExport = () => {
    const worksheet = XLSX.utils.json_to_sheet(engageData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Engage Data");
    const blob = new Blob([XLSX.write(workbook, { bookType: "xlsx", type: "array" })], {
      type: "application/octet-stream",
    });
    saveAs(blob, fileName);
    setOpen(false);
  };

  return (
    <Box sx={{ flexGrow: 1, p: 3, ml: "240px", mt: 2 }}>
      <FormControl fullWidth margin="normal" sx={{ mb: 3 }}>
        <InputLabel id="branch-label">Branch</InputLabel>
        <Select
          labelId="branch-label"
          value={branch}
          onChange={(e) => setBranch(e.target.value)}
        >
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
          onChange={(e) => setFromDate(e.target.value)}
          InputLabelProps={{ shrink: true }}
          sx={{ flex: 1, mr: 2 }}
        />
        <TextField
          type="datetime-local"
          label="To Date"
          value={toDate}
          onChange={(e) => setToDate(e.target.value)}
          InputLabelProps={{ shrink: true }}
          sx={{ flex: 1 }}
        />
      </Box>

      <Button variant="contained" color="primary" onClick={fetchEngageData} sx={{ mb: 3 }}>
        Fetch Engage Report
      </Button>

      <Button variant="contained" color="secondary" onClick={() => setOpen(true)} sx={{ mb: 3, ml: 2 }}>
        Export to Excel
      </Button>

      <Dialog open={open} onClose={() => setOpen(false)}>
        <DialogTitle>Export to Excel</DialogTitle>
        <DialogContent>
          <DialogContentText>Enter the file name for the Excel file.</DialogContentText>
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
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={handleExport}>Export</Button>
        </DialogActions>
      </Dialog>

      <TableContainer component={Paper} sx={{ mt: 2 }}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Date & Time</TableCell>
              <TableCell align="right">Weight</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
  {engageData.length === 0 ? (
    <TableRow>
      <TableCell colSpan={2} align="center">
        No data available for the selected period.
      </TableCell>
    </TableRow>
  ) : (
    <>
      {engageData.map((row, index) => (
        <TableRow key={index}>
          <TableCell>{row.dateTime}</TableCell>
          <TableCell align="right">{row.weight}</TableCell>
        </TableRow>
      ))}
      <TableRow>
        <TableCell sx={{ fontWeight: "bold" }}>Total Count</TableCell>
        <TableCell align="right" sx={{ fontWeight: "bold" }}>
          {engageData.length}
        </TableCell>
      </TableRow>
    </>
  )}
</TableBody>

        </Table>
      </TableContainer>
    </Box>
  );
};

export default WeighBridgeEngageReport;
