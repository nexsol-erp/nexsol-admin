import React, { useEffect, useState } from "react";
import {
  Box, Button, TextField, Typography, Paper, CircularProgress,
  Grid, Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, Alert, Divider, FormControl, InputLabel, Select, MenuItem,
} from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";

const BRANCH_TYPE_OPTIONS = ["BAKERY_CGN", "BAKERY_OUTLET", "BAKERY_PROD", "FRANCHISE_OUTLET", "CGN", "FRANCHISE", "FRANCHISEE", "OUTLET", "PRODUCTION"];

const EMPTY_FORM = {
  branchName: "", branchState: "", branchBuildingAddress: "",
  branchAddress1: "", branchAddress2: "", branchStreetAddress: "",
  branchGst: "", branchInvoicePrefix: "", branchType: "",
};

const BranchUpdatePage = () => {
  const tenancyId = localStorage.getItem("tenancyId") || "";
  const token     = localStorage.getItem("jwtToken")  || "";
  const headers   = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  const [branches, setBranches]       = useState([]);
  const [loadingList, setLoadingList] = useState(false);
  const [selected, setSelected]       = useState(null); // branchCode string
  const [form, setForm]               = useState(EMPTY_FORM);
  const [saving, setSaving]           = useState(false);
  const [message, setMessage]         = useState(null); // {type, text}

  const fetchBranches = async () => {
    setLoadingList(true);
    try {
      const res  = await fetch(`/api/${tenancyId}/branches`, { headers });
      const data = await res.json();
      const list = Array.isArray(data) ? data : data.branches || data.data || [];
      setBranches(list);
    } catch {
      setMessage({ type: "error", text: "Failed to load branches" });
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => { fetchBranches(); }, []);

  const selectBranch = (branch) => {
    setSelected(branch.branchCode);
    setForm({
      branchName:             branch.branchName            || "",
      branchState:            branch.branchState           || "",
      branchBuildingAddress:  branch.branchBuildingAddress || "",
      branchAddress1:         branch.branchAddress1        || "",
      branchAddress2:         branch.branchAddress2        || "",
      branchStreetAddress:    branch.branchStreetAddress   || "",
      branchGst:              branch.branchGst             || "",
      branchInvoicePrefix:    branch.branchInvoicePrefix   || "",
      branchType:             branch.branchType            || "",
    });
    setMessage(null);
  };

  const handleSave = async () => {
    if (!selected) return;
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/${tenancyId}/branches/${selected}`, {
        method: "PUT", headers, body: JSON.stringify(form),
      });
      const data = await res.json();
      if (data.success) {
        setMessage({ type: "success", text: `Branch "${selected}" updated successfully` });
        fetchBranches();
      } else {
        setMessage({ type: "error", text: data.message || "Update failed" });
      }
    } catch (e) {
      setMessage({ type: "error", text: "Error: " + e.message });
    } finally {
      setSaving(false);
    }
  };

  const field = (label, key, props = {}) => (
    <Grid item xs={12} sm={6}>
      <TextField
        label={label} fullWidth size="small"
        value={form[key]}
        onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
        {...props}
      />
    </Grid>
  );

  return (
    <Box sx={{ flexGrow: 1, p: 3, ml: "240px", mt: 2 }}>
      <Typography variant="h4" gutterBottom>Branch Details</Typography>

      <Grid container spacing={3}>
        {/* ── Branch list ── */}
        <Grid item xs={12} md={4}>
          <Paper elevation={2} sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>Select Branch</Typography>
            {loadingList ? (
              <Box sx={{ textAlign: "center", py: 3 }}><CircularProgress size={28} /></Box>
            ) : (
              <TableContainer sx={{ maxHeight: 520 }}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell><strong>Code</strong></TableCell>
                      <TableCell><strong>Name</strong></TableCell>
                      <TableCell />
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {branches.map((b) => (
                      <TableRow
                        key={b.branchCode}
                        selected={selected === b.branchCode}
                        hover sx={{ cursor: "pointer" }}
                        onClick={() => selectBranch(b)}
                      >
                        <TableCell>{b.branchCode}</TableCell>
                        <TableCell>{b.branchName || <em style={{ color: "#999" }}>—</em>}</TableCell>
                        <TableCell align="right">
                          <EditIcon fontSize="small" sx={{ color: selected === b.branchCode ? "primary.main" : "#bbb" }} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Paper>
        </Grid>

        {/* ── Edit form ── */}
        <Grid item xs={12} md={8}>
          <Paper elevation={2} sx={{ p: 3 }}>
            {!selected ? (
              <Typography color="text.secondary" sx={{ py: 4, textAlign: "center" }}>
                Select a branch from the list to edit its details
              </Typography>
            ) : (
              <>
                <Typography variant="h6" gutterBottom>
                  Edit — <strong>{selected}</strong>
                </Typography>
                <Divider sx={{ mb: 2 }} />

                {message && (
                  <Alert severity={message.type} sx={{ mb: 2 }} onClose={() => setMessage(null)}>
                    {message.text}
                  </Alert>
                )}

                <Grid container spacing={2}>
                  {field("Branch Name",             "branchName")}
                  {field("GST Number",              "branchGst")}
                  {field("Building / Door No.",     "branchBuildingAddress")}
                  {field("Address Line 1",          "branchAddress1")}
                  {field("Address Line 2",          "branchAddress2")}
                  {field("Street",                  "branchStreetAddress")}
                  {field("State",                   "branchState")}
                  {field("Invoice Prefix",          "branchInvoicePrefix", { inputProps: { maxLength: 4 } })}

                  {/* Branch Type */}
                  <Grid item xs={12} sm={6}>
                    <FormControl fullWidth size="small">
                      <InputLabel>Branch Type</InputLabel>
                      <Select
                        label="Branch Type"
                        value={form.branchType}
                        onChange={(e) => setForm((f) => ({ ...f, branchType: e.target.value }))}
                      >
                        <MenuItem value=""><em>— Select Type —</em></MenuItem>
                        {BRANCH_TYPE_OPTIONS.map((t) => (
                          <MenuItem key={t} value={t}>{t}</MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>
                </Grid>

                <Box sx={{ mt: 3 }}>
                  <Button
                    variant="contained" color="primary"
                    onClick={handleSave} disabled={saving}
                    sx={{ minWidth: 140 }}
                  >
                    {saving ? <CircularProgress size={22} color="inherit" /> : "Save Changes"}
                  </Button>
                </Box>
              </>
            )}
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default BranchUpdatePage;
