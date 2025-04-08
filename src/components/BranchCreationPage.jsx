import React, { useState } from "react";
import {
  Box,
  Button,
  TextField,
  Typography,
  Paper,
  CircularProgress,
  Grid,
  StepIcon,
} from "@mui/material";
import { Select, MenuItem, InputLabel, FormControl } from "@mui/material";

import CloudDownloadIcon from "@mui/icons-material/CloudDownload";
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
  const [isControlBranch, setIsControlBranch] = useState("");
  
  const [branchType, setBranchType] = useState("");
  const [clientDbType, setClientDbType] = useState("");


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
      isControlBranch,
      branchType,
      clientDbType,
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
        //setBranchCode("");
        setBranchName("");
        setBranchState("");
        setBranchBuildingAddress("");
        setBranchStreetAddress("");
        setBranchAddress1("");
        setBranchAddress2("");
        setBranchGst("");
        setBranchInvoicePrefix(""); // reset the new field
        setIsControlBranch("");
        setBranchType("");
        setClientDbType("");


      } else {
        setError(data.message);
      }
    } catch (error) {
      console.error("Error:", error);
      setLoading(false);
      setError("An error occurred. Please try again later.");
    }
  };

  const handleDownload = async () => {
    const tenancyId = localStorage.getItem("tenancyId");
    const token = localStorage.getItem("jwtToken");
    const fileName = "nexsol-pos.zip";
    const url = `/api/${tenancyId}/download/${branchCode}/${fileName}`;

    try {
      const response = await fetch(url, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/octet-stream",
        },
      });

      if (!response.ok) {
        throw new Error("Failed to download file");
      }

      const blob = await response.blob();
      const link = document.createElement("a");
      link.href = window.URL.createObjectURL(blob);
      link.setAttribute("download", fileName);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error("Error downloading file:", error);
    }
  };

   
  const handlePublisBranch = async () => {
    const tenancyId = localStorage.getItem("tenancyId");
    const token = localStorage.getItem("jwtToken");
    const fileName = "nexsol-pos.zip";
    const url = `/api/${tenancyId}/publish-branch`;

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/octet-stream",
        },
      });

      if (!response.ok) {
        throw new Error("Failed to publish branch ");
      }

    } catch (error) {
      console.error("Error downloading file:", error);
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
            <Grid item xs={12} sm={6}>
  <FormControl fullWidth margin="normal" required>
    <InputLabel id="is-control-branch-label">Is Control Branch</InputLabel>
    <Select
      labelId="is-control-branch-label"
      value={isControlBranch}
      label="Is Control Branch"
      onChange={(e) => setIsControlBranch(e.target.value)}
    >
      <MenuItem value="Y">Y</MenuItem>
      <MenuItem value="N">N</MenuItem>
    </Select>
  </FormControl>
</Grid>
<Grid item xs={12} sm={6}>
  <FormControl fullWidth margin="normal" required>
    <InputLabel id="branch-type-label">Branch Type</InputLabel>
    <Select
      labelId="branch-type-label"
      value={branchType}
      label="Branch Type"
      onChange={(e) => setBranchType(e.target.value)}
    >
      <MenuItem value="BAKERY_OUTLET">Bakery Outlet</MenuItem>
      <MenuItem value="BAKERY_BO">Bakery Back Office</MenuItem>
      <MenuItem value="BAKERY_CGN">Bakery Central Godown</MenuItem>
      <MenuItem value="BAKERY_PROD">Bakery Production</MenuItem>
      <MenuItem value="WB">Weigh Bridge</MenuItem>
    </Select>
  </FormControl>
</Grid>

<Grid item xs={12} sm={6}>
  <FormControl fullWidth margin="normal" required>
    <InputLabel id="client-db-type-label">Client DB Type</InputLabel>
    <Select
      labelId="client-db-type-label"
      value={clientDbType}
      label="Client DB Type"
      onChange={(e) => setClientDbType(e.target.value)}
    >
      <MenuItem value="MULTI_USER">Multi User</MenuItem>
      <MenuItem value="SINGLE_USER">Single User</MenuItem>
    </Select>
  </FormControl>
</Grid>


          </Grid>
          <Box mt={2}>
            <Button
              type="submit"
              variant="contained"
              color="primary"
              fullWidth
              disabled={loading} 
              sx={{ mb: 2 }} // Add bottom margin
            >
              {loading ? <CircularProgress size={24} /> : "Create Branch"}
            </Button>
            <Button 
            variant="contained"
            color="primary"
            fullWidth
            startIcon={<CloudDownloadIcon />}
            onClick={handleDownload}
            disabled={!branchCode}
            sx={{ mb: 2 }} // Add bottom margin
          >
            Download Client Application
          </Button>
         
          
            <Button 
            variant="contained"
            color="primary"
            fullWidth
            startIcon={<StepIcon />}
            onClick={handlePublisBranch}
             
            sx={{ mb: 2 }} // Add bottom margin
          >
            Publish Branch
          </Button>
          </Box>
        </form>
      </Paper>
    </Box>
  );
};

export default BranchCreationPage;
