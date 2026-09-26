// CategorySalesSummaryReport.jsx
// Ask for a category's sales summary over a period. It runs on the server in the background;
// when it finishes the requester gets a "report ready" task, and the file is downloaded here.
import React, { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Chip,
  CircularProgress,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import dayjs from "dayjs";
import { saveAs } from "file-saver";

const authHeaders = () => ({
  Authorization: `Bearer ${localStorage.getItem("jwtToken")}`,
});

const STATUS_COLOR = { QUEUED: "default", RUNNING: "info", READY: "success", FAILED: "error" };
const POLL_MS = 10000;

const CategorySalesSummaryReport = () => {
  const [searchParams] = useSearchParams();
  const highlightId = searchParams.get("requestId") || "";

  const [categories, setCategories] = useState([]);
  const [branches, setBranches] = useState([]);
  const [category, setCategory] = useState(null);
  const [branchCode, setBranchCode] = useState("ALL");
  const [fromDate, setFromDate] = useState(dayjs().startOf("month").format("YYYY-MM-DD"));
  const [toDate, setToDate] = useState(dayjs().format("YYYY-MM-DD"));
  const [requests, setRequests] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState(null);
  const [downloadingId, setDownloadingId] = useState(null);

  const tenancyId = localStorage.getItem("tenancyId");

  const loadRequests = useCallback(async () => {
    try {
      const res = await fetch(`/api/${tenancyId}/report-requests/category-sales`, { headers: authHeaders() });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setRequests(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error("Error loading report requests:", e);
    }
  }, [tenancyId]);

  useEffect(() => {
    const loadMasters = async () => {
      try {
        const [catRes, brRes] = await Promise.all([
          fetch(`/api/${tenancyId}/categoriesNames`, { headers: authHeaders() }),
          fetch(`/api/${tenancyId}/branches`, { headers: authHeaders() }),
        ]);
        const cats = catRes.ok ? await catRes.json() : [];
        const names = [...new Set((Array.isArray(cats) ? cats : []).map((c) => c.categoryName).filter(Boolean))];
        setCategories(names.sort((a, b) => a.localeCompare(b)));
        const br = brRes.ok ? await brRes.json() : [];
        const list = Array.isArray(br) ? br : br.branches || br.data || [];
        setBranches([...new Map(list.map((b) => [b.branchCode, b])).values()]);
      } catch (e) {
        console.error("Error loading categories/branches:", e);
      }
    };
    loadMasters();
    loadRequests();
  }, [tenancyId, loadRequests]);

  // Refresh while anything is still queued or running, so READY shows up without a reload.
  const pending = requests.some((r) => r.status === "QUEUED" || r.status === "RUNNING");
  useEffect(() => {
    if (!pending) return undefined;
    const t = setInterval(loadRequests, POLL_MS);
    return () => clearInterval(t);
  }, [pending, loadRequests]);

  const submit = async () => {
    if (!category) {
      setMessage({ severity: "error", text: "Select a category." });
      return;
    }
    setSubmitting(true);
    setMessage(null);
    try {
      const params = new URLSearchParams({ categoryName: category, fromDate, toDate });
      if (branchCode && branchCode !== "ALL") params.set("branchCode", branchCode);
      const res = await fetch(`/api/${tenancyId}/report-requests/category-sales?${params.toString()}`, {
        method: "POST",
        headers: authHeaders(),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage({ severity: "error", text: data.message || "Could not request the report." });
        return;
      }
      setMessage({
        severity: "success",
        text: "Report requested. It runs in the background, and you'll get a task in My Tasks when it's ready.",
      });
      loadRequests();
    } catch (e) {
      console.error("Error requesting report:", e);
      setMessage({ severity: "error", text: "Could not request the report. Please try again later." });
    } finally {
      setSubmitting(false);
    }
  };

  const download = async (req) => {
    setDownloadingId(req.id);
    try {
      const res = await fetch(`/api/${tenancyId}/report-requests/${encodeURIComponent(req.id)}/download`, {
        headers: authHeaders(),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setMessage({ severity: "error", text: data.message || "Could not download the report." });
        return;
      }
      const blob = await res.blob();
      const name = `CategorySales_${req.categoryName}_${req.fromDate}_${req.toDate}`.replace(/[^\w-]+/g, "_");
      saveAs(blob, `${name}.xlsx`);
    } catch (e) {
      console.error("Error downloading report:", e);
      setMessage({ severity: "error", text: "Could not download the report." });
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <Box sx={{ flexGrow: 1, p: 3, ml: "240px", mt: 2 }}>
      <Paper elevation={3} sx={{ p: 3, mb: 3 }}>
        <Typography variant="h5" gutterBottom>
          Category Sales Summary Report
        </Typography>
        <Box display="flex" gap={2} flexWrap="wrap" alignItems="center">
          <Autocomplete
            sx={{ minWidth: 260 }}
            options={categories}
            value={category}
            onChange={(_, v) => setCategory(v)}
            renderInput={(params) => <TextField {...params} label="Category" size="small" />}
          />
          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel>Branch</InputLabel>
            <Select value={branchCode} label="Branch" onChange={(e) => setBranchCode(e.target.value)}>
              <MenuItem value="ALL">All branches</MenuItem>
              {branches.map((b) => (
                <MenuItem key={b.branchCode} value={b.branchCode}>
                  {b.branchCode}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            size="small"
            type="date"
            label="From"
            InputLabelProps={{ shrink: true }}
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
          />
          <TextField
            size="small"
            type="date"
            label="To"
            InputLabelProps={{ shrink: true }}
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
          />
          <Button variant="contained" onClick={submit} disabled={submitting}>
            {submitting ? <CircularProgress size={22} /> : "Request Report"}
          </Button>
        </Box>
        {message && (
          <Alert severity={message.severity} sx={{ mt: 2 }}>
            {message.text}
          </Alert>
        )}
      </Paper>

      <Paper elevation={3} sx={{ p: 3 }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
          <Typography variant="h6">My Requests</Typography>
          <Button size="small" onClick={loadRequests}>
            Refresh
          </Button>
        </Box>
        <TableContainer sx={{ maxHeight: 520 }}>
          <Table stickyHeader size="small">
            <TableHead>
              <TableRow>
                <TableCell>Requested</TableCell>
                <TableCell>Category</TableCell>
                <TableCell>Branch</TableCell>
                <TableCell>Period</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Rows</TableCell>
                <TableCell align="right" />
              </TableRow>
            </TableHead>
            <TableBody>
              {requests.map((r) => (
                <TableRow key={r.id} hover selected={r.id === highlightId}>
                  <TableCell>{r.requestedAt ? dayjs(r.requestedAt).format("DD-MM-YYYY HH:mm") : ""}</TableCell>
                  <TableCell>{r.categoryName}</TableCell>
                  <TableCell>{r.branchCode || "All"}</TableCell>
                  <TableCell>
                    {r.fromDate} to {r.toDate}
                  </TableCell>
                  <TableCell>
                    <Chip size="small" label={r.status} color={STATUS_COLOR[r.status] || "default"} title={r.errorMessage || ""} />
                  </TableCell>
                  <TableCell align="right">{r.rowCount ?? ""}</TableCell>
                  <TableCell align="right">
                    {r.status === "READY" && (
                      <Button size="small" variant="outlined" onClick={() => download(r)} disabled={downloadingId === r.id}>
                        {downloadingId === r.id ? <CircularProgress size={18} /> : "Download"}
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {requests.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} align="center">
                    No reports requested yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </Box>
  );
};

export default CategorySalesSummaryReport;
