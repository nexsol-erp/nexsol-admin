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
import HomeRoundedIcon from "@mui/icons-material/HomeRounded";
import SignUpForm from "./SignUpForm";
import { useNavigate } from "react-router-dom";

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
  const navigate = useNavigate();
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
        // ── Multi-tenant: user must select a company first ──────────────
        if (data.needsTenantSelection) {
          localStorage.setItem("partialToken",   data.token);
          localStorage.setItem("pendingTenants", JSON.stringify(data.accessibleTenants || []));
          setModalOpen(false);
          navigate("/tenant-select");
          return;
        }

        // ── Single tenant: standard flow ─────────────────────────────────
        localStorage.setItem("jwtToken",  data.token);
        localStorage.setItem("tenancyId", data.tenancyId);
        localStorage.setItem("roles",     JSON.stringify(data.roles || []));

        // Store setup status so the app can redirect to wizard if needed
        const setupCompleted = data.setupCompleted !== false; // default true for legacy
        localStorage.setItem("setupCompleted", setupCompleted ? "true" : "false");

        // ✅ Extract allowed branches from JWT claims and store
        const payload = decodeJwtPayload(data.token);
        const allowedBranches =
          payload && Array.isArray(payload.branches) ? payload.branches : [];
        localStorage.setItem("allowedBranches", JSON.stringify(allowedBranches));

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
            onClick={() => navigate("/")}
            size="small"
            startIcon={<HomeRoundedIcon />}
            sx={{
              mr: 1.5, color: "rgba(255,255,255,0.7)",
              textTransform: "none", fontWeight: 500, borderRadius: "8px",
              "&:hover": { color: "#fff", bgcolor: "rgba(255,255,255,0.08)" },
            }}
          >
            Home
          </Button>
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
      >
        <Box
          sx={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: { xs: "92vw", sm: isSignUp ? 460 : 440 },
            maxWidth: "92vw",
            maxHeight: "92vh",
            overflowY: "auto",
            borderRadius: "20px",
            overflow: "hidden",
            outline: "none",
            boxShadow: "0 32px 80px rgba(0,0,0,0.6)",
            border: "1px solid rgba(255,255,255,0.1)",
          }}
        >
          {isSignUp ? (
            /* ── Signup: keep existing SignUpForm, just dark-wrap it ── */
            <Box sx={{ bgcolor: "#0f172a" }}>
              <SignUpForm
                onSignUp={() => setModalOpen(false)}
                onClose={() => setModalOpen(false)}
                onLogin={(roles) => { onLogin?.(roles); setModalOpen(false); }}
              />
            </Box>
          ) : (
            /* ── Login dialog ── */
            <Box
              sx={{
                background: "linear-gradient(160deg, #0f172a 0%, #1e3a8a 100%)",
                position: "relative",
                overflow: "hidden",
              }}
            >
              {/* Subtle orb */}
              <Box sx={{
                position: "absolute", top: -60, right: -60,
                width: 200, height: 200, borderRadius: "50%",
                bgcolor: "rgba(59,130,246,0.18)", filter: "blur(50px)",
                pointerEvents: "none",
              }} />

              {/* Header strip */}
              <Box
                sx={{
                  px: 3.5, pt: 3.5, pb: 2.5,
                  borderBottom: "1px solid rgba(255,255,255,0.08)",
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                }}
              >
                {/* Logo + title */}
                <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                  <Box
                    sx={{
                      width: 36, height: 36, borderRadius: "10px",
                      background: "linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      boxShadow: "0 4px 12px rgba(59,130,246,0.45)",
                    }}
                  >
                    <Typography sx={{ color: "#fff", fontWeight: 800, fontSize: 17 }}>T</Typography>
                  </Box>
                  <Box>
                    <Typography sx={{ fontWeight: 800, fontSize: 16, color: "#fff", lineHeight: 1.1 }}>
                      Tradelink<span style={{ color: "#60a5fa" }}>247</span>
                    </Typography>
                    <Typography sx={{ fontSize: 11, color: "rgba(255,255,255,0.45)" }}>
                      Cloud ERP & POS
                    </Typography>
                  </Box>
                </Box>
                <IconButton
                  onClick={() => setModalOpen(false)}
                  size="small"
                  sx={{
                    color: "rgba(255,255,255,0.5)",
                    "&:hover": { color: "#fff", bgcolor: "rgba(255,255,255,0.1)" },
                  }}
                >
                  <CloseIcon fontSize="small" />
                </IconButton>
              </Box>

              {/* Form body */}
              <Box sx={{ px: 3.5, py: 3 }}>
                <Typography sx={{ fontWeight: 700, fontSize: 22, color: "#fff", mb: 0.5 }}>
                  Welcome back
                </Typography>
                <Typography sx={{ fontSize: 13.5, color: "rgba(255,255,255,0.5)", mb: 3 }}>
                  Sign in to continue to your dashboard
                </Typography>

                <form onSubmit={handleSubmit}>
                  <TextField
                    label={t("username")}
                    fullWidth
                    margin="normal"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    variant="outlined"
                    InputLabelProps={{ style: { color: "rgba(255,255,255,0.5)" } }}
                    sx={{
                      mb: 1.5,
                      "& .MuiOutlinedInput-root": {
                        color: "#fff",
                        borderRadius: "10px",
                        bgcolor: "rgba(255,255,255,0.07)",
                        "& fieldset": { borderColor: "rgba(255,255,255,0.15)" },
                        "&:hover fieldset": { borderColor: "rgba(255,255,255,0.35)" },
                        "&.Mui-focused fieldset": { borderColor: "#3b82f6" },
                      },
                    }}
                  />
                  <TextField
                    label={t("password")}
                    type="password"
                    fullWidth
                    margin="normal"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    variant="outlined"
                    InputLabelProps={{ style: { color: "rgba(255,255,255,0.5)" } }}
                    sx={{
                      mb: 2.5,
                      "& .MuiOutlinedInput-root": {
                        color: "#fff",
                        borderRadius: "10px",
                        bgcolor: "rgba(255,255,255,0.07)",
                        "& fieldset": { borderColor: "rgba(255,255,255,0.15)" },
                        "&:hover fieldset": { borderColor: "rgba(255,255,255,0.35)" },
                        "&.Mui-focused fieldset": { borderColor: "#3b82f6" },
                      },
                    }}
                  />
                  <Button
                    type="submit"
                    variant="contained"
                    fullWidth
                    size="large"
                    sx={{
                      background: "linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)",
                      color: "#fff", fontWeight: 700, fontSize: 15,
                      borderRadius: "10px", py: 1.4,
                      textTransform: "none",
                      boxShadow: "0 8px 20px rgba(59,130,246,0.45)",
                      "&:hover": { opacity: 0.92, boxShadow: "0 10px 26px rgba(59,130,246,0.55)" },
                    }}
                  >
                    {t("login")}
                  </Button>
                </form>

                {/* Language selector */}
                <Select
                  value={selectedLanguage}
                  onChange={handleLanguageChange}
                  fullWidth
                  displayEmpty
                  variant="outlined"
                  MenuProps={{
                    PaperProps: {
                      sx: {
                        bgcolor: "#1e293b", color: "#fff",
                        border: "1px solid rgba(255,255,255,0.1)",
                        "& .MuiMenuItem-root": {
                          color: "#cbd5e1",
                          "&:hover": { bgcolor: "rgba(59,130,246,0.15)" },
                          "&.Mui-selected": { bgcolor: "rgba(59,130,246,0.2)", color: "#fff" },
                        },
                      },
                    },
                  }}
                  sx={{
                    mt: 2, color: "rgba(255,255,255,0.6)",
                    borderRadius: "10px",
                    bgcolor: "rgba(255,255,255,0.06)",
                    ".MuiSelect-icon": { color: "rgba(255,255,255,0.4)" },
                    ".MuiOutlinedInput-notchedOutline": { borderColor: "rgba(255,255,255,0.15)" },
                    "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: "rgba(255,255,255,0.35)" },
                    "&.Mui-focused .MuiOutlinedInput-notchedOutline": { borderColor: "#3b82f6" },
                  }}
                >
                  <MenuItem disabled value=""><em style={{ color: "rgba(255,255,255,0.35)" }}>{t("selectLanguage") || "Select Language"}</em></MenuItem>
                  <MenuItem value="en">English</MenuItem>
                  <MenuItem value="ar">العربية</MenuItem>
                  <MenuItem value="fr">Français</MenuItem>
                  <MenuItem value="ml">മലയാളം</MenuItem>
                  <MenuItem value="hi">हिन्दी</MenuItem>
                  <MenuItem value="ta">தமிழ்</MenuItem>
                  <MenuItem value="kn">ಕನ್ನಡ</MenuItem>
                  <MenuItem value="te">తెలుగు</MenuItem>
                </Select>

                {/* Switch to sign up */}
                <Typography sx={{ mt: 3, textAlign: "center", fontSize: 13.5, color: "rgba(255,255,255,0.45)" }}>
                  Don't have an account?{" "}
                  <Box
                    component="span"
                    onClick={() => setIsSignUp(true)}
                    sx={{ color: "#60a5fa", fontWeight: 600, cursor: "pointer", "&:hover": { color: "#93c5fd" } }}
                  >
                    Sign up free
                  </Box>
                </Typography>
              </Box>
            </Box>
          )}
        </Box>
      </Modal>
    </Box>
  );
};

export default LoginForm;
