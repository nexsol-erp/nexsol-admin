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
  Grid,
} from "@mui/material";
import { useTranslation } from "react-i18next";
import CloseIcon from "@mui/icons-material/Close";
import SignUpForm from "./SignUpForm";
import image1 from "../assets/image-1.jpg";
import image2 from "../assets/image-2.jpg";
import image3 from "../assets/image-3.jpg";
import image4 from "../assets/image-4.jpg";

const LoginForm = ({ onLogin }) => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false); // To track if the user clicked sign up
  const [modalOpen, setModalOpen] = useState(false); // To handle modal visibility
  const { t, i18n } = useTranslation(); // Hook for translation
  const [selectedLanguage, setSelectedLanguage] = useState("en"); // Default language

  useEffect(() => {
    const savedLanguage = localStorage.getItem("language");
    if (savedLanguage) {
      i18n.changeLanguage(savedLanguage); // Set the language in i18next
      setSelectedLanguage(savedLanguage); // Update state
    }
  }, [i18n]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch("/api/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();
      if (data.success) {
        localStorage.setItem("jwtToken", data.token);
        localStorage.setItem("tenancyId", data.tenancyId);
        localStorage.setItem("roles", JSON.stringify(data.roles));
        onLogin(data.roles);
        setModalOpen(false); // Close the modal upon successful login
      } else {
        alert(data.message);
      }
    } catch (error) {
      console.error("Error:", error);
      alert("An error occurred. Please try again later.");
    }
  };

  const handleLanguageChange = (event) => {
    const newLanguage = event.target.value;
    i18n.changeLanguage(newLanguage); // Change the language in i18next
    setSelectedLanguage(newLanguage); // Update the state
    localStorage.setItem("language", newLanguage); // Save the selected language in localStorage
  };

  const images = [image1, image2, image3, image4];

  // Mobile-friendly CSS for background and layout
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
    },
    paper: {
      maxWidth: "400px",
      padding: "20px",
      backgroundColor: "#f0f0f0",
    },
    buttonGroup: {
      display: "flex",
      justifyContent: "center",
      gap: "10px",
      marginTop: "20px",
    },
  };

  return (
    <Box>
      {/* Top navigation bar with login and signup links */}
      <AppBar position="static" color="default">
        <Toolbar>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            MapleERP
          </Typography>
          <Button color="primary" onClick={() => { setIsSignUp(false); setModalOpen(true); }}>
            {t("login")}
          </Button>
          <Button color="secondary" onClick={() => { setIsSignUp(true); setModalOpen(true); }}>
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
            Our cutting-edge ERP solution is designed specifically for supermarkets and bakeries, offering an all-in-one platform to manage every aspect of your business with efficiency and ease.
          </Typography>
          <Typography variant="body2">
            <strong>Key Features:</strong> AI-Powered Stock Management, POS Integration, Smart Reporting, Centralized Stock Management, Automated Invoicing, Seamless E-commerce Integration, and Workflow Automation.
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
            padding: "20px",
            borderRadius: "8px",
          }}
        >
          <Box sx={{ display: "flex", justifyContent: "space-between" }}>
            <Typography variant="h4">
              {isSignUp ? t("signup") : t("login")}
            </Typography>
            <IconButton onClick={() => setModalOpen(false)}>
              <CloseIcon />
            </IconButton>
          </Box>

          {isSignUp ? (
            <SignUpForm onSignUp={() => setModalOpen(false)} />
          ) : (
            <form onSubmit={handleSubmit}>
              <TextField
                label={t("username")}
                fullWidth
                margin="normal"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
              <TextField
                label={t("password")}
                type="password"
                fullWidth
                margin="normal"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <Button type="submit" variant="contained" color="primary" fullWidth>
                {t("login")}
              </Button>
            </form>
          )}

          {/* Language Selector */}
          <Select
            value={selectedLanguage}
            onChange={handleLanguageChange}
            fullWidth
            sx={{ marginTop: 2 }}
          >
            <MenuItem value="en">English</MenuItem>
            <MenuItem value="ar">العربية</MenuItem>
            <MenuItem value="fr">Français</MenuItem>
            <MenuItem value="ml">മലയാളം</MenuItem>
            <MenuItem value="hi">हिन्दी</MenuItem>
            <MenuItem value="ta">தமிழ்</MenuItem>
            <MenuItem value="kn">ಕನ್ನಡ</MenuItem>
            <MenuItem value="te">తెలుగు</MenuItem>
          </Select>
        </Box>
      </Modal>
    </Box>
  );
};

export default LoginForm;
