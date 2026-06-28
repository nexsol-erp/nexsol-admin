import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Button, Input, InputNumber, message, Modal, Select, Space, Table, Tag, Tooltip, Typography,
} from "antd";
import {
  CloseOutlined, DeleteOutlined, DollarOutlined, MergeCellsOutlined,
  PlusOutlined, PrinterOutlined, ScissorOutlined, SettingOutlined, ShoppingCartOutlined,
} from "@ant-design/icons";
import ItemLookupModal from "../components/ItemLookupModal";
import { localSearchItems } from "../cache/itemCache";
import {
  getAllActiveKots, getKotLines, getNextKotNumber, getOpenKotForTable,
  closeKot, markKotBilled, markKotPrinted, mergeKots, saveKot, splitKot,
} from "./kotDb";
import { buildKotHtml, buildBillHtml, buildFinalReceiptHtml } from "./kotPrint";
import { nowIST, todayIST } from "../utils/timeUtils";
import { generateVoucherNumber } from "../utils/posDevice";
import { applySaleToCache, loadReceiptModesFromCache } from "../cache/itemCache";
import { queueSale } from "./offlineQueue";
import { apiUrl } from "../utils/apiUrl";

const { Text, Title } = Typography;
const TABLES_KEY = "kot_tables_config";

const STATUS_BG    = { vacant: "#d1fae5", open: "#fed7aa", printed: "#fecaca", billed: "#bfdbfe" };
const STATUS_FG    = { vacant: "#065f46", open: "#9a3412", printed: "#991b1b", billed: "#1e40af" };
const STATUS_LABEL = { vacant: "VACANT",  open: "OPEN",    printed: "PRINTED", billed: "BILLED"  };

function defaultTables() {
  return Array.from({ length: 12 }, (_, i) => ({ id: `T${i + 1}`, name: `T${i + 1}` }));
}
function loadTables() {
  try {
    const raw = JSON.parse(localStorage.getItem(TABLES_KEY) || "null");
    if (Array.isArray(raw) && raw.length) return raw;
  } catch {}
  return defaultTables();
}
function round2(v) { return Math.round(Number(v) * 100) / 100; }

