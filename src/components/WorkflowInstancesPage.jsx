import React, { useCallback, useEffect, useState } from "react";
import {
  Box,
  Chip,
  IconButton,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import { listWorkflowInstances } from "../services/apiservice";

const STATUS_OPTIONS = [
  { value: "RUNNING", label: "Running" },
  { value: "COMPLETED", label: "Completed" },
  { value: "", label: "All" },
];

function formatDate(value) {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

export default function WorkflowInstancesPage() {
  const [instances, setInstances] = useState([]);
  const [status, setStatus] = useState("RUNNING");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const loadInstances = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await listWorkflowInstances(status || undefined, 0, 50);
      setInstances(res.data.content || []);
    } catch (err) {
      setError(err?.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    loadInstances();
  }, [loadInstances]);

  return (
    <Box p={3}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h5">Workflow Instances</Typography>
        <Stack direction="row" spacing={2} alignItems="center">
          <ToggleButtonGroup
            size="small"
            value={status}
            exclusive
            onChange={(e, val) => val !== null && setStatus(val)}
          >
            {STATUS_OPTIONS.map((opt) => (
              <ToggleButton key={opt.value} value={opt.value}>
                {opt.label}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
          <IconButton onClick={loadInstances} disabled={loading} title="Refresh">
            <RefreshIcon />
          </IconButton>
        </Stack>
      </Stack>

      {error && (
        <Typography color="error" mb={2}>
          {error}
        </Typography>
      )}

      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow sx={{ bgcolor: "#1976d2" }}>
              <TableCell sx={{ color: "#fff", fontWeight: 700 }}>Process</TableCell>
              <TableCell sx={{ color: "#fff", fontWeight: 700 }}>Business Key</TableCell>
              <TableCell sx={{ color: "#fff", fontWeight: 700 }}>Status</TableCell>
              <TableCell sx={{ color: "#fff", fontWeight: 700 }}>Current Step</TableCell>
              <TableCell sx={{ color: "#fff", fontWeight: 700 }}>Version</TableCell>
              <TableCell sx={{ color: "#fff", fontWeight: 700 }}>Started</TableCell>
              <TableCell sx={{ color: "#fff", fontWeight: 700 }}>Updated</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {instances.length === 0 && !loading && (
              <TableRow>
                <TableCell colSpan={7}>
                  <Typography color="text.secondary">No instances found.</Typography>
                </TableCell>
              </TableRow>
            )}
            {instances.map((i) => (
              <TableRow key={i.instanceId}>
                <TableCell>
                  {i.processName} <Typography variant="caption" color="text.secondary">({i.processId})</Typography>
                </TableCell>
                <TableCell>{i.businessKey || "—"}</TableCell>
                <TableCell>
                  <Chip
                    size="small"
                    label={i.status}
                    color={i.status === "RUNNING" ? "warning" : i.status === "COMPLETED" ? "success" : "default"}
                  />
                </TableCell>
                <TableCell>{(i.currentSteps || []).join(", ") || "—"}</TableCell>
                <TableCell>v{i.version}</TableCell>
                <TableCell>{formatDate(i.createdAt)}</TableCell>
                <TableCell>{formatDate(i.updatedAt)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}
