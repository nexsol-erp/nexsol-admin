import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert, Box, Button, Chip, CircularProgress, Dialog, DialogActions,
  DialogContent, DialogTitle, Divider, FormControl, IconButton,
  InputLabel, MenuItem, Paper, Select, Tab, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, Tabs, TextField,
  Tooltip, Typography,
} from "@mui/material";
import AddIcon          from "@mui/icons-material/Add";
import DeleteIcon       from "@mui/icons-material/Delete";
import DownloadIcon     from "@mui/icons-material/Download";
import FolderOffIcon    from "@mui/icons-material/FolderOff";
import HistoryIcon      from "@mui/icons-material/History";
import UploadFileIcon   from "@mui/icons-material/UploadFile";
import BoltIcon         from "@mui/icons-material/Bolt";

const PLATFORMS     = ["WINDOWS", "LINUX", "MAC"];
const STATUSES      = ["OPTIONAL", "REQUIRED", "OBSOLETE"];
const RELEASE_TYPES = ["APPLICATION_UPDATE", "FULL_INSTALLER"];

const RELEASE_TYPE_LABEL = {
  APPLICATION_UPDATE: "App Update",
  FULL_INSTALLER:     "Full Installer",
};

const STATUS_COLOR = { OPTIONAL: "success", REQUIRED: "warning", OBSOLETE: "error" };

const fmt = (bytes) => {
  if (!bytes) return "—";
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
};

const fmtDate = (s) =>
  s ? new Date(s).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "—";

