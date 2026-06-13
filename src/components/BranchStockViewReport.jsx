import React, { useEffect, useState, useMemo } from "react";
import {
  Box,
  Button,
  TextField,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  CircularProgress,
  Autocomplete,
} from "@mui/material";
import axios from "axios";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";

const BranchStockViewReport = () => {
  const [selectedBranch, setSelectedBranch] = useState("");
  const [branchList, setBranches] = useState([]);
  const [stockData, setStockData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const allowedBranches = useMemo(() => {
    try {
      const raw = localStorage.getItem("allowedBranches");
      const list = raw ? JSON.parse(raw) : [];
      return Array.isArray(list) ? list : [];
    } catch {
      return [];
    }
  }, []);

  useEffect(() => {
    const fetchBranches = async () => {
      try {
        setError(null);
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
        const list = Array.isArray(data) ? data : data.branches || data.data || [];

        const filtered = allowedBranches.length
          ? list.filter((b) => allowedBranches.includes(b.branchCode))
          : list;

        setBranches(filtered);

        if (filtered.length === 1) {
          setSelectedBranch(filtered[0].branchCode);
        }
      } catch (e) {
        console.error("Error fetching branches:", e);
        setError("Failed to load branches.");
        setBranches([]);
      }
    };

    fetchBranches();
  }, []);

  const fetchStock = async () => {
    if (!selectedBranch) return;
    setLoading(true);
    setError(null);
    const tenancyId = localStorage.getItem("tenancyId");
    const jwtToken = localStorage.getItem("jwtToken");

    try {
      const res = await axios.get(`/api/${tenancyId}/inventory/branch-stock`, {
        headers: { Authorization: `Bearer ${jwtToken}` },
        params: { branchCode: selectedBranch },
      });
      setStockData(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error(err);
      setError("Failed to fetch branch stock.");
    } finally {
      setLoading(false);
    }
  };

  const grandTotal = stockData.reduce((sum, row) => {
    const qty = parseFloat(row.totalQty ?? 0);
    const price = parseFloat(row.standardPrice ?? 0);
    return sum + qty * price;
  }, 0);

  const handleExportToExcel = () => {
    const rows = stockData.map((row) => {
      const qty = parseFloat(row.totalQty ?? 0);
      const price = parseFloat(row.standardPrice ?? 0);
      return {
        "Item Code": row.itemId ?? "",
        "Item Name": row.itemName ?? "",
        "Qty": qty,
        "Unit": row.unit ?? "",
        "HSN": row.hsn ?? "",
        "Standard Price": price || "",
        "Stock Value": price ? parseFloat((qty * price).toFixed(2)) : "",
      };
    });
    rows.push({
      "Item Code": "",
      "Item Name": "TOTAL",
      "Qty": "",
      "Unit": "",
      "HSN": "",
      "Standard Price": "",
      "Stock Value": parseFloat(grandTotal.toFixed(2)),
    });
    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Branch Stock");
    const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
    const blob = new Blob([excelBuffer], { type: "application/octet-stream" });
    saveAs(blob, `Branch_Stock_${selectedBranch}.xlsx`);
  };

  return (
    <Box sx={{ padding: 3 }}>
      <Typography variant="h4" gutterBottom>
        Branch Stock Report
      </Typography>

      <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 2, flexWrap: "wrap" }}>
        <Autocomplete
          options={branchList}
          getOptionLabel={(opt) =>
            typeof opt === "string" ? opt : `(${opt.branchCode}) ${opt.branchName}`
          }
          value={branchList.find((b) => b.branchCode === selectedBranch) || null}
          onChange={(_, newValue) => setSelectedBranch(newValue?.branchCode || "")}
          renderInput={(params) => (
            <TextField {...params} label="Select Branch" variant="outlined" sx={{ width: "30ch" }} />
          )}
        />

        <Button
          variant="contained"
          color="primary"
          onClick={fetchStock}
          disabled={loading || !selectedBranch.trim()}
        >
          {loading ? <CircularProgress size={24} /> : "Generate Report"}
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
        <Typography color="error" sx={{ mb: 2 }}>
          {error}
        </Typography>
      )}

      {stockData.length > 0 && (
        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Item Code</TableCell>
                <TableCell>Item Name</TableCell>
                <TableCell align="right">Qty</TableCell>
                <TableCell>Unit</TableCell>
                <TableCell>HSN</TableCell>
                <TableCell align="right">Standard Price</TableCell>
                <TableCell align="right">Stock Value</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {stockData.map((row, idx) => {
                const qty = parseFloat(row.totalQty ?? 0);
                const price = parseFloat(row.standardPrice ?? 0);
                const value = qty * price;
                return (
                  <TableRow key={idx}>
                    <TableCell>{row.itemId}</TableCell>
                    <TableCell>{row.itemName ?? ""}</TableCell>
                    <TableCell align="right">{qty.toFixed(2)}</TableCell>
                    <TableCell>{row.unit ?? ""}</TableCell>
                    <TableCell>{row.hsn ?? ""}</TableCell>
                    <TableCell align="right">
                      {price ? price.toFixed(2) : ""}
                    </TableCell>
                    <TableCell align="right">
                      {price ? value.toFixed(2) : ""}
                    </TableCell>
                  </TableRow>
                );
              })}
              <TableRow sx={{ bgcolor: "action.selected" }}>
                <TableCell colSpan={5} />
                <TableCell align="right">
                  <Typography variant="body2" fontWeight={700}>Total Stock Value</Typography>
                </TableCell>
                <TableCell align="right">
                  <Typography variant="body2" fontWeight={700}>
                    {grandTotal.toFixed(2)}
                  </Typography>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
};

export default BranchStockViewReport;
