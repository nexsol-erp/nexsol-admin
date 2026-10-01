import React, { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import dayjs from "dayjs";

/**
 * Weighbridge PCs.
 *
 * Each weighbridge desktop app checks in here. Its Settings tab (indicator, printing, weighing,
 * branch) locks once the PC is set up; "Allow settings changes" opens it again. The PC picks that
 * up within a minute. The opening is used up when Settings are saved on the PC: they lock again
 * at its next start. "Allow rate changes" separately lets a PC change rates on its Rates tab; it
 * stays as set here (rates themselves are changed in Weighbridge Rates).
 */
const fmt = (v) => (v ? dayjs(v).format("DD-MM-YYYY HH:mm") : "-");

const WeighbridgePcsPage = () => {
  const [rows, setRows] = useState([]);
  const [installed, setInstalled] = useState(true);
  const [ratesInstalled, setRatesInstalled] = useState(true);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState(null);

  const tenancyId = localStorage.getItem("tenancyId");
  const token = localStorage.getItem("jwtToken");
  const headers = useCallback(
    () => ({ Authorization: `Bearer ${token}`, "Content-Type": "application/json" }),
    [token]
  );

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/${tenancyId}/weighbridge/terminals`, { headers: headers() });
      const data = await res.json();
      setInstalled(data.installed !== false);
      setRatesInstalled(data.ratesInstalled !== false);
      setRows(Array.isArray(data.rows) ? data.rows : []);
    } catch (e) {
      setMessage({ severity: "error", text: e.message });
    }
  }, [tenancyId, headers]);

  useEffect(() => {
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, [load]);

  // what: "settings" | "rates"
  const setUnlocked = async (row, unlocked, what = "settings") => {
    setBusy(row.terminalId);
    try {
      const res = await fetch(`/api/${tenancyId}/weighbridge/terminals/${encodeURIComponent(row.terminalId)}/${what}`, {
        method: "PUT",
        headers: headers(),
        body: JSON.stringify({ unlocked }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage({ severity: "error", text: data.error || `Failed (HTTP ${res.status})` });
        return;
      }
      const name = row.machineName || row.branchCode || "The PC";
      setMessage({
        severity: "success",
        text: what === "rates"
          ? unlocked
            ? `${name} can change rates within a minute, until you lock them here.`
            : `${name} can only view rates.`
          : unlocked
            ? `${name} can change its settings within a minute. They lock again after they are saved and the app is restarted.`
            : `${name}'s settings are locked.`,
      });
      load();
    } catch (e) {
      setMessage({ severity: "error", text: e.message });
    } finally {
      setBusy("");
    }
  };

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h6" sx={{ mb: 1 }}>
        Weighbridge PCs
      </Typography>
      <Typography variant="body2" sx={{ mb: 2, color: "text.secondary" }}>
        A weighbridge PC's Settings lock after it is set up, so the indicator, printer and branch
        can't be changed at the counter. Allow changes here when a PC needs setting up again. It
        locks again once the settings are saved and the app is restarted.
      </Typography>

      {!installed && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Weighbridge PCs aren't set up on this server yet (the V078 migration hasn't been run).
          Until then, Settings on the PCs stay open.
        </Alert>
      )}
      {installed && !ratesInstalled && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          The rates lock isn't set up on this server yet (the V079 migration hasn't been run). Until
          then, admins can change rates on the PCs.
        </Alert>
      )}

      {message && (
        <Alert severity={message.severity} sx={{ mb: 2 }} onClose={() => setMessage(null)}>
          {message.text}
        </Alert>
      )}

      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>PC</TableCell>
              <TableCell>Branch</TableCell>
              <TableCell>Version</TableCell>
              <TableCell>Last user</TableCell>
              <TableCell>Last seen</TableCell>
              <TableCell>Settings</TableCell>
              <TableCell />
              <TableCell>Rates</TableCell>
              <TableCell />
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} sx={{ color: "text.secondary" }}>
                  No weighbridge PCs have checked in yet. They appear here once they run version 1.0.3 or later.
                </TableCell>
              </TableRow>
            )}
            {rows.map((r) => (
              <TableRow key={r.terminalId}>
                <TableCell sx={{ fontWeight: 600 }}>{r.machineName || r.terminalId}</TableCell>
                <TableCell>{r.branchCode || "-"}</TableCell>
                <TableCell>{r.appVersion || "-"}</TableCell>
                <TableCell>{r.lastUser || "-"}</TableCell>
                <TableCell>{fmt(r.lastSeen)}</TableCell>
                <TableCell>
                  {r.settingsUnlocked ? (
                    <Chip size="small" color="warning" label={`Open${r.unlockedBy ? ` (by ${r.unlockedBy})` : ""}`} />
                  ) : (
                    <Chip size="small" variant="outlined" label="Locked after setup" />
                  )}
                  {r.settingsUsedAt && (
                    <Typography variant="caption" display="block" color="text.secondary">
                      Last changed {fmt(r.settingsUsedAt)}
                    </Typography>
                  )}
                </TableCell>
                <TableCell align="right">
                  {r.settingsUnlocked ? (
                    <Button size="small" disabled={busy === r.terminalId} onClick={() => setUnlocked(r, false)}>
                      Lock
                    </Button>
                  ) : (
                    <Button size="small" variant="outlined" disabled={busy === r.terminalId} onClick={() => setUnlocked(r, true)}>
                      Allow settings changes
                    </Button>
                  )}
                </TableCell>
                <TableCell>
                  {r.ratesUnlocked ? (
                    <Chip size="small" color="warning" label={`Can change${r.ratesUnlockedBy ? ` (by ${r.ratesUnlockedBy})` : ""}`} />
                  ) : (
                    <Chip size="small" variant="outlined" label="View only" />
                  )}
                </TableCell>
                <TableCell align="right">
                  {r.ratesUnlocked ? (
                    <Button size="small" disabled={busy === r.terminalId || !ratesInstalled} onClick={() => setUnlocked(r, false, "rates")}>
                      Lock rates
                    </Button>
                  ) : (
                    <Button size="small" variant="outlined" disabled={busy === r.terminalId || !ratesInstalled} onClick={() => setUnlocked(r, true, "rates")}>
                      Allow rate changes
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
};

export default WeighbridgePcsPage;
