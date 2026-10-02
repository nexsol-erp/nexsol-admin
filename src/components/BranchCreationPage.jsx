import React, { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import {
  Box, Button, TextField, Typography, Paper, CircularProgress,
  Grid, FormControl, InputLabel, Select, MenuItem,
  Alert, Snackbar, Divider,
} from "@mui/material";
import AccountTreeIcon from "@mui/icons-material/AccountTree";
import AddBusinessIcon from "@mui/icons-material/AddBusiness";

const FIELD_SX = {
  "& .MuiOutlinedInput-root": { borderRadius: "10px" },
};

const SectionHeader = ({ label }) => (
  <Grid item xs={12}>
    <Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: 1, mb: 0.5 }}>
      <Divider sx={{ flex: 1 }} />
      <Typography
        variant="caption"
        sx={{
          fontWeight: 700, letterSpacing: "0.8px",
          color: "text.secondary", textTransform: "uppercase", px: 1,
          whiteSpace: "nowrap",
        }}
      >
        {label}
      </Typography>
      <Divider sx={{ flex: 1 }} />
    </Box>
  </Grid>
);

// Weighbridge accounts (and the weighbridge Get Started page, via ?type=WB) get a short form:
// the branch is always a Weigh Bridge, the name comes first, and the code and voucher prefix are
// filled in from it. They are set up by people who don't know the ERP's terms.
function isWeighbridgeOnly(search) {
  if (new URLSearchParams(search).get("type") === "WB") return true;
  try {
    const roles = JSON.parse(localStorage.getItem("roles") || "[]");
    return roles.includes("WB") && !roles.includes("system-admin");
  } catch {
    return false;
  }
}

/** "Sree Durga Weighbridge" -> "SDW"; "Kundara" -> "KUNDAR". Never one of `taken`. */
export function suggestBranchCode(name, taken = []) {
  const words = (name || "").toUpperCase().replace(/[^A-Z0-9 ]/g, " ").split(/\s+/).filter(Boolean);
  if (!words.length) return "";
  let base = words.length > 1 ? words.map((w) => w[0]).join("").slice(0, 6) : words[0].slice(0, 6);
  if (base.length < 2) base = words.join("").slice(0, 6);
  const used = new Set(taken.map((c) => String(c || "").toUpperCase()));
  if (!used.has(base)) return base;
  for (let n = 2; n < 100; n++) {
    const candidate = `${base.slice(0, 8 - String(n).length)}${n}`;
    if (!used.has(candidate)) return candidate;
  }
  return base;
}

