import React, { useState, useEffect } from "react";
import {
  Box, Button, TextField, Typography, Paper,
  Alert, MenuItem, CircularProgress, Divider, InputAdornment, IconButton,
} from "@mui/material";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";

const SANDBOX_URL    = "https://api-preprod.phonepe.com/apis/pg-sandbox";
const PRODUCTION_URL = "https://api.phonepe.com/apis/hermes";

const UpiConfigPage = () => {
  const [loading,    setLoading]    = useState(true);
  const [saving,     setSaving]     = useState(false);
  const [configured, setConfigured] = useState(false);
  const [showKey,    setShowKey]    = useState(false);
  const [error,      setError]      = useState("");
  const [success,    setSuccess]    = useState("");

  const [form, setForm] = useState({
    merchantId:  "",
    saltKey:     "",
    saltIndex:   "1",
    baseUrl:     SANDBOX_URL,
    callbackUrl: "",
  });

  const tenancyId = localStorage.getItem("tenancyId");
  const token     = localStorage.getItem("jwtToken");
  const headers   = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  useEffect(() => {
    (async () => {
      try {
        const res  = await fetch(`/api/${tenancyId}/upi-config`, { headers });
        const data = await res.json();
        if (data.configured) {
          setConfigured(true);
          setForm({
            merchantId:  data.merchantId  || "",
            saltKey:     data.saltKey     || "",   // arrives masked from backend
            saltIndex:   data.saltIndex   || "1",
            baseUrl:     data.baseUrl     || SANDBOX_URL,
            callbackUrl: data.callbackUrl || "",
          });
        }
      } catch {
        setError("Failed to load UPI configuration.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleChange = (field) => (e) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
    setError(""); setSuccess("");
  };

  const handleSave = async () => {
    setError(""); setSuccess("");
    if (!form.merchantId.trim()) { setError("Merchant ID is required."); return; }
    if (!form.saltKey.trim())    { setError("Salt Key is required."); return; }
    if (!form.baseUrl.trim())    { setError("Please select an environment."); return; }

    setSaving(true);
    try {
      const res  = await fetch(`/api/${tenancyId}/upi-config`, {
        method: "POST",
        headers,
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Failed to save."); return; }
      setSuccess("UPI configuration saved successfully. Customers can now pay via UPI QR.");
      setConfigured(true);
    } catch {
      setError("An error occurred while saving.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ ml: "240px", mt: 4, display: "flex", justifyContent: "center" }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ flexGrow: 1, p: 3, ml: "240px", mt: 2 }}>
      <Typography variant="h5" gutterBottom>UPI Payment Setup</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Enter your PhonePe Business credentials. UPI payments from customers will go
        directly into your linked bank account.
      </Typography>

      {configured && (
        <Alert severity="success" sx={{ mb: 3 }}>
          UPI is configured and active for this tenant.
        </Alert>
      )}
      {error   && <Alert severity="error"   sx={{ mb: 2 }}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}

      <Paper elevation={3} sx={{ p: 4, maxWidth: 560 }}>
        <Typography variant="h6" gutterBottom>PhonePe Business Credentials</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Register at{" "}
          <strong>developer.phonepe.com</strong> to obtain these credentials.
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
          placeholder="https://your-server.com/api/{tenantId}/upi/callback"
          helperText="Public URL where PhonePe sends payment confirmation (optional if polling only)"
        />

        <Button
          variant="contained"
          onClick={handleSave}
          disabled={saving}
          startIcon={saving ? <CircularProgress size={16} color="inherit" /> : null}
        >
          {saving ? "Saving…" : "Save UPI Configuration"}
        </Button>
      </Paper>

      <Paper elevation={1} sx={{ p: 3, maxWidth: 560, mt: 4, background: "#f9f9f9" }}>
        <Typography variant="subtitle2" gutterBottom>How to get credentials</Typography>
        <Typography variant="body2" color="text.secondary" component="ol" sx={{ pl: 2, m: 0 }}>
          <li>Go to <strong>developer.phonepe.com</strong> and create a merchant account</li>
          <li>Under your app, find <strong>Merchant ID</strong>, <strong>Salt Key</strong>, and <strong>Salt Index</strong></li>
          <li>Use <strong>Sandbox</strong> environment for testing; switch to <strong>Production</strong> before go-live</li>
          <li>In production, ensure your server is reachable at the Callback URL for instant payment confirmation</li>
        </Typography>
      </Paper>
    </Box>
  );
};

export default UpiConfigPage;
