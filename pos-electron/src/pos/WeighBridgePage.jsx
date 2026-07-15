import React, { useEffect, useState, useCallback } from "react";
import {
  Button, Input, InputNumber, Select, Table, Typography, Divider,
  Space, Tag, message, Switch, Badge, Tooltip,
} from "antd";
import Dexie from "dexie";
import { apiUrl } from "../utils/apiUrl";
import { log, error as logError } from "../utils/logger";

// ── Offline cache DB ─────────────────────────────────────────────────────────
const wbDb = new Dexie("wbOfflineCache");
wbDb.version(1).stores({
  pending: "++localId, vehicleNumber, createdAt",
});

const { Text, Title } = Typography;

export default function WeighBridgePage() {
  const tenantId   = localStorage.getItem("tenancyId") || "";
  const branchCode = localStorage.getItem("selectedBranchCode") || "";
  const token      = localStorage.getItem("jwtToken") || "";
  const headers    = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  // ── Serial port ──────────────────────────────────────────────────────────
  const [ports, setPorts]               = useState([]);
  const [selectedPort, setSelectedPort] = useState("");
  const [baudRate, setBaudRate]         = useState(9600);
  const [connected, setConnected]       = useState(false);
  const [liveWeight, setLiveWeight]     = useState(0);

  useEffect(() => {
    window.POS?.wb?.listPorts().then((list) => {
      setPorts(list || []);
      if (list?.length) setSelectedPort(list[0].path);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!window.POS?.wb) return;
    const unsub = window.POS.wb.onWeight((w) => setLiveWeight(w));
    return () => unsub?.();
  }, []);

  const connectPort = async () => {
    if (!window.POS?.wb) { message.error("Serial port API not available"); return; }
    if (!selectedPort) { message.warning("Select a COM port"); return; }
    const res = await window.POS.wb.openPort({ path: selectedPort, baudRate });
    if (res?.ok) { setConnected(true); message.success("Port connected"); }
    else { message.error("Connect failed: " + (res?.error || "unknown")); }
  };

  const disconnectPort = async () => {
    await window.POS?.wb?.closePort();
    setConnected(false);
    message.info("Port disconnected");
  };

  const simulateWeight = () => {
    const w = Math.floor(Math.random() * 20000) + 1000;
    setLiveWeight(w);
  };

  // ── Wheel rates ──────────────────────────────────────────────────────────
  const [wheelRates, setWheelRates] = useState([]);
  useEffect(() => {
    fetch(apiUrl(`/api/${tenantId}/wb-rates`), { headers })
      .then((r) => r.json())
      .then((data) => setWheelRates(Array.isArray(data) ? data : []))
      .catch((e) => logError("wb-rates fetch:", e.message));
  }, [tenantId]);

  // ── Form state ───────────────────────────────────────────────────────────
  const [vehicleNumber, setVehicleNumber]     = useState("");
  const [wheelType, setWheelType]             = useState("");
  const [material, setMaterial]               = useState("");
  const [mobileNumber, setMobileNumber]       = useState("");
  const [usePreviousWeight, setUsePreviousWeight] = useState(false);
  const [useTareWeight, setUseTareWeight]     = useState(false);
  const [firstWeight, setFirstWeight]         = useState("");
  const [firstWeightDate, setFirstWeightDate] = useState("");
  const [firstWeightId, setFirstWeightId]     = useState("");
  const [amount, setAmount]                   = useState(0);
  const [previousWeights, setPreviousWeights] = useState([]);
  const [loading, setLoading]                 = useState(false);
  const [lastVoucherNumber, setLastVoucherNumber] = useState("");
  const [pendingCount, setPendingCount]           = useState(0);
  const [syncing, setSyncing]                     = useState(false);

  const fetchPendingCount = useCallback(async () => {
    const n = await wbDb.pending.count();
    setPendingCount(n);
  }, []);

  const syncPending = useCallback(async () => {
    const records = await wbDb.pending.toArray();
    if (!records.length) { message.info("No pending records to sync"); return; }
    setSyncing(true);
    let ok = 0, fail = 0;
    for (const rec of records) {
      const { localId, createdAt, ...body } = rec;
      try {
        const res = await fetch(apiUrl(`/api/${tenantId}/weighbridge/save`), {
          method: "POST", headers, body: JSON.stringify(body),
        });
        if (res.ok) {
          await wbDb.pending.delete(localId);
          ok++;
        } else {
          fail++;
        }
      } catch (_) {
        fail++;
      }
    }
    setSyncing(false);
    fetchPendingCount();
    if (ok > 0) message.success(`Synced ${ok} record${ok > 1 ? "s" : ""} to server`);
    if (fail > 0) message.warning(`${fail} record${fail > 1 ? "s" : ""} still pending (server unreachable)`);
  }, [tenantId, headers, fetchPendingCount]);

  // Auto-sync on mount; re-sync when network comes back online
  useEffect(() => {
    fetchPendingCount();
    const onOnline = () => {
      message.info("Connection restored — syncing pending records…");
      syncPending();
    };
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [fetchPendingCount, syncPending]);

  // Net weight
  const fw = parseFloat(firstWeight) || 0;
  const netWeight = liveWeight > 0 && fw > 0 ? Math.abs(liveWeight - fw) : 0;

  // ── Vehicle number logic ─────────────────────────────────────────────────
  const fetchPreviousWeights = useCallback(async (vn) => {
    if (!vn) { setPreviousWeights([]); return; }
    try {
      const res = await fetch(apiUrl(`/api/${tenantId}/weighbridge/vehicle/${encodeURIComponent(vn)}`), { headers });
      if (res.ok) {
        const data = await res.json();
        setPreviousWeights(Array.isArray(data) ? data : []);
        // Auto-fill wheel type from last record
        const last = data.find((r) => r.wheelType);
        if (last && !wheelType) setWheelType(last.wheelType);
      }
    } catch (e) { logError("previous weights fetch:", e.message); }
  }, [tenantId, token, wheelType]);

  useEffect(() => {
    const t = setTimeout(() => fetchPreviousWeights(vehicleNumber), 400);
    return () => clearTimeout(t);
  }, [vehicleNumber, fetchPreviousWeights]);

  // ── Wheel type → rate ────────────────────────────────────────────────────
  useEffect(() => {
    if (!wheelType) return;
    const rate = wheelRates.find((r) => r.wheelType === wheelType);
    if (rate) setAmount(rate.wheelRate || 0);
  }, [wheelType, wheelRates]);

  // ── Copy previous weight row ─────────────────────────────────────────────
  const selectPreviousRow = (row) => {
    setFirstWeight(String(row.lcdNumber || row.lcdnumber || 0));
    setFirstWeightDate(row.voucherDate ? new Date(row.voucherDate).toLocaleString() : "");
    setFirstWeightId(row.id || "");
    // If it was a round-trip entry, balance amount
    const rate = wheelRates.find((r) => r.wheelType === wheelType);
    if (row.roundTrip === 1 && rate) {
      const balance = (rate.wheelRate || 0) - (parseFloat(row.amount) || 0);
      setAmount(Math.max(0, balance));
    } else if (rate) {
      setAmount(rate.wheelRate || 0);
    }
  };

  // ── Save ─────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!vehicleNumber.trim()) { message.warning("Enter vehicle number"); return; }
    if (!wheelType) { message.warning("Select wheel type"); return; }
    if (liveWeight <= 0) { message.warning("No weight reading (LCD = 0)"); return; }

    setLoading(true);
    const body = {
      branchCode,
      vehicleNumber: vehicleNumber.toUpperCase(),
      wheelType,
      material,
      mobileNumber,
      lcdNumber: liveWeight,
      firstWeight: fw,
      firstWeightDate: firstWeightDate || null,
      amount,
    };
    log("wb save body:", JSON.stringify(body));

    try {
      const res = await fetch(apiUrl(`/api/${tenantId}/weighbridge/save`), {
        method: "POST", headers, body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      message.success(`Saved! Voucher: ${data.voucherNumber}`);
      setLastVoucherNumber(data.voucherNumber);
      printReceipt(data.voucherNumber, body);
      clearForm();
      fetchPreviousWeights(vehicleNumber);
    } catch (e) {
      // Network or server error — persist to local cache
      const isNetworkError = !window.navigator.onLine || e.message.includes("fetch") || e.message.includes("Failed to fetch") || e.message.includes("NetworkError");
      if (isNetworkError || !window.navigator.onLine) {
        try {
          await wbDb.pending.add({ ...body, createdAt: new Date().toISOString() });
          await fetchPendingCount();
          message.warning("No internet — record saved offline. It will sync automatically when connection is restored.");
          printReceipt("OFFLINE", body);
          clearForm();
        } catch (dbErr) {
          message.error("Failed to save offline: " + dbErr.message);
          logError("wb offline cache error:", dbErr.message);
        }
      } else {
        message.error("Save failed: " + e.message);
        logError("wb save error:", e.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const clearForm = () => {
    setVehicleNumber(""); setWheelType(""); setMaterial(""); setMobileNumber("");
    setFirstWeight(""); setFirstWeightDate(""); setFirstWeightId("");
    setUsePreviousWeight(false); setUseTareWeight(false); setAmount(0);
  };

  // ── Print ────────────────────────────────────────────────────────────────
  const printReceipt = async (voucherNumber, body) => {
    if (!window.POS?.printHtml) return;
    const branchInfo = JSON.parse(localStorage.getItem("wbBranchInfo") || "{}");
    const html = buildWbReceiptHtml({ voucherNumber, branchInfo, ...body, netWeight: Math.abs(liveWeight - fw) });
    try {
      await window.POS.printHtml({ html, silent: true, deviceName: "" });
    } catch (e) { logError("wb print error:", e.message); }
  };

  // ── Previous weights table ───────────────────────────────────────────────
  const prevColumns = [
    { title: "Voucher", dataIndex: "voucherNumber", width: 100 },
    { title: "Date", dataIndex: "voucherDate", width: 140, render: (v) => v ? new Date(v).toLocaleString() : "—" },
    { title: "LCD (kg)", dataIndex: "lcdNumber", width: 90, render: (v) => v ?? "—" },
    { title: "First Wt", dataIndex: "firstWeight", width: 90, render: (v) => v ?? "—" },
    { title: "Amount", dataIndex: "amount", width: 90, render: (v) => v != null ? Number(v).toFixed(2) : "—" },
    { title: "Wheel", dataIndex: "wheelType", width: 80 },
    {
      title: "", key: "use", width: 70,
      render: (_, row) => (
        <Button size="small" type="link" onClick={() => selectPreviousRow(row)}>Use</Button>
      ),
    },
  ];

  const weightColor = liveWeight > 0 ? "#00e676" : "#546e7a";

  return (
    <div style={{ padding: "12px 16px", maxWidth: 900, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <Title level={4} style={{ margin: 0, color: "#0b3a75" }}>Weigh Bridge</Title>
        {branchCode && (
          <Tag color="blue" style={{ fontSize: 14, padding: "2px 12px" }}>{branchCode}</Tag>
        )}
      </div>

      {/* Serial port row */}
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12, flexWrap: "wrap" }}>
        <Select
          style={{ width: 160 }} size="small" placeholder="COM Port"
          value={selectedPort || undefined}
          onChange={setSelectedPort}
          options={ports.map((p) => ({ value: p.path, label: `${p.path} (${p.manufacturer || "?"})` }))}
        />
        <Select
          style={{ width: 100 }} size="small" value={baudRate}
          onChange={setBaudRate}
          options={[9600, 4800, 19200, 38400].map((b) => ({ value: b, label: `${b}` }))}
        />
        {!connected ? (
          <Button size="small" type="primary" onClick={connectPort}>Connect</Button>
        ) : (
          <Button size="small" danger onClick={disconnectPort}>Disconnect</Button>
        )}
        <Tag color={connected ? "green" : "default"}>{connected ? "Connected" : "Not connected"}</Tag>
        <Button size="small" onClick={simulateWeight}>Simulate</Button>
        {lastVoucherNumber && <Tag color="orange">Last: {lastVoucherNumber}</Tag>}
      </div>

      {/* LCD Weight Display */}
      <div style={{
        background: "#0d1117", borderRadius: 8, padding: "16px 24px",
        marginBottom: 16, textAlign: "center",
        boxShadow: "inset 0 2px 8px rgba(0,0,0,0.6)",
      }}>
        <div style={{ color: "#546e7a", fontSize: 11, letterSpacing: 2, textTransform: "uppercase", marginBottom: 4 }}>
          Live Weight (kg)
        </div>
        <div style={{
          fontFamily: "'Courier New', monospace", fontSize: 64, fontWeight: "bold",
          color: weightColor, letterSpacing: 6, lineHeight: 1,
          textShadow: liveWeight > 0 ? `0 0 20px ${weightColor}60` : "none",
          transition: "color 0.3s",
        }}>
          {String(liveWeight).padStart(6, "0")}
        </div>
        {fw > 0 && (
          <div style={{ marginTop: 8, color: "#90a4ae", fontSize: 13 }}>
            First: {fw} kg &nbsp;|&nbsp; <span style={{ color: "#ffd54f", fontWeight: 600 }}>Net: {netWeight} kg</span>
          </div>
        )}
      </div>

      {/* Form */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 20px", marginBottom: 12 }}>
        <div>
          <Text strong style={{ fontSize: 12, display: "block", marginBottom: 2 }}>Vehicle Number *</Text>
          <Input
            value={vehicleNumber}
            onChange={(e) => setVehicleNumber(e.target.value.toUpperCase())}
            placeholder="e.g. KL01AB1234"
            style={{ fontWeight: 600, letterSpacing: 1 }}
          />
        </div>
        <div>
          <Text strong style={{ fontSize: 12, display: "block", marginBottom: 2 }}>Wheel Type *</Text>
          <Select
            style={{ width: "100%" }} value={wheelType || undefined}
            onChange={setWheelType} placeholder="Select wheel type"
            options={wheelRates.map((r) => ({
              value: r.wheelType,
              label: `${r.wheelType}  —  ₹${r.wheelRate}`,
            }))}
          />
        </div>
        <div>
          <Text strong style={{ fontSize: 12, display: "block", marginBottom: 2 }}>Material</Text>
          <Input value={material} onChange={(e) => setMaterial(e.target.value)} placeholder="Sand, Gravel…" />
        </div>
        <div>
          <Text strong style={{ fontSize: 12, display: "block", marginBottom: 2 }}>Mobile Number</Text>
          <Input value={mobileNumber} onChange={(e) => setMobileNumber(e.target.value)} placeholder="Driver mobile" maxLength={20} />
        </div>
        <div>
          <Text strong style={{ fontSize: 12, display: "block", marginBottom: 2 }}>Amount (₹)</Text>
          <InputNumber
            style={{ width: "100%" }} value={amount}
            onChange={(v) => setAmount(Number(v) || 0)}
            min={0} precision={2}
          />
        </div>
        <div style={{ display: "flex", gap: 24, alignItems: "center", paddingTop: 20 }}>
          <Space>
            <Text style={{ fontSize: 12 }}>Use Previous Weight</Text>
            <Switch checked={usePreviousWeight} onChange={setUsePreviousWeight} />
          </Space>
          <Space>
            <Text style={{ fontSize: 12 }}>Use Tare Weight</Text>
            <Switch checked={useTareWeight} onChange={setUseTareWeight} />
          </Space>
        </div>
      </div>

      {/* First weight (shown when usePreviousWeight or useTareWeight) */}
      {(usePreviousWeight || useTareWeight) && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px 20px", marginBottom: 12, background: "#f8f9fa", padding: 10, borderRadius: 6 }}>
          <div>
            <Text style={{ fontSize: 12, display: "block", marginBottom: 2, color: "#6b7280" }}>First Weight (kg)</Text>
            <Input value={firstWeight} onChange={(e) => setFirstWeight(e.target.value)} />
          </div>
          <div>
            <Text style={{ fontSize: 12, display: "block", marginBottom: 2, color: "#6b7280" }}>First Weight Date</Text>
            <Input value={firstWeightDate} readOnly style={{ background: "#fff" }} />
          </div>
          <div>
            <Text style={{ fontSize: 12, display: "block", marginBottom: 2, color: "#6b7280" }}>First Weight ID</Text>
            <Input value={firstWeightId} readOnly style={{ background: "#fff", fontSize: 10 }} />
          </div>
        </div>
      )}

      <Divider style={{ margin: "8px 0" }} />

      {/* Action buttons */}
      <Space style={{ marginBottom: 12 }}>
        <Button
          type="primary" onClick={handleSave} loading={loading}
          disabled={!vehicleNumber || !wheelType || liveWeight <= 0}
          style={{ background: "#1b5e20", borderColor: "#1b5e20" }}
        >
          Save
        </Button>
        <Button onClick={clearForm}>Clear</Button>
        <Button onClick={() => fetchPreviousWeights(vehicleNumber)}>Refresh History</Button>
        <Tooltip title={pendingCount > 0 ? `${pendingCount} record(s) saved offline — click to sync` : "No pending records"}>
          <Badge count={pendingCount} size="small" offset={[-4, 4]}>
            <Button
              onClick={syncPending}
              loading={syncing}
              disabled={pendingCount === 0}
              style={pendingCount > 0 ? { borderColor: "#fa8c16", color: "#fa8c16" } : {}}
            >
              Sync Pending
            </Button>
          </Badge>
        </Tooltip>
      </Space>

      {/* Previous weights */}
      {previousWeights.length > 0 && (
        <>
          <Text strong style={{ fontSize: 12, display: "block", marginBottom: 4 }}>
            Vehicle History — {vehicleNumber}
          </Text>
          <Table
            size="small"
            dataSource={previousWeights}
            columns={prevColumns}
            rowKey="id"
            pagination={false}
            style={{ marginBottom: 12 }}
          />
        </>
      )}
    </div>
  );
}

function buildWbReceiptHtml({ voucherNumber, branchInfo, vehicleNumber, wheelType, material, mobileNumber, lcdNumber, firstWeight, netWeight, amount }) {
  const b = branchInfo || {};
  const now = new Date();
  const dateStr = now.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  const timeStr = now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
  const esc = (s) => String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const fw = parseFloat(firstWeight) || 0;
  const nw = parseFloat(netWeight) || Math.abs((parseFloat(lcdNumber) || 0) - fw);

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"/>
<style>
  @page{margin:0}*{margin:0;padding:0;box-sizing:border-box}
  body{font-family:'Courier New',monospace;font-size:12px;width:302px;color:#000;padding:6px 4px}
  .center{text-align:center}.bold{font-weight:bold}
  .name{font-size:15px;font-weight:bold;text-align:center;letter-spacing:1px;margin-bottom:2px}
  .addr{font-size:10px;text-align:center;line-height:1.4}
  .solid{border:none;border-top:2px solid #000;margin:4px 0}
  .dash{border:none;border-top:1px dashed #000;margin:4px 0}
  .row{display:flex;justify-content:space-between;margin:2px 0;font-size:11px}
  .label{color:#555}.value{font-weight:bold}
  .big{font-size:14px;font-weight:bold}
  .title{text-align:center;font-size:12px;font-weight:bold;letter-spacing:2px;margin:3px 0}
  .footer{text-align:center;font-size:11px;margin-top:6px;line-height:1.6}
</style></head>
<body>
  <div class="name">${esc(b.branchName || "WEIGH BRIDGE")}</div>
  ${b.branchBuildingAddress ? `<div class="addr">${esc(b.branchBuildingAddress)}</div>` : ""}
  ${b.branchAddress1 ? `<div class="addr">${esc(b.branchAddress1)}</div>` : ""}
  ${b.branchGst ? `<div class="addr bold">GST: ${esc(b.branchGst)}</div>` : ""}
  <hr class="solid"/>
  <div class="title">WEIGH BRIDGE RECEIPT</div>
  <hr class="dash"/>
  <div class="row"><span class="label">Voucher</span><span class="value">${esc(voucherNumber)}</span></div>
  <div class="row"><span class="label">Date &amp; Time</span><span class="value">${dateStr} ${timeStr}</span></div>
  <hr class="dash"/>
  <div class="row"><span class="label">Vehicle No.</span><span class="value">${esc(vehicleNumber)}</span></div>
  <div class="row"><span class="label">Wheel Type</span><span class="value">${esc(wheelType)}</span></div>
  ${material ? `<div class="row"><span class="label">Material</span><span class="value">${esc(material)}</span></div>` : ""}
  ${mobileNumber ? `<div class="row"><span class="label">Mobile</span><span class="value">${esc(mobileNumber)}</span></div>` : ""}
  <hr class="dash"/>
  ${fw > 0 ? `<div class="row"><span class="label">First Weight</span><span class="value">${fw} kg</span></div>` : ""}
  <div class="row"><span class="label">Gross Weight</span><span class="value">${lcdNumber || 0} kg</span></div>
  ${fw > 0 ? `<div class="row big"><span class="label">Net Weight</span><span class="value">${nw} kg</span></div>` : ""}
  <hr class="solid"/>
  <div class="row big"><span>AMOUNT</span><span>&#8377; ${Number(amount || 0).toFixed(2)}</span></div>
  <hr class="dash"/>
  <div class="footer">
    <div class="bold">Thank you!</div>
  </div>
  <br/><br/>
</body></html>`;
}
