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
} from "@mui/material";
import { useTranslation } from "react-i18next";
import SignUpForm from "./SignUpForm";
import logo from "../assets/maple-logo.png";

const LoginForm = ({ onLogin }) => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
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
    <Box sx={{ flexGrow: 1, p: 3, mt: 4 }}>
      <Grid container spacing={4} alignItems="center">
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
              style={{ maxWidth: "100%", height: "auto", marginBottom: "20px" }}
            />
            <Typography variant="body1" color="textSecondary">
              {t("experience")}
            </Typography>
          </Box>
        </Grid>
        <Grid item xs={12} md={6}>
          {isSignUp ? (
            <SignUpForm onSignUp={() => setIsSignUp(false)} />
          ) : (
            <Paper
              elevation={3}
              sx={{
                padding: 4,
                maxWidth: 400,
                margin: "auto",
                backgroundColor: "#f0f0f0",
              }}
            >
              <Typography variant="h4" gutterBottom>
                {t("login")}
              </Typography>
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
              <Button
                variant="outlined"
                color="secondary"
                fullWidth
                sx={{ marginTop: 2 }}
                onClick={() => setIsSignUp(true)}
              >
                {t("signup")}
              </Button>

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

                {/* Add more languages here */}
              </Select>
            </Paper>
          )}
        </Grid>
      </Grid>
    </Box>
  );
};

export default LoginForm;
