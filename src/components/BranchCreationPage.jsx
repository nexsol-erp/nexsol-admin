import React, { useState } from "react";
import {
  Box,
  Button,
  TextField,
  Typography,
  Paper,
  CircularProgress,
  Grid,
} from "@mui/material";

const BranchCreationPage = () => {
  const [branchCode, setBranchCode] = useState("");
  const [branchName, setBranchName] = useState("");
  const [branchState, setBranchState] = useState("");
  const [branchBuildingAddress, setBranchBuildingAddress] = useState("");
  const [branchStreetAddress, setBranchStreetAddress] = useState("");
  const [branchAddress1, setBranchAddress1] = useState("");
  const [branchAddress2, setBranchAddress2] = useState("");
  const [branchGst, setBranchGst] = useState("");
  const [branchInvoicePrefix, setBranchInvoicePrefix] = useState("");

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validate branch code to contain only letters and numbers
    const branchCodeRegex = /^[A-Za-z0-9]+$/;
    if (!branchCodeRegex.test(branchCode)) {
      setError(
        "Branch Code must contain only letters and numbers without spaces or special characters."
      );
      return;
    }

    const formData = {
      branchCode,
      branchName,
      branchState,
      branchBuildingAddress,
      branchStreetAddress,
      branchAddress1,
      branchAddress2,
      branchGst,
      branchInvoicePrefix, // include the new field
    };

    setLoading(true);
    setError("");

    try {
      const tenancyId = localStorage.getItem("tenancyId");
      const token = localStorage.getItem("jwtToken");
      const response = await fetch(`/api/${tenancyId}/createbranch`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();
      setLoading(false);
      if (data.success) {
        alert("Branch created successfully!");
        setBranchCode("");
        setBranchName("");
        setBranchState("");
        setBranchBuildingAddress("");
        setBranchStreetAddress("");
        setBranchAddress1("");
        setBranchAddress2("");
        setBranchGst("");
        setBranchInvoicePrefix(""); // reset the new field
      } else {
        setError(data.message);
      }
    } catch (error) {
      console.error("Error:", error);
      setLoading(false);
      setError("An error occurred. Please try again later.");
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
      <Paper elevation={3} sx={{ padding: 4, maxWidth: 800 }}>
        <Typography variant="h4" gutterBottom>
          Branch Creation
        </Typography>
        {error && (
          <Typography color="error" variant="body1" gutterBottom>
            {error}
          </Typography>
        )}
        <form onSubmit={handleSubmit}>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Branch Code"
                fullWidth
                margin="normal"
                value={branchCode}
                onChange={(e) => setBranchCode(e.target.value)}
                required
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Branch Name"
                fullWidth
                margin="normal"
                value={branchName}
                onChange={(e) => setBranchName(e.target.value)}
                required
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Branch State"
                fullWidth
                margin="normal"
                value={branchState}
                onChange={(e) => setBranchState(e.target.value)}
                required
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Branch Building"
                fullWidth
                margin="normal"
                value={branchBuildingAddress}
                onChange={(e) => setBranchBuildingAddress(e.target.value)}
                required
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Branch Street"
                fullWidth
                margin="normal"
                value={branchStreetAddress}
                onChange={(e) => setBranchStreetAddress(e.target.value)}
                required
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Branch Address1"
                fullWidth
                margin="normal"
                value={branchAddress1}
                onChange={(e) => setBranchAddress1(e.target.value)}
                required
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Branch Address2"
                fullWidth
                margin="normal"
                value={branchAddress2}
                onChange={(e) => setBranchAddress2(e.target.value)}
                required
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Branch GST"
                fullWidth
                margin="normal"
                value={branchGst}
                onChange={(e) => setBranchGst(e.target.value)}
                required
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Branch Invoice Prefix"
                fullWidth
                margin="normal"
                value={branchInvoicePrefix}
                onChange={(e) => setBranchInvoicePrefix(e.target.value)}
                required
              />
            </Grid>
          </Grid>
          <Box mt={2}>
            <Button
              type="submit"
              variant="contained"
              color="primary"
              fullWidth
              disabled={loading}
            >
              {loading ? <CircularProgress size={24} /> : "Create Branch"}
            </Button>
          </Box>
        </form>
      </Paper>
    </Box>
  );
};

export default BranchCreationPage;
