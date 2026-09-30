import React, { useState } from "react";
import { Alert, Button, Card, Input, Typography } from "antd";
import { wb } from "../api";

export default function LoginPage({ auth, onDone }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    if (!username || !password) return;
    setBusy(true);
    setError("");
    try {
      await wb("login", { username, password });
      onDone();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="center-page">
      <Card style={{ width: 420 }}>
        <Typography.Title level={3} style={{ marginTop: 0, marginBottom: 4 }}>TradeLink247 Weighbridge</Typography.Title>
        <Typography.Paragraph type="secondary">
          {auth?.branchCode ? `Branch ${auth.branchCode} · ` : ""}{window.WB?.server?.apiServer}
        </Typography.Paragraph>
        <Input size="large" placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} autoFocus />
        <Input.Password size="large" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} onPressEnter={submit} style={{ marginTop: 12 }} />
        {error && <Alert type="error" showIcon message={error} style={{ marginTop: 12 }} />}
        <Button type="primary" size="large" block loading={busy} onClick={submit} style={{ marginTop: 16 }}>Sign in</Button>
        <Typography.Paragraph type="secondary" style={{ marginTop: 16, marginBottom: 0, fontSize: 12 }}>
          Version {window.WB?.version}
        </Typography.Paragraph>
      </Card>
    </div>
  );
}
