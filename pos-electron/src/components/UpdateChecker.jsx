import React, { useEffect, useState } from "react";
import { Modal, Button, Progress, Typography, Space, Alert } from "antd";
import { ExclamationCircleFilled, DownloadOutlined } from "@ant-design/icons";
import { apiUrl } from "../utils/apiUrl";

const { Text, Title } = Typography;

const CURRENT_VERSION = import.meta.env.VITE_APP_VERSION || "1.0.0";

export default function UpdateChecker() {
  const [updateInfo, setUpdateInfo] = useState(null); // { version, url }
  const [state, setState] = useState("idle"); // idle | downloading | done | error
  const [progress, setProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState("");

  // Check for update once after login (tenantId must be in localStorage)
  useEffect(() => {
    const tenantId = localStorage.getItem("tenancyId");
    const token = localStorage.getItem("jwtToken");
    if (!tenantId || !token) return;

    const check = async () => {
      try {
        const res = await fetch(apiUrl(`/api/${tenantId}/electron-version/${CURRENT_VERSION}`), {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;

        // Backend response format (same as Qt app):
        //   version=1.2.3
        //   url=https://your-server.com/downloads/TradeLink247-POS-Setup.exe
        const text = await res.text();
        const lines = text.trim().split("\n");
        const version = lines[0]?.split("=")?.[1]?.trim();
        const url = lines[1]?.split("=")?.[1]?.trim();

        if (version && version !== CURRENT_VERSION && url) {
          setUpdateInfo({ version, url });
        }
      } catch (_) {
        // Silently ignore — no update server or offline
      }
    };

    check();
  }, []);

  // Wire up download progress/done/error listeners once
  useEffect(() => {
    if (!window.POS) return;

    const removeProgress = window.POS.onDownloadProgress((pct) => {
      setProgress(pct);
    });

    window.POS.onDownloadDone(() => setState("done"));
    window.POS.onDownloadError((msg) => {
      setErrorMsg(msg || "Download failed");
      setState("error");
    });

    return () => removeProgress?.();
  }, []);

  const startUpdate = async () => {
    if (!updateInfo?.url) return;
    setState("downloading");
    setProgress(0);

    if (!window.POS?.downloadAndInstall) {
      // Running in browser dev mode — open download URL manually
      window.open(updateInfo.url, "_blank");
      setState("idle");
      return;
    }

    window.POS.downloadAndInstall(updateInfo.url);
  };

  if (!updateInfo) return null;

  const isDownloading = state === "downloading";
  const isDone = state === "done";
  const isError = state === "error";

  return (
    <Modal
      open
      closable={false}
      maskClosable={false}
      keyboard={false}
      centered
      width={460}
      title={
        <Space>
          <ExclamationCircleFilled style={{ color: "#faad14", fontSize: 18 }} />
          <span>Update Required</span>
        </Space>
      }
      footer={
        <Button
          type="primary"
          size="large"
          block
          icon={<DownloadOutlined />}
          loading={isDownloading && !isDone}
          disabled={isDone}
          onClick={startUpdate}
          style={{ height: 44 }}
        >
          {isDone
            ? "Installing… app will restart"
            : isDownloading
            ? `Downloading ${progress}%`
            : `Update to v${updateInfo.version}`}
        </Button>
      }
    >
      <div style={{ padding: "8px 0" }}>
        <Title level={5} style={{ margin: "0 0 8px", color: "#1f2937" }}>
          Version {updateInfo.version} is available
        </Title>
        <Text style={{ color: "#6b7280" }}>
          You are running <strong>v{CURRENT_VERSION}</strong>. This update is
          required to continue using the POS.
        </Text>

        {(isDownloading || isDone) && (
          <Progress
            percent={progress}
            status={isDone ? "success" : "active"}
            style={{ marginTop: 20 }}
          />
        )}

        {isError && (
          <Alert
            type="error"
            showIcon
            message="Download failed"
            description={errorMsg}
            style={{ marginTop: 16 }}
            action={
              <Button size="small" onClick={() => setState("idle")}>
                Retry
              </Button>
            }
          />
        )}

        {!isDownloading && !isDone && !isError && (
          <Alert
            type="warning"
            showIcon
            message="Click the button below to download and install the update automatically."
            style={{ marginTop: 16 }}
          />
        )}
      </div>
    </Modal>
  );
}
