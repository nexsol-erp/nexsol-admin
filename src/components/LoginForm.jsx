import React, { useState, useEffect } from "react";
import {
  Box,
  Button,
  Typography,
  Paper,
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
import image1 from "../assets/image-1.jpg";
import image2 from "../assets/image-2.jpg";
import image3 from "../assets/image-3.jpg";
import image4 from "../assets/image-4.jpg";

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

const LoginForm = ({ onLogin }) => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

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

  const images = [image1, image2, image3, image4];

  const styles = {
    container: {
      height: "100vh",
      width: "100vw",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      position: "relative",
    },
    image: {
      objectFit: "cover",
      height: "100%",
      width: "100%",
      position: "absolute",
      top: 0,
      left: 0,
      zIndex: -1,
      opacity: 0.6,
    },
    textOverlay: {
      padding: "20px",
      textAlign: "center",
      maxWidth: "700px",
      backgroundColor: "rgba(0, 0, 0, 0.6)",
      color: "#fff",
      borderRadius: "10px",
      mx: 2,
    },
  };

  return (
    <Box>
      {/* Top navigation bar with login and signup links */}
      <AppBar position="static" color="default">
        <Toolbar>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            TradeLink247
          </Typography>
          <Button
            color="primary"
            onClick={() => {
              setIsSignUp(false);
              setModalOpen(true);
            }}
          >
            {t("login")}
          </Button>
          <Button
            color="secondary"
            onClick={() => {
              setIsSignUp(true);
              setModalOpen(true);
            }}
          >
            {t("signup")}
          </Button>
        </Toolbar>
      </AppBar>

      {/* Full-page background image */}
      <Box sx={styles.container}>
        <img src={images[0]} alt="Background" style={styles.image} />

        {/* Text Overlay with ERP description */}
        <Paper elevation={3} sx={styles.textOverlay}>
          <Typography variant="h4" gutterBottom>
            Streamline Your Retail Operations with Our Advanced ERP System
          </Typography>
          <Typography variant="body1" gutterBottom>
            Our cutting-edge ERP solution is designed specifically for
            supermarkets and bakeries, offering an all-in-one platform to manage
            every aspect of your business with efficiency and ease.
          </Typography>
          <Typography variant="body2">
            <strong>Key Features:</strong> AI-Powered Stock Management, POS
            Integration, Smart Reporting, Centralized Stock Management,
            Automated Invoicing, Seamless E-commerce Integration, and Workflow
            Automation.
          </Typography>
        </Paper>
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
