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
  Switch,
  FormControlLabel,
} from "@mui/material";
import axios from "axios";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";

const EPS = 1e-9; // guard tiny float noise

const BranchStockDiffReport = () => {
  const [selectedBranch, setSelectedBranch] = useState("");
  const [branchList, setBranches] = useState([]);
  const [diffData, setDiffData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [busyItemId, setBusyItemId] = useState(null);
  const [onlyNonZero, setOnlyNonZero] = useState(false);

  const POST_ENDPOINT = (tenancyId) => `/api/${tenancyId}/inventory/reconcile-item`;

  const computeDiff = (row) => {
    const snapshot = parseFloat(row.snapshotQty ?? 0) || 0;
    const server = parseFloat(row.serverQty ?? 0) || 0;
    const diff = row.diffQty != null ? parseFloat(row.diffQty) : snapshot - server;
    return { snapshot, server, diff: Number.isFinite(diff) ? diff : 0 };
  };

  const postForItem = async (itemId) => {
    const tenancyId = localStorage.getItem("tenancyId");
    const jwtToken = localStorage.getItem("jwtToken");
    if (!selectedBranch) return;

    setBusyItemId(itemId);
    try {
      const res = await fetch(POST_ENDPOINT(tenancyId), {
        method: "POST",
        headers: {
          Authorization: `Bearer ${jwtToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ branchCode: selectedBranch, itemId }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`HTTP ${res.status}: ${text}`);
      }

      await fetchDiff();
    } catch (e) {
      console.error("POST failed:", e);
      alert(`Action failed: ${e.message || e}`);
    } finally {
      setBusyItemId(null);
    }
  };

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
      const res = await axios.get(`/api/${tenancyId}/inventory/branch-diff`, {
        headers: { Authorization: `Bearer ${jwtToken}` },
        params: { branchCode: selectedBranch },
      });
      setDiffData(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error(err);
      setError("Failed to fetch branch diff.");
    } finally {
      setLoading(false);
    }
  };

  // Apply filter: only rows with diff !== 0
  const displayData = onlyNonZero
    ? diffData.filter((r) => Math.abs(computeDiff(r).diff) > EPS)
    : diffData;

  const handleExportToExcel = () => {
    const rows = displayData.map((r) => {
      const { snapshot, server, diff } = computeDiff(r);
      return {
        "Item ID": r.itemId,
        "Item Name": r.itemName ?? "",
        "Snapshot Qty": snapshot,
        "Server Qty": server,
        Difference: diff,
        Date: r.inventoryDate ?? "",
      };
    });
    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Branch Diff");
    const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
    const blob = new Blob([excelBuffer], { type: "application/octet-stream" });
    saveAs(blob, `Branch_Diff_${selectedBranch}${onlyNonZero ? "_nonzero" : ""}.xlsx`);
  };

  return (
    <Box sx={{ padding: 3 }}>
      <Typography variant="h4" gutterBottom>
        Branch Stock Difference Report
      </Typography>

      <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 2, flexWrap: "wrap" }}>
        <Autocomplete
          options={branchList}
          getOptionLabel={(opt) =>
            typeof opt === "string" ? opt : `(${opt.branchCode}) ${opt.branchName}`
          }
          value={branchList.find((b) => b.branchCode === selectedBranch) || null}
          onChange={(event, newValue) => setSelectedBranch(newValue?.branchCode || "")}
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

        <FormControlLabel
          control={
            <Switch
              checked={onlyNonZero}
              onChange={(e) => setOnlyNonZero(e.target.checked)}
            />
          }
          label="Show only Difference ≠ 0"
        />

        <Button
          variant="contained"
          color="secondary"
          onClick={handleExportToExcel}
          disabled={displayData.length === 0}
        >
          Export to Excel
        </Button>
      </Box>

      {error && (
        <Typography color="error" sx={{ mb: 2 }}>
          {error}
        </Typography>
      )}

      {displayData.length > 0 && (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Item Id</TableCell>
                <TableCell>Item Name</TableCell>
                <TableCell align="right">Snapshot Qty</TableCell>
                <TableCell align="right">Server Qty</TableCell>
                <TableCell align="right">Difference</TableCell>
                <TableCell align="center">Action</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {displayData.map((row, idx) => {
                const { snapshot, server, diff } = computeDiff(row);
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
                    <TableCell align="center">
                      <Button
                        variant="contained"
                        size="small"
                        onClick={() => postForItem(row.itemId)}
                        disabled={!selectedBranch || busyItemId === row.itemId}
                      >
                        {busyItemId === row.itemId ? <CircularProgress size={18} /> : "Reconcile"}
                      </Button>
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
