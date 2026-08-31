import React, { useCallback, useEffect, useState } from "react";
import {
  Autocomplete,
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
import {
  getMyTasks,
  getAllTasks,
  completeWorkflowTask,
  assignTask,
  getTenantUsers,
} from "../services/apiservice";
import { useNavigate } from "react-router-dom";
import { taskActionLink, taskActionLabel } from "./taskActionLink";

const STATE_OPTIONS = [
  { value: "OPEN", label: "Open" },
  { value: "COMPLETED", label: "Completed" },
  { value: "", label: "All" },
];

function formatDate(value) {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

/**
 * Administrators see everyone's tasks, with the assignee on each row.
 *
 * Role naming is inconsistent in the database - 'admin', 'Admin', 'system-admin' and
 * 'System_Admin' all exist as distinct rows - so this normalises rather than matching
 * literals, the same way AdminRoles.isAdmin does on the server.
 *
 * This only decides whether to OFFER the wider view. The backend refuses /all-tasks with a
 * 403 for non-administrators whatever the browser asks for.
 */
function currentUserIsAdmin() {
  try {
    const roles = JSON.parse(localStorage.getItem("roles") || "[]");
    return roles.some((r) =>
      ["ADMIN", "OWNER", "FRANCHISE_OWNER", "SYSTEM_ADMIN"].includes(
        String(r).toUpperCase().replace(/-/g, "_")
      )
    );
  } catch {
    return false;
  }
}

export default function MyTasksPage() {
  const navigate = useNavigate();
  const isAdmin = currentUserIsAdmin();
  const [scope, setScope] = useState("MINE"); // MINE | ALL - administrators only
  const [tasks, setTasks] = useState([]);
  const [state, setState] = useState("OPEN");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [completeDialogTask, setCompleteDialogTask] = useState(null);
  const [assignDialogTask, setAssignDialogTask] = useState(null);
  const [users, setUsers] = useState([]);
  const [usersLoaded, setUsersLoaded] = useState(false);
  const [assignee, setAssignee] = useState(null);
  const [assigning, setAssigning] = useState(false);
  const [assignError, setAssignError] = useState(null);
  const [variablesJson, setVariablesJson] = useState("{}");
  const [completeError, setCompleteError] = useState(null);
  const [completing, setCompleting] = useState(false);

  const loadTasks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const showAll = isAdmin && scope === "ALL";
      const res = showAll
        ? await getAllTasks(state || undefined, 0, 50)
        : await getMyTasks(state || undefined, 0, 50);
      setTasks(res.data.content || []);
    } catch (err) {
      setError(err?.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  }, [state, scope, isAdmin]);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  /**
   * Loads the tenant's users once, the first time the picker is opened.
   *
   * Lazily rather than on mount: most visits to this page never assign anything, and
   * the list is only needed when the dialog appears.
   */
  const openAssignDialog = async (task) => {
    setAssignDialogTask(task);
    setAssignee(task.assignee || null);
    setAssignError(null);

    if (usersLoaded) return;
    try {
      const res = await getTenantUsers();
      const names = (res.data || [])
        .map((u) => u.username)
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b));
      setUsers(names);
      setUsersLoaded(true);
    } catch (err) {
      // The dialog stays usable: the field accepts a typed username, so a failed
      // lookup degrades to manual entry rather than blocking the assignment.
      setAssignError(
        "Could not load the user list - you can still type a username. " +
          (err?.response?.data?.error || err.message)
      );
    }
  };

  const closeAssignDialog = () => {
    setAssignDialogTask(null);
    setAssignError(null);
  };

  const handleAssign = async () => {
    const target = (assignee || "").trim();
    if (!target) {
      setAssignError("Choose who this task belongs to");
      return;
    }
    setAssigning(true);
    setAssignError(null);
    try {
      await assignTask(assignDialogTask.taskId, target);
      setAssignDialogTask(null);
      loadTasks();
    } catch (err) {
      // Keep the dialog open so the choice is not lost.
      setAssignError(err?.response?.data?.error || err.message);
    } finally {
      setAssigning(false);
    }
  };

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
        <Typography variant="h5">
          {isAdmin && scope === "ALL" ? "All Tasks" : "My Tasks"}
        </Typography>
        <Stack direction="row" spacing={2} alignItems="center">
          {isAdmin && (
            <ToggleButtonGroup
              size="small"
              value={scope}
              exclusive
              onChange={(e, val) => val !== null && setScope(val)}
            >
              <ToggleButton value="MINE">Mine</ToggleButton>
              <ToggleButton value="ALL">Everyone</ToggleButton>
            </ToggleButtonGroup>
          )}
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
              {isAdmin && scope === "ALL" && (
                <TableCell sx={{ color: "#fff", fontWeight: 700 }}>Assigned To</TableCell>
              )}
              <TableCell sx={{ color: "#fff", fontWeight: 700 }}>Created</TableCell>
              <TableCell sx={{ color: "#fff", fontWeight: 700 }}>Due</TableCell>
              <TableCell sx={{ color: "#fff", fontWeight: 700 }}>State</TableCell>
              <TableCell sx={{ color: "#fff", fontWeight: 700 }}>Action</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {tasks.length === 0 && !loading && (
              <TableRow>
                <TableCell colSpan={isAdmin && scope === "ALL" ? 8 : 7}>
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
                {isAdmin && scope === "ALL" && (
                  // "Unassigned" rather than a blank cell: a task nobody owns is
                  // precisely the one that sits untouched, so it should read as a
                  // state rather than a gap.
                  <TableCell>{t.assignee || "Unassigned"}</TableCell>
                )}
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
                  <Stack direction="row" spacing={1}>
                    {/* "Open" comes first because it is what the task is for: the screen that lets
                        you act. Completing is what you do afterwards. It is hidden rather than
                        disabled when the target cannot be resolved - a permanently dead button
                        teaches people to ignore the column. */}
                    {isAdmin && (
                      <Button
                        size="small"
                        variant="text"
                        disabled={t.state !== "OPEN" && t.state !== "ASSIGNED"}
                        onClick={() => openAssignDialog(t)}
                      >
                        Assign
                      </Button>
                    )}
                    {taskActionLink(t) && (
                      <Button
                        size="small"
                        variant="outlined"
                        title={`Open ${taskActionLabel(t)}`}
                        onClick={() => navigate(taskActionLink(t))}
                      >
                        Open
                      </Button>
                    )}
                    <Button
                      size="small"
                      variant="contained"
                      disabled={t.state !== "OPEN" && t.state !== "ASSIGNED"}
                      onClick={() => openCompleteDialog(t)}
                    >
                      Complete
                    </Button>
                  </Stack>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={Boolean(assignDialogTask)} onClose={closeAssignDialog} fullWidth maxWidth="xs">
        <DialogTitle>Assign task</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {assignDialogTask?.stepName}
          </Typography>
          {/* freeSolo so a username can still be typed when the list fails to load, or when
              the person is not in it. */}
          <Autocomplete
            freeSolo
            options={users}
            value={assignee}
            onChange={(e, val) => setAssignee(val)}
            onInputChange={(e, val) => setAssignee(val)}
            renderInput={(params) => (
              <TextField {...params} label="Assign to" size="small" autoFocus fullWidth />
            )}
          />
          {assignError && (
            <Typography color="error" variant="body2" sx={{ mt: 2 }}>
              {assignError}
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={closeAssignDialog} disabled={assigning}>Cancel</Button>
          <Button variant="contained" onClick={handleAssign} disabled={assigning}>
            {assigning ? "Assigning..." : "Assign"}
          </Button>
        </DialogActions>
      </Dialog>

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
