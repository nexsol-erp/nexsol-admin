import React, { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Paper,
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
 * Weighbridge rates: the charge per wheel type for every weighbridge PC.
 *
 * Rates keep their history; a new rate for a wheel type applies from now on, and the PCs pick it
 * up within a minute. A PC's own Rates tab is view only unless "Allow rate changes" is on for it
 * in Weighbridge PCs.
 */
const fmt = (v) => (v ? dayjs(v).format("DD-MM-YYYY HH:mm") : "-");

// newest rate per wheel type, like the desktop app
function current(list) {
  const byType = new Map();
  for (const r of list) {
    if (!r?.wheelType || !(Number(r.wheelRate) > 0)) continue;
    const prev = byType.get(r.wheelType);
    if (!prev || String(r.voucherDate || "") > String(prev.voucherDate || "")) byType.set(r.wheelType, r);
  }
  return [...byType.values()].sort((a, b) => a.wheelType.localeCompare(b.wheelType));
}

const WeighbridgeRatesPage = () => {
  const [rates, setRates] = useState([]);
  const [form, setForm] = useState({ wheelType: "", wheelRate: "" });
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
      const res = await fetch(`/api/${tenancyId}/wb-rates`, { headers: headers() });
      const list = await res.json();
      setRates(current(Array.isArray(list) ? list : []));
    } catch (e) {
      setMessage({ severity: "error", text: e.message });
    }
  }, [tenancyId, headers]);

  useEffect(() => {
    load();
  }, [load]);

  const save = async () => {
    const wheelType = form.wheelType.trim().toUpperCase();
    const wheelRate = Number(form.wheelRate);
    if (!wheelType || !(wheelRate > 0)) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/${tenancyId}/wb-rates`, {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({ wheelType, wheelRate }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage({ severity: "error", text: data.error || `Save failed (HTTP ${res.status})` });
        return;
      }
      setMessage({ severity: "success", text: `${wheelType} is now ₹${wheelRate.toFixed(2)}. Weighbridge PCs use it within a minute.` });
      setForm({ wheelType: "", wheelRate: "" });
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
        Weighbridge Rates
      </Typography>
      <Typography variant="body2" sx={{ mb: 2, color: "text.secondary" }}>
        The charge per wheel type at every weighbridge. A new rate applies to weighings from now on;
        vouchers already issued keep their amount. Weighbridge PCs can only view rates unless rate
        changes are allowed for them in Weighbridge PCs.
      </Typography>

      <Paper sx={{ p: 2, mb: 2, display: "flex", gap: 2, flexWrap: "wrap", alignItems: "center" }}>
        <TextField
          size="small"
          label="Wheel type"
          placeholder="10 WHEEL"
          value={form.wheelType}
          onChange={(e) => setForm({ ...form, wheelType: e.target.value.toUpperCase() })}
          sx={{ minWidth: 200 }}
        />
        <TextField
          size="small"
          label="Rate (₹)"
          type="number"
          value={form.wheelRate}
          onChange={(e) => setForm({ ...form, wheelRate: e.target.value })}
          sx={{ width: 140 }}
        />
        <Button variant="contained" onClick={save} disabled={busy || !form.wheelType.trim() || !(Number(form.wheelRate) > 0)}>
          Save rate
        </Button>
      </Paper>

      {message && (
        <Alert severity={message.severity} sx={{ mb: 2 }} onClose={() => setMessage(null)}>
          {message.text}
        </Alert>
      )}

      <TableContainer component={Paper} sx={{ maxWidth: 720 }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Wheel type</TableCell>
              <TableCell align="right">Rate</TableCell>
              <TableCell>Since</TableCell>
              <TableCell />
            </TableRow>
          </TableHead>
          <TableBody>
            {rates.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} sx={{ color: "text.secondary" }}>
                  No rates yet.
                </TableCell>
              </TableRow>
            )}
            {rates.map((r) => (
              <TableRow key={r.wheelType}>
                <TableCell sx={{ fontWeight: 600 }}>{r.wheelType}</TableCell>
                <TableCell align="right">₹ {Number(r.wheelRate).toFixed(2)}</TableCell>
                <TableCell>{fmt(r.voucherDate)}</TableCell>
                <TableCell align="right">
                  <Button size="small" onClick={() => setForm({ wheelType: r.wheelType, wheelRate: String(r.wheelRate) })}>
                    Change
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
};

export default WeighbridgeRatesPage;
