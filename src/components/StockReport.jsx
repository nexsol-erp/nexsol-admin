import React, { useState, useEffect } from 'react';
import {
  Box, TextField, Button, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Paper, Typography, CircularProgress, Autocomplete
} from '@mui/material';
import axios from 'axios';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { getItems } from "../services/apiservice";

const StockReport = () => {
  const [itemName, setItemName] = useState('');
  const [itemList, setItemList] = useState([]);
  const [reportData, setReportData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Fetch list of items for dropdown
  useEffect(() => {
    const fetchItems = async () => {
      try {
        const response = await getItems();
        console.log("Fetched items:", response.data);
        setItemList(response.data);
      } catch (error) {
        console.error("Error fetching item list:", error);
      }
    };
    fetchItems();
  }, []);

  const fetchStockReport = async () => {
    setLoading(true);
    setError(null);

    const jwtToken = localStorage.getItem('jwtToken');
    const tenancyId = localStorage.getItem('tenancyId');

    try {
      const response = await axios.get(`/api/${tenancyId}/inventory/stock-report`, {
        headers: { Authorization: `Bearer ${jwtToken}` },
        params: { itemName },
      });
      setReportData(response.data);
    } catch (error) {
      setError("Failed to fetch stock report data. Please check the item name.");
      console.error("Error fetching stock report:", error);
    } finally {
      setLoading(false);
    }
  };

  // Calculate total stock
  const totalStock = reportData.reduce((sum, row) => sum + parseFloat(row.totalStock), 0).toFixed(2);

  const handleExportToExcel = () => {
    const worksheet = XLSX.utils.json_to_sheet(reportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Stock Report');

    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([excelBuffer], { type: 'application/octet-stream' });
    saveAs(blob, `Stock_Report_${itemName || 'All_Items'}.xlsx`);
  };

  return (
    <Box sx={{ padding: 3 }}>
      <Typography variant="h4" gutterBottom>Stock Report</Typography>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, marginBottom: 2 }}>
        <Autocomplete
          options={itemList}
          freeSolo
          getOptionLabel={(option) => typeof option === 'string' ? option : option.itemName}
          value={itemName}
          onInputChange={(event, newInputValue) => setItemName(newInputValue)}
          renderInput={(params) => (
            <TextField
              {...params}
              label="Item Name"
              variant="outlined"
              sx={{ width: '30ch' }}
            />
          )}
        />

        <Button
          variant="contained"
          color="primary"
          onClick={fetchStockReport}
          disabled={loading || !itemName.trim()}
        >
          {loading ? <CircularProgress size={24} /> : 'Fetch Report'}
        </Button>
        <Button
          variant="contained"
          color="secondary"
          onClick={handleExportToExcel}
          disabled={reportData.length === 0}
        >
          Export to Excel
        </Button>
      </Box>

      {error && (
        <Typography color="error" sx={{ marginBottom: 2 }}>{error}</Typography>
      )}

      {reportData.length > 0 && (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Branch Code</TableCell>
                <TableCell>Item Name</TableCell>
                <TableCell align="right">Total Stock</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {reportData.map((row, index) => (
                <TableRow key={index}>
                  <TableCell>{row.branchCode}</TableCell>
                  <TableCell>{row.itemName}</TableCell>
                  <TableCell align="right">{parseFloat(row.totalStock).toFixed(2)}</TableCell>
                </TableRow>
              ))}
              {/* Summary Row for Total Stock */}
              <TableRow>
                <TableCell colSpan={2} sx={{ fontWeight: 'bold' }}>Total Stock</TableCell>
                <TableCell align="right" sx={{ fontWeight: 'bold' }}>{totalStock}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
};

export default StockReport;
