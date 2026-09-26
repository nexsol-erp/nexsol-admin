// ProviderSetup.jsx
// Pick a tax authority provider, save its setup (environment, tax number, settings), store its
// credentials and test the connection. Credential values are sent once and never shown again:
// the server encrypts them and only ever answers "present".
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert, Box, Button, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle,
  FormControlLabel, Grid, MenuItem, Stack, Switch, Table, TableBody, TableCell, TableHead, TableRow,
  TextField, Typography,
} from "@mui/material";
import {
  formatDateTime, listConfigs, listProviders, onboard, readiness, removeCredential, saveConfig, setCredential,
  testConnection,
} from "./regulatoryApi";

const certColor = (s) => (s === "VALID" ? "success" : s === "EXPIRED" || s === "NOT_YET_VALID" ? "error" : "warning");
const READY_COLORS = { READY: "success", WARNING: "warning", NOT_READY: "error" };
const READY_LABELS = { READY: "Ready", WARNING: "Warning", NOT_READY: "Not ready", NOT_CHECKED: "Not checked" };
const readyLabel = (s) => READY_LABELS[s] || s;

const emptyForm = (provider, config) => ({
  environment: config?.environment || (provider.environments.includes("SANDBOX") ? "SANDBOX" : provider.environments[0] || ""),
  enabled: config ? config.enabled : false,
  processingMode: config?.processingMode || "SYNCHRONOUS",
  taxRegistrationNumber: config?.taxRegistrationNumber || "",
  legalName: config?.legalName || "",
  settings: { ...(config?.settings || {}) },
});

