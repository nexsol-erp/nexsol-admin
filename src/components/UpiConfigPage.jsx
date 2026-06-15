import React, { useState, useEffect, useCallback } from "react";
import {
  Box, Button, TextField, Typography, Paper,
  Alert, MenuItem, CircularProgress, Divider,
  InputAdornment, IconButton, Dialog, DialogTitle,
  DialogContent, DialogActions,
} from "@mui/material";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";

const SANDBOX_URL    = "https://api-preprod.phonepe.com/apis/pg-sandbox";
const PRODUCTION_URL = "https://api.phonepe.com/apis/hermes";

const EMPTY_FORM = {
  merchantId:  "",
  saltKey:     "",
  saltIndex:   "1",
  baseUrl:     SANDBOX_URL,
  callbackUrl: "",
};

const UpiConfigPage = () => {
  const tenancyId = localStorage.getItem("tenancyId");
  const token     = localStorage.getItem("jwtToken");
  const headers   = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  // Branch state
  const [branches,       setBranches]       = useState([]);
  const [selectedBranch, setSelectedBranch] = useState("");
  const [branchesLoading, setBranchesLoading] = useState(true);

  // Config state
  const [configLoading, setConfigLoading] = useState(false);
  const [saving,        setSaving]        = useState(false);
  const [configured,    setConfigured]    = useState(false);
  const [showKey,       setShowKey]       = useState(false);
  const [error,         setError]         = useState("");
  const [success,       setSuccess]       = useState("");
  const [form,          setForm]          = useState(EMPTY_FORM);

  // Copy-from-branch dialog
  const [copyOpen,       setCopyOpen]       = useState(false);
  const [copyFromBranch, setCopyFromBranch] = useState("");
  const [copying,        setCopying]        = useState(false);
  const [copyError,      setCopyError]      = useState("");

  // Load all branches on mount
  useEffect(() => {
    (async () => {
      try {
        const res  = await fetch(`/api/${tenancyId}/branches`, { headers });
        const data = await res.json();
        const list = Array.isArray(data) ? data : data.branches || [];
        setBranches(list);
        if (list.length > 0) setSelectedBranch(list[0].branchCode);
      } catch {
        setError("Failed to load branches.");
      } finally {
        setBranchesLoading(false);
      }
    })();
  }, []);

  // Load UPI config whenever the selected branch changes
  const loadConfig = useCallback(async (branchCode) => {
    if (!branchCode) return;
    setConfigLoading(true);
    setError(""); setSuccess("");
    try {
      const res  = await fetch(`/api/${tenancyId}/upi-config?branchCode=${encodeURIComponent(branchCode)}`, { headers });
      const data = await res.json();
      if (data.configured) {
        setConfigured(true);
        setForm({
          merchantId:  data.merchantId  || "",
          saltKey:     data.saltKey     || "",
          saltIndex:   data.saltIndex   || "1",
          baseUrl:     data.baseUrl     || SANDBOX_URL,
          callbackUrl: data.callbackUrl || "",
        });
      } else {
        setConfigured(false);
        setForm(EMPTY_FORM);
      }
    } catch {
      setError("Failed to load UPI configuration.");
    } finally {
      setConfigLoading(false);
    }
  }, [tenancyId]);

  useEffect(() => {
    if (selectedBranch) loadConfig(selectedBranch);
  }, [selectedBranch, loadConfig]);

  const handleChange = (field) => (e) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
    setError(""); setSuccess("");
  };

  const handleSave = async () => {
    setError(""); setSuccess("");
    if (!selectedBranch)         { setError("Please select a branch."); return; }
    if (!form.merchantId.trim()) { setError("Merchant ID is required."); return; }
    if (!form.saltKey.trim())    { setError("Salt Key is required."); return; }
    if (!form.baseUrl.trim())    { setError("Please select an environment."); return; }

    setSaving(true);
    try {
      const res  = await fetch(
        `/api/${tenancyId}/upi-config?branchCode=${encodeURIComponent(selectedBranch)}`,
        { method: "POST", headers, body: JSON.stringify(form) }
      );
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Failed to save."); return; }
      setSuccess("UPI configuration saved successfully for " + selectedBranch + ".");
      setConfigured(true);
    } catch {
      setError("An error occurred while saving.");
    } finally {
      setSaving(false);
    }
  };

  const handleCopyConfirm = async () => {
    setCopyError("");
    if (!copyFromBranch) { setCopyError("Please select a source branch."); return; }
    if (copyFromBranch === selectedBranch) { setCopyError("Source and destination cannot be the same branch."); return; }

    setCopying(true);
    try {
      const res  = await fetch(`/api/${tenancyId}/upi-config/copy`, {
        method: "POST",
        headers,
        body: JSON.stringify({ fromBranchCode: copyFromBranch, toBranchCode: selectedBranch }),
      });
      const data = await res.json();
      if (!res.ok) { setCopyError(data.error || "Copy failed."); return; }
      setCopyOpen(false);
      setCopyFromBranch("");
      await loadConfig(selectedBranch);
      setSuccess(`UPI config copied from ${copyFromBranch} to ${selectedBranch}.`);
    } catch {
      setCopyError("An error occurred while copying.");
    } finally {
      setCopying(false);
    }
  };

  if (branchesLoading) {
    return (
      <Box sx={{ ml: "240px", mt: 4, display: "flex", justifyContent: "center" }}>
        <CircularProgress />
      </Box>
    );
  }

  const otherBranches = branches.filter((b) => b.branchCode !== selectedBranch);

  return (
    <Box sx={{ flexGrow: 1, p: 3, ml: "240px", mt: 2 }}>
      <Typography variant="h5" gutterBottom>UPI Payment Setup</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Configure PhonePe Business credentials per branch. Each branch can have its own UPI merchant account.
      </Typography>

      {/* Branch selector */}
      <Paper elevation={2} sx={{ p: 3, maxWidth: 560, mb: 3 }}>
        <Typography variant="subtitle2" gutterBottom>Select Branch</Typography>
        <Box sx={{ display: "flex", gap: 2, alignItems: "center" }}>
          <TextField
            select
            size="small"
            fullWidth
            value={selectedBranch}
            onChange={(e) => { setSelectedBranch(e.target.value); setShowKey(false); }}
            label="Branch"
          >
            {branches.map((b) => (
              <MenuItem key={b.branchCode} value={b.branchCode}>
                {b.branchName} ({b.branchCode})
              </MenuItem>
            ))}
          </TextField>
          <Button
            variant="outlined"
            size="small"
            startIcon={<ContentCopyIcon />}
            disabled={!selectedBranch || otherBranches.length === 0}
            onClick={() => { setCopyOpen(true); setCopyError(""); setCopyFromBranch(""); }}
            sx={{ whiteSpace: "nowrap" }}
          >
            Copy from branch
          </Button>
        </Box>
      </Paper>

      {/* Status alerts */}
      {configured && !success && (
        <Alert severity="success" sx={{ mb: 2, maxWidth: 560 }}>
          UPI is configured and active for <strong>{selectedBranch}</strong>.
        </Alert>
      )}
      {error   && <Alert severity="error"   sx={{ mb: 2, maxWidth: 560 }}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2, maxWidth: 560 }}>{success}</Alert>}

      {/* Config form */}
      {configLoading ? (
        <Box sx={{ display: "flex", justifyContent: "center", mt: 4 }}>
          <CircularProgress />
        </Box>
      ) : (
        <Paper elevation={3} sx={{ p: 4, maxWidth: 560 }}>
          <Typography variant="h6" gutterBottom>PhonePe Business Credentials</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Register at <strong>developer.phonepe.com</strong> to obtain these credentials.
          </Typography>
          <Divider sx={{ mb: 3 }} />

          <TextField
            label="Merchant ID"
            fullWidth
            size="small"
            value={form.merchantId}
            onChange={handleChange("merchantId")}
            sx={{ mb: 2 }}
            placeholder="e.g. PGTESTPAYUAT"
            helperText="Your PhonePe merchant identifier"
          />

          <TextField
            label="Salt Key"
            fullWidth
            size="small"
            type={showKey ? "text" : "password"}
            value={form.saltKey}
            onChange={handleChange("saltKey")}
            sx={{ mb: 2 }}
            helperText="Keep this secret — used to sign API requests"
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton size="small" onClick={() => setShowKey((v) => !v)}>
                    {showKey ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />

          <TextField
            label="Salt Index"
            fullWidth
            size="small"
            value={form.saltIndex}
            onChange={handleChange("saltIndex")}
            sx={{ mb: 2 }}
            helperText="Usually '1' — provided alongside the salt key"
          />

          <TextField
            label="Environment"
            fullWidth
            size="small"
            select
            value={form.baseUrl}
            onChange={handleChange("baseUrl")}
            sx={{ mb: 2 }}
          >
            <MenuItem value={SANDBOX_URL}>Sandbox (Testing)</MenuItem>
            <MenuItem value={PRODUCTION_URL}>Production (Live)</MenuItem>
          </TextField>

          <TextField
            label="Callback URL"
            fullWidth
            size="small"
            value={form.callbackUrl}
            onChange={handleChange("callbackUrl")}
            sx={{ mb: 3 }}
            placeholder={`https://your-server.com/api/${tenancyId}/upi/callback`}
            helperText="Public URL where PhonePe sends payment confirmation (optional if polling only)"
          />

          <Button
            variant="contained"
            onClick={handleSave}
            disabled={saving || !selectedBranch}
            startIcon={saving ? <CircularProgress size={16} color="inherit" /> : null}
          >
            {saving ? "Saving…" : `Save for ${selectedBranch || "branch"}`}
          </Button>
        </Paper>
      )}

      <Paper elevation={1} sx={{ p: 3, maxWidth: 560, mt: 4, background: "#f9f9f9" }}>
        <Typography variant="subtitle2" gutterBottom>How to get credentials</Typography>
        <Typography variant="body2" color="text.secondary" component="ol" sx={{ pl: 2, m: 0 }}>
          <li>Go to <strong>developer.phonepe.com</strong> and create a merchant account</li>
          <li>Under your app, find <strong>Merchant ID</strong>, <strong>Salt Key</strong>, and <strong>Salt Index</strong></li>
          <li>Use <strong>Sandbox</strong> environment for testing; switch to <strong>Production</strong> before go-live</li>
          <li>In production, ensure your server is reachable at the Callback URL for instant payment confirmation</li>
        </Typography>
      </Paper>

      {/* Copy-from-branch dialog */}
      <Dialog open={copyOpen} onClose={() => setCopyOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Copy UPI Config from Another Branch</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Select the branch to copy credentials from. This will overwrite any existing config for{" "}
            <strong>{selectedBranch}</strong>.
          </Typography>
          {copyError && <Alert severity="error" sx={{ mb: 2 }}>{copyError}</Alert>}
          <TextField
            select
            label="Copy from branch"
            size="small"
            fullWidth
            value={copyFromBranch}
            onChange={(e) => { setCopyFromBranch(e.target.value); setCopyError(""); }}
          >
            {otherBranches.map((b) => (
              <MenuItem key={b.branchCode} value={b.branchCode}>
                {b.branchName} ({b.branchCode})
              </MenuItem>
            ))}
          </TextField>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCopyOpen(false)} disabled={copying}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleCopyConfirm}
            disabled={copying || !copyFromBranch}
            startIcon={copying ? <CircularProgress size={16} color="inherit" /> : null}
          >
            {copying ? "Copying…" : "Copy"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default UpiConfigPage;
