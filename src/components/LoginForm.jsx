import React, { useState } from "react";
import { Box, Button, TextField, Typography, Paper, Grid } from "@mui/material";
import SignUpForm from "./SignUpForm";
import logo from "../assets/maple-logo.png";
const LoginForm = ({ onLogin }) => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);

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

  return (
    <Box sx={{ flexGrow: 1, p: 3, mt: 4 }}>
      <Grid container spacing={4} alignItems="center">
        <Grid item xs={12} md={6}>
          <Box sx={{ textAlign: "center" }}>
            <Typography variant="h3" gutterBottom>
              Welcome to MapleERP
            </Typography>
            <Typography variant="h6" paragraph>
              MapleERP is a comprehensive POS system integrated with accounting
              and inventory management. Ideal for retail outlets with multiple
              branches, our system provides seamless monitoring and fast POS
              billing. Explore the system and see how it can transform your
              business.
            </Typography>
            <img
              src={logo}
              alt="MapleERP Logo"
              style={{ maxWidth: "100%", height: "auto", marginBottom: "20px" }}
            />
            <Typography variant="body1" color="textSecondary">
              Experience the future of retail with MapleERP.
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
                Login
              </Typography>
              <form onSubmit={handleSubmit}>
                <TextField
                  label="Username"
                  fullWidth
                  margin="normal"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
                <TextField
                  label="Password"
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
                  Login
                </Button>
              </form>
              <Button
                variant="outlined"
                color="secondary"
                fullWidth
                sx={{ marginTop: 2 }}
                onClick={() => setIsSignUp(true)}
              >
                Sign Up
              </Button>
            </Paper>
          )}
        </Grid>
      </Grid>
    </Box>
  );
};

export default LoginForm;
