import React, { useEffect, useState } from "react";
import { Alert, Button } from "antd";
import { apiUrl } from "../utils/apiUrl";

const CURRENT_VERSION = import.meta.env.VITE_APP_VERSION || "1.0.0";

export default function UpdateChecker() {
  const [newVersion, setNewVersion] = useState(null);

  useEffect(() => {
    const tenantId = localStorage.getItem("tenancyId");
    const token    = localStorage.getItem("jwtToken");
    if (!tenantId || !token) return;

    const check = async () => {
      try {
        const res = await fetch(
          apiUrl(`/api/${tenantId}/electron-version/${CURRENT_VERSION}`),
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (!res.ok) return;
        const text  = await res.text();
        const lines = text.trim().split("\n");
        const version = lines[0]?.split("=")?.[1]?.trim();
        if (version && version !== CURRENT_VERSION) setNewVersion(version);
      } catch (_) {
        // Offline or no update server — ignore silently
      }
    };

    check();
  }, []);

  if (!newVersion) return null;

  return (
    <div style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 9999 }}>
      <Alert
        type="warning"
        showIcon
        banner
        message={
          <>
            Version <strong>{newVersion}</strong> is available.{" "}
            Close and reopen the <strong>TradeLink247 POS Launcher</strong> to install the update.
          </>
        }
        action={
          <Button size="small" onClick={() => setNewVersion(null)}>
            Dismiss
          </Button>
        }
      />
    </div>
  );
}
