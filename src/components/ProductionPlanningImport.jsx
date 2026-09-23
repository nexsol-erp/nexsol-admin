import React, { useState } from "react";
import {
  Box,
  Typography,
  Paper,
  Button,
  Stack,
  Alert,
  CircularProgress,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  Chip,
  Divider,
} from "@mui/material";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import DownloadIcon from "@mui/icons-material/Download";
import { saveAs } from "file-saver";

const headCell = { bgcolor: "#1976d2", color: "#fff", fontWeight: 700, fontSize: "0.8rem" };

const ProductionPlanningImport = () => {
  const tenancyId = localStorage.getItem("tenancyId");
  const token = localStorage.getItem("jwtToken");

  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [downloadingTemplate, setDownloadingTemplate] = useState(false);

  const handleDownloadTemplate = async () => {
    setDownloadingTemplate(true);
    setError("");
    try {
      const res = await fetch(`/api/${tenancyId}/production-planning/import-template`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      saveAs(blob, "Production_Planning_Import_Template.xlsx");
    } catch (e) {
      setError("Could not download the template: " + (e.message || ""));
    } finally {
      setDownloadingTemplate(false);
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setError("");
    setResult(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`/api/${tenancyId}/production-planning/import`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || `HTTP ${res.status}`);
      setResult(data);
      setFile(null);
    } catch (e) {
      setError(e.message || "Import failed.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 1100, mx: "auto" }}>
      <Typography variant="h5" fontWeight={600} gutterBottom>
        Import Production Planning (Excel)
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Upload a sheet with columns <strong>Item Name</strong>, <strong>Qty</strong> and{" "}
        <strong>Branch Code</strong> (row 1 = header). Rows are grouped by branch code — each
        distinct branch gets its own planning with its own voucher number. The template is
        pre-filled with every item that has a recipe defined, and its Branch Code column has a
        dropdown limited to BAKERY_PROD branches.
      </Typography>

      <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems="center">
          <Button variant="outlined" component="label" startIcon={<UploadFileIcon />}>
            {file ? file.name : "Choose Excel File"}
            <input
              type="file"
              accept=".xlsx,.xls"
              hidden
              onChange={(e) => { setFile(e.target.files?.[0] || null); setResult(null); setError(""); }}
            />
          </Button>
          <Button variant="contained" onClick={handleUpload} disabled={!file || uploading} sx={{ minWidth: 120 }}>
            {uploading ? <CircularProgress size={20} color="inherit" /> : "Import"}
          </Button>
          <Button
            variant="text"
            startIcon={downloadingTemplate ? <CircularProgress size={16} /> : <DownloadIcon />}
            onClick={handleDownloadTemplate}
            disabled={downloadingTemplate}
          >
            Download Template
          </Button>
        </Stack>
      </Paper>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError("")}>
          {error}
        </Alert>
      )}

      {result && (
        <>
          <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
            <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1.5 }}>
              Import Summary
            </Typography>
            <Stack direction="row" spacing={4} flexWrap="wrap">
              <Box>
                <Typography variant="caption" color="text.secondary">Source Rows</Typography>
                <Typography variant="h6">{result.totalRows}</Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">Imported</Typography>
                <Typography variant="h6" color="success.main">{result.importedRows}</Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">Failed</Typography>
                <Typography variant="h6" color={result.failedRows > 0 ? "error.main" : "text.primary"}>
                  {result.failedRows}
                </Typography>
              </Box>
            </Stack>

            {result.plannings?.length > 0 && (
              <>
                <Divider sx={{ my: 2 }} />
                <Typography variant="subtitle2" sx={{ mb: 1 }}>
                  Plannings Created ({result.plannings.length})
                </Typography>
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                  {result.plannings.map((p) => (
                    <Chip
                      key={p.voucherNumber}
                      color="primary"
                      variant="outlined"
                      label={`${p.branchCode} — ${p.voucherNumber} (${p.itemCount} items)`}
                    />
                  ))}
                </Stack>
              </>
            )}
          </Paper>

          {result.errors?.length > 0 && (
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography variant="subtitle1" fontWeight={600} color="error" sx={{ mb: 1.5 }}>
                Error Rows ({result.errors.length})
              </Typography>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={headCell}>Row</TableCell>
                    <TableCell sx={headCell}>Item Name</TableCell>
                    <TableCell sx={headCell}>Qty</TableCell>
                    <TableCell sx={headCell}>Branch Code</TableCell>
                    <TableCell sx={headCell}>Reason</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {result.errors.map((e, idx) => (
                    <TableRow key={idx} sx={{ backgroundColor: idx % 2 === 0 ? "#fff" : "#fdf2f2" }}>
                      <TableCell>{e.rowNumber}</TableCell>
                      <TableCell>{e.itemName || "—"}</TableCell>
                      <TableCell>{e.qty || "—"}</TableCell>
                      <TableCell>{e.branchCode || "—"}</TableCell>
                      <TableCell sx={{ color: "error.main" }}>{e.reason}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Paper>
          )}
        </>
      )}
    </Box>
  );
};

export default ProductionPlanningImport;
