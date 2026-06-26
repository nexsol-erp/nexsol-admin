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
  Alert,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
} from "@mui/material";
import dayjs from "dayjs";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import StockReportExclusionSettings from "./StockReportExclusionSettings";

function r2(v) { return Math.round((Number(v) || 0) * 100) / 100; }

const LIMIT_OPTIONS = [5, 10, 20, 50];

const VelocityTable = ({ rows, numDays, rank }) => {
  if (!rows.length) return (
    <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: "center" }}>
      No data
    </Typography>
  );

  return (
    <TableContainer component={Paper} variant="outlined">
      <Table size="small" stickyHeader>
        <TableHead>
          <TableRow>
            <TableCell>#</TableCell>
            <TableCell>Item Name</TableCell>
            <TableCell align="right">Qty Sold</TableCell>
            <TableCell align="right">Avg / Day</TableCell>
            <TableCell align="right">Current Stock</TableCell>
            <TableCell align="right">Days of Cover</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((row, i) => {
            const sold  = r2(row.qtySold);
            const stock = r2(row.currentStock);
            const avgDay = numDays > 0 ? r2(sold / numDays) : 0;
            const cover  = avgDay > 0 ? Math.round(stock / avgDay) : "∞";
            return (
              <TableRow key={row.itemId} hover>
                <TableCell sx={{ color: "text.secondary", width: 36 }}>
                  {rank === "fast" ? i + 1 : rows.length - i}
                </TableCell>
                <TableCell>{row.itemName}</TableCell>
                <TableCell align="right">{sold.toFixed(2)}</TableCell>
                <TableCell align="right">{avgDay.toFixed(2)}</TableCell>
                <TableCell align="right">{stock.toFixed(2)}</TableCell>
                <TableCell align="right">{cover}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
};

const ItemVelocityReport = () => {
  const tenancyId = localStorage.getItem("tenancyId");
  const token     = localStorage.getItem("jwtToken");

  const allowedBranches = useMemo(() => {
    try {
      const raw = localStorage.getItem("allowedBranches");
      const list = raw ? JSON.parse(raw) : [];
      return Array.isArray(list) ? list : [];
    } catch { return []; }
  }, []);

  const [branches, setBranches]         = useState([]);
  const [selectedBranch, setSelectedBranch] = useState(null);
  const [fromDate, setFromDate]         = useState(dayjs().startOf("month").format("YYYY-MM-DD"));
  const [toDate, setToDate]             = useState(dayjs().format("YYYY-MM-DD"));
  const [limit, setLimit]               = useState(10);

  const [fastMoving, setFastMoving]     = useState([]);
  const [slowMoving, setSlowMoving]     = useState([]);
  const [loading, setLoading]           = useState(false);
  const [fetched, setFetched]           = useState(false);
  const [error, setError]               = useState(null);

  const [exportOpen, setExportOpen]     = useState(false);
  const [fileName, setFileName]         = useState("ItemVelocityReport.xlsx");

  const numDays = useMemo(() => {
    const d = dayjs(toDate).diff(dayjs(fromDate), "day") + 1;
    return d > 0 ? d : 1;
  }, [fromDate, toDate]);

  useEffect(() => {
    const fetchBranches = async () => {
      try {
        const res = await fetch(`/api/${tenancyId}/branches`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;
        const data = await res.json();
        const list = Array.isArray(data) ? data : data.branches || data.data || [];
        const filtered = allowedBranches.length
          ? list.filter((b) => allowedBranches.includes(b.branchCode))
          : list;
        setBranches(filtered);
        if (filtered.length === 1) setSelectedBranch(filtered[0]);
      } catch {}
    };
    fetchBranches();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchReport = async () => {
    if (!selectedBranch) { setError("Please select a branch."); return; }
    setError(null);
    setLoading(true);
    try {
      const params = new URLSearchParams({
        branchCode: selectedBranch.branchCode,
        fromDate,
        toDate,
        limit,
      });
      const res = await fetch(`/api/${tenancyId}/reports/item-velocity?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setFastMoving(Array.isArray(data.fastMoving) ? data.fastMoving : []);
      setSlowMoving(Array.isArray(data.slowMoving) ? data.slowMoving : []);
      setFetched(true);
    } catch (e) {
      setError("Failed to load report: " + (e.message || "Unknown error"));
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    const makeRows = (rows, label) =>
      rows.map((row, i) => ({
        "Type":          label,
        "Rank":          i + 1,
        "Item Name":     row.itemName,
        "Qty Sold":      r2(row.qtySold),
        "Avg / Day":     numDays > 0 ? r2(row.qtySold / numDays) : 0,
        "Current Stock": r2(row.currentStock),
        "Days of Cover": r2(row.qtySold / numDays) > 0
          ? Math.round(r2(row.currentStock) / r2(row.qtySold / numDays))
          : "∞",
      }));

    const allRows = [
      ...makeRows(fastMoving, "Fast Moving"),
      { Type: "", Rank: "", "Item Name": "", "Qty Sold": "", "Avg / Day": "", "Current Stock": "", "Days of Cover": "" },
      ...makeRows(slowMoving, "Slow Moving"),
    ];

    const ws = XLSX.utils.json_to_sheet(allRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Item Velocity");
    const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    saveAs(new Blob([buf], { type: "application/octet-stream" }), fileName);
    setExportOpen(false);
  };

  return (
    <Box sx={{ p: { xs: 1, sm: 3 } }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
        <Typography variant="h6" fontWeight={700}>
          Item Velocity Report — Fast &amp; Slow Movers
        </Typography>
        <StockReportExclusionSettings />
      </Box>

      {/* Filters */}
      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2, mb: 2, alignItems: "flex-end" }}>
        <Autocomplete
          options={branches}
          getOptionLabel={(b) => `${b.branchCode} – ${b.branchName || b.branchCode}`}
          value={selectedBranch}
          onChange={(_, v) => { setSelectedBranch(v); setFetched(false); }}
          renderInput={(p) => <TextField {...p} label="Branch" size="small" sx={{ width: 220 }} />}
          isOptionEqualToValue={(o, v) => o.branchCode === v.branchCode}
        />

        <TextField
          type="date" label="From" size="small"
          value={fromDate} onChange={(e) => { setFromDate(e.target.value); setFetched(false); }}
          InputLabelProps={{ shrink: true }} sx={{ width: 155 }}
        />
        <TextField
          type="date" label="To" size="small"
          value={toDate} onChange={(e) => { setToDate(e.target.value); setFetched(false); }}
          InputLabelProps={{ shrink: true }} sx={{ width: 155 }}
        />

        <Autocomplete
          options={LIMIT_OPTIONS}
          getOptionLabel={(n) => `Top ${n} items`}
          value={limit}
          onChange={(_, v) => { if (v) setLimit(v); }}
          disableClearable
          renderInput={(p) => <TextField {...p} label="Items to show" size="small" sx={{ width: 150 }} />}
        />

        <Button
          variant="contained"
          onClick={fetchReport}
          disabled={loading}
          sx={{ height: 40 }}
        >
          {loading ? <CircularProgress size={18} color="inherit" /> : "Generate"}
        </Button>

        <Button
          variant="outlined"
          onClick={() => setExportOpen(true)}
          disabled={!fetched || (!fastMoving.length && !slowMoving.length)}
          sx={{ height: 40 }}
        >
          Export Excel
        </Button>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {fetched && (
        <Box sx={{ display: "flex", gap: 2, alignItems: "flex-start",
          flexDirection: { xs: "column", md: "row" } }}>

          {/* Fast Moving */}
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
              <Chip label="Fast Moving" color="success" size="small" />
              <Typography variant="body2" color="text.secondary">
                Top {limit} by qty sold · {numDays} days
              </Typography>
            </Box>
            <VelocityTable rows={fastMoving} numDays={numDays} rank="fast" />
          </Box>

          {/* Slow Moving */}
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
              <Chip label="Slow Moving" color="warning" size="small" />
              <Typography variant="body2" color="text.secondary">
                Bottom {limit} by qty sold · {numDays} days
              </Typography>
            </Box>
            <VelocityTable rows={slowMoving} numDays={numDays} rank="slow" />
          </Box>
        </Box>
      )}

      {!fetched && !loading && (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 4, textAlign: "center" }}>
          Select a branch and date range, then click Generate
        </Typography>
      )}

      {/* Export dialog */}
      <Dialog open={exportOpen} onClose={() => setExportOpen(false)}>
        <DialogTitle>Export to Excel</DialogTitle>
        <DialogContent>
          <DialogContentText>Enter a file name:</DialogContentText>
          <TextField
            autoFocus margin="dense" label="File Name" fullWidth
            value={fileName} onChange={(e) => setFileName(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setExportOpen(false)}>Cancel</Button>
          <Button onClick={handleExport}>Export</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ItemVelocityReport;
