import React, { useState, useEffect } from "react";
import {
  Box,
  Button,
  TextField,
  Typography,
  Paper,
  Grid,
  MenuItem,
  Select,
  Modal,
  IconButton,
  AppBar,
  Toolbar,
} from "@mui/material";
import { useTranslation } from "react-i18next";
import SignUpForm from "./SignUpForm";
import logo from "../assets/maple-logo.png";
import CloseIcon from "@mui/icons-material/Close";

const LoginForm = ({ onLogin }) => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false); // To handle modal
  const { t, i18n } = useTranslation(); // Hook for translation
  const [selectedLanguage, setSelectedLanguage] = useState("en"); // Default language

  // Load language from localStorage when the component mounts
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
        setLoginOpen(false); // Close the modal upon successful login
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

  return (
    <Box>
      {/* Top navigation bar with login link */}
      <AppBar position="static" color="default">
        <Toolbar>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            MapleERP
          </Typography>
          <Button color="primary" onClick={() => setLoginOpen(true)}>
            {t("login")}
          </Button>
        </Toolbar>
      </AppBar>

      {/* Scrolling content section with images and text */}
      <Box
        sx={{
          height: "80vh",
          overflowY: "scroll",
          padding: 4,
        }}
      >
        <Grid container spacing={4}>
          <Grid item xs={12} md={6}>
            <Box sx={{ textAlign: "center" }}>
              <Typography variant="h3" gutterBottom>
                {t("welcome")}
              </Typography>
              <Typography variant="h6" paragraph>
                {t("description")}
              </Typography>
              <img
                src={logo}
                alt="MapleERP Logo"
                style={{
                  maxWidth: "100%",
                  height: "auto",
                  marginBottom: "20px",
                }}
              />
              <Typography variant="body1" color="textSecondary">
                {t("experience")}
              </Typography>
            </Box>
          </Grid>
          <Grid item xs={12} md={6}>
            <Box sx={{ textAlign: "left" }}>
              <Typography variant="h5" gutterBottom>
                About MapleERP
              </Typography>
              <Typography variant="body1">
                MapleERP offers robust solutions for supermarkets and bakeries,
                enabling efficient inventory management, sales tracking, and
                customer engagement. Our AI-powered stocktaking and real-time
                shelf management ensure seamless operations for your business.
              </Typography>
              <Typography variant="body1" sx={{ mt: 2 }}>
                Explore our solutions and learn how MapleERP can transform your
                business, driving growth and enhancing customer satisfaction.
              </Typography>
            </Box>
          </Grid>
        </Grid>
      </Box>

      {/* Modal for login */}
      <Modal
        open={loginOpen}
        onClose={() => setLoginOpen(false)}
        aria-labelledby="login-modal-title"
        aria-describedby="login-modal-description"
      >
        <Paper
          elevation={3}
          sx={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            padding: 4,
            maxWidth: 400,
            backgroundColor: "#f0f0f0",
          }}
        >
          <Box sx={{ display: "flex", justifyContent: "space-between" }}>
            <Typography variant="h4" id="login-modal-title">
              {t("login")}
            </Typography>
            <IconButton onClick={() => setLoginOpen(false)}>
              <CloseIcon />
            </IconButton>
          </Box>
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
            <Button
              type="submit"
              variant="contained"
              color="primary"
              fullWidth
            >
              {t("login")}
            </Button>
          </form>

          {/* Language Selector */}
          <Select
            value={selectedLanguage} // Current language state
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
        </Paper>
      </Modal>
    </Box>
  );
};

export default LoginForm;
