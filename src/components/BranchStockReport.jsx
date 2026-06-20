import React, { useEffect, useState } from 'react';
import {
  Box, Button, TextField, Typography, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Paper, CircularProgress, Autocomplete
} from '@mui/material';
import axios from 'axios';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { getBranches } from '../services/apiservice';

const BranchStockReport = () => {
  const [selectedBranch, setSelectedBranch] = useState('');
  const [branchList, setBranches] = useState([]);
  const [stockData, setStockData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

useEffect(() => {
    // Fetch branches from the backend API
    const fetchBranches = async () => {
      try {
        const token = localStorage.getItem("jwtToken");
        const tenancyId = localStorage.getItem("tenancyId");
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

    fetchBranches();
  }, []);

  const fetchStock = async () => {
    setLoading(true);
    setError(null);
    const tenancyId = localStorage.getItem("tenancyId");
    const jwtToken = localStorage.getItem("jwtToken");

    try {
      const response = await axios.get(`/api/${tenancyId}/inventory/branch-stock`, {
        headers: { Authorization: `Bearer ${jwtToken}` },
        params: { branchCode: selectedBranch }
      });
      setStockData(response.data);
    } catch (err) {
      setError('Failed to fetch branch stock.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const deleteRow = async (itemId) => {
    const confirmed = window.confirm("Are you sure you want to delete stock of this item?");
    if (!confirmed) return;
    const tenancyId = localStorage.getItem("tenancyId");
    const jwtToken = localStorage.getItem("jwtToken");

    try {
      await axios.delete(`/api/${tenancyId}/inventory/delete-item-from-branch`, {
        headers: { Authorization: `Bearer ${jwtToken}` },
        params: { branchCode: selectedBranch, itemId }
      });
      setStockData(prev => prev.filter(row => row.itemId !== itemId));
    } catch (err) {
      console.error("Failed to delete row:", err);
    }
  };

  const clearStock = async () => {

    const confirmed = window.confirm("Are you sure you want delete all stock for this branch?");
    if (!confirmed) return;

    const tenancyId = localStorage.getItem("tenancyId");
    const jwtToken = localStorage.getItem("jwtToken");

    try {
      await axios.delete(`/api/${tenancyId}/inventory/clear-branch-stock`, {
        headers: { Authorization: `Bearer ${jwtToken}` },
        params: { branchCode: selectedBranch }
      });
      setStockData([]);
    } catch (err) {
      console.error("Failed to clear stock:", err);
    }
  };

  const handleExportToExcel = () => {
    const worksheet = XLSX.utils.json_to_sheet(stockData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Branch Stock');
    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([excelBuffer], { type: 'application/octet-stream' });
    saveAs(blob, `Branch_Stock_${selectedBranch}.xlsx`);
  };

  return (
    <Box sx={{ padding: 3 }}>
      <Typography variant="h4" gutterBottom>Branch Stock Report</Typography>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, marginBottom: 2 }}>
      <Autocomplete
  options={branchList}
  getOptionLabel={(option) =>
    typeof option === 'string'
      ? option
      : `(${option.branchCode})${option.branchName} `
  }
  value={branchList.find((b) => b.branchCode === selectedBranch) || null}
  onChange={(event, newValue) => {
    setSelectedBranch(newValue?.branchCode || '');
  }}
  renderInput={(params) => (
    <TextField
      {...params}
      label="Select Branch"
      variant="outlined"
      sx={{ width: '30ch' }}
    />
  )}
/>

        <Button
          variant="contained"
          color="primary"
          onClick={fetchStock}
          disabled={loading || !selectedBranch.trim()}
        >
          {loading ? <CircularProgress size={24} /> : 'Fetch Stock'}
        </Button>
        <Button
          variant="contained"
          color="secondary"
          onClick={handleExportToExcel}
          disabled={stockData.length === 0}
        >
          Export to Excel
        </Button>
      </Box>

      {error && (
        <Typography color="error" sx={{ marginBottom: 2 }}>{error}</Typography>
      )}

      {stockData.length > 0 && (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Item Code</TableCell>
                <TableCell>Item Name</TableCell>
                <TableCell align="right">Qty</TableCell>
                <TableCell align="center">Action</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {stockData.map((row, index) => (
                <TableRow key={index}>
                  <TableCell>{row.itemId}</TableCell>
                  <TableCell>{row.itemName}</TableCell>
                  <TableCell align="right">{parseFloat(row.totalQty).toFixed(2)}</TableCell>
                  <TableCell align="center">
                    <Button variant="outlined" color="error" onClick={() => deleteRow(row.itemId)}>
                      Delete
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
};

export default BranchStockReport;
