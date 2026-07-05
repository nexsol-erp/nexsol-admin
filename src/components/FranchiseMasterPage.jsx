import React, { useState, useEffect, useCallback } from "react";
import {
  Box, Grid, Paper, Typography, Button, TextField, Select, MenuItem,
  FormControl, InputLabel, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Chip, Tabs, Tab, IconButton, Divider,
  CircularProgress, Snackbar, Alert, Dialog, DialogTitle,
  DialogContent, DialogActions, Tooltip, InputAdornment,
} from "@mui/material";
import {
  Add, Edit, Refresh, Search, Business, Settings,
  CheckCircle, Cancel, Pause, Delete,
} from "@mui/icons-material";

const API = () => {
  const tenancyId = localStorage.getItem("tenancyId");
  const token     = localStorage.getItem("jwtToken");
  const base      = `/api/${tenancyId}/franchise`;
  const headers   = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  return { base, headers, tenancyId };
};

const STATUS_COLOR = {
  DRAFT:               "default",
  PROVISIONING:        "info",
  ACTIVE:              "success",
  PROVISIONING_FAILED: "error",
  SUSPENDED:           "warning",
  TERMINATED:          "error",
};

const FRANCHISE_TYPES = ["STANDARD", "PREMIUM", "MASTER"];
const INDIAN_STATES   = [
  "Andhra Pradesh","Arunachal Pradesh","Assam","Bihar","Chhattisgarh","Goa","Gujarat",
  "Haryana","Himachal Pradesh","Jharkhand","Karnataka","Kerala","Madhya Pradesh",
  "Maharashtra","Manipur","Meghalaya","Mizoram","Nagaland","Odisha","Punjab",
  "Rajasthan","Sikkim","Tamil Nadu","Telangana","Tripura","Uttar Pradesh","Uttarakhand",
  "West Bengal","Delhi","Jammu and Kashmir","Ladakh","Puducherry",
];

const emptyForm = {
  franchiseCode: "", franchiseName: "", franchiseType: "STANDARD",
  addressLine1: "", addressLine2: "", city: "", state: "", pincode: "",
  country: "INDIA", gstNumber: "", panNumber: "", contactPerson: "",
  contactPhone: "", contactEmail: "", website: "",
  agreementDate: "", agreementExpiry: "", royaltyPercentage: 0, territory: "",
};

const FIELD_SX = { "& .MuiInputBase-root": { fontSize: 13 }, mb: 0 };

