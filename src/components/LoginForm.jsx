import React, { useState } from "react";
import { Box, Button, TextField, Typography, Paper } from "@mui/material";
import SignUpForm from "./SignUpForm";

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
        localStorage.setItem("tenancyId", data.tenancyId);
        localStorage.setItem("roles", JSON.stringify(data.roles)); // Store roles in localStorage
        onLogin(data.roles); // Pass roles to onLogin handler
      } else {
        alert(data.message);
      }
    } catch (error) {
      console.error("Error:", error);
      alert("An error occurred. Please try again later.");
    }
  };

  return (
    <>
      {isSignUp ? (
        <SignUpForm onSignUp={() => setIsSignUp(false)} />
      ) : (
        <Paper
          elevation={3}
          sx={{
            padding: 4,
            maxWidth: 400,
            margin: "auto",
            marginTop: 8,
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
            <Button type="submit" variant="contained" color="primary" fullWidth>
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
    </>
  );
};

export default LoginForm;
