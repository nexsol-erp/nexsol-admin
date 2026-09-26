// ReportRequestsTable.jsx
// The list of a user's background reports with a Download button, shared by My Reports and
// the screens that request a report.
import React, { useState } from "react";
import {
  Alert,
  Button,
  Chip,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
} from "@mui/material";
import dayjs from "dayjs";
import { downloadReport } from "./reportRequestsApi";

const STATUS_COLOR = { QUEUED: "default", RUNNING: "info", READY: "success", FAILED: "error" };

const ReportRequestsTable = ({ requests, highlightId, emptyText = "No reports requested yet." }) => {
  const [downloadingId, setDownloadingId] = useState(null);
  const [error, setError] = useState(null);

  const download = async (r) => {
    setDownloadingId(r.id);
    setError(await downloadReport(r));
    setDownloadingId(null);
  };

  return (
    <>
      {error && (
        <Alert severity="error" sx={{ mb: 1 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      <TableContainer sx={{ maxHeight: 560 }}>
        <Table stickyHeader size="small">
          <TableHead>
            <TableRow>
              <TableCell>Requested</TableCell>
              <TableCell>Report</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right">Rows</TableCell>
              <TableCell align="right" />
            </TableRow>
          </TableHead>
          <TableBody>
            {requests.map((r) => (
              <TableRow key={r.id} hover selected={r.id === highlightId}>
                <TableCell sx={{ whiteSpace: "nowrap" }}>
                  {r.requestedAt ? dayjs(r.requestedAt).format("DD-MM-YYYY HH:mm") : ""}
                </TableCell>
                <TableCell>{r.title}</TableCell>
                <TableCell>
                  <Tooltip title={r.errorMessage || ""}>
                    <Chip size="small" label={r.status} color={STATUS_COLOR[r.status] || "default"} />
                  </Tooltip>
                  {r.status === "FAILED" && r.errorMessage && (
                    <div style={{ fontSize: 12, color: "#b71c1c", marginTop: 4 }}>{r.errorMessage}</div>
                  )}
                </TableCell>
                <TableCell align="right">{r.rowCount ?? ""}</TableCell>
                <TableCell align="right">
                  {r.status === "READY" && r.fileAvailable === false && (
                    <span style={{ fontSize: 12, color: "#757575" }}>Expired, request again</span>
                  )}
                  {r.status === "READY" && r.fileAvailable !== false && (
                    <Button size="small" variant="outlined" onClick={() => download(r)} disabled={downloadingId === r.id}>
                      {downloadingId === r.id ? <CircularProgress size={18} /> : "Download"}
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {requests.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} align="center">
                  {emptyText}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </>
  );
};

export default ReportRequestsTable;
