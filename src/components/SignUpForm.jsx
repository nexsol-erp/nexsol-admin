import React, { useState } from "react";
import { Box, Button, TextField, Typography, Paper } from "@mui/material";

const SignUpForm = ({ onSignUp }) => {
  const [companyName, setCompanyName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [mobileNumber, setMobileNumber] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState({
    general: "",
    companyName: "",
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  const handleSubmit = async (e) => {
    e.preventDefault();

    let formHasErrors = false;
    const mobileNumberRegex = /^[0-9]+$/;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const passwordRegex = /^\S{3,}$/;
    const usernameRegex = /^\S+$/;

    setError({
      general: "",
      companyName: "",
      username: "",
      email: "",
      password: "",
      confirmPassword: "",
    });

    if (!companyName) {
      setError((prev) => ({
        ...prev,
        companyName: "Company Name cannot be blank.",
      }));
      formHasErrors = true;
    }

    if (!username) {
      setError((prev) => ({
        ...prev,
        username: "Username cannot be blank.",
      }));
      formHasErrors = true;
    } else if (!usernameRegex.test(username)) {
      setError((prev) => ({
        ...prev,
        username: "Username cannot contain spaces.",
      }));
      formHasErrors = true;
    }

    if (!mobileNumberRegex.test(mobileNumber)) {
      setError((prev) => ({
        ...prev,
        general:
          "Mobile Number must contain only digits without spaces or special characters.",
      }));
      formHasErrors = true;
    }

    if (!email) {
      setError((prev) => ({
        ...prev,
        email: "Email cannot be blank.",
      }));
      formHasErrors = true;
    } else if (!emailRegex.test(email)) {
      setError((prev) => ({
        ...prev,
        email: "Please enter a valid email address.",
      }));
      formHasErrors = true;
    }

    if (!passwordRegex.test(password)) {
      setError((prev) => ({
        ...prev,
        password:
          "Password must be at least 3 characters long and contain no spaces.",
      }));
      formHasErrors = true;
    }

    if (password !== confirmPassword) {
      setError((prev) => ({
        ...prev,
        confirmPassword: "Passwords do not match!",
      }));
      formHasErrors = true;
    }

    if (formHasErrors) return;

    const formData = {
      companyName,
      username,
      email,
      mobileNumber,
      password,
      country: "India",
      timezone: "Asia/Kolkata",
    };

    try {
      const response = await fetch("/api/signup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();
      if (data.success) {
        alert("Signup successful!");
        onSignUp();
      } else {
        setError((prev) => ({
          ...prev,
          general: data.message,
        }));
      }
    } catch (error) {
      console.error("Error:", error);
      setError((prev) => ({
        ...prev,
        general: "An error occurred. Please try again later.",
      }));
    }
  };

  const inputStyles = {
    InputLabelProps: { style: { color: "#000" } },
    InputProps: { style: { color: "#000" } },
  };

  return (
    <Paper
      elevation={3}
      sx={{
        padding: 4,
        margin: "auto",
        marginTop: 8,
        backgroundColor: "#f0f0f0",
        width: { xs: "90%", sm: "400px" },
        color: "#000",
      }}
    >
      <Typography variant="h4" gutterBottom sx={{ color: "#000" }}>
        Sign Up
      </Typography>

      {error.general && (
        <Typography color="error" variant="body1" gutterBottom>
          {error.general}
        </Typography>
      )}

      <form onSubmit={handleSubmit}>
        <TextField
          label="Company Name"
          fullWidth
          margin="normal"
          value={companyName}
          onChange={(e) => setCompanyName(e.target.value)}
          {...inputStyles}
        />
        {error.companyName && (
          <Typography color="error" variant="body2">
            {error.companyName}
          </Typography>
        )}

        <TextField
          label="Username"
          fullWidth
          margin="normal"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          {...inputStyles}
        />
        {error.username && (
          <Typography color="error" variant="body2">
            {error.username}
          </Typography>
        )}

        <TextField
          label="Email"
          type="email"
          fullWidth
          margin="normal"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          {...inputStyles}
        />
        {error.email && (
          <Typography color="error" variant="body2">
            {error.email}
          </Typography>
        )}

        <TextField
          label="Mobile Number"
          type="tel"
          fullWidth
          margin="normal"
          value={mobileNumber}
          onChange={(e) => setMobileNumber(e.target.value)}
          required
          {...inputStyles}
        />

        <TextField
          label="Password"
          type="password"
          fullWidth
          margin="normal"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          {...inputStyles}
        />
        {error.password && (
          <Typography color="error" variant="body2">
            {error.password}
          </Typography>
        )}

        <TextField
          label="Confirm Password"
          type="password"
          fullWidth
          margin="normal"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          {...inputStyles}
        />
        {error.confirmPassword && (
          <Typography color="error" variant="body2">
            {error.confirmPassword}
          </Typography>
        )}

        <Box mt={2}>
          <Button type="submit" variant="contained" color="primary" fullWidth>
            Sign Up
          </Button>
        </Box>
      </form>
    </Paper>
  );
};

export default SignUpForm;
