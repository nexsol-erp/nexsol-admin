import React, { useEffect, useState } from "react";
import { Modal, Select, Button, message, Space } from "antd";
import {
  FONT_FAMILY_OPTIONS,
  FONT_SIZE_OPTIONS,
  getPrintPrefs,
  setPrintPrefs,
  applyPrintPrefs,
  buildTestPrintHtml,
} from "./printPrefs";

// Settings ▸ Print Settings — lets the user pick a font/size override for ALL
// POS print output (receipts, KOT, stock transfer, expense vouchers, reports).
// Saved per-terminal in localStorage; "Default" leaves every print builder's
// own styling untouched (this is the out-of-the-box behaviour).
export default function PrintSettingsModal({ open, onClose }) {
  const [fontFamily, setFontFamily] = useState("");
  const [fontSizePx, setFontSizePx] = useState(0);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    if (!open) return;
    const saved = getPrintPrefs();
    setFontFamily(saved.fontFamily);
    setFontSizePx(saved.fontSizePx);
  }, [open]);

  const previewHtml = applyPrintPrefs(buildTestPrintHtml(), { fontFamily, fontSizePx });

  const save = () => {
    setPrintPrefs({ fontFamily, fontSizePx });
    message.success("Print settings saved — applies to all POS print output from now on.");
  };

  const saveAndTestPrint = async () => {
    save();
    if (!window.POS?.printHtml) { message.error("Print API not available"); return; }
    setTesting(true);
    try {
      await window.POS.printHtml({ html: buildTestPrintHtml(), silent: false, deviceName: "" });
    } catch (e) {
      message.error("Test print failed: " + (e.message || "Unknown error"));
    } finally {
      setTesting(false);
    }
  };

  return (
    <Modal
      title="Print Settings"
      open={open}
      onCancel={onClose}
      width={560}
      footer={[
        <Button key="close" onClick={onClose}>Close</Button>,
        <Button key="save" onClick={save}>Save</Button>,
        <Button key="test" type="primary" loading={testing} onClick={saveAndTestPrint}>
          Save &amp; Test Print
        </Button>,
      ]}
    >
      <div style={{ display: "flex", gap: 16, marginBottom: 12 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12, fontWeight: "bold", marginBottom: 4 }}>Font</div>
          <Select
            value={fontFamily}
            onChange={setFontFamily}
            options={FONT_FAMILY_OPTIONS}
            style={{ width: "100%" }}
          />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12, fontWeight: "bold", marginBottom: 4 }}>Font Size</div>
          <Select
            value={fontSizePx}
            onChange={setFontSizePx}
            options={FONT_SIZE_OPTIONS}
            style={{ width: "100%" }}
          />
        </div>
      </div>

      <div style={{ fontSize: 12, fontWeight: "bold", marginBottom: 4 }}>Preview</div>
      <div style={{ border: "1px solid #d9d9d9", background: "#f5f5f5", padding: 8, display: "flex", justifyContent: "center" }}>
        <iframe
          title="print-preview"
          srcDoc={previewHtml}
          style={{ width: 280, height: 260, border: "1px solid #ccc", background: "#fff" }}
        />
      </div>

      <Space direction="vertical" size={0} style={{ marginTop: 10 }}>
        <span style={{ fontSize: 11, color: "#666" }}>
          This applies to every POS print (sale receipt, KOT, stock transfer, expense voucher, reports) on this terminal.
        </span>
        <span style={{ fontSize: 11, color: "#666" }}>
          Pick "Default (as designed)" for either setting to leave that receipt's original styling untouched.
        </span>
      </Space>
    </Modal>
  );
}
