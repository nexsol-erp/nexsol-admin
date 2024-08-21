import React, { useState, useEffect } from "react";
import {
  Box,
  Button,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
} from "@mui/material";

const PublishSchemePage = () => {
  const [schemes, setSchemes] = useState([]);
  const [branches, setBranches] = useState([]);
  const [selectedScheme, setSelectedScheme] = useState("");
  const [selectedBranch, setSelectedBranch] = useState("");

  const fetchSchemes = async () => {
    const tenancyId = localStorage.getItem("tenancyId");
        const token = localStorage.getItem("jwtToken");
    const response = await fetch(`/api/${tenancyId}/scheme`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });
    const data = await response.json();
    setSchemes(Array.isArray(data) ? data : []);
  };

  const fetchBranches = async () => {
    try {
      const tenancyId = localStorage.getItem("tenancyId");
      const token = localStorage.getItem("jwtToken");
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
    fetchSchemes();
    fetchBranches();
  }, []);

  const handlePublishScheme = async () => {
    const tenancyId = localStorage.getItem("tenancyId");
    const token = localStorage.getItem("jwtToken");
    const response = await fetch(`/api/${tenancyId}/scheme/publish-scheme`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        schemeId: selectedScheme,
        branchId: selectedBranch,
      }),
    });

    if (response.ok) {
      alert("Scheme published successfully!");
    } else {
      alert("Failed to publish scheme.");
    }
  };

  const handleDeleteScheme = async (schemeId) => {
    const tenancyId = localStorage.getItem("tenancyId");
    const token = localStorage.getItem("jwtToken");
    const response = await fetch(`/api/${tenancyId}/scheme/${schemeId}`, {
      Authorization: `Bearer ${token}`,
      method: "DELETE",
    });

    if (response.ok) {
      alert("Scheme deleted successfully!");
      fetchSchemes(); // Refresh the list of schemes
    } else {
      alert("Failed to delete scheme.");
    }
  };

  return (
    <Box sx={{ flexGrow: 1, p: 3, ml: "240px", mt: 2 }}>
      <Paper elevation={3} sx={{ padding: 4, maxWidth: 600 }}>
        <Typography variant="h4" gutterBottom>
          Publish Scheme
        </Typography>
        <FormControl fullWidth margin="normal">
          <InputLabel>Select Scheme</InputLabel>
          <Select
            value={selectedScheme}
            onChange={(e) => setSelectedScheme(e.target.value)}
          >
            {schemes.map((scheme) => (
              <MenuItem key={scheme.schemeName} value={scheme.schemeName}>
                {scheme.schemeName}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl fullWidth margin="normal">
          <InputLabel>Select Branch</InputLabel>
          <Select
            value={selectedBranch}
            onChange={(e) => setSelectedBranch(e.target.value)}
          >
            {branches.map((branch) => (
              <MenuItem key={branch.branchCode} value={branch.branchCode}>
                {branch.branchCode}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <Button
          variant="contained"
          color="primary"
          onClick={handlePublishScheme}
          sx={{ mt: 2 }}
        >
          Publish Scheme
        </Button>
      </Paper>
      <Paper elevation={3} sx={{ padding: 4, maxWidth: 600, marginTop: 4 }}>
        <Typography variant="h4" gutterBottom>
          Existing Schemes
        </Typography>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Scheme Name</TableCell>
              <TableCell>Start Date</TableCell>
              <TableCell>End Date</TableCell>
              <TableCell>Action</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {schemes.map((scheme) => (
              <TableRow key={scheme.schemeName}>
                <TableCell>{scheme.schemeName}</TableCell>
                <TableCell>{scheme.startDate}</TableCell>
                <TableCell>{scheme.endDate}</TableCell>
                <TableCell>
                  <Button
                    variant="contained"
                    color="secondary"
                    onClick={() => handleDeleteScheme(scheme.schemeName)}
                  >
                    Delete
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>
    </Box>
  );
};

export default PublishSchemePage;
