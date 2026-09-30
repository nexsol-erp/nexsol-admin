import React, { useState } from "react";
import { Alert, Button, Card, Input, Typography } from "antd";
import { wb } from "../api";

// First start on a PC: which TradeLink247 server this weighbridge reports to.
export default function ServerSetup() {
  const [address, setAddress] = useState(window.WB?.server?.apiServer || "https://www.tradelink247.com");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const connect = async () => {
    setBusy(true);
    setError("");
    try {
      const res = await wb("checkServer", { address });
      if (!res.config) throw new Error(res.error || "That address didn't answer as a TradeLink247 server.");
      await wb("saveServer", { config: res.config });
      window.WB.relaunch();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="center-page">
      <Card style={{ width: 460 }}>
        <Typography.Title level={3} style={{ marginTop: 0 }}>Connect to server</Typography.Title>
        <Typography.Paragraph type="secondary">
          Enter the address of your TradeLink247 server. Weighings are saved on this PC first and uploaded there.
        </Typography.Paragraph>
        <Input size="large" value={address} onChange={(e) => setAddress(e.target.value)} onPressEnter={connect} placeholder="https://erp.example.com" />
        {error && <Alert type="error" showIcon message={error} style={{ marginTop: 12 }} />}
        <Button type="primary" size="large" block loading={busy} onClick={connect} style={{ marginTop: 16 }}>Connect</Button>
      </Card>
    </div>
  );
}