export default function FranchiseMasterPage() {
  const [franchises, setFranchises]     = useState([]);
  const [selected, setSelected]         = useState(null);
  const [tab, setTab]                   = useState(0);
  const [loading, setLoading]           = useState(false);
  const [saving, setSaving]             = useState(false);
  const [search, setSearch]             = useState("");
  const [formOpen, setFormOpen]         = useState(false);
  const [editMode, setEditMode]         = useState(false);
  const [form, setForm]                 = useState(emptyForm);
  const [configs, setConfigs]           = useState([]);
  const [dashboard, setDashboard]       = useState({});
  const [snack, setSnack]               = useState({ open: false, msg: "", sev: "success" });
  const [confirmDialog, setConfirmDialog] = useState({ open: false, action: "", status: "" });

  // Config form
  const [cfgKey, setCfgKey]     = useState("");
  const [cfgVal, setCfgVal]     = useState("");
  const [cfgType, setCfgType]   = useState("STRING");
  const [cfgDesc, setCfgDesc]   = useState("");

  const showSnack = (msg, sev = "success") => setSnack({ open: true, msg, sev });

  const fetchFranchises = useCallback(() => {
    const { base, headers } = API();
    setLoading(true);
    fetch(base, { headers })
      .then(r => r.json())
      .then(d => { setFranchises(d.franchises || []); setLoading(false); })
      .catch(() => { showSnack("Failed to load franchises", "error"); setLoading(false); });
  }, []);

  const fetchDashboard = useCallback(() => {
    const { base, headers } = API();
    fetch(`${base}/dashboard`, { headers })
      .then(r => r.json())
      .then(d => setDashboard(d))
      .catch(() => {});
  }, []);

  const fetchConfigs = useCallback((id) => {
    const { base, headers } = API();
    fetch(`${base}/${id}/config`, { headers })
      .then(r => r.json())
      .then(d => setConfigs(d.configs || []))
      .catch(() => setConfigs([]));
  }, []);

  useEffect(() => {
    fetchFranchises();
    fetchDashboard();
  }, [fetchFranchises, fetchDashboard]);

  useEffect(() => {
    if (selected) fetchConfigs(selected.id);
  }, [selected, fetchConfigs]);

  const filtered = franchises.filter(f =>
    !search ||
    f.franchiseCode?.toLowerCase().includes(search.toLowerCase()) ||
    f.franchiseName?.toLowerCase().includes(search.toLowerCase()) ||
    f.city?.toLowerCase().includes(search.toLowerCase())
  );

  const handleSelect = (f) => {
    setSelected(f);
    setTab(0);
  };

  // ── Form ────────────────────────────────────────────────────────────────

  const openCreate = () => {
    setForm(emptyForm);
    setEditMode(false);
    setFormOpen(true);
  };

  const openEdit = () => {
    setForm({
      franchiseCode:     selected.franchiseCode     || "",
      franchiseName:     selected.franchiseName     || "",
      franchiseType:     selected.franchiseType     || "STANDARD",
      addressLine1:      selected.addressLine1      || "",
      addressLine2:      selected.addressLine2      || "",
      city:              selected.city              || "",
      state:             selected.state             || "",
      pincode:           selected.pincode           || "",
      country:           selected.country           || "INDIA",
      gstNumber:         selected.gstNumber         || "",
      panNumber:         selected.panNumber         || "",
      contactPerson:     selected.contactPerson     || "",
      contactPhone:      selected.contactPhone      || "",
      contactEmail:      selected.contactEmail      || "",
      website:           selected.website           || "",
      agreementDate:     selected.agreementDate     || "",
      agreementExpiry:   selected.agreementExpiry   || "",
      royaltyPercentage: selected.royaltyPercentage || 0,
      territory:         selected.territory         || "",
    });
    setEditMode(true);
    setFormOpen(true);
  };

  const handleFormChange = (field) => (e) =>
    setForm(prev => ({ ...prev, [field]: e.target.value }));

  const handleSave = () => {
    if (!form.franchiseCode.trim() || !form.franchiseName.trim()) {
      showSnack("Franchise Code and Name are required", "error");
      return;
    }
    if (!/^[A-Z0-9-]{3,20}$/.test(form.franchiseCode.trim().toUpperCase())) {
      showSnack("Franchise Code must be 3–20 alphanumeric characters (A-Z, 0-9, -)", "error");
      return;
    }

    const { base, headers } = API();
    setSaving(true);
    const method = editMode ? "PUT" : "POST";
    const url    = editMode ? `${base}/${selected.id}` : base;

    fetch(url, { method, headers, body: JSON.stringify({ ...form, franchiseCode: form.franchiseCode.toUpperCase() }) })
      .then(r => r.json())
      .then(d => {
        setSaving(false);
        if (d.success) {
          showSnack(editMode ? "Franchise updated" : "Franchise created");
          setFormOpen(false);
          fetchFranchises();
          fetchDashboard();
          if (editMode) setSelected(d.franchise);
        } else {
          showSnack(d.message || "Save failed", "error");
        }
      })
      .catch(() => { setSaving(false); showSnack("Network error", "error"); });
  };

  // ── Status Actions ──────────────────────────────────────────────────────

  const handleStatusChange = (newStatus) => {
    setConfirmDialog({ open: true, action: newStatus, status: newStatus });
  };

  const confirmStatusChange = () => {
    const { base, headers } = API();
    fetch(`${base}/${selected.id}/status`, {
      method: "PATCH", headers, body: JSON.stringify({ status: confirmDialog.status }),
    })
      .then(r => r.json())
      .then(d => {
        setConfirmDialog({ open: false, action: "", status: "" });
        if (d.success) {
          showSnack(`Status updated to ${d.status}`);
          fetchFranchises();
          fetchDashboard();
          setSelected(prev => ({ ...prev, status: d.status }));
        } else {
          showSnack(d.message || "Status update failed", "error");
        }
      })
      .catch(() => showSnack("Network error", "error"));
  };

  // ── Config ──────────────────────────────────────────────────────────────

  const handleSaveConfig = () => {
    if (!cfgKey.trim() || !cfgVal.trim()) {
      showSnack("Key and Value are required", "error");
      return;
    }
    const { base, headers } = API();
    fetch(`${base}/${selected.id}/config`, {
      method: "POST", headers,
      body: JSON.stringify({ configKey: cfgKey, configValue: cfgVal, configType: cfgType, description: cfgDesc }),
    })
      .then(r => r.json())
      .then(d => {
        if (d.success) {
          showSnack("Config saved");
          setCfgKey(""); setCfgVal(""); setCfgType("STRING"); setCfgDesc("");
          fetchConfigs(selected.id);
        } else {
          showSnack(d.message || "Failed", "error");
        }
      })
      .catch(() => showSnack("Network error", "error"));
  };

  const handleDeleteConfig = (configId) => {
    const { base, headers } = API();
    fetch(`${base}/${selected.id}/config/${configId}`, { method: "DELETE", headers })
      .then(r => r.json())
      .then(d => {
        if (d.success) { showSnack("Config removed"); fetchConfigs(selected.id); }
        else showSnack(d.message || "Delete failed", "error");
      })
      .catch(() => showSnack("Network error", "error"));
  };

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <Box sx={{ p: 2 }}>
      {/* Header */}
      <Box sx={{ display: "flex", alignItems: "center", mb: 2, gap: 1 }}>
        <Business sx={{ color: "#1976d2" }} />
        <Typography variant="h6" sx={{ fontWeight: 700, flexGrow: 1 }}>
          Franchise Management
        </Typography>
        <Button variant="contained" startIcon={<Add />} size="small" onClick={openCreate}>
          New Franchise
        </Button>
        <IconButton size="small" onClick={() => { fetchFranchises(); fetchDashboard(); }}>
          <Refresh fontSize="small" />
        </IconButton>
      </Box>

      {/* Dashboard KPIs */}
      <Grid container spacing={1} sx={{ mb: 2 }}>
        {[
          { label: "Total",     value: dashboard.total || 0,              color: "#1976d2" },
          { label: "Active",    value: dashboard.active || 0,             color: "#2e7d32" },
          { label: "Draft",     value: dashboard.draft || 0,              color: "#757575" },
          { label: "Suspended", value: dashboard.suspended || 0,          color: "#e65100" },
          { label: "Failed",    value: dashboard.provisioningFailed || 0, color: "#c62828" },
        ].map(k => (
          <Grid item xs={6} sm={2.4} key={k.label}>
            <Paper sx={{ p: 1.5, textAlign: "center", borderLeft: `4px solid ${k.color}` }}>
              <Typography variant="h5" sx={{ fontWeight: 700, color: k.color }}>{k.value}</Typography>
              <Typography variant="caption" sx={{ color: "text.secondary" }}>{k.label}</Typography>
            </Paper>
          </Grid>
        ))}
      </Grid>

      <Grid container spacing={2}>
        {/* Left: Franchise List */}
        <Grid item xs={12} md={4}>
          <Paper sx={{ height: "calc(100vh - 280px)", display: "flex", flexDirection: "column" }}>
            <Box sx={{ p: 1.5 }}>
              <TextField
                fullWidth size="small" placeholder="Search franchise..."
                value={search} onChange={e => setSearch(e.target.value)}
                InputProps={{ startAdornment: <InputAdornment position="start"><Search fontSize="small" /></InputAdornment> }}
                sx={FIELD_SX}
              />
            </Box>
            <Divider />
            {loading ? (
              <Box sx={{ display: "flex", justifyContent: "center", p: 3 }}>
                <CircularProgress size={24} />
              </Box>
            ) : (
              <Box sx={{ overflowY: "auto", flexGrow: 1 }}>
                <TableContainer>
                  <Table size="small" stickyHeader>
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 700, fontSize: 12 }}>Code</TableCell>
                        <TableCell sx={{ fontWeight: 700, fontSize: 12 }}>Name</TableCell>
                        <TableCell sx={{ fontWeight: 700, fontSize: 12 }}>Status</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {filtered.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={3} align="center" sx={{ color: "text.secondary", fontSize: 13 }}>
                            No franchises found
                          </TableCell>
                        </TableRow>
                      ) : filtered.map(f => (
                        <TableRow
                          key={f.id} hover
                          selected={selected?.id === f.id}
                          onClick={() => handleSelect(f)}
                          sx={{ cursor: "pointer" }}
                        >
                          <TableCell sx={{ fontSize: 12, fontWeight: 600 }}>{f.franchiseCode}</TableCell>
                          <TableCell sx={{ fontSize: 12 }}>{f.franchiseName}</TableCell>
                          <TableCell>
                            <Chip label={f.status} size="small"
                              color={STATUS_COLOR[f.status] || "default"}
                              sx={{ fontSize: 10 }} />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Box>
            )}
          </Paper>
        </Grid>

        {/* Right: Detail Panel */}
        <Grid item xs={12} md={8}>
          {!selected ? (
            <Paper sx={{ height: "calc(100vh - 280px)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Box sx={{ textAlign: "center", color: "text.secondary" }}>
                <Business sx={{ fontSize: 48, mb: 1, opacity: 0.3 }} />
                <Typography>Select a franchise to view details</Typography>
              </Box>
            </Paper>
          ) : (
            <Paper sx={{ height: "calc(100vh - 280px)", display: "flex", flexDirection: "column" }}>
              {/* Detail Header */}
              <Box sx={{ p: 1.5, display: "flex", alignItems: "center", gap: 1 }}>
                <Box sx={{ flexGrow: 1 }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                    {selected.franchiseCode} — {selected.franchiseName}
                  </Typography>
                  <Chip label={selected.status} size="small"
                    color={STATUS_COLOR[selected.status] || "default"} sx={{ fontSize: 10 }} />
                </Box>
                <Tooltip title="Edit">
                  <IconButton size="small" onClick={openEdit}><Edit fontSize="small" /></IconButton>
                </Tooltip>
              </Box>

              {/* Status Action Buttons */}
              <Box sx={{ px: 1.5, pb: 1, display: "flex", gap: 1, flexWrap: "wrap" }}>
                {selected.status === "ACTIVE" && (
                  <>
                    <Button size="small" color="warning" variant="outlined" startIcon={<Pause />}
                      onClick={() => handleStatusChange("SUSPENDED")}>Suspend</Button>
                    <Button size="small" color="error" variant="outlined" startIcon={<Cancel />}
                      onClick={() => handleStatusChange("TERMINATED")}>Terminate</Button>
                  </>
                )}
                {selected.status === "SUSPENDED" && (
                  <>
                    <Button size="small" color="success" variant="outlined" startIcon={<CheckCircle />}
                      onClick={() => handleStatusChange("ACTIVE")}>Reactivate</Button>
                    <Button size="small" color="error" variant="outlined" startIcon={<Cancel />}
                      onClick={() => handleStatusChange("TERMINATED")}>Terminate</Button>
                  </>
                )}
                {selected.status === "PROVISIONING_FAILED" && (
                  <Button size="small" color="info" variant="outlined"
                    onClick={() => handleStatusChange("DRAFT")}>Reset to Draft</Button>
                )}
              </Box>

              <Divider />

              <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ px: 1, minHeight: 36 }}>
                <Tab label="Details" sx={{ fontSize: 12, minHeight: 36 }} />
                <Tab label="Config" icon={<Settings fontSize="small" />} iconPosition="start"
                     sx={{ fontSize: 12, minHeight: 36 }} />
              </Tabs>
              <Divider />

              <Box sx={{ flexGrow: 1, overflowY: "auto", p: 1.5 }}>
                {/* ── Details Tab ── */}
                {tab === 0 && (
                  <Grid container spacing={1.5}>
                    {[
                      { label: "Franchise Type",    value: selected.franchiseType },
                      { label: "City",              value: selected.city },
                      { label: "State",             value: selected.state },
                      { label: "Pincode",           value: selected.pincode },
                      { label: "Country",           value: selected.country },
                      { label: "GST Number",        value: selected.gstNumber },
                      { label: "PAN Number",        value: selected.panNumber },
                      { label: "Contact Person",    value: selected.contactPerson },
                      { label: "Contact Phone",     value: selected.contactPhone },
                      { label: "Contact Email",     value: selected.contactEmail },
                      { label: "Agreement Date",    value: selected.agreementDate },
                      { label: "Agreement Expiry",  value: selected.agreementExpiry },
                      { label: "Royalty %",         value: selected.royaltyPercentage },
                      { label: "Territory",         value: selected.territory },
                      { label: "Address",           value: [selected.addressLine1, selected.addressLine2].filter(Boolean).join(", ") },
                    ].map(({ label, value }) => (
                      <Grid item xs={12} sm={6} key={label}>
                        <Box>
                          <Typography variant="caption" sx={{ color: "text.secondary", fontSize: 11 }}>{label}</Typography>
                          <Typography variant="body2" sx={{ fontSize: 13 }}>{value || "—"}</Typography>
                        </Box>
                      </Grid>
                    ))}
                  </Grid>
                )}

                {/* ── Config Tab ── */}
                {tab === 1 && (
                  <Box>
                    <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>Add Configuration</Typography>
                    <Grid container spacing={1} sx={{ mb: 2 }}>
                      <Grid item xs={12} sm={3}>
                        <TextField fullWidth size="small" label="Key" value={cfgKey}
                          onChange={e => setCfgKey(e.target.value)} sx={FIELD_SX} />
                      </Grid>
                      <Grid item xs={12} sm={3}>
                        <TextField fullWidth size="small" label="Value" value={cfgVal}
                          onChange={e => setCfgVal(e.target.value)} sx={FIELD_SX} />
                      </Grid>
                      <Grid item xs={12} sm={2}>
                        <FormControl fullWidth size="small">
                          <InputLabel sx={{ fontSize: 13 }}>Type</InputLabel>
                          <Select value={cfgType} onChange={e => setCfgType(e.target.value)} label="Type" sx={{ fontSize: 13 }}>
                            {["STRING", "BOOLEAN", "NUMBER", "JSON"].map(t => (
                              <MenuItem key={t} value={t} sx={{ fontSize: 13 }}>{t}</MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                      </Grid>
                      <Grid item xs={12} sm={3}>
                        <TextField fullWidth size="small" label="Description" value={cfgDesc}
                          onChange={e => setCfgDesc(e.target.value)} sx={FIELD_SX} />
                      </Grid>
                      <Grid item xs={12} sm={1}>
                        <Button fullWidth variant="contained" size="small" onClick={handleSaveConfig}
                          sx={{ height: "100%", minHeight: 37 }}>Add</Button>
                      </Grid>
                    </Grid>

                    <Divider sx={{ mb: 1 }} />
                    <TableContainer>
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell sx={{ fontWeight: 700, fontSize: 12 }}>Key</TableCell>
                            <TableCell sx={{ fontWeight: 700, fontSize: 12 }}>Value</TableCell>
                            <TableCell sx={{ fontWeight: 700, fontSize: 12 }}>Type</TableCell>
                            <TableCell sx={{ fontWeight: 700, fontSize: 12 }}>Description</TableCell>
                            <TableCell />
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {configs.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={5} align="center" sx={{ color: "text.secondary", fontSize: 13 }}>
                                No configurations yet
                              </TableCell>
                            </TableRow>
                          ) : configs.map(c => (
                            <TableRow key={c.id}>
                              <TableCell sx={{ fontSize: 12, fontWeight: 600 }}>{c.configKey}</TableCell>
                              <TableCell sx={{ fontSize: 12 }}>{c.configValue}</TableCell>
                              <TableCell sx={{ fontSize: 11 }}>
                                <Chip label={c.configType} size="small" variant="outlined" sx={{ fontSize: 10 }} />
                              </TableCell>
                              <TableCell sx={{ fontSize: 12, color: "text.secondary" }}>{c.description}</TableCell>
                              <TableCell>
                                <IconButton size="small" color="error"
                                  onClick={() => handleDeleteConfig(c.id)}>
                                  <Delete fontSize="small" />
                                </IconButton>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </Box>
                )}
              </Box>
            </Paper>
          )}
        </Grid>
      </Grid>

      {/* ── Create / Edit Dialog ── */}
      <Dialog open={formOpen} onClose={() => setFormOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ fontWeight: 700, fontSize: 15 }}>
          {editMode ? `Edit — ${selected?.franchiseCode}` : "New Franchise"}
        </DialogTitle>
        <DialogContent dividers>
          <Grid container spacing={2} sx={{ mt: 0 }}>
            {/* Basic Info */}
            <Grid item xs={12}>
              <Typography variant="caption" sx={{ fontWeight: 700, color: "text.secondary", textTransform: "uppercase" }}>
                Basic Information
              </Typography>
              <Divider sx={{ mt: 0.5, mb: 1.5 }} />
            </Grid>
            <Grid item xs={12} sm={3}>
              <TextField required fullWidth size="small" label="Franchise Code"
                value={form.franchiseCode} onChange={handleFormChange("franchiseCode")}
                disabled={editMode}
                inputProps={{ style: { textTransform: "uppercase" } }}
                helperText="Unique, 3–20 chars (A-Z, 0-9, -)"
                sx={FIELD_SX} />
            </Grid>
            <Grid item xs={12} sm={5}>
              <TextField required fullWidth size="small" label="Franchise Name"
                value={form.franchiseName} onChange={handleFormChange("franchiseName")} sx={FIELD_SX} />
            </Grid>
            <Grid item xs={12} sm={4}>
              <FormControl fullWidth size="small">
                <InputLabel sx={{ fontSize: 13 }}>Franchise Type</InputLabel>
                <Select value={form.franchiseType} onChange={handleFormChange("franchiseType")}
                  label="Franchise Type" sx={{ fontSize: 13 }}>
                  {FRANCHISE_TYPES.map(t => <MenuItem key={t} value={t} sx={{ fontSize: 13 }}>{t}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>

            {/* Address */}
            <Grid item xs={12}>
              <Typography variant="caption" sx={{ fontWeight: 700, color: "text.secondary", textTransform: "uppercase" }}>
                Address
              </Typography>
              <Divider sx={{ mt: 0.5, mb: 1.5 }} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth size="small" label="Address Line 1"
                value={form.addressLine1} onChange={handleFormChange("addressLine1")} sx={FIELD_SX} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth size="small" label="Address Line 2"
                value={form.addressLine2} onChange={handleFormChange("addressLine2")} sx={FIELD_SX} />
            </Grid>
            <Grid item xs={12} sm={3}>
              <TextField fullWidth size="small" label="City"
                value={form.city} onChange={handleFormChange("city")} sx={FIELD_SX} />
            </Grid>
            <Grid item xs={12} sm={3}>
              <FormControl fullWidth size="small">
                <InputLabel sx={{ fontSize: 13 }}>State</InputLabel>
                <Select value={form.state} onChange={handleFormChange("state")} label="State" sx={{ fontSize: 13 }}>
                  {INDIAN_STATES.map(s => <MenuItem key={s} value={s} sx={{ fontSize: 13 }}>{s}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={3}>
              <TextField fullWidth size="small" label="Pincode"
                value={form.pincode} onChange={handleFormChange("pincode")} sx={FIELD_SX} />
            </Grid>
            <Grid item xs={12} sm={3}>
              <TextField fullWidth size="small" label="Country"
                value={form.country} onChange={handleFormChange("country")} sx={FIELD_SX} />
            </Grid>

            {/* Legal */}
            <Grid item xs={12}>
              <Typography variant="caption" sx={{ fontWeight: 700, color: "text.secondary", textTransform: "uppercase" }}>
                Legal & Tax
              </Typography>
              <Divider sx={{ mt: 0.5, mb: 1.5 }} />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField fullWidth size="small" label="GST Number"
                value={form.gstNumber} onChange={handleFormChange("gstNumber")} sx={FIELD_SX} />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField fullWidth size="small" label="PAN Number"
                value={form.panNumber} onChange={handleFormChange("panNumber")} sx={FIELD_SX} />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField fullWidth size="small" label="Website"
                value={form.website} onChange={handleFormChange("website")} sx={FIELD_SX} />
            </Grid>

            {/* Contact */}
            <Grid item xs={12}>
              <Typography variant="caption" sx={{ fontWeight: 700, color: "text.secondary", textTransform: "uppercase" }}>
                Contact
              </Typography>
              <Divider sx={{ mt: 0.5, mb: 1.5 }} />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField fullWidth size="small" label="Contact Person"
                value={form.contactPerson} onChange={handleFormChange("contactPerson")} sx={FIELD_SX} />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField fullWidth size="small" label="Contact Phone"
                value={form.contactPhone} onChange={handleFormChange("contactPhone")} sx={FIELD_SX} />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField fullWidth size="small" label="Contact Email"
                value={form.contactEmail} onChange={handleFormChange("contactEmail")} sx={FIELD_SX} />
            </Grid>

            {/* Agreement */}
            <Grid item xs={12}>
              <Typography variant="caption" sx={{ fontWeight: 700, color: "text.secondary", textTransform: "uppercase" }}>
                Agreement
              </Typography>
              <Divider sx={{ mt: 0.5, mb: 1.5 }} />
            </Grid>
            <Grid item xs={12} sm={3}>
              <TextField fullWidth size="small" label="Agreement Date" type="date"
                value={form.agreementDate} onChange={handleFormChange("agreementDate")}
                InputLabelProps={{ shrink: true }} sx={FIELD_SX} />
            </Grid>
            <Grid item xs={12} sm={3}>
              <TextField fullWidth size="small" label="Agreement Expiry" type="date"
                value={form.agreementExpiry} onChange={handleFormChange("agreementExpiry")}
                InputLabelProps={{ shrink: true }} sx={FIELD_SX} />
            </Grid>
            <Grid item xs={12} sm={3}>
              <TextField fullWidth size="small" label="Royalty %" type="number"
                value={form.royaltyPercentage} onChange={handleFormChange("royaltyPercentage")}
                inputProps={{ min: 0, max: 100, step: 0.5 }} sx={FIELD_SX} />
            </Grid>
            <Grid item xs={12} sm={3}>
              <TextField fullWidth size="small" label="Territory"
                value={form.territory} onChange={handleFormChange("territory")} sx={FIELD_SX} />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setFormOpen(false)} disabled={saving}>Cancel</Button>
          <Button variant="contained" onClick={handleSave} disabled={saving}
            startIcon={saving ? <CircularProgress size={14} /> : null}>
            {saving ? "Saving..." : editMode ? "Update" : "Create"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Status Confirm Dialog ── */}
      <Dialog open={confirmDialog.open} onClose={() => setConfirmDialog({ open: false, action: "", status: "" })}>
        <DialogTitle>Confirm Status Change</DialogTitle>
        <DialogContent>
          <Typography>
            Change <strong>{selected?.franchiseName}</strong> status to{" "}
            <strong>{confirmDialog.status}</strong>?
          </Typography>
          {confirmDialog.status === "TERMINATED" && (
            <Alert severity="warning" sx={{ mt: 1 }}>
              This action will deactivate the franchise. The database will be retained.
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDialog({ open: false, action: "", status: "" })}>Cancel</Button>
          <Button variant="contained"
            color={confirmDialog.status === "TERMINATED" ? "error" : "primary"}
            onClick={confirmStatusChange}>Confirm</Button>
        </DialogActions>
      </Dialog>

      {/* ── Snackbar ── */}
      <Snackbar open={snack.open} autoHideDuration={3500}
        onClose={() => setSnack(p => ({ ...p, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}>
        <Alert severity={snack.sev} onClose={() => setSnack(p => ({ ...p, open: false }))}>
          {snack.msg}
        </Alert>
      </Snackbar>
    </Box>
  );
}