const ProviderSetup = () => {
  const [providers, setProviders] = useState([]);
  const [configs, setConfigs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const [p, c] = await Promise.all([listProviders(), listConfigs()]);
    if (!p.ok || !c.ok) setError(p.message || c.message);
    else setError("");
    setProviders(p.data || []);
    setConfigs(c.data || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const configFor = useCallback((code) => configs.find((c) => c.providerCode === code), [configs]);
  const provider = providers.find((p) => p.providerCode === selected);

  if (loading) {
    return (
      <Box textAlign="center" py={4}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Provider</TableCell>
            <TableCell>Country</TableCell>
            <TableCell>Environment</TableCell>
            <TableCell>Status</TableCell>
            <TableCell>Last connection test</TableCell>
            <TableCell />
          </TableRow>
        </TableHead>
        <TableBody>
          {providers.map((p) => {
            const c = configFor(p.providerCode);
            return (
              <TableRow key={p.providerCode} selected={p.providerCode === selected} hover>
                <TableCell>{p.displayName}</TableCell>
                <TableCell>{p.countryCode}</TableCell>
                <TableCell>{c?.environment || "-"}</TableCell>
                <TableCell>
                  {!c ? (
                    <Chip size="small" label="Not set up" />
                  ) : c.missingCredentials?.length ? (
                    <Chip size="small" color="warning" label={`${c.missingCredentials.length} credential(s) missing`} />
                  ) : (
                    <Chip size="small" color={c.enabled ? "success" : "default"} label={c.enabled ? "Enabled" : "Disabled"} />
                  )}
                </TableCell>
                <TableCell>
                  {c?.lastTestAt ? `${formatDateTime(c.lastTestAt)} - ${c.lastTestOk ? "OK" : "Failed"}` : "-"}
                </TableCell>
                <TableCell align="right">
                  <Button size="small" onClick={() => setSelected(p.providerCode)}>
                    {c ? "Manage" : "Set up"}
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
          {providers.length === 0 && (
            <TableRow>
              <TableCell colSpan={6}>No providers are installed on the server.</TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      {provider && (
        <ProviderDetail
          key={provider.providerCode}
          provider={provider}
          config={configFor(provider.providerCode)}
          onChanged={load}
        />
      )}
    </Box>
  );
};

const ProviderDetail = ({ provider, config, onChanged }) => {
  const [form, setForm] = useState(() => emptyForm(provider, config));
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState(null);

  const save = async () => {
    setSaving(true);
    const r = await saveConfig(provider.providerCode, { countryCode: provider.countryCode, ...form });
    setSaving(false);
    setNotice(r.ok ? { severity: "success", text: "Setup saved." } : { severity: "error", text: r.message });
    if (r.ok) onChanged();
  };

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));
  const setSetting = (key) => (e) => setForm((f) => ({ ...f, settings: { ...f.settings, [key]: e.target.value } }));

  return (
    <Box mt={3}>
      <Typography variant="h6" gutterBottom>
        {provider.displayName} ({provider.countryCode})
      </Typography>
      {notice && <Alert severity={notice.severity} sx={{ mb: 2 }} onClose={() => setNotice(null)}>{notice.text}</Alert>}
      {provider.endpointsConfigured && !provider.endpointsConfigured.includes(form.environment) && provider.providerCode !== "MOCK" && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          The server has no {form.environment} address for this provider yet, so submissions will fail until it is added
          to the server configuration.
        </Alert>
      )}
      <Grid container spacing={2}>
        <Grid item xs={12} sm={4}>
          <TextField select fullWidth size="small" label="Environment" value={form.environment} onChange={set("environment")}>
            {provider.environments.map((e) => (
              <MenuItem key={e} value={e}>{e === "SANDBOX" ? "Sandbox (testing)" : "Production (live)"}</MenuItem>
            ))}
          </TextField>
        </Grid>
        <Grid item xs={12} sm={4}>
          <TextField select fullWidth size="small" label="Processing" value={form.processingMode} onChange={set("processingMode")}>
            <MenuItem value="SYNCHRONOUS">Immediately</MenuItem>
            <MenuItem value="ASYNCHRONOUS">In the background</MenuItem>
          </TextField>
        </Grid>
        <Grid item xs={12} sm={4}>
          <FormControlLabel
            control={<Switch checked={form.enabled} onChange={(e) => setForm((f) => ({ ...f, enabled: e.target.checked }))} />}
            label="Enabled"
          />
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField fullWidth size="small" label="Tax registration number" value={form.taxRegistrationNumber} onChange={set("taxRegistrationNumber")} />
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField fullWidth size="small" label="Legal name" value={form.legalName} onChange={set("legalName")} />
        </Grid>
        {(provider.settingKeys || []).map((k) => (
          <Grid item xs={12} sm={4} key={k}>
            <TextField fullWidth size="small" label={k} value={form.settings[k] || ""} onChange={setSetting(k)} />
          </Grid>
        ))}
      </Grid>
      <Box mt={2}>
        <Button variant="contained" onClick={save} disabled={saving}>
          {saving ? "Saving..." : "Save setup"}
        </Button>
      </Box>

      {config ? (
        <>
          {provider.capabilities?.includes("ONBOARDING") && (
            <Onboarding provider={provider} config={config} onChanged={onChanged} />
          )}
          <Credentials provider={provider} config={config} onChanged={onChanged} />
          <ConnectionAndReadiness provider={provider} config={config} onChanged={onChanged} />
        </>
      ) : (
        <Alert severity="info" sx={{ mt: 3 }}>Save the setup first, then add the credentials.</Alert>
      )}
    </Box>
  );
};

const Credentials = ({ provider, config, onChanged }) => {
  const [editing, setEditing] = useState(null); // credential key being set
  const [newKey, setNewKey] = useState("");
  const [notice, setNotice] = useState(null);

  const rows = useMemo(() => {
    const byKey = new Map((config.credentials || []).map((c) => [c.key, c]));
    (provider.requiredCredentials || []).forEach((k) => {
      if (!byKey.has(k)) byKey.set(k, { key: k, present: false, required: true });
    });
    return [...byKey.values()];
  }, [config, provider]);

  const remove = async (key) => {
    if (!window.confirm(`Remove the credential "${key}"? Submissions will fail until it is set again.`)) return;
    const r = await removeCredential(provider.providerCode, key);
    setNotice(r.ok ? { severity: "success", text: `Removed ${key}.` } : { severity: "error", text: r.message });
    if (r.ok) onChanged();
  };

  const addOther = () => {
    const k = newKey.trim();
    if (!/^[a-z][a-z0-9_]{0,99}$/.test(k)) {
      setNotice({ severity: "error", text: "Credential names are lower case letters, digits and underscores, starting with a letter." });
      return;
    }
    setNewKey("");
    setEditing(k);
  };

  return (
    <Box mt={4}>
      <Typography variant="h6">Credentials</Typography>
      <Typography variant="body2" color="text.secondary" mb={1}>
        Stored encrypted on the server. Once saved, a value is never shown again; replace it to change it.
      </Typography>
      {notice && <Alert severity={notice.severity} sx={{ mb: 2 }} onClose={() => setNotice(null)}>{notice.text}</Alert>}
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Name</TableCell>
            <TableCell>Status</TableCell>
            <TableCell>Certificate</TableCell>
            <TableCell>Last changed</TableCell>
            <TableCell />
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((c) => (
            <TableRow key={c.key}>
              <TableCell>
                {c.key}
                {c.required && <Typography component="span" color="text.secondary" variant="caption"> (required)</Typography>}
              </TableCell>
              <TableCell>
                <Chip size="small" color={c.present ? "success" : "warning"} label={c.present ? "Saved" : "Missing"} />
              </TableCell>
              <TableCell>
                {c.certificate ? (
                  <Chip
                    size="small"
                    color={certColor(c.certificateStatus)}
                    label={`Valid to ${formatDateTime(c.certificate.validTo).slice(0, 10)}`}
                  />
                ) : (
                  "-"
                )}
              </TableCell>
              <TableCell>{c.updatedAt ? `${formatDateTime(c.updatedAt)} by ${c.updatedBy || "-"}` : "-"}</TableCell>
              <TableCell align="right">
                <Button size="small" onClick={() => setEditing(c.key)}>{c.present ? "Replace" : "Set"}</Button>
                {c.present && (
                  <Button size="small" color="error" onClick={() => remove(c.key)}>Remove</Button>
                )}
              </TableCell>
            </TableRow>
          ))}
          {rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={5}>This provider needs no credentials.</TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
      <Stack direction="row" spacing={1} mt={2} alignItems="center">
        <TextField size="small" label="Other credential name" value={newKey} onChange={(e) => setNewKey(e.target.value)} />
        <Button onClick={addOther} disabled={!newKey.trim()}>Add</Button>
      </Stack>

      {editing && (
        <CredentialDialog
          provider={provider}
          credentialKey={editing}
          onClose={() => setEditing(null)}
          onSaved={(text) => {
            setEditing(null);
            setNotice({ severity: "success", text });
            onChanged();
          }}
        />
      )}
    </Box>
  );
};

const CredentialDialog = ({ provider, credentialKey, onClose, onSaved }) => {
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const multiline = /certificate|private_key|pem|csr/.test(credentialKey);

  const save = async () => {
    setSaving(true);
    const r = await setCredential(provider.providerCode, credentialKey, value);
    setSaving(false);
    if (!r.ok) {
      setError(r.message);
      return;
    }
    setValue("");
    const cert = r.data?.certificate;
    onSaved(cert ? `Saved ${credentialKey}. Certificate valid to ${formatDateTime(cert.validTo).slice(0, 10)}.` : `Saved ${credentialKey}.`);
  };

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Set {credentialKey}</DialogTitle>
      <DialogContent>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        <TextField
          autoFocus
          fullWidth
          margin="dense"
          label="Value"
          type={multiline ? "text" : "password"}
          multiline={multiline}
          minRows={multiline ? 6 : undefined}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          autoComplete="new-password"
          inputProps={{ spellCheck: false, style: multiline ? { fontFamily: "monospace", fontSize: 12 } : undefined }}
          helperText={multiline ? "Paste the PEM text, including the BEGIN and END lines." : "It will not be shown again after saving."}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={save} disabled={saving || !value.trim()}>
          {saving ? "Saving..." : "Save"}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// Providers that fetch their own credentials (ZATCA: OTP -> compliance checks -> production
// certificate). The OTP is used once and never stored; the server lists each step it took.
const Onboarding = ({ provider, config, onChanged }) => {
  const [otp, setOtp] = useState("");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState(null);
  const sandbox = config.environment === "SANDBOX" && !config.settings?.endpointVariant;

  const run = async () => {
    setRunning(true);
    setResult(null);
    const r = await onboard(provider.providerCode, otp.trim() ? { otp: otp.trim() } : {});
    setRunning(false);
    setResult(r.ok ? r.data : { ok: false, message: r.message, steps: [] });
    setOtp("");
    onChanged();
  };

  return (
    <Box mt={4}>
      <Typography variant="h6">Onboarding</Typography>
      <Typography variant="body2" color="text.secondary" mb={1}>
        Enter the one-time password from the tax authority portal
        {sandbox ? " (the developer portal always uses 123345)" : ""}. The server creates the key and
        certificate request, runs the compliance checks and stores the certificate. Leave it empty to
        re-run the compliance checks after a fix.
      </Typography>
      <Stack direction="row" spacing={2} alignItems="center">
        <TextField
          size="small"
          label="OTP"
          value={otp}
          onChange={(e) => setOtp(e.target.value)}
          inputProps={{ inputMode: "numeric", maxLength: 6, autoComplete: "one-time-code" }}
        />
        <Button variant="contained" onClick={run} disabled={running}>
          {running ? "Onboarding..." : otp.trim() ? "Onboard" : "Re-run checks"}
        </Button>
        {running && <CircularProgress size={20} />}
      </Stack>
      {result && (
        <Box mt={2}>
          <Alert severity={result.ok ? "success" : "error"}>{result.message}</Alert>
          {result.steps?.length > 0 && (
            <Table size="small" sx={{ mt: 1 }}>
              <TableBody>
                {result.steps.map((s, i) => (
                  <TableRow key={i}>
                    <TableCell sx={{ fontFamily: "monospace", fontSize: 12, wordBreak: "break-word" }}>{s}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Box>
      )}
    </Box>
  );
};

const ConnectionAndReadiness = ({ provider, config, onChanged }) => {
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState(null);
  const [report, setReport] = useState(null);

  const loadReadiness = useCallback(async () => {
    const r = await readiness(provider.providerCode);
    setReport(r.ok ? r.data : null);
  }, [provider.providerCode]);

  useEffect(() => {
    loadReadiness();
  }, [loadReadiness, config.updatedAt]);

  const test = async () => {
    setTesting(true);
    const r = await testConnection(provider.providerCode);
    setTesting(false);
    setResult(r.ok ? { severity: r.data.ok ? "success" : "error", text: r.data.message || (r.data.ok ? "Connected." : "Failed.") }
      : { severity: "error", text: r.message });
    onChanged();
  };

  return (
    <Box mt={4}>
      <Stack direction="row" spacing={2} alignItems="center" mb={1}>
        <Typography variant="h6">Connection</Typography>
        <Button variant="outlined" size="small" onClick={test} disabled={testing}>
          {testing ? "Testing..." : "Test connection"}
        </Button>
      </Stack>
      {result && <Alert severity={result.severity} sx={{ mb: 2 }}>{result.text}</Alert>}
      {!result && config.lastTestAt && (
        <Typography variant="body2" color="text.secondary" mb={2}>
          Last test {formatDateTime(config.lastTestAt)}: {config.lastTestOk ? "OK" : "Failed"}
          {config.lastTestMessage ? ` - ${config.lastTestMessage}` : ""}
        </Typography>
      )}

      {report && (
        <>
          <Typography variant="subtitle1" mt={2}>
            Ready to go live? <Chip size="small" color={READY_COLORS[report.overall] || "default"} label={readyLabel(report.overall)} />
          </Typography>
          <Table size="small">
            <TableBody>
              {report.checks.map((c) => (
                <TableRow key={c.code}>
                  <TableCell>{c.label}</TableCell>
                  <TableCell>
                    <Chip size="small" color={READY_COLORS[c.status] || "default"} label={c.percent != null ? `${readyLabel(c.status)} ${c.percent}%` : readyLabel(c.status)} />
                  </TableCell>
                  <TableCell>{c.detail || ""}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </>
      )}
    </Box>
  );
};

export default ProviderSetup;
