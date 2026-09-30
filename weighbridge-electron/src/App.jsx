import React, { useCallback, useEffect, useState } from "react";
import { App as AntApp, Badge, Button, ConfigProvider, Layout, Space, Tabs, Tag, Tooltip, Typography } from "antd";
import { wb } from "./api";
import ServerSetup from "./pages/ServerSetup";
import LoginPage from "./pages/LoginPage";
import BranchPage from "./pages/BranchPage";
import WeighingPage from "./pages/WeighingPage";
import TaresPage from "./pages/TaresPage";
import RatesPage from "./pages/RatesPage";
import ReportPage from "./pages/ReportPage";
import SettingsPage from "./pages/SettingsPage";

const theme = { token: { colorPrimary: "#0b3a75", borderRadius: 6, fontSize: 15 } };

export default function App() {
  return (
    <ConfigProvider theme={theme}>
      <AntApp>
        <Shell />
      </AntApp>
    </ConfigProvider>
  );
}

function Shell() {
  const server = window.WB?.server;
  const [session, setSession] = useState(null); // { auth, isAdmin }
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("weigh");

  const refresh = useCallback(async () => {
    try { setSession(await wb("authState")); } catch (_) { setSession(null); } finally { setLoading(false); }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  if (!server?.confirmed) return <ServerSetup />;
  if (loading) return null;
  const auth = session?.auth;
  if (!auth?.signedIn) return <LoginPage auth={auth} onDone={refresh} />;
  if (!auth.branchCode) return <BranchPage auth={auth} onDone={refresh} />;

  const isAdmin = !!session.isAdmin;
  const items = [
    { key: "weigh", label: "Weighing", children: <WeighingPage active={tab === "weigh"} /> },
    { key: "tares", label: "Tare Weights", children: <TaresPage active={tab === "tares"} /> },
    { key: "report", label: "Daily Report", children: <ReportPage active={tab === "report"} /> },
    { key: "rates", label: "Rates", children: <RatesPage active={tab === "rates"} isAdmin={isAdmin} /> },
    { key: "settings", label: "Settings", children: <SettingsPage active={tab === "settings"} isAdmin={isAdmin} auth={auth} onChanged={refresh} /> },
  ];

  return (
    <Layout style={{ minHeight: "100vh", background: "#f3f5f8" }}>
      <Layout.Header style={{ background: "#0b3a75", display: "flex", alignItems: "center", gap: 16, padding: "0 20px", height: 56 }}>
        <Typography.Text style={{ color: "#fff", fontSize: 18, fontWeight: 700 }}>TradeLink247 Weighbridge</Typography.Text>
        <Tag color="blue" style={{ fontSize: 14 }}>{auth.branchCode}</Tag>
        <div style={{ flex: 1 }} />
        <SyncBadge />
        <Space>
          <Typography.Text style={{ color: "#cfe0ff" }}>{auth.username}</Typography.Text>
          <Button size="small" onClick={async () => { await wb("logout"); refresh(); }}>Sign out</Button>
        </Space>
      </Layout.Header>
      <Layout.Content style={{ padding: "8px 20px 20px" }}>
        <Tabs activeKey={tab} onChange={setTab} items={items} size="large" destroyInactiveTabPane={false} />
      </Layout.Content>
    </Layout>
  );
}

function SyncBadge() {
  const [s, setS] = useState(null);
  useEffect(() => {
    wb("syncState").then((r) => setS(r.state)).catch(() => {});
    return window.WB.onSync(setS);
  }, []);
  if (!s) return null;
  const pending = (s.pending?.weights || 0) + (s.pending?.tares || 0);
  let color = "green";
  let text = "Synced";
  if (s.needsLogin) { color = "orange"; text = "Sign in again to sync"; }
  else if (s.online === false) { color = "red"; text = "Offline"; }
  else if (pending) { color = "gold"; text = "Syncing"; }
  const tip = `${pending} waiting to upload${s.lastSyncAt ? ` · last sync ${new Date(s.lastSyncAt).toLocaleTimeString()}` : ""}${s.lastError ? ` · ${s.lastError}` : ""}`;
  return (
    <Tooltip title={tip}>
      <Badge count={pending} size="small" offset={[-4, 2]}>
        <Tag color={color} style={{ cursor: "pointer", fontSize: 13 }} onClick={() => wb("syncNow").catch(() => {})}>{text}</Tag>
      </Badge>
    </Tooltip>
  );
}
