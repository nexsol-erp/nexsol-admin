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
  TextField,
  LinearProgress,
} from "@mui/material";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";

const UploadPage = () => {
  const [branch, setBranch] = useState("");
  const [fileType, setFileType] = useState("");
  const [branches, setBranches] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

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

  const handleFileTypeChange = (event) => {
    setFileType(event.target.value);
  };

  const handleFileChange = (event) => {
    setSelectedFile(event.target.files[0]);
  };

  const handleUpload = async () => {
    if (!selectedFile || !branch || !fileType) return;

    setUploading(true);
    const tenancyId = localStorage.getItem("tenancyId");
    const token = localStorage.getItem("jwtToken");

    const formData = new FormData();
    formData.append("file", selectedFile);
    formData.append("branch", branch);
    formData.append("fileType", fileType);

    try {
      const response = await fetch(`/api/${tenancyId}/upload`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Failed to upload file");
      }

      const reader = response.body.getReader();
      const contentLength = +response.headers.get("Content-Length");
      let receivedLength = 0;

      reader.read().then(function processText({ done, value }) {
        if (done) {
          setUploading(false);
          return;
        }

        receivedLength += value.length;
        setProgress((receivedLength / contentLength) * 100);

        return reader.read().then(processText);
      });
    } catch (error) {
      console.error("Error uploading file:", error);
      setUploading(false);
    }
  };

  return (
    <Box sx={{ flexGrow: 1, p: 3, ml: "240px", mt: 2 }}>
      <Paper
        elevation={3}
        sx={{ padding: 4, maxWidth: 600, margin: "auto", marginTop: 8 }}
      >
        <Typography variant="h4" gutterBottom>
          Upload File
        </Typography>
        <Typography variant="body1" gutterBottom>
          Select a file to upload to the selected branch.
        </Typography>
        <FormControl fullWidth sx={{ mt: 3 }}>
          <InputLabel id="branch-label">Branch Code</InputLabel>
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
        <FormControl fullWidth sx={{ mt: 3 }}>
          <InputLabel id="file-type-label">File Type</InputLabel>
          <Select
            labelId="file-type-label"
            value={fileType}
            onChange={handleFileTypeChange}
          >
            <MenuItem value="INI">INI</MenuItem>
            <MenuItem value="EXE">EXE</MenuItem>
            <MenuItem value="ITEM_MASTER">ITEM_MASTER</MenuItem>
            <MenuItem value="OTHERS">OTHERS</MenuItem>
          </Select>
        </FormControl>
        <TextField
          type="file"
          fullWidth
          onChange={handleFileChange}
          sx={{ mt: 3 }}
        />
        {uploading && (
          <LinearProgress
            sx={{ mt: 2 }}
            variant="determinate"
            value={progress}
          />
        )}
        <Box sx={{ mt: 3, display: "flex", gap: 2 }}>
          <Button
            variant="contained"
            color="primary"
            startIcon={<CloudUploadIcon />}
            onClick={handleUpload}
            disabled={!branch || !fileType || !selectedFile || uploading}
          >
            Upload
          </Button>
        </Box>
      </Paper>
    </Box>
  );
};

export default UploadPage;
