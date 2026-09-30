import React, { useEffect, useState } from "react";
import { Alert, Button, Card, Select, Typography } from "antd";
import { wb } from "../api";

// Which branch this weighbridge PC belongs to. Set once; changing it later needs an admin.
export default function BranchPage({ auth, onDone }) {
  const [branches, setBranches] = useState([]);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    wb("branches").then((r) => {
      const allowed = (r.allowed || []).map((b) => String(b).toLowerCase());
      const list = (r.branches || []).filter((b) => !allowed.length || allowed.includes(String(b.branchCode).toLowerCase()));
      setBranches(list.length ? list : (r.allowed || []).map((c) => ({ branchCode: c, branchName: c })));
    }).catch((e) => setError(e.message));
  }, []);

  const save = async () => {
    setBusy(true);
    setError("");
    try {
      await wb("setBranch", { branchCode: code });
      onDone();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="center-page">
      <Card style={{ width: 460 }}>
        <Typography.Title level={3} style={{ marginTop: 0 }}>Choose the branch</Typography.Title>
        <Typography.Paragraph type="secondary">
          Pick the weighbridge branch this PC is at. Voucher numbers continue from that branch's last voucher,
          and its recent weighings are copied here so return weighings are recognised.
        </Typography.Paragraph>
        <Select size="large" style={{ width: "100%" }} value={code || undefined} onChange={setCode} placeholder="Branch"
          options={branches.map((b) => ({ value: b.branchCode, label: `${b.branchCode} · ${b.branchName || ""}` }))} />
        {error && <Alert type="error" showIcon message={error} style={{ marginTop: 12 }} />}
        <Button type="primary" size="large" block disabled={!code} loading={busy} onClick={save} style={{ marginTop: 16 }}>Continue</Button>
        <Typography.Paragraph type="secondary" style={{ marginTop: 12, marginBottom: 0, fontSize: 12 }}>Signed in as {auth.username}</Typography.Paragraph>
      </Card>
    </div>
  );
}
