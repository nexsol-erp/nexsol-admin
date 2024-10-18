import React, { useState, useEffect } from "react";
import {
  Box,
  Button,
  Typography,
  Paper,
  Grid,
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
import Slider from "react-slick"; // Importing react-slick for the carousel

const LoginForm = ({ onLogin }) => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false); // To track if the user clicked sign up
  const [modalOpen, setModalOpen] = useState(false); // To handle modal visibility
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

  // Slider settings for react-slick
  const settings = {
    dots: true,
    infinite: true,
    speed: 500,
    slidesToShow: 1,
    slidesToScroll: 1,
    autoplay: true,
    autoplaySpeed: 3000,
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

      {/* Full-page scrolling background images */}
      <Slider {...settings}>
        <div>
          <img src="../assets/image_1.jpg" alt="Image 1" />
        </div>
        <div>
          <img src="../assets/image_2.jpg" alt="Image 2" />
        </div>
        <div>
          <img src="../assets/image_3.jpg" alt="Image 3" />
        </div>
        <div>
          <img src="../assets/image_4.jpg" alt="Image 4" />
        </div>
      </Slider>

      {/* Modal for login and signup */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        aria-labelledby="auth-modal-title"
        aria-describedby="auth-modal-description"
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
            <Typography variant="h4" id="auth-modal-title">
              {isSignUp ? t("signup") : t("login")}
            </Typography>
            <IconButton onClick={() => setModalOpen(false)}>
              <CloseIcon />
            </IconButton>
          </Box>

          {/* Render Sign Up or Login form based on isSignUp state */}
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
              <Button
                type="submit"
                variant="contained"
                color="primary"
                fullWidth
              >
                {t("login")}
              </Button>
            </form>
          )}

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
