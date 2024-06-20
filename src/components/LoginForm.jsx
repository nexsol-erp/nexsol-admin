import React, { useState } from "react";
import { Box, Button, TextField, Typography, Paper } from "@mui/material";

const LoginForm = ({ onLogin }) => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
     const response = await fetch("http://tradelink247.com:80/api/login", {
       method: "POST",
       headers: {
         "Content-Type": "application/json",
       },
       body: JSON.stringify({ username, password }),
     });

      const data = await response.json();
      if (data.success) {
        // Store tenancy ID in local storage
        localStorage.setItem("tenancyId", data.tenancyId);
        onLogin();
      } else {
        alert(data.message);
      }
    } catch (error) {
      console.error("Error:", error);
      alert("An error occurred. Please try again later.");
    }
  };

  return (
    <Paper
      elevation={3}
      sx={{ padding: 4, maxWidth: 400, margin: "auto", marginTop: 8 }}
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
    </Paper>
  );
};

export default LoginForm;
