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
} from "@mui/material";
import dayjs from "dayjs";
import "dayjs/locale/en";

const SalesDetail = () => {
  const [branch, setBranch] = useState("");
  const [branches, setBranches] = useState([]);
  const [fromDate, setFromDate] = useState(
    dayjs().subtract(30, "day").format("YYYY-MM-DD")
  );
  const [toDate, setToDate] = useState(dayjs().format("YYYY-MM-DD"));
  const [salesData, setSalesData] = useState([]);

  const fetchBranches = async () => {
    try {
      const response = await fetch(
        "http://localhost:8082/api/nexsoldb/branches"
      );
      const data = await response.json();
      setBranches(data.branches);
    } catch (error) {
      console.error("Error fetching branches:", error);
    }
  };

  const fetchSalesData = async () => {
    if (branch && fromDate && toDate) {
      try {
        const response = await fetch(
          `http://localhost:8082/api/nexsoldb/salesdata?branch=${branch}&fromDate=${fromDate}&toDate=${toDate}`
        );
        const data = await response.json();
        setSalesData(data.data);
      } catch (error) {
        console.error("Error fetching sales data:", error);
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

  const totalAmount = Array.isArray(salesData)
    ? salesData.reduce((total, item) => total + parseFloat(item.amount), 0)
    : 0;

  return (
    <Box sx={{ flexGrow: 1, p: 3, ml: "240px", mt: 2 }}>
      <FormControl fullWidth margin="normal" sx={{ mb: 3 }}>
        <InputLabel id="branch-label">Branch</InputLabel>
        <Select
          labelId="branch-label"
          value={branch}
          onChange={handleBranchChange}
        >
          {branches.map((branch) => (
            <MenuItem key={branch.id} value={branch.name}>
              {branch.name}
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

      <Button
        variant="contained"
        color="primary"
        onClick={fetchSalesData}
        sx={{ mb: 3 }}
      >
        Fetch Sales Data
      </Button>

      <TableContainer component={Paper} sx={{ width: "100%", mt: 2 }}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Voucher Number</TableCell>
              <TableCell>Voucher Date</TableCell>
              <TableCell>Item Name</TableCell>
              <TableCell align="right">Quantity</TableCell>
              <TableCell align="right">Rate</TableCell>
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
