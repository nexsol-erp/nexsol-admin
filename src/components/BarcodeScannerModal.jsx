// src/components/BarcodeScannerModal.jsx
import React, { useEffect, useRef, useState } from "react";
import { Modal, Alert, Space, Button } from "antd";
import { Html5Qrcode } from "html5-qrcode";

const QR_REGION_ID = "qr-reader";

const BarcodeScannerModal = ({ open, onClose, onDetected }) => {
  const qrRef = useRef(null); // Html5Qrcode instance
  const [err, setErr] = useState("");

  useEffect(() => {
    let cancelled = false;

    const start = async () => {
      setErr("");

      // Wait a tick so Modal DOM is mounted (important!)
      await new Promise((r) => setTimeout(r, 150));
      if (cancelled) return;

      const el = document.getElementById(QR_REGION_ID);
      if (!el) {
        setErr("Scanner area not mounted yet (qr-reader not found). Try again.");
        return;
      }

      // Create instance only once
      if (!qrRef.current) {
        qrRef.current = new Html5Qrcode(QR_REGION_ID);
      }

      try {
        // pick back camera if available
        const config = { fps: 10, qrbox: { width: 250, height: 250 } };

        await qrRef.current.start(
          { facingMode: "environment" },
          config,
          (decodedText) => {
            // stop immediately after a successful scan
            if (decodedText) {
              onDetected?.(decodedText);
              onClose?.();
            }
          },
          () => {
            // ignore scan errors per-frame
          }
        );
      } catch (e) {
        console.error(e);
        setErr(
          e?.message ||
            "Failed to start camera. Please allow camera permission and try again."
        );
      }
    };

    const stop = async () => {
      try {
        if (qrRef.current) {
          const isRunning = qrRef.current.getState && qrRef.current.getState() === 2; // 2 = RUNNING (in newer builds)
          // Not all versions expose getState reliably, so try-catch stop anyway
          await qrRef.current.stop().catch(() => {});
          await qrRef.current.clear().catch(() => {});
        }
      } catch (e) {
        // ignore
      }
    };

    if (open) {
      start();
    } else {
      stop();
    }

    return () => {
      cancelled = true;
      stop();
    };
  }, [open, onClose, onDetected]);

  return (
    <Modal
      title="Scan Barcode"
      open={open}
      onCancel={onClose}
      footer={
        <Space>
          <Button onClick={onClose}>Close</Button>
        </Space>
      }
      destroyOnClose
      centered
    >
      {err && (
        <Alert
          type="error"
          showIcon
          message="Camera error"
          description={err}
          style={{ marginBottom: 12 }}
        />
      )}

      {/* IMPORTANT: this element MUST exist before scanner starts */}
      <div
        id={QR_REGION_ID}
        style={{
          width: "100%",
          minHeight: 320,
          borderRadius: 8,
          overflow: "hidden",
          background: "#000",
        }}
      />
      <div style={{ marginTop: 10, fontSize: 12, opacity: 0.7 }}>
        Point the camera at the barcode/QR code. Permission prompt may appear.
      </div>
    </Modal>
  );
};

export default BarcodeScannerModal;
