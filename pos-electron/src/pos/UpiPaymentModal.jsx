import React, { useEffect, useRef, useState } from "react";
import { Modal, Button, Spin } from "antd";
import QRCode from "qrcode";

const TIMEOUT_SECONDS = 300; // 5 minutes

export default function UpiPaymentModal({ open, amount, qrData, merchantTransactionId, onSuccess, onCancel }) {
  const [secondsLeft, setSecondsLeft] = useState(TIMEOUT_SECONDS);
  const [status,      setStatus]      = useState("waiting"); // waiting | success | failed | timeout
  const [qrImageUrl,  setQrImageUrl]  = useState("");
  const pollRef  = useRef(null);
  const timerRef = useRef(null);

  // Generate QR image from UPI deep-link string whenever qrData changes
  useEffect(() => {
    if (!qrData) { setQrImageUrl(""); return; }
    QRCode.toDataURL(qrData, { width: 200, margin: 1, color: { dark: "#0b3a75", light: "#ffffff" } })
      .then(setQrImageUrl)
      .catch(() => setQrImageUrl(""));
  }, [qrData]);

  // Start polling when modal opens
  useEffect(() => {
    if (!open || !merchantTransactionId) return;

    setStatus("waiting");
    setSecondsLeft(TIMEOUT_SECONDS);

    const tenantId = localStorage.getItem("tenancyId") || "";
    const token    = localStorage.getItem("jwtToken") || "";

    timerRef.current = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          clearInterval(timerRef.current);
          clearInterval(pollRef.current);
          setStatus("timeout");
          return 0;
        }
        return s - 1;
      });
    }, 1000);

    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(
          `/api/${tenantId}/upi/status/${merchantTransactionId}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (!res.ok) return;
        const { status: payStatus } = await res.json();

        if (payStatus === "SUCCESS") {
          clearInterval(pollRef.current);
          clearInterval(timerRef.current);
          setStatus("success");
          window.POS?.upi?.paymentSuccess?.();
          setTimeout(() => onSuccess(), 1500);
        } else if (payStatus === "FAILED") {
          clearInterval(pollRef.current);
          clearInterval(timerRef.current);
          setStatus("failed");
        }
      } catch (_) {}
    }, 3000);

    return () => {
      clearInterval(pollRef.current);
      clearInterval(timerRef.current);
    };
  }, [open, merchantTransactionId]);

  const handleCancel = () => {
    clearInterval(pollRef.current);
    clearInterval(timerRef.current);
    window.POS?.upi?.hideCustomerDisplay?.();
    onCancel();
  };

  const mins = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
  const secs = String(secondsLeft % 60).padStart(2, "0");

  return (
    <Modal
      open={open}
      footer={null}
      closable={false}
      centered
      width={380}
      styles={{ body: { padding: "24px 20px", textAlign: "center" } }}
    >
      {status === "waiting" && (
        <>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#0b3a75", marginBottom: 4 }}>
            UPI Payment
          </div>
          <div style={{ fontSize: 30, fontWeight: 800, color: "#00b96b", marginBottom: 16 }}>
            ₹{Number(amount).toFixed(2)}
          </div>

          {/* QR code on cashier screen */}
          {qrImageUrl ? (
            <div style={{
              display: "inline-block",
              padding: 10,
              background: "#fff",
              border: "2px solid #0b3a75",
              borderRadius: 8,
              marginBottom: 12,
            }}>
              <img src={qrImageUrl} alt="UPI QR" style={{ width: 180, height: 180, display: "block" }} />
            </div>
          ) : (
            <div style={{ marginBottom: 12 }}>
              <Spin size="large" />
            </div>
          )}

          <div style={{ fontSize: 12, color: "#666", marginBottom: 4 }}>
            QR also shown on customer display
          </div>
          <div style={{ fontSize: 11, color: "#aaa", marginBottom: 12 }}>
            Scan with any UPI app &mdash; GPay, PhonePe, Paytm, BHIM
          </div>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 12 }}>
            <Spin size="small" />
            <span style={{ fontSize: 13, color: "#555" }}>Waiting for payment…</span>
          </div>

          <div style={{ fontSize: 12, color: "#aaa", marginBottom: 16 }}>
            Expires in {mins}:{secs}
          </div>

          <Button
            danger
            style={{ width: "100%", borderRadius: 0 }}
            onClick={handleCancel}
          >
            Cancel Payment
          </Button>
        </>
      )}

      {status === "success" && (
        <>
          <div style={{ fontSize: 56 }}>✅</div>
          <div style={{ marginTop: 12, fontSize: 20, fontWeight: 700, color: "#00b96b" }}>
            Payment Received!
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, color: "#0b3a75", marginTop: 8 }}>
            ₹{Number(amount).toFixed(2)}
          </div>
          <div style={{ marginTop: 8, color: "#888", fontSize: 13 }}>
            Saving sale…
          </div>
        </>
      )}

      {status === "failed" && (
        <>
          <div style={{ fontSize: 56 }}>❌</div>
          <div style={{ marginTop: 12, fontSize: 18, fontWeight: 700, color: "#ff4d4f" }}>
            Payment Failed
          </div>
          <div style={{ marginTop: 8, color: "#555", fontSize: 13 }}>
            The transaction was declined. Please try again.
          </div>
          <Button style={{ marginTop: 20, width: "100%", borderRadius: 0 }} onClick={handleCancel}>
            Close
          </Button>
        </>
      )}

      {status === "timeout" && (
        <>
          <div style={{ fontSize: 56 }}>⏰</div>
          <div style={{ marginTop: 12, fontSize: 18, fontWeight: 700, color: "#faad14" }}>
            QR Expired
          </div>
          <div style={{ marginTop: 8, color: "#555", fontSize: 13 }}>
            The QR code has expired. Generate a new one.
          </div>
          <Button style={{ marginTop: 20, width: "100%", borderRadius: 0 }} onClick={handleCancel}>
            Close
          </Button>
        </>
      )}
    </Modal>
  );
}
