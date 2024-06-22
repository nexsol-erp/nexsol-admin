import React, { useState } from "react";
import { Box, Button, TextField, Typography, Paper } from "@mui/material";

const BranchCreationPage = () => {
  const [branchCode, setBranchCode] = useState("");
  const [branchName, setBranchName] = useState("");
  const [branchAddress, setBranchAddress] = useState("");
  const [branchPhone, setBranchPhone] = useState("");
  const [branchPlace, setBranchPlace] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    const formData = {
      branchCode,
      branchName,
      branchAddress,
      branchPhone,
      branchPlace,
    };

    try {
      const response = await fetch("/api/createbranch", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();
      if (data.success) {
        alert("User created successfully!");
        // Optionally redirect or perform other actions after successful user creation
      } else {
        alert(data.message);
      }
    } catch (error) {
      console.error("Error:", error);
      alert("An error occurred. Please try again later.");
    }
  };

  return (
    <Box
      sx={{
        flexGrow: 1,
        p: 3,
        ml: "240px",
        mt: 2,
      }}
    >
      <Paper elevation={3} sx={{ padding: 4, maxWidth: 400 }}>
        <Typography variant="h4" gutterBottom>
          Branch Creation
        </Typography>
        <form onSubmit={handleSubmit}>
          <TextField
            label="Branch Code"
            fullWidth
            margin="normal"
            value={branchCode}
            onChange={(e) => setBranchCode(e.target.value)}
            required
            pattern="[A-Za-z0-9]+"
          />
          <TextField
            label="Branch Name"
            fullWidth
            margin="normal"
            value={branchName}
            onChange={(e) => setBranchName(e.target.value)}
            required
          />
          <TextField
            label="Branch Address"
            fullWidth
            margin="normal"
            value={branchAddress}
            onChange={(e) => setBranchAddress(e.target.value)}
            required
          />
          <TextField
            label="Branch Phone"
            type="tel"
            fullWidth
            margin="normal"
            value={branchPhone}
            onChange={(e) => setBranchPhone(e.target.value)}
            required
          />
          <TextField
            label="Branch Place"
            type="email"
            fullWidth
            margin="normal"
            value={branchPlace}
            onChange={(e) => setBranchPlace(e.target.value)}
            required
          />
          <Box mt={2}>
            <Button type="submit" variant="contained" color="primary" fullWidth>
              Create Branch
            </Button>
          </Box>
        </form>
      </Paper>
    </Box>
  );
};

export default BranchCreationPage;
