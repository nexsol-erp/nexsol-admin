import React, { useCallback, useEffect, useState } from "react";
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import { getMyTasks, completeWorkflowTask } from "../services/apiservice";

const STATE_OPTIONS = [
  { value: "OPEN", label: "Open" },
  { value: "COMPLETED", label: "Completed" },
  { value: "", label: "All" },
];

function formatDate(value) {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

export default function MyTasksPage() {
  const [tasks, setTasks] = useState([]);
  const [state, setState] = useState("OPEN");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [completeDialogTask, setCompleteDialogTask] = useState(null);
  const [variablesJson, setVariablesJson] = useState("{}");
  const [completeError, setCompleteError] = useState(null);
  const [completing, setCompleting] = useState(false);

  const loadTasks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getMyTasks(state || undefined, 0, 50);
      setTasks(res.data.content || []);
    } catch (err) {
      setError(err?.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  }, [state]);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  const openCompleteDialog = (task) => {
    setCompleteDialogTask(task);
    setVariablesJson("{}");
    setCompleteError(null);
  };

  const closeCompleteDialog = () => {
    setCompleteDialogTask(null);
    setCompleteError(null);
  };

  const handleComplete = async () => {
    let updates;
    try {
      updates = variablesJson.trim() === "" ? {} : JSON.parse(variablesJson);
    } catch (err) {
      setCompleteError(`Variables must be valid JSON: ${err.message}`);
      return;
    }
    setCompleting(true);
    setCompleteError(null);
    try {
      await completeWorkflowTask(completeDialogTask.taskId, updates);
      closeCompleteDialog();
      loadTasks();
    } catch (err) {
      setCompleteError(err?.response?.data?.error || err.message);
    } finally {
      setCompleting(false);
    }
  };

  return (
    <Box p={3}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h5">My Tasks</Typography>
        <Stack direction="row" spacing={2} alignItems="center">
          <ToggleButtonGroup
            size="small"
            value={state}
            exclusive
            onChange={(e, val) => val !== null && setState(val)}
          >
            {STATE_OPTIONS.map((opt) => (
              <ToggleButton key={opt.value} value={opt.value}>
                {opt.label}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
          <IconButton onClick={loadTasks} disabled={loading} title="Refresh">
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
              <TableCell sx={{ color: "#fff", fontWeight: 700 }}>Step</TableCell>
              <TableCell sx={{ color: "#fff", fontWeight: 700 }}>Business Key</TableCell>
              <TableCell sx={{ color: "#fff", fontWeight: 700 }}>Created</TableCell>
              <TableCell sx={{ color: "#fff", fontWeight: 700 }}>Due</TableCell>
              <TableCell sx={{ color: "#fff", fontWeight: 700 }}>State</TableCell>
              <TableCell sx={{ color: "#fff", fontWeight: 700 }}>Action</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {tasks.length === 0 && !loading && (
              <TableRow>
                <TableCell colSpan={7}>
                  <Typography color="text.secondary">No tasks found.</Typography>
                </TableCell>
              </TableRow>
            )}
            {tasks.map((t) => (
              <TableRow key={t.taskId}>
                <TableCell>
                  {t.processName} <Typography variant="caption" color="text.secondary">({t.processId})</Typography>
                </TableCell>
                <TableCell>{t.stepName}</TableCell>
                <TableCell>{t.businessKey || "—"}</TableCell>
                <TableCell>{formatDate(t.createdAt)}</TableCell>
                <TableCell>{formatDate(t.dueDateTime)}</TableCell>
                <TableCell>
                  <Chip
                    size="small"
                    label={t.state}
                    color={t.state === "OPEN" ? "warning" : t.state === "COMPLETED" ? "success" : "default"}
                  />
                </TableCell>
                <TableCell>
                  <Button
                    size="small"
                    variant="contained"
                    disabled={t.state !== "OPEN" && t.state !== "ASSIGNED"}
                    onClick={() => openCompleteDialog(t)}
                  >
                    Complete
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={!!completeDialogTask} onClose={closeCompleteDialog} maxWidth="sm" fullWidth>
        <DialogTitle>Complete Task — {completeDialogTask?.stepName}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" mb={2}>
            Optional: variables to set on the process instance when completing this task, as JSON.
          </Typography>
          <TextField
            multiline
            minRows={4}
            fullWidth
            value={variablesJson}
            onChange={(e) => setVariablesJson(e.target.value)}
            sx={{ fontFamily: "monospace" }}
          />
          {completeError && (
            <Typography color="error" mt={2}>
              {completeError}
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={closeCompleteDialog} disabled={completing}>Cancel</Button>
          <Button variant="contained" onClick={handleComplete} disabled={completing}>
            {completing ? "Completing..." : "Complete"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
