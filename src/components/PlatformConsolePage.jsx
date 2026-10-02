import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Box, Typography, Paper, Button, Alert, CircularProgress, Chip, Tabs, Tab, TextField,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, InputAdornment,
  Dialog, DialogTitle, DialogContent, DialogActions, DialogContentText, Snackbar,
  FormControlLabel, Switch, Tooltip, IconButton,
} from "@mui/material";
import {
  Refresh as RefreshIcon,
  Search as SearchIcon,
  Logout as SignOutIcon,
  Block as BlockIcon,
  CheckCircle as EnableIcon,
  PauseCircle as SuspendIcon,
  PlayCircle as ActivateIcon,
  PersonRemove as RemoveIcon,
  AdminPanelSettings as AdminIcon,
} from "@mui/icons-material";

// Platform Console: operators who look after every tenant. The server only answers for users
// in nexsoldb.platform_admin (see server-postgres docs/workflows/PLATFORM-CONSOLE-RUNBOOK.md).

const BASE = "/api/platform";

async function api(path, { method = "GET", body } = {}) {
  const token = localStorage.getItem("jwtToken");
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try { data = await res.json(); } catch { /* empty body */ }
  if (res.status === 403) throw new Error("Only platform admins can use this page.");
  if (!res.ok || data?.success === false) throw new Error(data?.message || data?.error || `Request failed (${res.status})`);
  return data;
}

