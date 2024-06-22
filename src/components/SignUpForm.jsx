import React, { useState, useEffect } from "react";
import { Box, Button, TextField, Typography, Paper, Grid } from "@mui/material";
import Select from "react-select";

const SignUpForm = ({ onSignUp }) => {
  const [companyName, setCompanyName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [mobileNumber, setMobileNumber] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [countries, setCountries] = useState([]);
  const [selectedCountry, setSelectedCountry] = useState(null);

  useEffect(() => {
    fetchCountries();
  }, []);

  const fetchCountries = async () => {
    try {
      const response = await fetch("https://restcountries.com/v3.1/all");
      if (!response.ok) {
        throw new Error("Failed to fetch countries");
      }
      const data = await response.json();
      const formattedCountries = data.map((country) => ({
        label: country.name.common,
        value: country.cca2,
      }));
      setCountries(formattedCountries);
    } catch (error) {
      console.error("Error fetching countries:", error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      alert("Passwords do not match!");
      return;
    }

    const formData = {
      companyName,
      username,
      email,
      mobileNumber,
      password,
      country: selectedCountry ? selectedCountry.label : null,
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
        onSignUp(); // Notify parent component (LoginForm) about successful signup
      } else {
        alert(data.message);
      }
    } catch (error) {
      console.error("Error:", error);
      alert("An error occurred. Please try again later.");
    }
  };

  const handleCountryChange = (selectedOption) => {
    setSelectedCountry(selectedOption);
  };

  return (
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
        Sign Up
      </Typography>
      <form onSubmit={handleSubmit}>
        <TextField
          label="Company Name"
          fullWidth
          margin="normal"
          value={companyName}
          onChange={(e) => setCompanyName(e.target.value)}
        />
        <TextField
          label="Username"
          fullWidth
          margin="normal"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
        <TextField
          label="Email"
          type="email"
          fullWidth
          margin="normal"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <TextField
          label="Mobile Number"
          type="tel"
          fullWidth
          margin="normal"
          value={mobileNumber}
          onChange={(e) => setMobileNumber(e.target.value)}
        />
        <Select
          options={countries}
          value={selectedCountry}
          onChange={handleCountryChange}
          placeholder="Select Country"
          isClearable
          styles={{ menu: (provided) => ({ ...provided, zIndex: 9999 }) }}
        />
        <TextField
          label="Password"
          type="password"
          fullWidth
          margin="normal"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <TextField
          label="Confirm Password"
          type="password"
          fullWidth
          margin="normal"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
        />
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