export default function KOTPage({ selectedBranchCode }) {
  // ── Tables ─────────────────────────────────────────────────────────────────
  const [tables,        setTables]        = useState(loadTables);
  const [tableStatuses, setTableStatuses] = useState({});
  const [addTableOpen,  setAddTableOpen]  = useState(false);
  const [newTableName,  setNewTableName]  = useState("");

  // ── KOT modal ──────────────────────────────────────────────────────────────
  const [kotOpen,      setKotOpen]      = useState(false);
  const [activeTable,  setActiveTable]  = useState(null);
  const [kotId,        setKotId]        = useState(null);
  const [kotNumber,    setKotNumber]    = useState(null);
  const [salesMan,     setSalesMan]     = useState("");
  const [kotLines,     setKotLines]     = useState([]);
  const [lookupOpen,   setLookupOpen]   = useState(false);
  const [barcodeInput, setBarcodeInput] = useState("");
  const [saving,       setSaving]       = useState(false);

  // ── Print options dialog ───────────────────────────────────────────────────
  const [printDialog, setPrintDialog] = useState(false);

  // ── Payment / finalise modal ───────────────────────────────────────────────
  const [payOpen,       setPayOpen]       = useState(false);
  const [payMode,       setPayMode]       = useState("CASH");
  const [tendered,      setTendered]      = useState(0);
  const [finalising,    setFinalising]    = useState(false);
  const [receiptModes,  setReceiptModes]  = useState(["CASH", "CARD", "UPI"]);

  // ── Split modal ────────────────────────────────────────────────────────────
  const [splitOpen,     setSplitOpen]     = useState(false);
  const [splitSelected, setSplitSelected] = useState([]);
  const [splitTargetId, setSplitTargetId] = useState(null);

  // ── Merge modal ────────────────────────────────────────────────────────────
  const [mergeOpen,     setMergeOpen]     = useState(false);
  const [mergeSourceId, setMergeSourceId] = useState(null);

  // ── Takeaway modal ────────────────────────────────────────────────────────
  const [taOpen,     setTaOpen]     = useState(false);
  const [taCustomer, setTaCustomer] = useState("");
  const [taMobile,   setTaMobile]   = useState("");
  const [taOrderNo,  setTaOrderNo]  = useState("");
  const [taLines,    setTaLines]    = useState([]);
  const [taLookup,   setTaLookup]   = useState(false);

  const [branchInfo, setBranchInfo] = useState(null);
  const barcodeRef  = useRef(null);
  const salesManRef = useRef(null);
  const newTableRef = useRef(null);

  // ── Branch info ────────────────────────────────────────────────────────────
  useEffect(() => {
    const tenancyId = localStorage.getItem("tenancyId");
    const token     = localStorage.getItem("jwtToken");
    if (!tenancyId || !token) return;
    const bc = selectedBranchCode || globalThis.POS_BRANCH_CODE || localStorage.getItem("selectedBranchCode") || "";
    fetch(`/api/${tenancyId}/branches`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((data) => {
        const list = data?.branches ?? data?.data ?? (Array.isArray(data) ? data : []);
        setBranchInfo(list.find((b) => b.branchCode === bc) || null);
      })
      .catch(() => {});
  }, [selectedBranchCode]);

  // ── Receipt modes ──────────────────────────────────────────────────────────
  useEffect(() => {
    loadReceiptModesFromCache()
      .then((modes) => {
        const names = (modes || []).map((m) => (typeof m === "string" ? m : m.receiptMode || m.receipt_mode)).filter(Boolean);
        if (names.length) setReceiptModes(names);
      })
      .catch(() => {});
  }, []);

  // ── Table statuses ─────────────────────────────────────────────────────────
  const refreshStatuses = useCallback(async () => {
    const kots = await getAllActiveKots();
    const map  = {};
    for (const h of kots) {
      if (!h.tableId) continue;
      const lines = await getKotLines(h.id);
      const total = lines.reduce((s, l) => s + (Number(l.amount) || 0), 0);
      map[h.tableId] = { status: h.status, kotTotal: total, kotId: h.id };
    }
    setTableStatuses(map);
  }, []);

  useEffect(() => { refreshStatuses(); }, [refreshStatuses]);

  // ── Table management ───────────────────────────────────────────────────────
  const saveTables = (next) => {
    localStorage.setItem(TABLES_KEY, JSON.stringify(next));
    setTables(next);
  };

  const handleAddTable = () => {
    const name = newTableName.trim();
    if (!name) return;
    const id = name.toUpperCase().replace(/\s+/g, "_");
    if (tables.some((t) => t.id === id)) { message.warning("A table with that name already exists"); return; }
    saveTables([...tables, { id, name }]);
    setNewTableName("");
    setAddTableOpen(false);
  };

  const handleRemoveTable = (e, tableId) => {
    e.stopPropagation();
    const ts = tableStatuses[tableId];
    if (ts?.status && ts.status !== "vacant") { message.warning("Cannot remove an occupied table"); return; }
    saveTables(tables.filter((t) => t.id !== tableId));
  };

  // ── Open table ─────────────────────────────────────────────────────────────
  const openTable = async (table) => {
    setActiveTable(table);
    const existing = await getOpenKotForTable(table.id);
    if (existing) {
      const lines = await getKotLines(existing.id);
      setKotId(existing.id);
      setKotNumber(existing.kotNumber || null);
      setSalesMan(existing.salesMan || "");
      setKotLines(lines.map((l, i) => ({ ...l, _key: l.id ?? i })));
    } else {
      setKotId(null);
      setKotNumber(null);
      setSalesMan("");
      setKotLines([]);
    }
    setBarcodeInput("");
    setKotOpen(true);
    setTimeout(() => salesManRef.current?.focus?.(), 100);
  };

  // ── Line helpers ───────────────────────────────────────────────────────────
  const addLine = (item, setter) => {
    const rate = Number(item.standardPrice) || 0;
    setter((prev) => [...prev, {
      _key:       Date.now(),
      kotPrinted: false,
      itemId:     item.itemId,
      itemName:   item.itemName,
      barcode:    item.barcode   || "",
      batchCode:  item.batchCode || "",
      unit:       item.unitName  || "",
      taxRate:    Number(item.taxRate) || 0,
      qty:        1,
      rate,
      amount:     rate,
    }]);
  };

  const updateQty = (idx, qty, setter) => {
    setter((prev) => {
      const next   = [...prev];
      const newQty = Number(qty) || 0;
      next[idx]    = { ...next[idx], qty: newQty, amount: round2(newQty * Number(next[idx].rate)) };
      return next;
    });
  };

  const deleteLine = (idx, setter) => setter((prev) => prev.filter((_, i) => i !== idx));

  // ── Barcode key ────────────────────────────────────────────────────────────
  const handleBarcodeKey = async (e) => {
    if (e.key !== "Enter") return;
    const code = barcodeInput.trim();
    setBarcodeInput("");
    if (!code) { setLookupOpen(true); return; }
    const results = await localSearchItems(code, 2);
    const exact   = results.find((r) => (r.barcode || "").toLowerCase() === code.toLowerCase()) || results[0];
    if (exact) { addLine(exact, setKotLines); barcodeRef.current?.focus?.(); }
    else       { setLookupOpen(true); }
  };

  // ── Build header / lines for DB save ──────────────────────────────────────
  const buildHeader = (status) => ({
    ...(kotId !== null ? { id: kotId } : {}),
    tableId:   activeTable?.id,
    tableName: activeTable?.name,
    salesMan,
    status,
    kotDate:   todayIST(),
    kotNumber: kotNumber || null,
  });

  const buildLines = (lines = kotLines) =>
    lines.map((l) => ({
      itemId:     l.itemId,
      itemName:   l.itemName,
      barcode:    l.barcode    || "",
      batchCode:  l.batchCode  || "",
      unit:       l.unit       || "",
      taxRate:    l.taxRate    || 0,
      qty:        Number(l.qty)    || 0,
      rate:       Number(l.rate)   || 0,
      amount:     Number(l.amount) || 0,
      kotPrinted: l.kotPrinted     || false,
    }));

  // ── Ensure KOT saved ───────────────────────────────────────────────────────
  const ensureSaved = async (status = "open") => {
    const id = await saveKot(buildHeader(status), buildLines());
    setKotId(id);
    return id;
  };

  // ── Print core ─────────────────────────────────────────────────────────────
  const executePrint = (html) => {
    if (window.POS?.printHtml) {
      const printer = localStorage.getItem("posPrinter") || "";
      window.POS.printHtml({ html, silent: true, deviceName: printer }).catch(() => {
        openBrowserPrint(html);
      });
    } else {
      openBrowserPrint(html);
    }
  };

  const openBrowserPrint = (html) => {
    const win = window.open("", "_blank", "width=420,height=620");
    if (win) {
      win.document.write(html);
      win.document.close();
      win.focus();
      win.onload = () => { win.print(); win.onafterprint = () => win.close(); };
    }
  };

  // ── doKOT: save + mark printed + print ────────────────────────────────────
  const doKOT = async (linesToPrint) => {
    setSaving(true);
    try {
      const newKotNum = kotNumber || (await getNextKotNumber());
      const printedKeys = new Set(linesToPrint.map((l) => l._key));
      const updatedLines = kotLines.map((l) =>
        printedKeys.has(l._key) ? { ...l, kotPrinted: true } : l
      );
      const headerId = await saveKot(
        { ...buildHeader("printed"), kotNumber: newKotNum },
        buildLines(updatedLines)
      );
      await markKotPrinted(headerId, newKotNum);
      setKotId(headerId);
      setKotNumber(newKotNum);
      setKotLines(updatedLines);
      await refreshStatuses();

      const isDuplicate = linesToPrint.length === kotLines.length && !!kotNumber;
      const html = buildKotHtml({
        branchName:    branchInfo?.branchName,
        branchAddress: [branchInfo?.branchBuildingAddress, branchInfo?.branchAddress1].filter(Boolean).join(", "),
        kotNumber:     newKotNum,
        voucherDate:   nowIST(),
        salesMan,
        tableName:     activeTable?.name,
        items:         linesToPrint,
        isDuplicate,
      });
      executePrint(html);
      setKotOpen(false);
      setPrintDialog(false);
    } catch (err) {
      message.error("KOT failed: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  // ── KOT button ─────────────────────────────────────────────────────────────
  const handleKOT = () => {
    if (!kotLines.length) return message.warning("No items in KOT");
    const hasAlreadyPrinted = kotLines.some((l) => l.kotPrinted);
    const newLines          = kotLines.filter((l) => !l.kotPrinted);
    if (hasAlreadyPrinted && newLines.length > 0) {
      setPrintDialog(true);
    } else {
      doKOT(kotLines);
    }
  };

  // ── Print Bill (proforma) ─────────────────────────────────────────────────
  const handlePrintBill = async () => {
    if (!kotLines.length) return message.warning("No items in KOT");
    setSaving(true);
    try {
      const id = await ensureSaved("billed");
      await markKotBilled(id);
      await refreshStatuses();
      const html = buildBillHtml({
        branchName:    branchInfo?.branchName,
        branchAddress: [branchInfo?.branchBuildingAddress, branchInfo?.branchAddress1].filter(Boolean).join(", "),
        branchGst:     branchInfo?.branchGst,
        tableName:     activeTable?.name,
        salesMan,
        items:         kotLines,
        voucherDate:   nowIST(),
        kotNumber,
      });
      executePrint(html);
      setKotOpen(false);
    } catch (err) {
      message.error("Print bill failed: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  // ── Open payment modal ────────────────────────────────────────────────────
  const openPayModal = () => {
    if (!kotLines.length) return message.warning("No items in KOT");
    setPayMode(receiptModes[0] || "CASH");
    setTendered(kotTotal);
    setPayOpen(true);
  };

  // ── Finalise sale ─────────────────────────────────────────────────────────
  const finaliseSale = async () => {
    setFinalising(true);
    const tenantId  = localStorage.getItem("tenancyId") || "";
    const token     = localStorage.getItem("jwtToken")  || "";
    const branch    = selectedBranchCode || globalThis.POS_BRANCH_CODE || localStorage.getItem("selectedBranchCode") || "";

    if (!branch) { message.warning("No branch selected"); setFinalising(false); return; }

    try {
      const headerId = crypto.randomUUID();
      const { voucherNumber, numericSeq } = generateVoucherNumber(branch);
      const voucherPrefix = localStorage.getItem(`posBranchPrefix_${branch}`) || "POS";

      const header = {
        id:                     headerId,
        branch_code:            branch,
        sales_man_name:         salesMan || "",
        customer_mobile:        "",
        numeric_voucher_number: numericSeq,
        voucher_number:         voucherNumber,
        voucher_prefix:         voucherPrefix,
        voucher_date:           nowIST(),
        company_mst_id:         tenantId,
        is_synched:             "0",
      };

      const details = kotLines.map((l) => ({
        id:             crypto.randomUUID(),
        parent_id:      headerId,
        item_name:      l.itemName   || "",
        item_id:        l.itemId     || "",
        barcode:        l.barcode    || "",
        tax_rate:       Number(l.taxRate) || 0,
        cess_rate:      0,
        unit:           l.unit       || "",
        item_code:      "",
        qty:            Number(l.qty)    || 0,
        rate:           Number(l.rate)   || 0,
        standard_price: Number(l.rate)   || 0,
        amount:         Number(l.amount) || 0,
        batch:          l.batchCode  || "",
        expiry:         null,
        description:    "",
      }));

      const isCash  = payMode.toUpperCase() === "CASH";
      const payAmt  = round2(kotTotal);
      const receiptLines = [{ receipt_mode: payMode, amount: payAmt }];

      const payload = { sales: [{ header, details, receipts: receiptLines }] };

      const saleUrl = apiUrl(`/api/${tenantId}/sales-upload/${branch}`);
      const response = await fetch(saleUrl, {
        method:  "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body:    JSON.stringify(payload),
      });

      if (!response.ok) {
        const txt = await response.text().catch(() => "");
        let msg = `Save failed: ${response.status}`;
        try { msg = JSON.parse(txt)?.message || msg; } catch {}
        if (response.status === 401) { message.error("Session expired — please log in again."); return; }
        throw new Error(msg);
      }

      const result = await response.json().catch(() => ({}));
      if (result.failedIds?.length > 0) throw new Error(Object.values(result.errorMessages || {}).join("; ") || "Upload failed");

      await applySaleToCache(kotLines.map((l) => ({ itemId: l.itemId, batchCode: l.batchCode || "", qty: Number(l.qty) || 0 })));
      await closeKot(kotId || (await ensureSaved("billed")));
      await refreshStatuses();

      const change = isCash ? Math.max(round2((Number(tendered) || 0) - payAmt), 0) : 0;
      const finalHtml = buildFinalReceiptHtml({
        branchName:    branchInfo?.branchName,
        branchAddress: [branchInfo?.branchBuildingAddress, branchInfo?.branchAddress1].filter(Boolean).join(", "),
        branchGst:     branchInfo?.branchGst,
        tableName:     activeTable?.name,
        salesMan,
        items:         kotLines,
        voucherNumber,
        voucherDate:   nowIST(),
        payMode,
        tendered:      Number(tendered) || 0,
        change,
      });
      executePrint(finalHtml);

      message.success(`Bill saved — ${voucherNumber}`);
      setPayOpen(false);
      setKotOpen(false);
    } catch (err) {
      // Offline / server error — queue it
      const isOffline = !navigator.onLine || err instanceof TypeError;
      if (isOffline || (err.httpStatus >= 500)) {
        try {
          const tenantId = localStorage.getItem("tenancyId") || "";
          const branch   = selectedBranchCode || localStorage.getItem("selectedBranchCode") || "";
          const headerId = crypto.randomUUID();
          const { voucherNumber, numericSeq } = generateVoucherNumber(branch);
          const voucherPrefix = localStorage.getItem(`posBranchPrefix_${branch}`) || "POS";
          const header = {
            id: headerId, branch_code: branch, sales_man_name: salesMan || "",
            customer_mobile: "", numeric_voucher_number: numericSeq,
            voucher_number: voucherNumber, voucher_prefix: voucherPrefix,
            voucher_date: nowIST(), company_mst_id: tenantId, is_synched: "0",
          };
          const details = kotLines.map((l) => ({
            id: crypto.randomUUID(), parent_id: headerId,
            item_name: l.itemName || "", item_id: l.itemId || "",
            barcode: l.barcode || "", tax_rate: Number(l.taxRate) || 0,
            cess_rate: 0, unit: l.unit || "", item_code: "", qty: Number(l.qty) || 0,
            rate: Number(l.rate) || 0, standard_price: Number(l.rate) || 0,
            amount: Number(l.amount) || 0, batch: l.batchCode || "", expiry: null, description: "",
          }));
          const payload = { sales: [{ header, details, receipts: [{ receipt_mode: payMode, amount: round2(kotTotal) }] }] };
          await queueSale({ tenantId, branchCode: branch, payload, voucherNumber });
          await applySaleToCache(kotLines.map((l) => ({ itemId: l.itemId, batchCode: l.batchCode || "", qty: Number(l.qty) || 0 })));
          await closeKot(kotId);
          await refreshStatuses();
          message.warning("No network — sale queued for sync");
          setPayOpen(false);
          setKotOpen(false);
        } catch (qErr) {
          message.error("Offline queue failed: " + qErr.message);
        }
      } else {
        message.error("Save failed: " + err.message);
      }
    } finally {
      setFinalising(false);
    }
  };

  // ── Close / hold ───────────────────────────────────────────────────────────
  const handleClose = () => {
    const hasPrinted = kotLines.some((l) => l.kotPrinted);
    if (hasPrinted) {
      // Items already sent to kitchen — must not be discarded, only hold
      ensureSaved("printed").then(refreshStatuses);
      setKotOpen(false);
      return;
    }
    if (kotLines.length > 0) {
      Modal.confirm({
        title:      "Unsaved KOT",
        content:    "Hold items on this table, or discard?",
        okText:     "Hold",
        cancelText: "Discard",
        onOk:       async () => { await ensureSaved("open"); await refreshStatuses(); setKotOpen(false); },
        onCancel:   async () => { if (kotId) { await closeKot(kotId); await refreshStatuses(); } setKotOpen(false); },
      });
    } else {
      if (kotId) { closeKot(kotId).then(refreshStatuses); }
      setKotOpen(false);
    }
  };

  // ── Split ──────────────────────────────────────────────────────────────────
  const openSplit = () => { setSplitSelected([]); setSplitTargetId(null); setSplitOpen(true); };

  const handleSplitConfirm = async () => {
    if (!splitSelected.length)  return message.warning("Select items to move");
    if (!splitTargetId)         return message.warning("Select a target table");
    if (splitTargetId === activeTable?.id) return message.warning("Cannot split to the same table");
    try {
      const currentId   = kotId || (await ensureSaved("open"));
      const itemsToMove = kotLines
        .filter((l) => splitSelected.includes(l._key))
        .map((l) => ({ itemId: l.itemId, batchCode: l.batchCode || "" }));
      const targetTable = tables.find((t) => t.id === splitTargetId);
      await splitKot(currentId, itemsToMove, splitTargetId, targetTable?.name || splitTargetId);
      const existing = await getOpenKotForTable(activeTable?.id);
      if (existing) {
        const lines = await getKotLines(existing.id);
        setKotId(existing.id);
        setKotLines(lines.map((l, i) => ({ ...l, _key: l.id ?? i })));
      } else {
        setKotOpen(false);
      }
      await refreshStatuses();
      setSplitOpen(false);
      message.success("Table split successfully");
    } catch (err) {
      message.error("Split failed: " + err.message);
    }
  };

  // ── Merge ──────────────────────────────────────────────────────────────────
  const openMerge = () => { setMergeSourceId(null); setMergeOpen(true); };

  const handleMergeConfirm = async () => {
    if (!mergeSourceId) return message.warning("Select a table to merge from");
    try {
      const currentId = kotId || (await ensureSaved("open"));
      await mergeKots(mergeSourceId, currentId);
      const lines = await getKotLines(currentId);
      setKotLines(lines.map((l, i) => ({ ...l, _key: l.id ?? i })));
      await refreshStatuses();
      setMergeOpen(false);
      message.success("Tables merged");
    } catch (err) {
      message.error("Merge failed: " + err.message);
    }
  };

  // ── Takeaway ───────────────────────────────────────────────────────────────
  const handleTaKOT = async () => {
    if (!taLines.length) return message.warning("No items");
    const num  = await getNextKotNumber();
    const html = buildKotHtml({
      branchName:    branchInfo?.branchName,
      branchAddress: [branchInfo?.branchBuildingAddress, branchInfo?.branchAddress1].filter(Boolean).join(", "),
      kotNumber:     num,
      voucherDate:   nowIST(),
      salesMan:      taCustomer,
      tableName:     `Takeaway${taOrderNo ? " #" + taOrderNo : ""}`,
      items:         taLines,
    });
    executePrint(html);
    closeTakeaway();
  };

  const closeTakeaway = () => { setTaOpen(false); setTaLines([]); setTaCustomer(""); setTaMobile(""); setTaOrderNo(""); };

  // ── Derived ────────────────────────────────────────────────────────────────
  const kotTotal = kotLines.reduce((s, l) => s + (Number(l.amount) || 0), 0);
  const kotQty   = kotLines.reduce((s, l) => s + (Number(l.qty)    || 0), 0);
  const taTotal  = taLines.reduce( (s, l) => s + (Number(l.amount) || 0), 0);
  const taQty    = taLines.reduce( (s, l) => s + (Number(l.qty)    || 0), 0);
  const newLines = kotLines.filter((l) => !l.kotPrinted);
  const occupiedTablesExceptCurrent = Object.entries(tableStatuses)
    .filter(([id, ts]) => id !== activeTable?.id && ts.status !== "vacant")
    .map(([id, ts]) => ({ id, ...ts }));

  const isCashMode    = payMode.toUpperCase() === "CASH";
  const tenderedNum   = Number(tendered) || 0;
  const changeAmount  = isCashMode ? Math.max(round2(tenderedNum - kotTotal), 0) : 0;
  const canFinalise   = kotTotal > 0 && (!isCashMode || tenderedNum >= kotTotal);

  // ── Column definitions ────────────────────────────────────────────────────
  const makeColumns = (setter) => [
    { title: "#", width: 32, render: (_, __, i) => i + 1 },
    {
      title: "Item", dataIndex: "itemName",
      render: (t, row) => (
        <Space size={4}>
          <Text strong style={{ fontSize: 12 }}>{t}</Text>
          {!row.kotPrinted && <Tag color="orange" style={{ fontSize: 10, padding: "0 4px", lineHeight: "16px" }}>NEW</Tag>}
        </Space>
      ),
    },
    { title: "Unit", dataIndex: "unit", width: 55 },
    {
      title: "Qty", dataIndex: "qty", width: 80,
      render: (v, row, idx) =>
        row.kotPrinted
          ? <Text style={{ fontSize: 12 }}>{Number(v).toFixed(2)}</Text>
          : <InputNumber size="small" value={v} min={0.01} step={1} style={{ width: 72 }}
              onChange={(val) => updateQty(idx, val, setter)} />,
    },
    { title: "Rate",   dataIndex: "rate",   width: 78, align: "right", render: (v) => Number(v).toFixed(2) },
    { title: "Amount", dataIndex: "amount", width: 88, align: "right", render: (v) => <Text strong>{Number(v).toFixed(2)}</Text> },
    {
      title: "", width: 38,
      render: (_, row, idx) =>
        row.kotPrinted
          ? <Tooltip title="Already sent to kitchen — cannot delete"><Button type="text" size="small" icon={<DeleteOutlined />} disabled /></Tooltip>
          : <Button type="text" danger size="small" icon={<DeleteOutlined />} onClick={() => deleteLine(idx, setter)} />,
    },
  ];

  const kotColumns  = makeColumns(setKotLines);
  const taColumns   = makeColumns(setTaLines);
  const splitColumns = [
    { title: "Item", dataIndex: "itemName", render: (t) => <Text style={{ fontSize: 12 }}>{t}</Text> },
    { title: "Qty",  dataIndex: "qty",    width: 60, render: (v) => Number(v).toFixed(2) },
    { title: "Amt",  dataIndex: "amount", width: 80, align: "right", render: (v) => Number(v).toFixed(2) },
  ];

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ padding: "10px 14px" }}>
      {/* Page header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <div>
          <Title level={5} style={{ margin: 0 }}>KOT</Title>
          {selectedBranchCode && (
            <Text style={{ fontSize: 12, color: "#555" }}>
              {selectedBranchCode}{branchInfo?.branchName ? " — " + branchInfo.branchName : ""}
            </Text>
          )}
        </div>
        <Space>
          <Button icon={<SettingOutlined />} onClick={() => { setNewTableName(""); setAddTableOpen(true); }}>
            Add Table
          </Button>
          <Button icon={<ShoppingCartOutlined />} onClick={() => { setTaLines([]); setTaOpen(true); }}>
            Takeaway
          </Button>
        </Space>
      </div>

      {/* ── Table board ──────────────────────────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))", gap: 10 }}>
        {tables.map((table) => {
          const ts     = tableStatuses[table.id];
          const status = ts?.status || "vacant";
          const total  = ts?.kotTotal || 0;
          const bg     = STATUS_BG[status] || STATUS_BG.vacant;
          const fg     = STATUS_FG[status] || STATUS_FG.vacant;
          const vacant = status === "vacant";
          return (
            <div
              key={table.id}
              onClick={() => openTable(table)}
              style={{ background: bg, border: `2px solid ${fg}`, borderRadius: 8, padding: "10px 8px", textAlign: "center", cursor: "pointer", userSelect: "none", position: "relative" }}
            >
              {vacant && (
                <span
                  onClick={(e) => handleRemoveTable(e, table.id)}
                  title="Remove table"
                  style={{ position: "absolute", top: 3, right: 5, fontSize: 12, color: fg, opacity: 0.5, cursor: "pointer", lineHeight: 1 }}
                >×</span>
              )}
              <div style={{ fontWeight: 700, fontSize: 20, color: fg }}>{table.name}</div>
              <div style={{ fontSize: 10, color: fg, marginTop: 2 }}>{STATUS_LABEL[status] || status.toUpperCase()}</div>
              {total > 0 && (
                <div style={{ fontSize: 12, fontWeight: 600, marginTop: 4, color: fg }}>₹{total.toFixed(2)}</div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── KOT entry modal ──────────────────────────────────────────────────── */}
      <Modal
        open={kotOpen}
        onCancel={handleClose}
        title={
          <Space>
            <span>KOT — {activeTable?.name}</span>
            {kotNumber && <Tag color="red">KOT #{kotNumber}</Tag>}
            {newLines.length > 0 && <Tag color="orange">{newLines.length} new</Tag>}
          </Space>
        }
        width={840}
        footer={null}
        centered
      >
        {/* Captain + Barcode row */}
        <div style={{ display: "flex", gap: 12, marginBottom: 10 }}>
          <div>
            <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 2 }}>Captain / Sales Man</div>
            <Input ref={salesManRef} size="small" value={salesMan} onChange={(e) => setSalesMan(e.target.value)}
              placeholder="Name" style={{ width: 180 }}
              onKeyDown={(e) => { if (e.key === "Enter") barcodeRef.current?.focus?.(); }} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 2 }}>Scan Barcode / Item</div>
            <Input ref={barcodeRef} size="small" value={barcodeInput}
              onChange={(e) => setBarcodeInput(e.target.value)} onKeyDown={handleBarcodeKey}
              placeholder="Scan barcode or press Enter to search"
              suffix={
                <Button type="link" size="small" icon={<PlusOutlined />}
                  onClick={() => setLookupOpen(true)} style={{ padding: 0 }}>Search</Button>
              } />
          </div>
        </div>

        <Table size="small" dataSource={kotLines} columns={kotColumns} rowKey="_key"
          pagination={false} scroll={{ y: 250 }}
          locale={{ emptyText: "No items — scan barcode or click Search" }} />

        {/* Footer */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10, padding: "8px 0", borderTop: "1px solid #f0f0f0" }}>
          <Space>
            <Text type="secondary">Qty: <Text strong>{kotQty.toFixed(2)}</Text></Text>
            <Text type="secondary">Amount: <Text strong style={{ fontSize: 15 }}>₹{kotTotal.toFixed(2)}</Text></Text>
          </Space>
          <Space>
            <Button icon={<CloseOutlined />} onClick={handleClose}>Close</Button>
            <Button icon={<ScissorOutlined />}    onClick={openSplit} disabled={!kotLines.length}>Split</Button>
            <Button icon={<MergeCellsOutlined />} onClick={openMerge} disabled={!occupiedTablesExceptCurrent.length}>Merge</Button>
            <Button
              icon={<PrinterOutlined />}
              onClick={handlePrintBill}
              loading={saving}
              disabled={!kotLines.length}
            >
              Print Bill
            </Button>
            <Button
              type="primary"
              icon={<DollarOutlined />}
              onClick={openPayModal}
              disabled={!kotLines.length}
              style={{ background: "#16a34a", borderColor: "#16a34a" }}
            >
              Collect Payment
            </Button>
            <Button
              type="primary"
              style={{ background: "#c026d3", borderColor: "#c026d3" }}
              icon={<PrinterOutlined />}
              onClick={handleKOT}
              loading={saving}
              disabled={!kotLines.length}
            >
              KOT
            </Button>
          </Space>
        </div>
      </Modal>

      {/* ── Print options dialog ──────────────────────────────────────────────── */}
      <Modal open={printDialog} onCancel={() => setPrintDialog(false)} title="Print Options" footer={null} centered width={420}>
        <div style={{ marginBottom: 12 }}>
          <Text>This table has <Text strong>{kotLines.filter(l => l.kotPrinted).length}</Text> already-printed item(s)
          and <Text strong style={{ color: "#c026d3" }}>{newLines.length}</Text> new item(s).</Text>
        </div>
        <Space direction="vertical" style={{ width: "100%" }}>
          <Button block type="primary" style={{ background: "#c026d3", borderColor: "#c026d3" }}
            icon={<PrinterOutlined />} onClick={() => doKOT(newLines)} loading={saving}>
            Print New Items Only ({newLines.length})
          </Button>
          <Button block icon={<PrinterOutlined />} onClick={() => doKOT(kotLines)} loading={saving}>
            Print Entire KOT ({kotLines.length} items)
          </Button>
          <Button block onClick={() => setPrintDialog(false)}>Cancel</Button>
        </Space>
      </Modal>

      {/* ── Collect payment modal ─────────────────────────────────────────────── */}
      <Modal
        open={payOpen}
        onCancel={() => setPayOpen(false)}
        title={`Collect Payment — ${activeTable?.name}`}
        width={420}
        footer={null}
        centered
      >
        <div style={{ marginBottom: 16, padding: "10px 14px", background: "#f0fdf4", borderRadius: 8, textAlign: "center" }}>
          <div style={{ fontSize: 12, color: "#6b7280" }}>Total Amount</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: "#16a34a" }}>₹{kotTotal.toFixed(2)}</div>
        </div>

        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 6 }}>Payment Mode</div>
          <Space wrap>
            {receiptModes.map((m) => (
              <Button
                key={m}
                type={payMode === m ? "primary" : "default"}
                onClick={() => { setPayMode(m); if (m.toUpperCase() !== "CASH") setTendered(kotTotal); }}
                style={payMode === m ? { background: "#1d4ed8", borderColor: "#1d4ed8" } : {}}
              >
                {m}
              </Button>
            ))}
          </Space>
        </div>

        {isCashMode && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 4 }}>Tendered Amount</div>
            <InputNumber
              style={{ width: "100%" }}
              size="large"
              value={tendered}
              min={kotTotal}
              onChange={(v) => setTendered(v || 0)}
              onFocus={(e) => e.target.select()}
              prefix="₹"
            />
            {tenderedNum > kotTotal && (
              <div style={{ marginTop: 6, fontSize: 13, color: "#6b7280" }}>
                Change: <strong style={{ color: "#16a34a" }}>₹{changeAmount.toFixed(2)}</strong>
              </div>
            )}
          </div>
        )}

        <Button
          type="primary"
          block
          size="large"
          loading={finalising}
          disabled={!canFinalise}
          onClick={finaliseSale}
          style={{ background: "#16a34a", borderColor: "#16a34a", marginTop: 4 }}
          icon={<DollarOutlined />}
        >
          Finalise & Print Receipt
        </Button>
      </Modal>

      {/* ── Split modal ───────────────────────────────────────────────────────── */}
      <Modal
        open={splitOpen}
        onCancel={() => setSplitOpen(false)}
        title={`Split Table — ${activeTable?.name}`}
        width={680}
        onOk={handleSplitConfirm}
        okText="Split"
        okButtonProps={{ disabled: !splitSelected.length || !splitTargetId }}
        centered
      >
        <div style={{ marginBottom: 10 }}>
          <Text type="secondary" style={{ fontSize: 12 }}>Select items to move, then choose the target table.</Text>
        </div>
        <Table
          size="small"
          rowSelection={{ selectedRowKeys: splitSelected, onChange: setSplitSelected }}
          dataSource={kotLines}
          columns={splitColumns}
          rowKey="_key"
          pagination={false}
          scroll={{ y: 220 }}
        />
        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 4 }}>Move to table:</div>
          <Select
            style={{ width: "100%" }}
            placeholder="Select target table"
            value={splitTargetId}
            onChange={setSplitTargetId}
            options={tables
              .filter((t) => t.id !== activeTable?.id)
              .map((t) => {
                const ts = tableStatuses[t.id];
                const label = ts?.status && ts.status !== "vacant"
                  ? `${t.name} (${STATUS_LABEL[ts.status] || ts.status} — ₹${ts.kotTotal.toFixed(2)})`
                  : t.name;
                return { value: t.id, label };
              })}
          />
        </div>
      </Modal>

      {/* ── Merge modal ───────────────────────────────────────────────────────── */}
      <Modal
        open={mergeOpen}
        onCancel={() => setMergeOpen(false)}
        title={`Merge into ${activeTable?.name}`}
        width={440}
        onOk={handleMergeConfirm}
        okText="Merge"
        okButtonProps={{ disabled: !mergeSourceId }}
        centered
      >
        <div style={{ marginBottom: 10 }}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            Select a table to merge into <Text strong>{activeTable?.name}</Text>.
            The selected table's items will move here and that table will be freed.
          </Text>
        </div>
        <Select
          style={{ width: "100%" }}
          placeholder="Select table to merge from"
          value={mergeSourceId}
          onChange={setMergeSourceId}
          options={occupiedTablesExceptCurrent.map((ts) => {
            const tableInfo = tables.find((t) => t.id === ts.id);
            return {
              value: ts.kotId,
              label: `${tableInfo?.name || ts.id} — ${STATUS_LABEL[ts.status] || ts.status} — ₹${ts.kotTotal.toFixed(2)}`,
            };
          })}
        />
      </Modal>

      {/* ── Add table modal ───────────────────────────────────────────────────── */}
      <Modal
        open={addTableOpen}
        onCancel={() => { setAddTableOpen(false); setNewTableName(""); }}
        title="Add New Table"
        onOk={handleAddTable}
        okText="Add"
        okButtonProps={{ disabled: !newTableName.trim() }}
        centered
        width={360}
        afterOpenChange={(open) => open && setTimeout(() => newTableRef.current?.focus?.(), 50)}
      >
        <Input
          ref={newTableRef}
          value={newTableName}
          onChange={(e) => setNewTableName(e.target.value)}
          placeholder="e.g. T13, VIP-1, Terrace"
          onKeyDown={(e) => e.key === "Enter" && handleAddTable()}
        />
      </Modal>

      {/* ── Takeaway modal ────────────────────────────────────────────────────── */}
      <Modal open={taOpen} onCancel={closeTakeaway} title="Takeaway Order" width={820} footer={null} centered>
        <div style={{ display: "flex", gap: 12, marginBottom: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
          <div>
            <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 2 }}>Order No</div>
            <Input size="small" value={taOrderNo} onChange={(e) => setTaOrderNo(e.target.value)} placeholder="Order #" style={{ width: 90 }} />
          </div>
          <div>
            <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 2 }}>Customer</div>
            <Input size="small" value={taCustomer} onChange={(e) => setTaCustomer(e.target.value)} placeholder="Name" style={{ width: 160 }} />
          </div>
          <div>
            <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 2 }}>Mobile</div>
            <Input size="small" value={taMobile} onChange={(e) => setTaMobile(e.target.value)} placeholder="Mobile" style={{ width: 120 }} />
          </div>
          <Button size="small" icon={<PlusOutlined />} onClick={() => setTaLookup(true)}>Add Item</Button>
        </div>
        <Table size="small" dataSource={taLines} columns={taColumns} rowKey="_key" pagination={false}
          scroll={{ y: 250 }} locale={{ emptyText: "No items — click Add Item" }} />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10, padding: "8px 0", borderTop: "1px solid #f0f0f0" }}>
          <Space>
            <Text type="secondary">Qty: <Text strong>{taQty.toFixed(2)}</Text></Text>
            <Text type="secondary">Amount: <Text strong style={{ fontSize: 15 }}>₹{taTotal.toFixed(2)}</Text></Text>
          </Space>
          <Space>
            <Button icon={<CloseOutlined />} onClick={closeTakeaway}>Cancel</Button>
            <Button type="primary" style={{ background: "#c026d3", borderColor: "#c026d3" }}
              icon={<PrinterOutlined />} onClick={handleTaKOT} disabled={!taLines.length}>KOT</Button>
          </Space>
        </div>
      </Modal>

      {/* ── Item lookup modals ────────────────────────────────────────────────── */}
      <ItemLookupModal open={lookupOpen} initialQuery=""
        onClose={() => { setLookupOpen(false); barcodeRef.current?.focus?.(); }}
        onPick={(item) => { addLine(item, setKotLines); setLookupOpen(false); barcodeRef.current?.focus?.(); }} />
      <ItemLookupModal open={taLookup} initialQuery=""
        onClose={() => setTaLookup(false)}
        onPick={(item) => { addLine(item, setTaLines); setTaLookup(false); }} />
    </div>
  );
}
