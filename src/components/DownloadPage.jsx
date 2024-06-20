// DownloadPage.js
import React from "react";
import { Box, Button, Typography, Paper } from "@mui/material";
import CloudDownloadIcon from "@mui/icons-material/CloudDownload";

const DownloadPage = () => {
  const handleDownload = () => {
    const tenancyId = localStorage.getItem("tenancyId"); // Retrieve the tenancyId from local storage
    const fileName = "nexsol-pos.zip"; // Replace with your actual file name
    const url = `http://tradelink247.com:80/api/download/${tenancyId}/${fileName}`;

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
        <Button
          variant="contained"
          color="primary"
          startIcon={<CloudDownloadIcon />}
          onClick={handleDownload}
          sx={{ mt: 3 }}
        >
          Download Now
        </Button>
      </Paper>
    </Box>
  );
};

export default DownloadPage;
