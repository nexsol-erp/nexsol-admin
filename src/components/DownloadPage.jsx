import React, { useEffect, useState } from "react";
import {
  Box,
  Button,
  Typography,
  Paper,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from "@mui/material";
import CloudDownloadIcon from "@mui/icons-material/CloudDownload";

const DownloadPage = () => {
   const [branch, setBranch] = useState("");
   
  //const [selectedBranchCode, setSelectedBranchCode] = useState("");
  const [branches, setBranches] = useState([]);


  const fetchBranches = async () => {
    try {
      const tenancyId = localStorage.getItem("tenancyId");
      const response = await fetch(`/api/${tenancyId}/branches`);
      const data = await response.json();
      setBranches(data.branches);
    } catch (error) {
      console.error("Error fetching branches:", error);
    }
  };


     useEffect(() => {
       fetchBranches();
     }, []);

  const handleBranchChange = (event) => {
    setBranch(event.target.value);
  };
  const handleDownload = () => {
    const tenancyId = localStorage.getItem("tenancyId"); // Retrieve the tenancyId from local storage
 
    const fileName = "nexsol-pos.zip"; // Replace with your actual file name
    const url = `/api/download/${tenancyId}/${branch}/${fileName}`;

    // Trigger the file download
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", fileName); // Set the file name
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <Box sx={{ flexGrow: 1, p: 3, ml: "240px", mt: 2 }}>
      <Paper
        elevation={3}
        sx={{ padding: 4, maxWidth: 600, margin: "auto", marginTop: 8 }}
      >
        <Typography variant="h4" gutterBottom>
          Download Desktop Application
        </Typography>
        <Typography variant="body1" gutterBottom>
          Click the button below to download the latest version of our desktop
          application.
        </Typography>
        <FormControl fullWidth sx={{ mt: 3 }}>
          <InputLabel id="branch-code-label">Branch Code</InputLabel>
          <Select
            labelId="branch-label"
            value={branch}
            onChange={handleBranchChange}
          >
            {branches.map((branch) => (
              <MenuItem key={branch.id} value={branch.branchCode}>
                {branch.branchCode}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <Button
          variant="contained"
          color="primary"
          startIcon={<CloudDownloadIcon />}
          onClick={handleDownload}
          sx={{ mt: 3 }}
          disabled={!branch}
        >
          Download Now
        </Button>
      </Paper>
    </Box>
  );
};

export default DownloadPage;
