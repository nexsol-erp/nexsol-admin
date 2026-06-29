import React, { useState, useEffect } from "react";
import {
  Box,
  Button,
  Typography,
  Modal,
  IconButton,
  AppBar,
  Toolbar,
  Select,
  MenuItem,
  TextField,
} from "@mui/material";
import { useTranslation } from "react-i18next";
import CloseIcon from "@mui/icons-material/Close";
import SignUpForm from "./SignUpForm";

// ✅ Decode JWT payload (base64url) without any library
const decodeJwtPayload = (token) => {
  try {
    if (!token) return null;
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(
      base64.length + (4 - (base64.length % 4)) % 4,
      "="
    );

    const json = atob(padded);
    return JSON.parse(json);
  } catch (e) {
    console.error("Failed to decode JWT payload:", e);
    return null;
  }
};

const LoginForm = ({ onLogin, autoOpen = false }) => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [modalOpen, setModalOpen] = useState(autoOpen);

  const { t, i18n } = useTranslation();
  const [selectedLanguage, setSelectedLanguage] = useState("en");

  useEffect(() => {
    const savedLanguage = localStorage.getItem("language");
    if (savedLanguage) {
      i18n.changeLanguage(savedLanguage);
      setSelectedLanguage(savedLanguage);
    }
  }, [i18n]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const response = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Server error ${response.status}: ${text.slice(0, 120)}`);
      }

      const data = await response.json();

      if (data.success) {
        // Store raw login response fields
        localStorage.setItem("jwtToken", data.token);
        localStorage.setItem("tenancyId", data.tenancyId);
        localStorage.setItem("roles", JSON.stringify(data.roles || []));

        // Store setup status so the app can redirect to wizard if needed
        const setupCompleted = data.setupCompleted !== false; // default true for legacy
        localStorage.setItem("setupCompleted", setupCompleted ? "true" : "false");

        // ✅ Extract allowed branches from JWT claims and store
        const payload = decodeJwtPayload(data.token);
        const allowedBranches =
          payload && Array.isArray(payload.branches) ? payload.branches : [];

        localStorage.setItem(
          "allowedBranches",
          JSON.stringify(allowedBranches)
        );

        // Notify parent
        onLogin?.(data.roles || []);

        setModalOpen(false);
      } else {
        alert(data.message || "Login failed");
      }
    } catch (error) {
      console.error("Error:", error);
      alert(error.message || "An error occurred. Please try again later.");
    }
  };

  const handleLanguageChange = (event) => {
    const newLanguage = event.target.value;
    i18n.changeLanguage(newLanguage);
    setSelectedLanguage(newLanguage);
    localStorage.setItem("language", newLanguage);
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        width: "100vw",
        background: "linear-gradient(135deg, #0f172a 0%, #1e3a8a 55%, #1d4ed8 100%)",
        display: "flex",
        flexDirection: "column",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Glowing orbs — matches landing page */}
      {[
        { top: "8%",  left: "-6%",  size: 380, color: "rgba(59,130,246,0.18)" },
        { top: "55%", right: "-5%", size: 320, color: "rgba(139,92,246,0.15)" },
        { top: "35%", left: "42%",  size: 240, color: "rgba(16,185,129,0.10)" },
      ].map((o, i) => (
        <Box
          key={i}
          sx={{
            position: "absolute", borderRadius: "50%",
            width: o.size, height: o.size,
            bgcolor: o.color, filter: "blur(80px)",
            top: o.top, left: o.left, right: o.right,
            pointerEvents: "none",
          }}
        />
      ))}

      {/* Top navigation bar */}
      <AppBar
        position="static"
        elevation={0}
        sx={{ bgcolor: "transparent", borderBottom: "1px solid rgba(255,255,255,0.1)" }}
      >
        <Toolbar>
          {/* Logo */}
          <Box sx={{ display: "flex", alignItems: "center", flexGrow: 1, gap: 1.2 }}>
            <Box
              sx={{
                width: 34, height: 34, borderRadius: "9px",
                background: "linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)",
                display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: "0 4px 12px rgba(59,130,246,0.45)",
              }}
            >
              <Typography sx={{ color: "#fff", fontWeight: 800, fontSize: 16 }}>T</Typography>
            </Box>
            <Typography sx={{ fontWeight: 800, fontSize: 20, color: "#fff", letterSpacing: "-0.4px" }}>
              Tradelink<span style={{ color: "#60a5fa" }}>247</span>
            </Typography>
          </Box>
          <Button
            onClick={() => { setIsSignUp(false); setModalOpen(true); }}
            variant="outlined"
            size="small"
            sx={{
              mr: 1, color: "#fff", borderColor: "rgba(255,255,255,0.45)",
              textTransform: "none", fontWeight: 600, borderRadius: "8px",
              "&:hover": { borderColor: "#fff", bgcolor: "rgba(255,255,255,0.08)" },
            }}
          >
            {t("login")}
          </Button>
          <Button
            onClick={() => { setIsSignUp(true); setModalOpen(true); }}
            variant="contained"
            size="small"
            sx={{
              background: "linear-gradient(135deg, #1e40af, #3b82f6)",
              color: "#fff", textTransform: "none", fontWeight: 600,
              borderRadius: "8px",
              boxShadow: "0 4px 12px rgba(59,130,246,0.4)",
              "&:hover": { opacity: 0.9 },
            }}
          >
            {t("signup")}
          </Button>
        </Toolbar>
      </AppBar>

      {/* Centre content */}
      <Box
        sx={{
          flex: 1, display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          px: 2, py: 6, position: "relative", zIndex: 1,
        }}
      >
        <Typography
          variant="h3"
          sx={{
            fontWeight: 800, color: "#fff", textAlign: "center",
            fontSize: { xs: "1.8rem", md: "2.6rem" },
            letterSpacing: "-0.5px", mb: 2, maxWidth: 700,
          }}
        >
          Run Your Retail Business{" "}
          <Box
            component="span"
            sx={{
              background: "linear-gradient(90deg, #60a5fa, #a78bfa, #34d399)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            Smarter
          </Box>{" "}
          with Tradelink247
        </Typography>

        <Typography
          sx={{
            fontSize: { xs: 14, md: 16 }, color: "rgba(255,255,255,0.65)",
            textAlign: "center", maxWidth: 560, lineHeight: 1.75, mb: 5,
          }}
        >
          Complete cloud ERP and POS solution for billing, inventory, purchase,
          stock transfer, reports, branches, and business growth.
        </Typography>

        {/* Feature chips */}
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1.5, justifyContent: "center", mb: 5 }}>
          {[
            "⚡ Fast POS Billing",
            "📦 Inventory Management",
            "🏪 Multi-Branch Control",
            "📊 Smart Reports",
            "☁️ Cloud Access",
            "🔒 Secure & GST Ready",
          ].map((chip) => (
            <Box
              key={chip}
              sx={{
                bgcolor: "rgba(255,255,255,0.08)",
                border: "1px solid rgba(255,255,255,0.15)",
                color: "rgba(255,255,255,0.8)",
                borderRadius: "20px", px: 2, py: 0.7,
                fontSize: 13, fontWeight: 500,
              }}
            >
              {chip}
            </Box>
          ))}
        </Box>

        <Button
          variant="contained"
          size="large"
          onClick={() => { setIsSignUp(false); setModalOpen(true); }}
          sx={{
            background: "linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)",
            color: "#fff", fontWeight: 700, fontSize: 16,
            borderRadius: "12px", px: 5, py: 1.6,
            textTransform: "none",
            boxShadow: "0 8px 24px rgba(59,130,246,0.5)",
            "&:hover": { opacity: 0.92 },
          }}
        >
          Login to Your Account
        </Button>

        <Typography sx={{ mt: 2, color: "rgba(255,255,255,0.45)", fontSize: 13 }}>
          Don't have an account?{" "}
          <Box
            component="span"
            onClick={() => { setIsSignUp(true); setModalOpen(true); }}
            sx={{ color: "#60a5fa", fontWeight: 600, cursor: "pointer", "&:hover": { color: "#93c5fd" } }}
          >
            Sign up free
          </Box>
        </Typography>
      </Box>

      {/* Modal for login and signup */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        aria-labelledby="auth-modal-title"
        aria-describedby="auth-modal-description"
      >
        <Box
          sx={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            backgroundColor: "white",
            color: "#000",
            // No padding when signup — the form provides its own header flush to edges
            padding: isSignUp ? 0 : "20px",
            borderRadius: "8px",
            overflow: "hidden",
            width: { xs: "92vw", sm: isSignUp ? 460 : 480 },
            maxWidth: "92vw",
            maxHeight: "95vh",
            overflowY: "auto",
          }}
        >
          {/* Login header row — hidden during signup (SignUpForm has its own header) */}
          {!isSignUp && (
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1 }}>
              <Typography variant="h4" sx={{ color: "#000" }}>
                {t("login")}
              </Typography>
              <IconButton onClick={() => setModalOpen(false)} sx={{ color: "#000" }}>
                <CloseIcon />
              </IconButton>
            </Box>
          )}

          {isSignUp ? (
            <SignUpForm
              onSignUp={() => setModalOpen(false)}
              onClose={() => setModalOpen(false)}
              onLogin={(roles) => { onLogin?.(roles); setModalOpen(false); }}
            />
          ) : (
            <>
              <form onSubmit={handleSubmit}>
                <TextField
                  label={t("username")}
                  fullWidth margin="normal"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  variant="outlined"
                  InputLabelProps={{ style: { color: "#555" } }}
                  sx={{
                    input: { color: "#000" },
                    "& .MuiOutlinedInput-root": {
                      backgroundColor: "#fff",
                      "& fieldset": { borderColor: "#ccc" },
                      "&:hover fieldset": { borderColor: "#999" },
                      "&.Mui-focused fieldset": { borderColor: "#1976d2" },
                    },
                  }}
                />
                <TextField
                  label={t("password")}
                  type="password"
                  fullWidth margin="normal"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  variant="outlined"
                  InputLabelProps={{ style: { color: "#555" } }}
                  sx={{
                    input: { color: "#000" },
                    "& .MuiOutlinedInput-root": {
                      backgroundColor: "#fff",
                      "& fieldset": { borderColor: "#ccc" },
                      "&:hover fieldset": { borderColor: "#999" },
                      "&.Mui-focused fieldset": { borderColor: "#1976d2" },
                    },
                  }}
                />
                <Button type="submit" variant="contained" color="primary" fullWidth>
                  {t("login")}
                </Button>
              </form>

              <Select
                value={selectedLanguage}
                onChange={handleLanguageChange}
                fullWidth displayEmpty
                MenuProps={{
                  PaperProps: {
                    sx: { bgcolor: "#fff", color: "#000", "& .MuiMenuItem-root": { color: "#000" } },
                  },
                }}
                sx={{
                  mt: 2, color: "#000", backgroundColor: "#fff",
                  ".MuiSelect-icon": { color: "#000" },
                  ".MuiOutlinedInput-notchedOutline": { borderColor: "#ccc" },
                  "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: "#999" },
                  "&.Mui-focused .MuiOutlinedInput-notchedOutline": { borderColor: "#1976d2" },
                }}
              >
                <MenuItem disabled value=""><em>{t("selectLanguage") || "Select Language"}</em></MenuItem>
                <MenuItem value="en">English</MenuItem>
                <MenuItem value="ar">العربية</MenuItem>
                <MenuItem value="fr">Français</MenuItem>
                <MenuItem value="ml">മലയാളം</MenuItem>
                <MenuItem value="hi">हिन्दी</MenuItem>
                <MenuItem value="ta">தமிழ்</MenuItem>
                <MenuItem value="kn">ಕನ್ನಡ</MenuItem>
                <MenuItem value="te">తెలుగు</MenuItem>
              </Select>
            </>
          )}
        </Box>
      </Modal>
    </Box>
  );
};

export default LoginForm;
