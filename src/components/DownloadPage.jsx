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
  Chip,
} from "@mui/material";
import CloudDownloadIcon from "@mui/icons-material/CloudDownload";
import PointOfSaleIcon from "@mui/icons-material/PointOfSale";

const DownloadPage = () => {
  const [branch, setBranch] = useState("");
  const [branches, setBranches] = useState([]);

  const fetchBranches = async () => {
    try {
      const token = localStorage.getItem("jwtToken");
      const tenancyId = localStorage.getItem("tenancyId");
      const response = await fetch(`/api/${tenancyId}/branches`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });
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

  const handleDownload = async () => {
    const tenancyId = localStorage.getItem("tenancyId");
    const token = localStorage.getItem("jwtToken");
    const fileName = "nexsol-pos.zip";
    const url = `/api/${tenancyId}/download/${branch}/${fileName}`;

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

  const handleUpgradeDownload = async () => {
    const tenancyId = localStorage.getItem("tenancyId");
    const token = localStorage.getItem("jwtToken");
    const fileName = "nexsol-pos-upgrade.zip";
    const url = `/api/${tenancyId}/upgrade/${branch}/${fileName}`;

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

  const handlePosDownload = () => {
    const link = document.createElement("a");
    link.href = "/api/updates/electron/download/latest";
    link.setAttribute("download", "TradeLink247-POS-Setup.exe");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <Box sx={{ flexGrow: 1, p: 3, ml: "240px", mt: 2 }}>
      {/* Cashier POS card */}
      <Paper
        elevation={3}
        sx={{ padding: 4, maxWidth: 600, margin: "auto", marginTop: 8 }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
          <PointOfSaleIcon color="primary" sx={{ fontSize: 32 }} />
          <Typography variant="h5" sx={{ fontWeight: 600 }}>
            Cashier POS
          </Typography>
          <Chip label="Windows" size="small" color="primary" variant="outlined" />
        </Box>
        <Typography variant="body2" color="text.secondary" gutterBottom>
          Desktop application for cashier billing, day-end, stock transfer, and
          accept stock. Install on each cashier PC — branch and server are
          configured at first login.
        </Typography>
        <Box sx={{ mt: 2 }}>
          <Button
            variant="contained"
            color="primary"
            size="large"
            startIcon={<CloudDownloadIcon />}
            onClick={handlePosDownload}
          >
            Download Cashier POS Setup (.exe)
          </Button>
        </Box>
      </Paper>

      {/* Existing desktop application card */}
      <Paper
        elevation={3}
        sx={{ padding: 4, maxWidth: 600, margin: "auto", marginTop: 4 }}
      >
        <Typography variant="h5" sx={{ fontWeight: 600 }} gutterBottom>
          Desktop Application
        </Typography>
        <Typography variant="body2" color="text.secondary" gutterBottom>
          Branch-specific desktop application. Select a branch to download the
          full installer or latest patch.
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
        <Box sx={{ mt: 3, display: "flex", gap: 2 }}>
          <Button
            variant="contained"
            color="primary"
            startIcon={<CloudDownloadIcon />}
            onClick={handleDownload}
            disabled={!branch}
          >
            Download Full
          </Button>
          <Button
            variant="contained"
            color="secondary"
            startIcon={<CloudDownloadIcon />}
            onClick={handleUpgradeDownload}
            disabled={!branch}
          >
            Download Patch
          </Button>
        </Box>
      </Paper>
    </Box>
  );
};

export default DownloadPage;
