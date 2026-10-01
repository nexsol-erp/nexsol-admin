import React, { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import dayjs from "dayjs";

/**
 * Vehicle wheel types.
 *
 * The weighbridge desktop app locks a vehicle's wheel type once it has one, so an operator can't
 * weigh a lorry at a cheaper rate. This is the only place it can be changed. Each PC picks a change
 * up when the vehicle is next entered (or within ten minutes).
 */
const normalize = (v) => String(v || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
const fmt = (v) => (v ? dayjs(v).format("DD-MM-YYYY HH:mm") : "-");

const VehicleWheelTypePage = () => {
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState([]);
  const [installed, setInstalled] = useState(true);
  const [wheelTypes, setWheelTypes] = useState([]);
  const [editing, setEditing] = useState(null); // { vehicleNumber, wheelType, current }
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);

  const tenancyId = localStorage.getItem("tenancyId");
  const token = localStorage.getItem("jwtToken");
  const headers = useCallback(
    () => ({ Authorization: `Bearer ${token}`, "Content-Type": "application/json" }),
    [token]
  );

  const load = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/${tenancyId}/weighbridge/wheel-types?search=${encodeURIComponent(normalize(search))}`,
        { headers: headers() }
      );
      const data = await res.json();
      setInstalled(data.installed !== false);
      setRows(Array.isArray(data.rows) ? data.rows : []);
    } catch (e) {
      setMessage({ severity: "error", text: e.message });
    }
  }, [tenancyId, search, headers]);

  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
  }, [load]);

  useEffect(() => {
    fetch(`/api/${tenancyId}/wb-rates`, { headers: headers() })
      .then((r) => r.json())
      .then((list) => {
        const names = [...new Set((Array.isArray(list) ? list : []).map((r) => r.wheelType).filter(Boolean))];
        setWheelTypes(names.sort());
      })
      .catch(() => {});
  }, [tenancyId, headers]);

  const save = async () => {
    if (!editing?.vehicleNumber || !editing.wheelType) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/${tenancyId}/weighbridge/wheel-types`, {
        method: "PUT",
        headers: headers(),
        body: JSON.stringify({ vehicleNumber: editing.vehicleNumber, wheelType: editing.wheelType }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage({ severity: "error", text: data.error || `Save failed (HTTP ${res.status})` });
        return;
      }
      setMessage({
        severity: "success",
        text: `${data.vehicleNumber || editing.vehicleNumber} is now ${editing.wheelType}. Weighbridge PCs use it from the next time the vehicle is entered.`,
      });
      setEditing(null);
      load();
    } catch (e) {
      setMessage({ severity: "error", text: e.message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h6" sx={{ mb: 1 }}>
        Vehicle Wheel Type
      </Typography>
      <Typography variant="body2" sx={{ mb: 2, color: "text.secondary" }}>
        The weighbridge app locks a vehicle's wheel type once it has been weighed or given a tare
        weight. Change it here when it was entered wrong; operators can't change it at the weighbridge.
      </Typography>

      {!installed && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Changing wheel types isn't set up on this server yet (the V077 migration hasn't been run).
          The list below is read only.
        </Alert>
      )}

      <Paper sx={{ p: 2, mb: 2, display: "flex", gap: 2, flexWrap: "wrap", alignItems: "center" }}>
        <TextField
          size="small"
          label="Vehicle number"
          value={search}
          onChange={(e) => setSearch(e.target.value.toUpperCase())}
          sx={{ minWidth: 240 }}
        />
        <Button
          variant="outlined"
          disabled={!installed}
          onClick={() => setEditing({ vehicleNumber: normalize(search), wheelType: "", current: "", isNew: true })}
        >
          Set for a vehicle
        </Button>
      </Paper>

      {message && (
        <Alert severity={message.severity} sx={{ mb: 2 }} onClose={() => setMessage(null)}>
          {message.text}
        </Alert>
      )}

      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Vehicle</TableCell>
              <TableCell>Wheel type</TableCell>
              <TableCell>From</TableCell>
              <TableCell>Last weighed</TableCell>
              <TableCell>Changed</TableCell>
              <TableCell />
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} sx={{ color: "text.secondary" }}>
                  No vehicles found.
                </TableCell>
              </TableRow>
            )}
            {rows.map((r) => (
              <TableRow key={r.vehicleNumber}>
                <TableCell sx={{ fontWeight: 600 }}>{r.vehicleNumber}</TableCell>
                <TableCell>{r.wheelType || "-"}</TableCell>
                <TableCell>
                  {r.source === "set" ? (
                    <Chip size="small" color="primary" label="Set here" />
                  ) : (
                    <Chip size="small" variant="outlined" label="Weighing" />
                  )}
                </TableCell>
                <TableCell>{fmt(r.lastDate)}</TableCell>
                <TableCell>{r.updatedAt ? `${fmt(r.updatedAt)}${r.updatedBy ? ` by ${r.updatedBy}` : ""}` : "-"}</TableCell>
                <TableCell align="right">
                  <Button
                    size="small"
                    disabled={!installed}
                    onClick={() => setEditing({ vehicleNumber: r.vehicleNumber, wheelType: r.wheelType || "", current: r.wheelType || "" })}
                  >
                    Change
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={!!editing} onClose={() => setEditing(null)} fullWidth maxWidth="xs">
        <DialogTitle>{editing?.isNew ? "Set wheel type" : `Change wheel type of ${editing?.vehicleNumber}`}</DialogTitle>
        <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, pt: "8px !important" }}>
          {editing?.isNew && (
            <TextField
              size="small"
              label="Vehicle number"
              value={editing.vehicleNumber}
              onChange={(e) => setEditing({ ...editing, vehicleNumber: normalize(e.target.value) })}
            />
          )}
          <FormControl size="small">
            <InputLabel id="wheel-type-label">Wheel type</InputLabel>
            <Select
              labelId="wheel-type-label"
              label="Wheel type"
              value={editing?.wheelType || ""}
              onChange={(e) => setEditing({ ...editing, wheelType: e.target.value })}
            >
              {wheelTypes.map((w) => (
                <MenuItem key={w} value={w}>
                  {w}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          {editing?.current && (
            <Typography variant="body2" color="text.secondary">
              Currently {editing.current}. Vouchers already issued keep their wheel type and amount.
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditing(null)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={save}
            disabled={busy || !editing?.vehicleNumber || !editing?.wheelType || editing.wheelType === editing.current}
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default VehicleWheelTypePage;
