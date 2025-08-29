import React, { useEffect, useState } from "react";
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

const BranchStockDiffReport = () => {
  const [selectedBranch, setSelectedBranch] = useState("");
  const [branchList, setBranches] = useState([]);
  const [diffData, setDiffData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Fetch branches
  useEffect(() => {
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
        // Expecting { branches: [{branchCode, branchName}, ...] }
        setBranches(Array.isArray(data.branches) ? data.branches : []);
      } catch (err) {
        console.error("Error fetching branches:", err);
      }
    };

    fetchBranches();
  }, []);

  const fetchDiff = async () => {
    setLoading(true);
    setError(null);
    const tenancyId = localStorage.getItem("tenancyId");
    const jwtToken = localStorage.getItem("jwtToken");

    try {
      // GET /api/{company}/inventory/branch-diff?branchCode=XX[&date=YYYY-MM-DD]
      const res = await axios.get(`/api/${tenancyId}/inventory/branch-diff`, {
        headers: { Authorization: `Bearer ${jwtToken}` },
        params: { branchCode: selectedBranch },
      });
      // Expecting array: [{ itemId, itemName?, snapshotQty, serverQty, diffQty, inventoryDate? }]
      setDiffData(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error(err);
      setError("Failed to fetch branch diff.");
    } finally {
      setLoading(false);
    }
  };

  const handleExportToExcel = () => {
    const worksheet = XLSX.utils.json_to_sheet(diffData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Branch Diff");
    const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
    const blob = new Blob([excelBuffer], { type: "application/octet-stream" });
    saveAs(blob, `Branch_Diff_${selectedBranch}.xlsx`);
  };

  return (
    <Box sx={{ padding: 3 }}>
      <Typography variant="h4" gutterBottom>
        Branch Stock Difference Report
      </Typography>

      <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 2 }}>
        <Autocomplete
          options={branchList}
          getOptionLabel={(opt) =>
            typeof opt === "string" ? opt : `(${opt.branchCode}) ${opt.branchName}`
          }
          value={branchList.find((b) => b.branchCode === selectedBranch) || null}
          onChange={(event, newValue) => {
            setSelectedBranch(newValue?.branchCode || "");
          }}
          renderInput={(params) => (
            <TextField {...params} label="Select Branch" variant="outlined" sx={{ width: "30ch" }} />
          )}
        />

        <Button
          variant="contained"
          color="primary"
          onClick={fetchDiff}
          disabled={loading || !selectedBranch.trim()}
        >
          {loading ? <CircularProgress size={24} /> : "Fetch Diff"}
        </Button>

        <Button
          variant="contained"
          color="secondary"
          onClick={handleExportToExcel}
          disabled={diffData.length === 0}
        >
          Export to Excel
        </Button>
      </Box>

      {error && (
        <Typography color="error" sx={{ mb: 2 }}>
          {error}
        </Typography>
      )}

      {diffData.length > 0 && (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Item Id</TableCell>
                <TableCell>Item Name</TableCell>
                <TableCell align="right">Snapshot Qty</TableCell>
                <TableCell align="right">Server Qty</TableCell>
                <TableCell align="right">Difference</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {diffData.map((row, idx) => {
                const snapshot = Number(row.snapshotQty || 0);
                const server = Number(row.serverQty || 0);
                const diff = Number(row.diffQty != null ? row.diffQty : snapshot - server);
                const color = diff === 0 ? "green" : diff > 0 ? "red" : "blue";
                return (
                  <TableRow key={idx}>
                    <TableCell>{row.itemId}</TableCell>
                    <TableCell>{row.itemName || ""}</TableCell>
                    <TableCell align="right">{snapshot.toFixed(2)}</TableCell>
                    <TableCell align="right">{server.toFixed(2)}</TableCell>
                    <TableCell align="right" sx={{ color, fontWeight: "bold" }}>
                      {diff.toFixed(2)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
};

export default BranchStockDiffReport;