export default function VersionManagementPage() {
  const tenantId = localStorage.getItem("tenancyId") || "";
  const token    = localStorage.getItem("jwtToken")  || "";
  const headers  = { Authorization: `Bearer ${token}` };
  const jsonHdrs = { ...headers, "Content-Type": "application/json" };
  const user     = localStorage.getItem("userName") || "admin";

  const [platform,  setPlatform]  = useState("WINDOWS");
  const [versions,  setVersions]  = useState([]);
  const [patches,   setPatches]   = useState({});  // toVersion → {patchSize, savings%}
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState(null);
  const [success,   setSuccess]   = useState(null);

  // Upload dialog
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploading,  setUploading]  = useState(false);
  const [form, setForm] = useState({
    version: "", buildNumber: "", platform: "WINDOWS",
    status: "OPTIONAL", releaseNotes: "", releaseType: "APPLICATION_UPDATE",
  });
  const fileRef = useRef();
  const [selectedFile, setSelectedFile] = useState(null);

  // Status change confirm
  const [statusDlg, setStatusDlg] = useState({ open: false, version: null, next: "" });

  // Delete files confirm
  const [delFilesDlg, setDelFilesDlg] = useState({ open: false, version: null });

  // Delete entry confirm
  const [delEntryDlg, setDelEntryDlg] = useState({ open: false, version: null });

  // Audit drawer
  const [auditDlg, setAuditDlg] = useState({ open: false, versionId: null, logs: [] });

  // ── Load ─────────────────────────────────────────────────────────────────────

  const pollRef = useRef(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/${tenantId}/admin/pos-app/versions?platform=${platform}`,
        { headers }
      );
      if (!res.ok) throw new Error(`Load failed (${res.status})`);
      const data = await res.json();
      setVersions(data);

      // Load delta patch info for all versions
      const patchRes = await fetch(
        `/api/${tenantId}/admin/pos-app/patches?platform=${platform}`,
        { headers }
      );
      if (patchRes.ok) {
        const patchList = await patchRes.json();
        const patchMap = {};
        patchList.forEach(p => {
          if (!patchMap[p.toVersion] || p.patchSize < (patchMap[p.toVersion]?.patchSize ?? Infinity))
            patchMap[p.toVersion] = p;
        });
        setPatches(patchMap);
      }
    } catch (e) { setError(e.message); }
    finally { if (!silent) setLoading(false); }
  }, [platform, tenantId, token]);

  useEffect(() => { load(); }, [load]);

  // Auto-refresh: poll every 5 s while any delta is still generating
  useEffect(() => {
    if (pollRef.current) clearTimeout(pollRef.current);
    const hasPending = Object.values(patches).some(p => p.status === "PENDING");
    if (hasPending) pollRef.current = setTimeout(() => load(true), 5000);
    return () => { if (pollRef.current) clearTimeout(pollRef.current); };
  }, [patches, load]);

  // ── Upload ────────────────────────────────────────────────────────────────────

  const handleUpload = async () => {
    if (!form.version.trim()) { setError("Version is required"); return; }
    setUploading(true);
    try {
      const fd = new FormData();
      const meta = {
        version: form.version.trim(),
        buildNumber: form.buildNumber ? Number(form.buildNumber) : null,
        platform: form.platform,
        status: form.status,
        releaseType: form.releaseType,
        releaseNotes: form.releaseNotes,
      };
      fd.append("metadata", new Blob([JSON.stringify(meta)], { type: "application/json" }));
      if (selectedFile) fd.append("file", selectedFile);

      const res = await fetch(`/api/${tenantId}/admin/pos-app/versions`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "X-User": user },
        body: fd,
      });
      if (!res.ok) throw new Error(`Upload failed (${res.status})`);
      setSuccess(`Version ${form.version} created`);
      setUploadOpen(false);
      setForm({ version: "", buildNumber: "", platform: "WINDOWS", status: "OPTIONAL", releaseNotes: "", releaseType: "APPLICATION_UPDATE" });
      setSelectedFile(null);
      load();
    } catch (e) { setError(e.message); }
    finally { setUploading(false); }
  };

  // ── Status change ─────────────────────────────────────────────────────────────

  const confirmStatusChange = (v, next) => setStatusDlg({ open: true, version: v, next });

  const applyStatusChange = async () => {
    const { version, next } = statusDlg;
    setStatusDlg({ open: false, version: null, next: "" });
    try {
      const res = await fetch(
        `/api/${tenantId}/admin/pos-app/versions/${version.id}/status`,
        { method: "PUT", headers: { ...jsonHdrs, "X-User": user },
          body: JSON.stringify({ status: next }) }
      );
      if (!res.ok) throw new Error(`Status change failed (${res.status})`);
      setSuccess(`${version.version} → ${next}`);
      load();
    } catch (e) { setError(e.message); }
  };

  // ── Delete files ──────────────────────────────────────────────────────────────

  const applyDeleteFiles = async () => {
    const v = delFilesDlg.version;
    setDelFilesDlg({ open: false, version: null });
    if (v.status !== "OBSOLETE") { setError("Only OBSOLETE version files can be deleted."); return; }
    try {
      const res = await fetch(
        `/api/${tenantId}/admin/pos-app/versions/${v.id}/files`,
        { method: "DELETE", headers: { ...jsonHdrs, "X-User": user } }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || `Failed (${res.status})`);
      setSuccess(`Files deleted for v${data.version}${data.fileDeleted ? "" : " (no file on disk)"}`);
      load();
    } catch (e) { setError(e.message); }
  };

  // ── Delete entry ──────────────────────────────────────────────────────────────

  const applyDeleteEntry = async () => {
    const v = delEntryDlg.version;
    setDelEntryDlg({ open: false, version: null });
    try {
      const res = await fetch(
        `/api/${tenantId}/admin/pos-app/versions/${v.id}`,
        { method: "DELETE", headers: { ...jsonHdrs, "X-User": user } }
      );
      if (!res.ok) throw new Error(`Delete failed (${res.status})`);
      setSuccess(`Version ${v.version} removed`);
      load();
    } catch (e) { setError(e.message); }
  };

  // ── Download ──────────────────────────────────────────────────────────────────

  const [downloading,         setDownloading]         = useState(null);  // version id
  const [launcherDownloading, setLauncherDownloading] = useState(false);

  const downloadLauncher = async (filename) => {
    setLauncherDownloading(true);
    try {
      const res = await fetch(
        `/api/${tenantId}/admin/pos-app/launcher/download?file=${encodeURIComponent(filename)}`,
        { headers }
      );
      if (!res.ok) throw new Error(`Server returned ${res.status}`);
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href     = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(`Launcher download failed: ${e.message}`);
    } finally {
      setLauncherDownloading(false);
    }
  };

  const downloadVersion = async (v) => {
    setDownloading(v.id);
    try {
      const res = await fetch(
        `/api/${tenantId}/admin/pos-app/versions/${v.id}/download`,
        { headers }
      );
      if (!res.ok) throw new Error(`Server returned ${res.status}`);
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href     = url;
      a.download = v.fileName || `TradeLink247-POS-${v.version}.exe`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(`Download failed for v${v.version}: ${e.message}`);
    } finally {
      setDownloading(null);
    }
  };

  // ── Audit ─────────────────────────────────────────────────────────────────────

  const openAudit = async (v) => {
    try {
      const res = await fetch(
        `/api/${tenantId}/admin/pos-app/versions/${v.id}/audit`, { headers }
      );
      const logs = res.ok ? await res.json() : [];
      setAuditDlg({ open: true, versionId: v.id, version: v.version, logs });
    } catch { setAuditDlg({ open: true, versionId: v.id, version: v.version, logs: [] }); }
  };

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h5" gutterBottom>POS Electron Version Management</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Manage POS Electron release versions. Control whether updates are Optional, Required, or
        mark versions as Obsolete. Only Obsolete version files can be deleted from the server.
      </Typography>

      {error   && <Alert severity="error"   sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>{success}</Alert>}

      {/* Toolbar */}
      <Box sx={{ display: "flex", gap: 2, mb: 2, alignItems: "center" }}>
        <Tabs value={platform} onChange={(_, v) => setPlatform(v)} sx={{ minHeight: 36 }}>
          {PLATFORMS.map(p => <Tab key={p} label={p} value={p} sx={{ minHeight: 36, py: 0 }} />)}
        </Tabs>
        {Object.values(patches).some(p => p.status === "PENDING") && (
          <Tooltip title="Delta patches are being generated — refreshing automatically">
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, color: "text.secondary" }}>
              <CircularProgress size={14} thickness={5} />
              <Typography variant="caption">Generating deltas…</Typography>
            </Box>
          </Tooltip>
        )}
        <Box sx={{ flex: 1 }} />
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setUploadOpen(true)}>
          Add Version
        </Button>
      </Box>

      {/* Launcher download card */}
      <Paper elevation={1} sx={{ p: 2, mb: 2, bgcolor: "#f0f7ff", border: "1px solid #bfdbfe" }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 2, flexWrap: "wrap" }}>
          <Box sx={{ flex: 1 }}>
            <Typography variant="subtitle1" fontWeight={600}>
              TradeLink247 POS Launcher
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Permanent entry point for end users. Installed once — handles all future POS updates automatically via delta patches.
            </Typography>
          </Box>
          <Box sx={{ display: "flex", gap: 1, flexShrink: 0 }}>
            <Button
              variant="outlined"
              size="small"
              startIcon={launcherDownloading ? <CircularProgress size={14} /> : <DownloadIcon />}
              disabled={launcherDownloading}
              onClick={() => downloadLauncher("TradeLink247-POS-Launcher.exe")}
            >
              Portable (.exe)
            </Button>
            <Button
              variant="contained"
              size="small"
              startIcon={launcherDownloading ? <CircularProgress size={14} /> : <DownloadIcon />}
              disabled={launcherDownloading}
              onClick={() => downloadLauncher("TradeLink247-POS-Launcher-Setup.exe")}
            >
              Installer (.exe)
            </Button>
          </Box>
        </Box>
      </Paper>

      {/* Main table */}
      {loading ? (
        <Box sx={{ textAlign: "center", py: 5 }}><CircularProgress /></Box>
      ) : (
        <Paper elevation={2}>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: "#f8fafc" }}>
                  {["Version","Build","Platform","Type","Status","File Name","File Size",
                    "Delta Patch","Uploaded By","Uploaded Date","Actions"].map(h => (
                    <TableCell key={h}><strong>{h}</strong></TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {versions.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={12} align="center" sx={{ py: 4, color: "text.secondary" }}>
                      No versions found for {platform}
                    </TableCell>
                  </TableRow>
                )}
                {versions.map(v => (
                  <TableRow key={v.id}
                    sx={{ opacity: v.isFileDeleted ? 0.6 : 1,
                          bgcolor: v.isFileDeleted ? "#fef2f2" : "inherit" }}>
                    <TableCell><strong>{v.version}</strong></TableCell>
                    <TableCell>{v.buildNumber ?? "—"}</TableCell>
                    <TableCell>{v.platform}</TableCell>
                    <TableCell>
                      <Chip
                        label={RELEASE_TYPE_LABEL[v.releaseType] || v.releaseType || "App Update"}
                        size="small"
                        variant="outlined"
                        color={v.releaseType === "FULL_INSTALLER" ? "secondary" : "primary"}
                      />
                    </TableCell>
                    <TableCell>
                      <FormControl size="small" sx={{ minWidth: 130 }}>
                        <Select
                          value={v.status || "OPTIONAL"}
                          onChange={e => confirmStatusChange(v, e.target.value)}
                          renderValue={val => (
                            <Chip label={val} size="small"
                              color={STATUS_COLOR[val] || "default"} />
                          )}
                        >
                          {STATUSES.map(s => (
                            <MenuItem key={s} value={s}>
                              <Chip label={s} size="small" color={STATUS_COLOR[s] || "default"} />
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </TableCell>
                    <TableCell sx={{ fontSize: 12, color: "text.secondary", maxWidth: 180,
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {v.isFileDeleted
                        ? <Chip label="File deleted" size="small" color="error" variant="outlined" />
                        : (v.fileName || "—")}
                    </TableCell>
                    <TableCell>{fmt(v.fileSize)}</TableCell>
                    <TableCell>
                      {(() => {
                        const p = patches[v.version];
                        if (!p) return <Typography variant="caption" color="text.disabled">—</Typography>;
                        if (p.status === "PENDING") return <Chip icon={<BoltIcon />} label="Generating…" size="small" variant="outlined" />;
                        if (p.status === "FAILED")  return <Chip label="Failed" size="small" color="error" variant="outlined" />;
                        const saving = v.fileSize ? Math.round(100 - (100 * p.patchSize / v.fileSize)) : null;
                        return (
                          <Tooltip title={`Smallest available delta patch: ${fmt(p.patchSize)}`}>
                            <Chip
                              icon={<BoltIcon />}
                              label={saving != null ? `${fmt(p.patchSize)} (−${saving}%)` : fmt(p.patchSize)}
                              size="small"
                              color="success"
                              variant="outlined"
                            />
                          </Tooltip>
                        );
                      })()}
                    </TableCell>
                    <TableCell sx={{ fontSize: 12 }}>{v.uploadedBy || "—"}</TableCell>
                    <TableCell sx={{ fontSize: 12, whiteSpace: "nowrap" }}>
                      {fmtDate(v.uploadedAt)}
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: "flex", gap: 0.5 }}>
                        <Tooltip title="Audit log">
                          <IconButton size="small" onClick={() => openAudit(v)}>
                            <HistoryIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        {!v.isFileDeleted && v.filePath && (
                          <Tooltip title={downloading === v.id ? "Downloading…" : `Download ${v.fileName || "exe"}`}>
                            <span>
                              <IconButton size="small" color="primary"
                                disabled={downloading === v.id}
                                onClick={() => downloadVersion(v)}>
                                {downloading === v.id
                                  ? <CircularProgress size={16} />
                                  : <DownloadIcon fontSize="small" />}
                              </IconButton>
                            </span>
                          </Tooltip>
                        )}
                        {v.status === "OBSOLETE" && !v.isFileDeleted && (
                          <Tooltip title="Delete installer files from server">
                            <IconButton size="small" color="warning"
                              onClick={() => setDelFilesDlg({ open: true, version: v })}>
                              <FolderOffIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                        <Tooltip title="Remove version entry">
                          <IconButton size="small" color="error"
                            onClick={() => setDelEntryDlg({ open: true, version: v })}>
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}

      {/* ── Upload dialog ─────────────────────────────────────────────────── */}
      <Dialog open={uploadOpen} onClose={() => setUploadOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add Version</DialogTitle>
        <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 2 }}>
          <Box sx={{ display: "flex", gap: 2 }}>
            <TextField label="Version *" size="small" sx={{ flex: 1 }}
              value={form.version}
              onChange={e => setForm(p => ({ ...p, version: e.target.value }))}
              placeholder="e.g. 2.1.8" />
            <TextField label="Build Number" size="small" type="number" sx={{ flex: 1 }}
              value={form.buildNumber}
              onChange={e => setForm(p => ({ ...p, buildNumber: e.target.value }))} />
          </Box>
          <Box sx={{ display: "flex", gap: 2 }}>
            <FormControl size="small" sx={{ flex: 1 }}>
              <InputLabel>Platform</InputLabel>
              <Select value={form.platform} label="Platform"
                onChange={e => setForm(p => ({ ...p, platform: e.target.value }))}>
                {PLATFORMS.map(pl => <MenuItem key={pl} value={pl}>{pl}</MenuItem>)}
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ flex: 1 }}>
              <InputLabel>Status</InputLabel>
              <Select value={form.status} label="Status"
                onChange={e => setForm(p => ({ ...p, status: e.target.value }))}>
                {STATUSES.map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
              </Select>
            </FormControl>
          </Box>
          <FormControl size="small" fullWidth>
            <InputLabel>Release Type</InputLabel>
            <Select value={form.releaseType} label="Release Type"
              onChange={e => setForm(p => ({ ...p, releaseType: e.target.value }))}>
              <MenuItem value="APPLICATION_UPDATE">
                Application Update — upload pos-electron.exe only (~80% smaller)
              </MenuItem>
              <MenuItem value="FULL_INSTALLER">
                Full Installer — includes Launcher, runtime, and all dependencies
              </MenuItem>
            </Select>
          </FormControl>
          <TextField label="Release Notes" size="small" multiline rows={3}
            value={form.releaseNotes}
            onChange={e => setForm(p => ({ ...p, releaseNotes: e.target.value }))}
            placeholder="What's new in this version…" />
          <Box>
            <input ref={fileRef} type="file" accept=".exe,.dmg,.deb,.AppImage"
              style={{ display: "none" }}
              onChange={e => setSelectedFile(e.target.files[0] || null)} />
            <Button variant="outlined" startIcon={<UploadFileIcon />}
              onClick={() => fileRef.current.click()}>
              {selectedFile ? selectedFile.name
                : form.releaseType === "FULL_INSTALLER"
                  ? "Choose full installer (optional)"
                  : "Choose pos-electron.exe (optional)"}
            </Button>
            {selectedFile && (
              <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                {fmt(selectedFile.size)}
              </Typography>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setUploadOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleUpload}
            disabled={uploading || !form.version.trim()}
            startIcon={uploading ? <CircularProgress size={16} /> : <AddIcon />}>
            {uploading ? "Uploading…" : "Create"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Status change confirm ─────────────────────────────────────────── */}
      <Dialog open={statusDlg.open} onClose={() => setStatusDlg({ open: false, version: null, next: "" })}>
        <DialogTitle>Confirm Status Change</DialogTitle>
        <DialogContent>
          {statusDlg.version && (
            <Typography>
              Change <strong>v{statusDlg.version.version}</strong> from{" "}
              <Chip label={statusDlg.version.status} size="small"
                color={STATUS_COLOR[statusDlg.version.status]} /> to{" "}
              <Chip label={statusDlg.next} size="small"
                color={STATUS_COLOR[statusDlg.next] || "default"} />?
              {statusDlg.next === "OBSOLETE" && (
                <Alert severity="warning" sx={{ mt: 2 }}>
                  Marking as OBSOLETE will force all clients on this version to update.
                  Installer files can then be deleted separately.
                </Alert>
              )}
              {statusDlg.next === "REQUIRED" && (
                <Alert severity="info" sx={{ mt: 2 }}>
                  Marking as REQUIRED will block POS clients until they install this update.
                </Alert>
              )}
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setStatusDlg({ open: false, version: null, next: "" })}>Cancel</Button>
          <Button variant="contained" color={STATUS_COLOR[statusDlg.next] || "primary"}
            onClick={applyStatusChange}>Confirm</Button>
        </DialogActions>
      </Dialog>

      {/* ── Delete files confirm ──────────────────────────────────────────── */}
      <Dialog open={delFilesDlg.open}
        onClose={() => setDelFilesDlg({ open: false, version: null })}>
        <DialogTitle>Delete Installer Files</DialogTitle>
        <DialogContent>
          <Alert severity="error" sx={{ mb: 2 }}>
            This will permanently delete the installer/update package from the server.
          </Alert>
          {delFilesDlg.version && (
            <Typography>
              Delete files for <strong>v{delFilesDlg.version.version}</strong>?
              <br /><br />
              File: <code>{delFilesDlg.version.fileName || "—"}</code>
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDelFilesDlg({ open: false, version: null })}>Cancel</Button>
          <Button variant="contained" color="error" startIcon={<FolderOffIcon />}
            onClick={applyDeleteFiles}>Delete Files</Button>
        </DialogActions>
      </Dialog>

      {/* ── Delete entry confirm ──────────────────────────────────────────── */}
      <Dialog open={delEntryDlg.open}
        onClose={() => setDelEntryDlg({ open: false, version: null })}>
        <DialogTitle>Remove Version Entry</DialogTitle>
        <DialogContent>
          {delEntryDlg.version && (
            <Typography>
              Remove <strong>v{delEntryDlg.version.version}</strong> from the version list?
              {!delEntryDlg.version.isFileDeleted && delEntryDlg.version.fileName && (
                <Alert severity="warning" sx={{ mt: 2 }}>
                  The installer file is still on disk. Mark as OBSOLETE and delete files first
                  if you want to remove the physical file.
                </Alert>
              )}
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDelEntryDlg({ open: false, version: null })}>Cancel</Button>
          <Button variant="contained" color="error" startIcon={<DeleteIcon />}
            onClick={applyDeleteEntry}>Remove</Button>
        </DialogActions>
      </Dialog>

      {/* ── Audit log dialog ──────────────────────────────────────────────── */}
      <Dialog open={auditDlg.open} onClose={() => setAuditDlg({ open: false, logs: [] })}
        maxWidth="md" fullWidth>
        <DialogTitle>Audit Log — v{auditDlg.version}</DialogTitle>
        <DialogContent>
          {auditDlg.logs.length === 0 ? (
            <Typography color="text.secondary" sx={{ py: 2, textAlign: "center" }}>
              No audit records found
            </Typography>
          ) : (
            <Table size="small">
              <TableHead>
                <TableRow>
                  {["Action","From","To","By","Date","Notes"].map(h => (
                    <TableCell key={h}><strong>{h}</strong></TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {auditDlg.logs.map(l => (
                  <TableRow key={l.id}>
                    <TableCell><Chip label={l.action} size="small" /></TableCell>
                    <TableCell>
                      {l.previousStatus
                        ? <Chip label={l.previousStatus} size="small"
                            color={STATUS_COLOR[l.previousStatus] || "default"} />
                        : "—"}
                    </TableCell>
                    <TableCell>
                      {l.newStatus
                        ? <Chip label={l.newStatus} size="small"
                            color={STATUS_COLOR[l.newStatus] || "default"} />
                        : "—"}
                    </TableCell>
                    <TableCell>{l.performedBy}</TableCell>
                    <TableCell sx={{ whiteSpace: "nowrap", fontSize: 12 }}>
                      {fmtDate(l.performedAt)}
                    </TableCell>
                    <TableCell sx={{ fontSize: 12, color: "text.secondary" }}>{l.notes}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAuditDlg({ open: false, logs: [] })}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