const BranchCreationPage = () => {
  const location = useLocation();
  const wbOnly = isWeighbridgeOnly(location.search);
  const [existingCodes, setExistingCodes] = useState([]);
  // The code and prefix follow the name until the user types in them.
  const codeEdited = useRef(false);
  const prefixEdited = useRef(false);
  const [branchCode,            setBranchCode]            = useState("");
  const [branchName,            setBranchName]            = useState("");
  const [branchState,           setBranchState]           = useState("");
  const [branchBuildingAddress, setBranchBuildingAddress] = useState("");
  const [branchStreetAddress,   setBranchStreetAddress]   = useState("");
  const [branchAddress1,        setBranchAddress1]        = useState("");
  const [branchAddress2,        setBranchAddress2]        = useState("");
  const [branchGst,             setBranchGst]             = useState("");
  const [branchInvoicePrefix,   setBranchInvoicePrefix]   = useState("");
  const [branchType,            setBranchType]            = useState(wbOnly ? "WB" : "");
  const [error,   setError]   = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const resetForm = () => {
    setBranchName("");
    setBranchState("");
    setBranchBuildingAddress("");
    setBranchStreetAddress("");
    setBranchAddress1("");
    setBranchAddress2("");
    setBranchGst("");
    setBranchInvoicePrefix("");
    setBranchType(wbOnly ? "WB" : "");
    if (wbOnly) {
      setBranchCode("");
      codeEdited.current = false;
      prefixEdited.current = false;
    }
  };

  const loadExistingCodes = () => {
    const tenancyId = localStorage.getItem("tenancyId");
    const token = localStorage.getItem("jwtToken");
    fetch(`/api/${tenancyId}/branches`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        const list = Array.isArray(d) ? d : d?.branches || [];
        setExistingCodes(list.map((b) => b.branchCode).filter(Boolean));
      })
      .catch(() => {});
  };

  useEffect(() => {
    if (wbOnly) loadExistingCodes();
  }, [wbOnly]);

  const onWbNameChange = (name) => {
    setBranchName(name);
    if (!codeEdited.current) {
      const code = suggestBranchCode(name, existingCodes);
      setBranchCode(code);
      if (!prefixEdited.current) setBranchInvoicePrefix(code.slice(0, 1));
    }
  };

  const onWbCodeChange = (value) => {
    const code = value.toUpperCase().replace(/[^A-Z0-9]/g, "");
    codeEdited.current = true;
    setBranchCode(code);
    if (!prefixEdited.current) setBranchInvoicePrefix(code.slice(0, 1));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    const branchCodeRegex = /^[A-Za-z0-9]+$/;
    if (!branchCodeRegex.test(branchCode)) {
      setError("Branch Code must contain only letters and numbers — no spaces or special characters.");
      return;
    }
    // Saving reuses the code as the branch id, so an existing code would overwrite that branch.
    if (wbOnly && existingCodes.some((c) => String(c).toUpperCase() === branchCode.toUpperCase())) {
      setError(`Code ${branchCode} is already used by another weighbridge. Please choose a different code.`);
      return;
    }

    const formData = {
      branchCode,
      branchName,
      branchState,
      branchBuildingAddress,
      branchStreetAddress,
      branchAddress1,
      branchAddress2,
      branchGst,
      branchInvoicePrefix,
      branchType,
    };

    setLoading(true);
    try {
      const tenancyId = localStorage.getItem("tenancyId");
      const token     = localStorage.getItem("jwtToken");
      const response  = await fetch(`/api/${tenancyId}/createbranch`, {
        method: "POST",
        headers: {
          Authorization:    `Bearer ${token}`,
          "Content-Type":   "application/json",
          "X-Tenant-ID":    `${tenancyId}`,
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();
      if (data.success) {
        setSuccess(true);
        resetForm();
        if (wbOnly) loadExistingCodes();
      } else {
        setError(data.message || "Failed to create branch. Please try again.");
      }
    } catch (err) {
      console.error("Error:", err);
      setError("An error occurred. Please try again later.");
    } finally {
      setLoading(false);
    }
  };

  if (wbOnly) {
    return (
      <Box sx={{ p: { xs: 2, sm: 3 }, maxWidth: 720 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 3 }}>
          <Box
            sx={{
              width: 42, height: 42, borderRadius: "12px",
              background: "linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)",
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 4px 14px rgba(59,130,246,0.4)",
            }}
          >
            <AccountTreeIcon sx={{ color: "#fff", fontSize: 22 }} />
          </Box>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
              Add a weighbridge
            </Typography>
            <Typography variant="body2" color="text.secondary">
              One for each weighbridge site. The name and address print on the voucher.
            </Typography>
          </Box>
        </Box>

        <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 }, borderRadius: 3 }}>
          {error && (
            <Alert severity="error" sx={{ mb: 2.5, borderRadius: 2 }} onClose={() => setError("")}>
              {error}
            </Alert>
          )}
          <form onSubmit={handleSubmit}>
            <Grid container spacing={2.5}>
              <Grid item xs={12}>
                <TextField
                  label="Weighbridge name"
                  placeholder="e.g. Sree Durga Weighbridge, Kundara"
                  fullWidth required autoFocus
                  value={branchName}
                  onChange={(e) => onWbNameChange(e.target.value)}
                  helperText="As you want it printed at the top of the voucher"
                  sx={FIELD_SX}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Short code"
                  fullWidth size="small" required
                  value={branchCode}
                  onChange={(e) => onWbCodeChange(e.target.value)}
                  inputProps={{ maxLength: 10 }}
                  helperText="Filled in from the name. Letters and numbers only. Used to pick this weighbridge on the PC."
                  sx={FIELD_SX}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Voucher prefix"
                  fullWidth size="small" required
                  value={branchInvoicePrefix}
                  onChange={(e) => {
                    prefixEdited.current = true;
                    setBranchInvoicePrefix(e.target.value.toUpperCase());
                  }}
                  inputProps={{ maxLength: 5 }}
                  helperText="Comes before the voucher number. The first letter of the code unless you change it."
                  sx={FIELD_SX}
                />
              </Grid>

              <SectionHeader label="Address (printed on the voucher)" />
              <Grid item xs={12}>
                <TextField
                  label="Building / place"
                  fullWidth size="small" required
                  value={branchBuildingAddress}
                  onChange={(e) => setBranchBuildingAddress(e.target.value)}
                  sx={FIELD_SX}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Street / road"
                  fullWidth size="small"
                  value={branchStreetAddress}
                  onChange={(e) => setBranchStreetAddress(e.target.value)}
                  sx={FIELD_SX}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Town / city"
                  fullWidth size="small"
                  value={branchAddress1}
                  onChange={(e) => setBranchAddress1(e.target.value)}
                  sx={FIELD_SX}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="State"
                  fullWidth size="small" required
                  value={branchState}
                  onChange={(e) => setBranchState(e.target.value)}
                  sx={FIELD_SX}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="GST number (optional)"
                  fullWidth size="small"
                  value={branchGst}
                  onChange={(e) => setBranchGst(e.target.value.toUpperCase())}
                  sx={FIELD_SX}
                />
              </Grid>

              <Grid item xs={12}>
                <Divider sx={{ mb: 2 }} />
                <Button
                  type="submit"
                  variant="contained"
                  size="large"
                  disabled={loading}
                  startIcon={loading ? <CircularProgress size={18} color="inherit" /> : <AddBusinessIcon />}
                  sx={{
                    background: "linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)",
                    color: "#fff", fontWeight: 700, borderRadius: "10px",
                    px: 4, textTransform: "none", fontSize: 15,
                    "&:hover": { opacity: 0.92 },
                    "&:disabled": { opacity: 0.6 },
                  }}
                >
                  {loading ? "Saving…" : "Save weighbridge"}
                </Button>
              </Grid>
            </Grid>
          </form>
        </Paper>

        <Snackbar
          open={success}
          autoHideDuration={6000}
          onClose={() => setSuccess(false)}
          anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
        >
          <Alert severity="success" onClose={() => setSuccess(false)} sx={{ borderRadius: 2, fontWeight: 600 }}>
            Weighbridge saved. Sign in on the weighbridge PC and pick it from the list.
          </Alert>
        </Snackbar>
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 2, sm: 3 }, maxWidth: 900 }}>

      {/* ── Page header ──────────────────────────────────────────────── */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 3 }}>
        <Box
          sx={{
            width: 42, height: 42, borderRadius: "12px",
            background: "linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 4px 14px rgba(59,130,246,0.4)",
          }}
        >
          <AccountTreeIcon sx={{ color: "#fff", fontSize: 22 }} />
        </Box>
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
            Branch Creation
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Add a new branch to your organisation
          </Typography>
        </Box>
      </Box>

      {/* ── Form card ────────────────────────────────────────────────── */}
      <Paper
        variant="outlined"
        sx={{ p: { xs: 2, sm: 3 }, borderRadius: 3 }}
      >
        {error && (
          <Alert severity="error" sx={{ mb: 2.5, borderRadius: 2 }} onClose={() => setError("")}>
            {error}
          </Alert>
        )}

        <form onSubmit={handleSubmit}>
          <Grid container spacing={2.5}>

            {/* ── Branch identity ──────────────────────────────────── */}
            <SectionHeader label="Branch Identity" />

            <Grid item xs={12} sm={6}>
              <TextField
                label="Branch Code"
                fullWidth size="small" required
                value={branchCode}
                onChange={(e) => setBranchCode(e.target.value.toUpperCase())}
                inputProps={{ maxLength: 10 }}
                helperText="Letters and numbers only, no spaces"
                sx={FIELD_SX}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Branch Name"
                fullWidth size="small" required
                value={branchName}
                onChange={(e) => setBranchName(e.target.value)}
                sx={FIELD_SX}
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                label="GST Number"
                fullWidth size="small" required
                value={branchGst}
                onChange={(e) => setBranchGst(e.target.value.toUpperCase())}
                sx={FIELD_SX}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Invoice Prefix"
                fullWidth size="small" required
                value={branchInvoicePrefix}
                onChange={(e) => setBranchInvoicePrefix(e.target.value.toUpperCase())}
                helperText="e.g. INV, POS, BIL"
                sx={FIELD_SX}
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <FormControl fullWidth size="small" required sx={FIELD_SX}>
                <InputLabel>Branch Type</InputLabel>
                <Select
                  value={branchType}
                  label="Branch Type"
                  onChange={(e) => setBranchType(e.target.value)}
                >
                  <MenuItem value="BAKERY_OUTLET">Bakery Outlet</MenuItem>
                  <MenuItem value="BAKERY_BO">Bakery Back Office</MenuItem>
                  <MenuItem value="BAKERY_CGN">Bakery Central Godown</MenuItem>
                  <MenuItem value="BAKERY_PROD">Bakery Production</MenuItem>
                  <MenuItem value="WB">Weigh Bridge</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            {/* ── Address ──────────────────────────────────────────── */}
            <SectionHeader label="Address" />

            <Grid item xs={12} sm={6}>
              <TextField
                label="Building / Premises"
                fullWidth size="small" required
                value={branchBuildingAddress}
                onChange={(e) => setBranchBuildingAddress(e.target.value)}
                sx={FIELD_SX}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Street"
                fullWidth size="small" required
                value={branchStreetAddress}
                onChange={(e) => setBranchStreetAddress(e.target.value)}
                sx={FIELD_SX}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Address Line 1"
                fullWidth size="small" required
                value={branchAddress1}
                onChange={(e) => setBranchAddress1(e.target.value)}
                sx={FIELD_SX}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Address Line 2"
                fullWidth size="small"
                value={branchAddress2}
                onChange={(e) => setBranchAddress2(e.target.value)}
                sx={FIELD_SX}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="State"
                fullWidth size="small" required
                value={branchState}
                onChange={(e) => setBranchState(e.target.value)}
                sx={FIELD_SX}
              />
            </Grid>

            {/* ── Submit ───────────────────────────────────────────── */}
            <Grid item xs={12}>
              <Divider sx={{ mb: 2 }} />
              <Button
                type="submit"
                variant="contained"
                size="large"
                disabled={loading}
                startIcon={
                  loading
                    ? <CircularProgress size={18} color="inherit" />
                    : <AddBusinessIcon />
                }
                sx={{
                  background: "linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)",
                  color: "#fff", fontWeight: 700, borderRadius: "10px",
                  px: 4, textTransform: "none", fontSize: 15,
                  boxShadow: "0 4px 14px rgba(59,130,246,0.35)",
                  "&:hover": { opacity: 0.92 },
                  "&:disabled": { opacity: 0.6 },
                }}
              >
                {loading ? "Creating Branch…" : "Create Branch"}
              </Button>
            </Grid>

          </Grid>
        </form>
      </Paper>

      {/* ── Success toast ─────────────────────────────────────────── */}
      <Snackbar
        open={success}
        autoHideDuration={4000}
        onClose={() => setSuccess(false)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          severity="success"
          onClose={() => setSuccess(false)}
          sx={{ borderRadius: 2, fontWeight: 600 }}
        >
          Branch created successfully!
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default BranchCreationPage;
