// CategorySalesSummaryReport.jsx
// Ask for a category's sales summary over a period. It runs on the server in the background;
// when it finishes the requester gets a "report ready" task, and the file is downloaded here or
// from My Reports.
import React, { useEffect, useState } from "react";
import { Link as RouterLink, useSearchParams } from "react-router-dom";
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  CircularProgress,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  TextField,
  Typography,
} from "@mui/material";
import dayjs from "dayjs";
import ReportRequestsTable from "./backgroundReports/ReportRequestsTable";
import { requestReport, useReportRequests } from "./backgroundReports/reportRequestsApi";

const REPORT_TYPE = "CATEGORY_SALES";

const authHeaders = () => ({
  Authorization: `Bearer ${localStorage.getItem("jwtToken")}`,
});


const CategorySalesSummaryReport = () => {
  const [searchParams] = useSearchParams();
  const highlightId = searchParams.get("requestId") || "";

  const [categories, setCategories] = useState([]);
  const [branches, setBranches] = useState([]);
  const [category, setCategory] = useState(null);
  const [branchCode, setBranchCode] = useState("ALL");
  const [fromDate, setFromDate] = useState(dayjs().startOf("month").format("YYYY-MM-DD"));
  const [toDate, setToDate] = useState(dayjs().format("YYYY-MM-DD"));
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState(null);
  const { requests, reload: loadRequests } = useReportRequests(REPORT_TYPE);

  const tenancyId = localStorage.getItem("tenancyId");

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
  }, [tenancyId]);

  const submit = async () => {
    if (!category) {
      setMessage({ severity: "error", text: "Select a category." });
      return;
    }
    setSubmitting(true);
    setMessage(null);
    const params = { categoryName: category, fromDate, toDate };
    if (branchCode && branchCode !== "ALL") params.branchCode = branchCode;
    const { ok, message: text } = await requestReport(REPORT_TYPE, params);
    setMessage({ severity: ok ? "success" : "error", text });
    if (ok) loadRequests();
    setSubmitting(false);
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
          <Box>
            <Button size="small" component={RouterLink} to="/my-reports">
              All my reports
            </Button>
            <Button size="small" onClick={loadRequests}>
              Refresh
            </Button>
          </Box>
        </Box>
        <ReportRequestsTable requests={requests} highlightId={highlightId} />
      </Paper>
    </Box>
  );
};

export default CategorySalesSummaryReport;
