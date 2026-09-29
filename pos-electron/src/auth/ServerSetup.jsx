import React, { useState } from "react";
import { Alert, Button, Card, Input, Modal, Typography } from "antd";
import { confirmServer, switchServer, hostOf } from "./serverSwitch";

const { Title, Text } = Typography;

function unsyncedMessage(n, current) {
  if (n < 0) return "Couldn't check for bills waiting to sync, so the server was not changed.";
  return `${n} bill(s) or stock transfer(s) are still waiting to sync to ${hostOf(current)}. ` +
    "Let them sync (or clear them) before changing the server.";
}

/**
 * Asks for a server address, checks it answers as a TradeLink247 server, then saves it.
 * mode "first": this PC has never been used, so nothing needs clearing.
 * mode "change": moving a used PC; refused while bills are waiting to sync.
 */
export function ServerSetupForm({ mode, suggestion, currentServer, onCancel }) {
  const [address, setAddress] = useState(suggestion ? hostOf(suggestion) : "");
  const [checking, setChecking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [found, setFound] = useState(null); // config returned by the server
  const [error, setError] = useState("");

  const check = async () => {
    setError("");
    setFound(null);
    setChecking(true);
    try {
      const res = await window.POS.server.check(address);
      if (res?.ok) setFound(res.config);
      else setError(res?.error || "That address didn't answer.");
    } finally {
      setChecking(false);
    }
  };

  const connect = async () => {
    setError("");
    setSaving(true);
    try {
      if (mode === "change") {
        const res = await switchServer(found);
        if (!res.ok) setError(res.error || unsyncedMessage(res.unsynced, currentServer));
        return; // on success the app restarts
      }
      const res = await confirmServer(found);
      if (!res.ok) { setError(res.error); return; }
      // Restart so every request, including the file:// redirect set at startup, uses it.
      window.POS.server.relaunch();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <Text style={{ display: "block", marginBottom: 6, color: "#6b7280", fontSize: 12 }}>
        Server address
      </Text>
      <Input
        size="large"
        placeholder="erp.example.com"
        value={address}
        autoFocus
        onChange={(e) => { setAddress(e.target.value); setFound(null); setError(""); }}
        onPressEnter={() => (found ? connect() : check())}
        style={{ marginBottom: 12 }}
      />
      {mode === "change" && currentServer && (
        <Text type="secondary" style={{ display: "block", marginBottom: 12, fontSize: 12 }}>
          Currently connected to {hostOf(currentServer)}. Changing the server signs you out and clears
          this PC's saved items and branch.
        </Text>
      )}
      {error && <Alert type="error" showIcon message={error} style={{ marginBottom: 12 }} />}
      {found ? (
        <>
          <Alert
            type="success"
            showIcon
            style={{ marginBottom: 12 }}
            message={`Connect to ${found.name || hostOf(found.apiServer)}?`}
            description={found.name ? hostOf(found.apiServer) : "Only continue if this is your company's server."}
          />
          <Button type="primary" block size="large" loading={saving} onClick={connect}
            style={{ height: 44, fontWeight: 600 }}>
            Connect
          </Button>
        </>
      ) : (
        <Button type="primary" block size="large" loading={checking} disabled={!address.trim()}
          onClick={check} style={{ height: 44, fontWeight: 600 }}>
          Check server
        </Button>
      )}
      {onCancel && (
        <Button block type="text" onClick={onCancel} style={{ marginTop: 8 }}>
          Cancel
        </Button>
      )}
    </div>
  );
}

/** Full-page first-run screen, shown before Login on a PC that has no server yet. */
export function ServerSetupPage({ suggestion }) {
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f0f2f5" }}>
      <Card style={{ width: 420, borderRadius: 12, boxShadow: "0 8px 30px rgba(0,0,0,0.08)" }}>
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <Title level={2} style={{ margin: 0, color: "#1677ff" }}>TradeLink247</Title>
          <Text type="secondary">Connect this POS to your company's server</Text>
        </div>
        <ServerSetupForm mode="first" suggestion={suggestion} />
      </Card>
    </div>
  );
}

/** "Change server" link for the Login page. Hidden outside the desktop app. */
export function ChangeServerLink() {
  const [open, setOpen] = useState(false);
  const state = window.POS?.serverState;
  if (!window.POS?.server || !state) return null;
  return (
    <>
      <div style={{ textAlign: "center", marginTop: 16 }}>
        <Text type="secondary" style={{ fontSize: 12 }}>Server: {hostOf(state.apiServer)} · </Text>
        <Button type="link" size="small" style={{ padding: 0, fontSize: 12 }} onClick={() => setOpen(true)}>
          Change server
        </Button>
      </div>
      <Modal open={open} title="Change server" footer={null} destroyOnHidden onCancel={() => setOpen(false)}>
        <ServerSetupForm mode="change" currentServer={state.apiServer} onCancel={() => setOpen(false)} />
      </Modal>
    </>
  );
}