function ago(ts) {
  if (!ts) return "never";
  const s = Math.max(0, (Date.now() - new Date(ts).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return `${Math.floor(s / 86400)} d ago`;
}

function when(ts) {
  return ts ? new Date(ts).toLocaleString() : "";
}

function device(ua, clientType) {
  if (!ua) return clientType === "WEB" ? "Browser" : "App";
  if (ua.includes("Electron/")) return "POS app";
  if (ua.startsWith("TradeLink247-Weighbridge")) return "Weighbridge app";
  if (ua === "Mozilla/5.0") return "Desktop app";
  const browser = /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox"
    : /Safari\//.test(ua) ? "Safari" : clientType === "WEB" ? "Browser" : "App";
  const os = /Android/.test(ua) ? "Android" : /iPhone|iPad/.test(ua) ? "iOS" : /Windows/.test(ua) ? "Windows"
    : /Mac OS/.test(ua) ? "Mac" : /Linux/.test(ua) ? "Linux" : "";
  return os ? `${browser} on ${os}` : browser;
}

function company(row) {
  return row.companyName && row.companyName !== row.tenantId ? row.companyName : "";
}

function Stat({ label, value, color }) {
  return (
    <Paper variant="outlined" sx={{ p: 1.5, flex: "1 1 140px", minWidth: 0 }}>
      <Typography sx={{ fontSize: 12, color: "text.secondary" }}>{label}</Typography>
      <Typography sx={{ fontSize: 24, fontWeight: 700, color: color || "text.primary" }}>{value ?? "–"}</Typography>
    </Paper>
  );
}

function SearchBox({ value, onChange, placeholder }) {
  return (
    <TextField
      size="small"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      sx={{ width: { xs: "100%", sm: 320 } }}
      InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
    />
  );
}

const cellSx = { whiteSpace: "nowrap" };

export default function PlatformConsolePage() {
  const [tab, setTab] = useState(0);
  const [overview, setOverview] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [users, setUsers] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [admins, setAdmins] = useState([]);
  const [audit, setAudit] = useState([]);
  const [includeClosed, setIncludeClosed] = useState(false);
  const [filter, setFilter] = useState("");
  const [tenantFilter, setTenantFilter] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState(null);
  const [confirm, setConfirm] = useState(null); // { title, text, action, danger, needsReason }
  const [reason, setReason] = useState("");
  const [newAdmin, setNewAdmin] = useState("");
  const me = useMemo(() => {
    try {
      const p = JSON.parse(atob(localStorage.getItem("jwtToken").split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
      return { username: p.sub, tenantId: p.activeTenant || p.tenant };
    } catch { return {}; }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [o, s, u, t, a, au] = await Promise.all([
        api("/overview"),
        api(`/sessions?includeClosed=${includeClosed}`),
        api("/users"),
        api("/tenants"),
        api("/admins"),
        api("/audit?limit=200"),
      ]);
      setOverview(o); setSessions(s); setUsers(u); setTenants(t); setAdmins(a); setAudit(au);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [includeClosed]);

  useEffect(() => { load(); }, [load]);

  const ask = (c) => { setReason(""); setConfirm(c); };

  const runConfirmed = async () => {
    const c = confirm;
    setConfirm(null);
    try {
      const msg = await c.action(reason.trim());
      setToast(msg);
      load();
    } catch (e) {
      setError(e.message);
    }
  };

  const match = (row, keys) => {
    const f = filter.trim().toLowerCase();
    const okText = !f || keys.some((k) => String(row[k] ?? "").toLowerCase().includes(f));
    const okTenant = !tenantFilter || row.tenantId === tenantFilter;
    return okText && okTenant;
  };

  const shownSessions = sessions.filter((r) => match(r, ["username", "tenantId", "companyName", "ipAddress"]));
  const shownUsers = users.filter((r) => match(r, ["username", "email", "phone", "tenantId", "companyName"]));
  const shownTenants = tenants.filter((r) => match(r, ["tenantId", "companyName", "phone", "email"]));

  // ── Actions ────────────────────────────────────────────────────────────
  const signOutSession = (s) => ask({
    title: `Sign out ${s.username}?`,
    text: `Ends this ${device(s.userAgent, s.clientType)} sign-in. They can sign in again.`,
    needsReason: true,
    action: async (r) => { await api(`/sessions/${s.id}/sign-out`, { method: "POST", body: { reason: r } }); return `${s.username} signed out`; },
  });

  const signOutUser = (username) => ask({
    title: `Sign out ${username} everywhere?`,
    text: "Ends every browser and app sign-in of this user. They can sign in again.",
    needsReason: true,
    action: async (r) => {
      const d = await api("/users/sign-out", { method: "POST", body: { username, reason: r } });
      return `${username}: ${d.sessionsEnded} sign-in(s) ended`;
    },
  });

  const toggleUser = (u) => ask(u.disabled ? {
    title: `Enable ${u.username}?`,
    text: "They will be able to sign in again.",
    action: async (r) => { await api(`/users/${encodeURIComponent(u.id)}/enable`, { method: "POST", body: { reason: r } }); return `${u.username} enabled`; },
  } : {
    title: `Disable ${u.username}?`,
    text: "Signs them out everywhere and blocks sign-in. Their data is kept and you can enable them again.",
    danger: true,
    needsReason: true,
    action: async (r) => {
      const d = await api(`/users/${encodeURIComponent(u.id)}/disable`, { method: "POST", body: { reason: r } });
      return `${u.username} disabled, ${d.sessionsEnded} sign-in(s) ended`;
    },
  });

  const toggleTenant = (t) => ask(t.status === "SUSPENDED" ? {
    title: `Activate ${company(t) || t.tenantId}?`,
    text: "Users of this company can sign in again.",
    action: async (r) => { await api(`/tenants/${encodeURIComponent(t.tenantId)}/activate`, { method: "POST", body: { reason: r } }); return `${t.tenantId} activated`; },
  } : {
    title: `Suspend ${company(t) || t.tenantId}?`,
    text: `Signs out all ${t.users} user(s) of this company, including POS and weighbridge apps, and blocks sign-in until you activate it. No data is deleted.`,
    danger: true,
    needsReason: true,
    action: async (r) => {
      const d = await api(`/tenants/${encodeURIComponent(t.tenantId)}/suspend`, { method: "POST", body: { reason: r } });
      return `${t.tenantId} suspended, ${d.sessionsEnded} sign-in(s) ended`;
    },
  });

  const addAdmin = async () => {
    if (!newAdmin.trim()) return;
    try {
      await api("/admins", { method: "POST", body: { username: newAdmin.trim() } });
      setToast(`${newAdmin.trim()} is now a platform admin`);
      setNewAdmin("");
      load();
    } catch (e) { setError(e.message); }
  };

  const removeAdmin = (username) => ask({
    title: `Remove ${username} as platform admin?`,
    text: "They keep their normal account but lose this console.",
    action: async () => { await api(`/admins/${encodeURIComponent(username)}`, { method: "DELETE" }); return `${username} removed`; },
  });

  const viewTenant = (tenantId, toTab) => { setTenantFilter(tenantId); setFilter(""); setTab(toTab); };

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <Box sx={{ p: { xs: 1.5, sm: 3 }, width: "100%", maxWidth: 1400, minWidth: 0 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2, flexWrap: "wrap" }}>
        <AdminIcon color="primary" />
        <Typography variant="h5" sx={{ fontWeight: 700, flexGrow: 1 }}>Platform Console</Typography>
        <Button startIcon={loading ? <CircularProgress size={16} /> : <RefreshIcon />} onClick={load} disabled={loading}>
          Refresh
        </Button>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}

      <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap", mb: 2 }}>
        <Stat label="Companies" value={overview?.tenants} />
        <Stat label="Users" value={overview?.users} />
        <Stat label="Signed in now" value={overview?.openSessions} />
        <Stat label="Active last 15 min" value={overview?.activeLast15Min} color="success.main" />
        <Stat label="Suspended companies" value={overview?.suspendedTenants} color={overview?.suspendedTenants ? "warning.main" : undefined} />
        <Stat label="Disabled users" value={overview?.disabledUsers} color={overview?.disabledUsers ? "warning.main" : undefined} />
      </Box>

      <Paper variant="outlined">
        <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="scrollable" scrollButtons="auto">
          <Tab label="Signed in" />
          <Tab label="Users" />
          <Tab label="Companies" />
          <Tab label="Admins" />
          <Tab label="Audit" />
        </Tabs>

        {tab <= 2 && (
          <Box sx={{ display: "flex", gap: 1.5, alignItems: "center", flexWrap: "wrap", p: 1.5 }}>
            <SearchBox value={filter} onChange={setFilter} placeholder="Search name, phone, company…" />
            {tenantFilter && (
              <Chip label={`Company: ${tenantFilter}`} onDelete={() => setTenantFilter("")} />
            )}
            {tab === 0 && (
              <FormControlLabel
                control={<Switch size="small" checked={includeClosed} onChange={(e) => setIncludeClosed(e.target.checked)} />}
                label="Show ended sign-ins"
              />
            )}
            {tab === 0 && overview && (
              <Typography sx={{ fontSize: 12, color: "text.secondary" }}>
                Browsers sign out after {Math.round(overview.webIdleMinutes / 60)} h idle. Apps stay signed in until signed out here.
              </Typography>
            )}
          </Box>
        )}

        {tab === 0 && (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>User</TableCell>
                  <TableCell>Company</TableCell>
                  <TableCell>Device</TableCell>
                  <TableCell>Last active</TableCell>
                  <TableCell>Signed in</TableCell>
                  <TableCell>IP</TableCell>
                  <TableCell>State</TableCell>
                  <TableCell align="right" />
                </TableRow>
              </TableHead>
              <TableBody>
                {shownSessions.map((s) => (
                  <TableRow key={s.id} hover>
                    <TableCell sx={cellSx}>{s.username}</TableCell>
                    <TableCell sx={cellSx}>{company(s) || s.tenantId}{company(s) && <Typography component="span" sx={{ fontSize: 11, color: "text.secondary", ml: 0.5 }}>{s.tenantId}</Typography>}</TableCell>
                    <TableCell sx={cellSx}><Tooltip title={s.userAgent || ""}><span>{device(s.userAgent, s.clientType)}</span></Tooltip></TableCell>
                    <TableCell sx={cellSx}><Tooltip title={when(s.lastSeenAt)}><span>{ago(s.lastSeenAt)}</span></Tooltip></TableCell>
                    <TableCell sx={cellSx}>{when(s.createdAt)}</TableCell>
                    <TableCell sx={cellSx}>{s.ipAddress}</TableCell>
                    <TableCell sx={cellSx}>
                      {s.state === "OPEN" && <Chip size="small" color="success" label="Signed in" />}
                      {s.state === "EXPIRED" && <Chip size="small" label="Expired" />}
                      {s.state === "SIGNED_OUT" && (
                        <Tooltip title={`${s.revokeReason || ""}${s.revokedBy ? ` (by ${s.revokedBy})` : ""}`}>
                          <Chip size="small" variant="outlined" label="Signed out" />
                        </Tooltip>
                      )}
                    </TableCell>
                    <TableCell align="right" sx={cellSx}>
                      {s.state === "OPEN" && (
                        <Button size="small" color="warning" startIcon={<SignOutIcon />} onClick={() => signOutSession(s)}>
                          Sign out
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {!shownSessions.length && (
                  <TableRow><TableCell colSpan={8} sx={{ color: "text.secondary" }}>Nobody is signed in{filter || tenantFilter ? " that matches" : ""}.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}

        {tab === 1 && (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>User</TableCell>
                  <TableCell>Company</TableCell>
                  <TableCell>Phone / email</TableCell>
                  <TableCell>Signed in</TableCell>
                  <TableCell>Last active</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right" />
                </TableRow>
              </TableHead>
              <TableBody>
                {shownUsers.map((u) => (
                  <TableRow key={u.id} hover>
                    <TableCell sx={cellSx}>
                      {u.username}
                      {u.platformAdmin && <Chip size="small" color="primary" variant="outlined" label="Platform admin" sx={{ ml: 1 }} />}
                    </TableCell>
                    <TableCell sx={cellSx}>{company(u) || u.tenantId}</TableCell>
                    <TableCell sx={cellSx}>{[u.phone, u.email].filter(Boolean).join(" · ")}</TableCell>
                    <TableCell sx={cellSx}>{u.openSessions}</TableCell>
                    <TableCell sx={cellSx}>{ago(u.lastSeenAt)}</TableCell>
                    <TableCell sx={cellSx}>
                      {u.disabled
                        ? <Tooltip title={`${u.disabledReason || ""}${u.disabledBy ? ` (by ${u.disabledBy}, ${when(u.disabledAt)})` : ""}`}><Chip size="small" color="error" label="Disabled" /></Tooltip>
                        : <Chip size="small" variant="outlined" label="Active" />}
                    </TableCell>
                    <TableCell align="right" sx={cellSx}>
                      {u.openSessions > 0 && (
                        <Button size="small" color="warning" startIcon={<SignOutIcon />} onClick={() => signOutUser(u.username)}>
                          Sign out
                        </Button>
                      )}
                      {u.username !== me.username && (
                        <Button size="small" color={u.disabled ? "success" : "error"} startIcon={u.disabled ? <EnableIcon /> : <BlockIcon />} onClick={() => toggleUser(u)}>
                          {u.disabled ? "Enable" : "Disable"}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {!shownUsers.length && (
                  <TableRow><TableCell colSpan={7} sx={{ color: "text.secondary" }}>No users match.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}

        {tab === 2 && (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Company</TableCell>
                  <TableCell>Tenant id</TableCell>
                  <TableCell>Contact</TableCell>
                  <TableCell>Users</TableCell>
                  <TableCell>Signed in</TableCell>
                  <TableCell>Last active</TableCell>
                  <TableCell>Subscription</TableCell>
                  <TableCell align="right" />
                </TableRow>
              </TableHead>
              <TableBody>
                {shownTenants.map((t) => (
                  <TableRow key={t.tenantId} hover>
                    <TableCell sx={cellSx}>{company(t) || "—"}</TableCell>
                    <TableCell sx={cellSx}>{t.tenantId}</TableCell>
                    <TableCell sx={cellSx}>{[t.phone, t.email].filter(Boolean).join(" · ")}</TableCell>
                    <TableCell sx={cellSx}><Button size="small" onClick={() => viewTenant(t.tenantId, 1)}>{t.users}</Button></TableCell>
                    <TableCell sx={cellSx}><Button size="small" onClick={() => viewTenant(t.tenantId, 0)}>{t.openSessions}</Button></TableCell>
                    <TableCell sx={cellSx}>{ago(t.lastSeenAt)}</TableCell>
                    <TableCell sx={cellSx}>
                      {t.status === "SUSPENDED"
                        ? <Tooltip title={`${t.reason || ""}${t.changedBy ? ` (by ${t.changedBy}, ${when(t.changedAt)})` : ""}`}><Chip size="small" color="error" label="Suspended" /></Tooltip>
                        : <Chip size="small" color="success" variant="outlined" label="Active" />}
                    </TableCell>
                    <TableCell align="right" sx={cellSx}>
                      {t.tenantId !== me.tenantId && (
                        <Button size="small" color={t.status === "SUSPENDED" ? "success" : "error"}
                          startIcon={t.status === "SUSPENDED" ? <ActivateIcon /> : <SuspendIcon />} onClick={() => toggleTenant(t)}>
                          {t.status === "SUSPENDED" ? "Activate" : "Suspend"}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {!shownTenants.length && (
                  <TableRow><TableCell colSpan={8} sx={{ color: "text.secondary" }}>No companies match.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}

        {tab === 3 && (
          <Box sx={{ p: 1.5 }}>
            <Typography sx={{ fontSize: 13, color: "text.secondary", mb: 1.5 }}>
              Platform admins see every company here and can sign users out, disable users and suspend companies.
            </Typography>
            <Box sx={{ display: "flex", gap: 1, mb: 2, flexWrap: "wrap" }}>
              <TextField size="small" label="Username" value={newAdmin} onChange={(e) => setNewAdmin(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addAdmin()} />
              <Button variant="contained" onClick={addAdmin} disabled={!newAdmin.trim()}>Add admin</Button>
            </Box>
            <Table size="small">
              <TableHead>
                <TableRow><TableCell>Username</TableCell><TableCell>Added by</TableCell><TableCell>Added</TableCell><TableCell /></TableRow>
              </TableHead>
              <TableBody>
                {admins.map((a) => (
                  <TableRow key={a.username}>
                    <TableCell>{a.username}</TableCell>
                    <TableCell>{a.addedBy}</TableCell>
                    <TableCell>{when(a.addedAt)}</TableCell>
                    <TableCell align="right">
                      {a.username.toLowerCase() !== (me.username || "").toLowerCase() && (
                        <IconButton size="small" onClick={() => removeAdmin(a.username)} title="Remove"><RemoveIcon fontSize="small" /></IconButton>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Box>
        )}

        {tab === 4 && (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow><TableCell>When</TableCell><TableCell>Who</TableCell><TableCell>Action</TableCell><TableCell>Target</TableCell><TableCell>Detail</TableCell></TableRow>
              </TableHead>
              <TableBody>
                {audit.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell sx={cellSx}>{when(a.at)}</TableCell>
                    <TableCell sx={cellSx}>{a.actor}</TableCell>
                    <TableCell sx={cellSx}>{a.action.replace(/_/g, " ").toLowerCase()}</TableCell>
                    <TableCell sx={cellSx}>{a.target}</TableCell>
                    <TableCell>{a.detail}</TableCell>
                  </TableRow>
                ))}
                {!audit.length && (
                  <TableRow><TableCell colSpan={5} sx={{ color: "text.secondary" }}>Nothing yet.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      <Dialog open={!!confirm} onClose={() => setConfirm(null)} maxWidth="xs" fullWidth>
        <DialogTitle>{confirm?.title}</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: confirm?.needsReason ? 2 : 0 }}>{confirm?.text}</DialogContentText>
          {confirm?.needsReason && (
            <TextField autoFocus fullWidth size="small" label="Reason (optional)" value={reason} onChange={(e) => setReason(e.target.value)} />
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirm(null)}>Cancel</Button>
          <Button variant="contained" color={confirm?.danger ? "error" : "primary"} onClick={runConfirmed}>Confirm</Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={!!toast} autoHideDuration={4000} onClose={() => setToast(null)} message={toast} />
    </Box>
  );
}
