import React, { useMemo, useState } from "react";
import { Button, Input, Space, Table, Typography, message } from "antd";
import { db } from "../cache/itemCacheDb";
import { loadAllItemsToCache } from "../cache/itemCache";
import { getPendingCount, syncPendingSales } from "./offlineQueue";
import { getPendingStockCount, syncPendingStockTransfers } from "../stock-transfer/offlineStockQueue";

const { Title, Text } = Typography;

function r2(v) { return Math.round((Number(v) || 0) * 100) / 100; }

function esc(s) {
  return String(s || "")
    .replaceAll("&", "&amp;").replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

// ── PDF ───────────────────────────────────────────────────────────────────────

function buildReportHtml({ branchCode, generatedAt, rows }) {
  const totalQty = rows.reduce((s, r) => s + (Number(r.availableQty) || 0), 0);

  const bodyRows = rows.map((r, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>${esc(r.itemName)}</td>
      <td>${esc(r.barcode)}</td>
      <td>${esc(r.category)}</td>
      <td>${esc(r.unitName)}</td>
      <td class="num">${r2(r.availableQty).toFixed(2)}</td>
    </tr>`).join("");

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 12px; color: #000; padding: 24px; }
  .title  { text-align: center; font-size: 18px; font-weight: bold; margin-bottom: 4px; }
  .meta   { text-align: center; font-size: 11px; color: #444; margin-bottom: 16px; }
  table   { width: 100%; border-collapse: collapse; }
  th, td  { padding: 5px 8px; border-bottom: 1px solid #ddd; text-align: left; }
  th      { background: #1976d2; color: #fff; }
  .num    { text-align: right; }
  tfoot td { border-top: 2px solid #000; font-weight: bold; }
</style>
</head>
<body>
  <div class="title">CURRENT STOCK REPORT</div>
  <div class="meta">Branch: ${esc(branchCode)} &nbsp;|&nbsp; Generated: ${esc(generatedAt)}</div>
  <table>
    <thead>
      <tr>
        <th>#</th><th>Item</th><th>Barcode</th><th>Category</th><th>Unit</th><th class="num">Available Qty</th>
      </tr>
    </thead>
    <tbody>${bodyRows}</tbody>
    <tfoot>
      <tr>
        <td colspan="5" class="num">Total Items: ${rows.length}</td>
        <td class="num">${r2(totalQty).toFixed(2)}</td>
      </tr>
    </tfoot>
  </table>
</body>
</html>`;
}

// ── Columns ───────────────────────────────────────────────────────────────────

const columns = [
  { title: "Item", dataIndex: "itemName", key: "itemName" },
  { title: "Barcode", dataIndex: "barcode", key: "barcode", width: 130 },
  { title: "Category", dataIndex: "category", key: "category", width: 140 },
  { title: "Unit", dataIndex: "unitName", key: "unitName", width: 80 },
  { title: "Available Qty", dataIndex: "availableQty", key: "availableQty", align: "right", width: 120,
    render: (v) => <Text strong>{r2(v).toFixed(2)}</Text> },
];

// ── Component ─────────────────────────────────────────────────────────────────

export default function CurrentStockReportPage({ selectedBranchCode }) {
  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [generatedAt, setGeneratedAt] = useState(null);
  const [savingPdf, setSavingPdf] = useState(false);

  const branchCode = String(
    selectedBranchCode || globalThis.POS_BRANCH_CODE ||
    localStorage.getItem("selectedBranchCode") || ""
  ).trim();

  // Any unsynced offline sale or stock transfer means the server's stock figures
  // don't yet reflect a local change — pulling "live" stock at that point would
  // silently show a number the server itself considers wrong. So flush both
  // offline queues first, and refuse to refresh if anything is still stuck pending
  // (e.g. still offline, or the server rejected it) rather than show a misleading report.
  const ensureNothingPending = async () => {
    const [salesBefore, transfersBefore] = await Promise.all([getPendingCount(), getPendingStockCount()]);
    if (salesBefore === 0 && transfersBefore === 0) return true;

    if (!navigator.onLine) {
      message.error(
        `Cannot refresh — ${salesBefore} sale(s) and ${transfersBefore} stock transfer(s) are pending sync and you're offline. Reconnect and sync first.`
      );
      return false;
    }

    message.info("Syncing pending sales/transfers before refreshing stock…");
    await Promise.all([syncPendingSales(), syncPendingStockTransfers()]);

    const [salesAfter, transfersAfter] = await Promise.all([getPendingCount(), getPendingStockCount()]);
    if (salesAfter > 0 || transfersAfter > 0) {
      message.error(
        `Cannot refresh — ${salesAfter} sale(s) and ${transfersAfter} stock transfer(s) still failed to sync. Resolve them first so stock is accurate.`
      );
      return false;
    }
    return true;
  };

  // Re-fetches every item's live stock from the server (wiping and reloading the
  // shared item cache, same as the top-bar "Refresh" button) so the report reflects
  // stock at the moment it's generated rather than whatever was last synced.
  const refreshAndLoad = async () => {
    if (!branchCode) { message.error("No branch selected."); return; }
    setLoading(true);
    try {
      if (!(await ensureNothingPending())) return;
      await loadAllItemsToCache({});
      const items = await db.items.orderBy("itemName").toArray();
      const inStock = items.filter((r) => (Number(r.availableQty) || 0) > 0);
      setRows(inStock);
      setGeneratedAt(new Date());
      message.success(`Stock refreshed — ${inStock.length} items in stock`);
    } catch (e) {
      message.error("Failed to refresh stock: " + (e.message || "Unknown error"));
    } finally {
      setLoading(false);
    }
  };

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      String(r.itemName || "").toLowerCase().includes(q) ||
      String(r.barcode || "").toLowerCase().includes(q) ||
      String(r.category || "").toLowerCase().includes(q)
    );
  }, [rows, search]);

  const downloadPdf = async () => {
    if (!window.POS?.printToPDF) { message.error("PDF export is not available in this build."); return; }
    if (!filteredRows.length) { message.warning("No stock data to export. Refresh first."); return; }

    const genAt = generatedAt || new Date();
    const html = buildReportHtml({
      branchCode,
      generatedAt: genAt.toLocaleString("en-IN", {
        day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
      }),
      rows: filteredRows,
    });
    const fileStamp = genAt.toISOString().slice(0, 19).replace(/[:T]/g, "-");

    setSavingPdf(true);
    try {
      const result = await window.POS.printToPDF({
        html,
        defaultFileName: `stock-report-${branchCode}-${fileStamp}.pdf`,
      });
      if (result?.saved) message.success(`Saved: ${result.filePath}`);
    } catch (e) {
      message.error("PDF export failed: " + (e.message || "Unknown error"));
    } finally {
      setSavingPdf(false);
    }
  };

  return (
    <div style={{ padding: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, flexWrap: "wrap", gap: 8 }}>
        <Title level={3} style={{ margin: 0, color: "#0b3a75" }}>
          Current Stock Report
        </Title>
        <Space wrap>
          <Text style={{ color: "#374151" }}>Branch:</Text>
          <Text strong style={{ color: "#1f2937" }}>{branchCode || "-"}</Text>

          <Input.Search
            placeholder="Filter by item / barcode / category"
            style={{ width: 240 }}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            allowClear
          />

          <Button type="primary" onClick={refreshAndLoad} loading={loading}>
            Refresh Stock
          </Button>
          <Button onClick={downloadPdf} loading={savingPdf} disabled={!filteredRows.length}>
            Download PDF
          </Button>
        </Space>
      </div>

      {generatedAt && (
        <Text style={{ display: "block", marginBottom: 8, color: "#6b7280", fontSize: 12 }}>
          Stock as of {generatedAt.toLocaleString("en-IN", {
            day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
          })}
        </Text>
      )}

      <Table
        size="small"
        dataSource={filteredRows}
        columns={columns}
        rowKey="itemId"
        pagination={{ pageSize: 50, showSizeChanger: true }}
        locale={{ emptyText: generatedAt ? (search ? "No items match this filter" : "No items currently in stock") : "Click Refresh Stock to load current stock" }}
      />
    </div>
  );
}
