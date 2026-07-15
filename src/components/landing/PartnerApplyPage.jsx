import React, { useState } from "react";
import {
  Box, Typography, Paper, TextField, Button, MenuItem, CssBaseline,
  Snackbar, Alert, CircularProgress,
} from "@mui/material";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import { useNavigate } from "react-router-dom";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";

const lightTheme = createTheme({ palette: { mode: "light" } });

const PARTNER_TYPES = [
  "ERP Implementation Company",
  "POS Solution Provider",
  "Software Company",
  "IT Service Provider",
  "System Integrator",
  "Managed Service Provider (MSP)",
  "Business Consultant",
  "Accounting & Finance Consultant",
  "Digital Transformation Consultant",
  "Retail Technology Consultant",
  "Other",
];

const EMPTY_FORM = {
  companyName: "", contactName: "", email: "", phone: "",
  country: "", partnerType: "", message: "",
};

const PartnerApplyPage = () => {
  const navigate = useNavigate();
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [snack, setSnack] = useState({ open: false, message: "", severity: "error" });

  const handleChange = (field) => (e) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const validate = () => {
    const next = {};
    if (!form.companyName.trim()) next.companyName = "Company name is required";
    if (!form.contactName.trim()) next.contactName = "Contact name is required";
    if (!form.email.trim()) next.email = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) next.email = "Enter a valid email";
    if (!form.phone.trim()) next.phone = "Phone number is required";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setSubmitting(true);
    try {
      const response = await fetch("/api/partner/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await response.json().catch(() => ({}));

      if (response.ok && data.success) {
        setSubmitted(true);
      } else {
        setSnack({
          open: true,
          message: data.message || "Something went wrong. Please try again.",
          severity: "error",
        });
      }
    } catch (err) {
      setSnack({ open: true, message: "Network error. Please try again.", severity: "error" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ThemeProvider theme={lightTheme}>
      <CssBaseline />
      <Box
        sx={{
          minHeight: "100vh",
          background: "linear-gradient(135deg, #0f172a 0%, #1e3a8a 55%, #1d4ed8 100%)",
          display: "flex", alignItems: "center", justifyContent: "center",
          px: 2, py: 6, position: "relative", overflow: "hidden",
        }}
      >
        {[
          { top: "5%", left: "-10%", size: 380, color: "rgba(59,130,246,0.18)" },
          { bottom: "5%", right: "-8%", size: 300, color: "rgba(139,92,246,0.15)" },
        ].map((o, i) => (
          <Box
            key={i}
            sx={{
              position: "absolute", borderRadius: "50%",
              width: o.size, height: o.size, bgcolor: o.color, filter: "blur(80px)",
              top: o.top, left: o.left, bottom: o.bottom, right: o.right,
              pointerEvents: "none",
            }}
          />
        ))}

        <Box sx={{ position: "relative", zIndex: 1, width: "100%", maxWidth: 560 }}>
          {/* Logo */}
          <Box
            onClick={() => navigate("/")}
            sx={{
              display: "flex", alignItems: "center", justifyContent: "center",
              mb: 4, cursor: "pointer", gap: 1.2,
            }}
          >
            <Box
              sx={{
                width: 40, height: 40, borderRadius: "11px",
                background: "linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)",
                display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: "0 4px 14px rgba(59,130,246,0.5)",
              }}
            >
              <Typography sx={{ color: "#fff", fontWeight: 800, fontSize: 20 }}>T</Typography>
            </Box>
            <Typography sx={{ fontWeight: 800, fontSize: 24, color: "#fff", letterSpacing: "-0.5px" }}>
              Tradelink<span style={{ color: "#60a5fa" }}>247</span>
            </Typography>
          </Box>

          <Paper elevation={24} sx={{ borderRadius: "20px", overflow: "hidden", bgcolor: "#fff" }}>
            {submitted ? (
              <Box sx={{ p: { xs: 4, md: 6 }, textAlign: "center" }}>
                <CheckCircleIcon sx={{ color: "#10b981", fontSize: 56, mb: 2 }} />
                <Typography sx={{ fontWeight: 800, fontSize: 22, color: "#0f172a", mb: 1 }}>
                  Application Received
                </Typography>
                <Typography sx={{ fontSize: 14.5, color: "#64748b", lineHeight: 1.7, mb: 4 }}>
                  Thank you for your interest in becoming a TradeLink247 partner. Our team
                  will review your application and get in touch with you shortly.
                </Typography>
                <Button
                  variant="contained"
                  onClick={() => navigate("/partner")}
                  sx={{
                    background: "linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)",
                    borderRadius: "10px", textTransform: "none", fontWeight: 600, px: 4,
                  }}
                >
                  Back to Partner Page
                </Button>
              </Box>
            ) : (
              <Box component="form" onSubmit={handleSubmit} sx={{ p: { xs: 3, md: 5 } }}>
                <Button
                  startIcon={<ArrowBackRoundedIcon />}
                  onClick={() => navigate("/partner")}
                  sx={{ textTransform: "none", color: "#64748b", mb: 1, px: 0, "&:hover": { bgcolor: "transparent", color: "#1e40af" } }}
                >
                  Back
                </Button>
                <Typography sx={{ fontWeight: 800, fontSize: 22, color: "#0f172a", mb: 0.5 }}>
                  Become a Partner
                </Typography>
                <Typography sx={{ fontSize: 13.5, color: "#64748b", mb: 3 }}>
                  Tell us about your business and we'll get back to you within 2 business days.
                </Typography>

                <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  <TextField
                    label="Company Name" fullWidth required
                    value={form.companyName} onChange={handleChange("companyName")}
                    error={!!errors.companyName} helperText={errors.companyName}
                  />
                  <TextField
                    label="Contact Person Name" fullWidth required
                    value={form.contactName} onChange={handleChange("contactName")}
                    error={!!errors.contactName} helperText={errors.contactName}
                  />
                  <TextField
                    label="Email Address" type="email" fullWidth required
                    value={form.email} onChange={handleChange("email")}
                    error={!!errors.email} helperText={errors.email}
                  />
                  <TextField
                    label="Phone Number" fullWidth required
                    value={form.phone} onChange={handleChange("phone")}
                    error={!!errors.phone} helperText={errors.phone}
                  />
                  <TextField
                    label="Country" fullWidth
                    value={form.country} onChange={handleChange("country")}
                  />
                  <TextField
                    label="Partner Type" select fullWidth
                    value={form.partnerType} onChange={handleChange("partnerType")}
                  >
                    {PARTNER_TYPES.map((t) => (
                      <MenuItem key={t} value={t}>{t}</MenuItem>
                    ))}
                  </TextField>
                  <TextField
                    label="Tell us about your business (optional)"
                    fullWidth multiline rows={3}
                    value={form.message} onChange={handleChange("message")}
                  />

                  <Button
                    type="submit"
                    variant="contained"
                    size="large"
                    disabled={submitting}
                    sx={{
                      background: "linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)",
                      borderRadius: "10px", textTransform: "none", fontWeight: 700,
                      py: 1.4, mt: 1,
                      "&:hover": { opacity: 0.92 },
                    }}
                  >
                    {submitting ? <CircularProgress size={22} sx={{ color: "#fff" }} /> : "Submit Application"}
                  </Button>
                </Box>
              </Box>
            )}
          </Paper>

          <Typography sx={{ mt: 3, textAlign: "center", fontSize: 12, color: "rgba(255,255,255,0.35)" }}>
            © {new Date().getFullYear()} Tradelink247. All rights reserved.
          </Typography>
        </Box>
      </Box>

      <Snackbar
        open={snack.open}
        autoHideDuration={5000}
        onClose={() => setSnack((prev) => ({ ...prev, open: false }))}
      >
        <Alert severity={snack.severity} onClose={() => setSnack((prev) => ({ ...prev, open: false }))}>
          {snack.message}
        </Alert>
      </Snackbar>
    </ThemeProvider>
  );
};

export default PartnerApplyPage;
