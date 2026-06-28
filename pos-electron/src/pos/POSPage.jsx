import React, { useEffect, useMemo, useRef, useState } from "react";
import { AutoComplete, Button, Input, InputNumber, Select, Table, message, Tag, Tooltip, Modal, Badge } from "antd";
import { SyncOutlined, PauseCircleOutlined, PlayCircleOutlined, DeleteOutlined } from "@ant-design/icons";
import { logout } from "../auth/auth";
import ItemLookupModal from "../components/ItemLookupModal";
import UpiPaymentModal from "./UpiPaymentModal";
import { applySaleToCache, findItemByName, loadReceiptModesFromCache, saveReceiptModesToCache, getShortcutItems } from "../cache/itemCache";
import ShortcutManageModal from "./ShortcutManageModal";
import { evaluateSchemes, buildOfferRows } from "./schemeEngine";
import { log, warn, error as logError } from "../utils/logger";
import { apiUrl } from "../utils/apiUrl";
import { queueSale, getPendingCount, syncPendingSales } from "./offlineQueue";
import { generateVoucherNumber } from "../utils/posDevice";
import { nowIST, todayIST } from "../utils/timeUtils";
import { db } from "../cache/itemCacheDb";
import { connect as wsConnect, disconnect as wsDisconnect, onMessage as wsOnMessage, onStateChange } from "../utils/posWebSocket";

export default function POSPage({ onLogout, selectedBranchCode = "", prefillItems = null, onPrefillUsed }) {

  const itemSearchRef = useRef(null);
  const tenderedRef = useRef(null);
  const saveButtonRef = useRef(null);
  const qtyInputRefs = useRef({});
  const lastActivityRef = useRef(Date.now());
  const pendingQtyFocusKey = useRef(null);
  const savingRef = useRef(false);
  const categoryMapRef = useRef({});

  const [isSaving, setIsSaving] = useState(false);
  const [customerMobile, setCustomerMobile] = useState("");
  const [salesmanCode, setSalesmanCode] = useState("");
  const [salesmanName, setSalesmanName] = useState("");
  const [itemQuery, setItemQuery] = useState("");
  const [items, setItems] = useState([]);
  const [lookupOpen, setLookupOpen] = useState(false);
  const [lookupQuery, setLookupQuery] = useState("");
  const [pendingCount, setPendingCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [reprintOpen, setReprintOpen] = useState(false);
  const [reprintHistory, setReprintHistory] = useState([]);
  const [holdCount, setHoldCount] = useState(0);
  const [recallOpen, setRecallOpen] = useState(false);
  const [heldBills, setHeldBills] = useState([]);
  const [wsOnline, setWsOnline] = useState(false);
  const [schemes, setSchemes] = useState([]);
  const [categoryMap, setCategoryMap] = useState({});
  const [quickItems,        setQuickItems]        = useState([]);
  const [shortcutMgrOpen,   setShortcutMgrOpen]   = useState(false);
  const [salesmanOptions,   setSalesmanOptions]   = useState([]);

  // Offline queue — poll every 10 s; sync only when idle >= 30 s and online
  useEffect(() => {
    getPendingCount().then(setPendingCount);
    db.pos_holds.count().then(setHoldCount);

    let busy = false;

    const trySync = async () => {
      if (busy || !navigator.onLine) return;
      const count = await getPendingCount();
      if (!count) return;
      const idleMs = Date.now() - lastActivityRef.current;
      if (idleMs < 120_000) return;

      busy = true;
      setSyncing(true);
      log("offlineQueue: idle sync triggered | pending:", count, "| idleMs:", idleMs);
      const { synced, failed } = await syncPendingSales();
      if (synced > 0) message.success(`Synced ${synced} offline sale${synced > 1 ? "s" : ""}`);
      if (failed > 0) message.warning(`${failed} sale${failed > 1 ? "s" : ""} still pending`);
      setPendingCount(await getPendingCount());
      setSyncing(false);
      busy = false;
    };

    const interval = setInterval(trySync, 10_000);
    // Also attempt immediately when coming back online
    window.addEventListener("online", trySync);

    return () => {
      clearInterval(interval);
      window.removeEventListener("online", trySync);
    };
  }, []);

  useEffect(() => { log("POSPage mounted"); }, []);

  const refreshQuickItems = () => getShortcutItems().then(setQuickItems).catch(() => {});
  useEffect(() => { refreshQuickItems(); }, []);

  const loadSalesmanOptions = async () => {
    try {
      const rows = await db.salesmen.orderBy("code").toArray();
      setSalesmanOptions(rows.map((r) => ({ value: r.code })));
    } catch (_) {}
  };
  useEffect(() => { loadSalesmanOptions(); }, []);

  const persistSalesmanCode = async (code) => {
    const trimmed = (code || "").trim();
    if (!trimmed) return;
    try {
      await db.salesmen.put({ code: trimmed });
      loadSalesmanOptions();
    } catch (_) {}
  };

  // Alt+1…Alt+9 = quick items 1–9, Alt+0 = item 10, Alt+S = save invoice
  const quickItemsRef = useRef([]);
  const onSaveRef     = useRef(null);
  const canSaveRef    = useRef(false);
  useEffect(() => { quickItemsRef.current = quickItems; }, [quickItems]);
  useEffect(() => { categoryMapRef.current = categoryMap; }, [categoryMap]);
  useEffect(() => {
    const handler = (e) => {
      if (!e.altKey) return;
      if (e.key === "s" || e.key === "S") {
        e.preventDefault();
        if (canSaveRef.current) onSaveRef.current?.();
        return;
      }
      const digit = e.key >= "1" && e.key <= "9" ? Number(e.key) - 1
                  : e.key === "0" ? 9 : -1;
      if (digit < 0) return;
      const itm = quickItemsRef.current[digit];
      if (!itm) return;
      e.preventDefault();
      addItemToBillRef.current(itm);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  // WebSocket — connect once branch is known, reconnect if branch changes
  useEffect(() => {
    if (!selectedBranchCode) return;
    const tenant = localStorage.getItem("tenancyId") || "";
    const wsBase = typeof window !== "undefined" ? window.POS?.wsServer : "";
    wsConnect(tenant, selectedBranchCode, wsBase);

    const unsubState = onStateChange(setWsOnline);

    // Price change — patch only the changed items in IndexedDB
    const unsubPrice = wsOnMessage("PRICE_CHANGE", async (msg) => {
      log("posWebSocket: PRICE_CHANGE received", JSON.stringify(msg));
      const changed = Array.isArray(msg.items)
        ? msg.items
        : msg.itemId ? [msg] : [];

      if (changed.length) {
        for (const patch of changed) {
          const existing = await db.items.get(patch.itemId);
          if (existing) await db.items.put({ ...existing, ...patch });
        }
        message.info(`Price updated for ${changed.length} item(s)`, 3);
      } else {
        // No item data in message — fall back to full reload
        message.info("Price update received — refreshing item cache…", 3);
        import("../cache/itemCache").then(({ loadAllItemsToCache }) => {
          loadAllItemsToCache().catch(() => {});
        });
      }
    });

    // Full catalogue refresh (new items added, bulk GST change, etc.)
    const unsubCatalog = wsOnMessage("CATALOG_REFRESH", () => {
      message.info("Catalogue updated — refreshing item cache…", 3);
      import("../cache/itemCache").then(({ loadAllItemsToCache }) => {
        loadAllItemsToCache().catch(() => {});
      });
    });

    // Generic notification
    const unsubNotify = wsOnMessage("NOTIFICATION", (msg) => {
      const text = msg.message || msg.text || "New notification";
      const type = (msg.type || "info").toLowerCase();
      if (type === "error")   message.error(text, 6);
      else if (type === "warning") message.warning(text, 5);
      else message.info(text, 4);
    });

    return () => {
      unsubState();
      unsubPrice();
      unsubCatalog();
      unsubNotify();
      wsDisconnect();
    };
  }, [selectedBranchCode]);

  // Reload schemes whenever the active branch changes — only receives schemes published to that branch
  useEffect(() => {
    const tenantId = localStorage.getItem("tenancyId");
    const token = localStorage.getItem("jwtToken");
    if (!tenantId || !token || !selectedBranchCode) return;
    const hdr = { Authorization: `Bearer ${token}` };
    fetch(`/api/${tenantId}/scheme?branchCode=${encodeURIComponent(selectedBranchCode)}`, { headers: hdr })
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setSchemes(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, [selectedBranchCode]);

  useEffect(() => {
    const tenantId = localStorage.getItem("tenancyId");
    const token = localStorage.getItem("jwtToken");
    if (!tenantId || !token) return;
    const hdr = { Authorization: `Bearer ${token}` };

    // Restore cached map immediately so DYNAMIC checks work even before the
    // network response arrives (or when starting fully offline).
    const CACHE_KEY = `cat_map_${tenantId}`;
    try {
      const saved = localStorage.getItem(CACHE_KEY);
      if (saved) setCategoryMap(JSON.parse(saved));
    } catch (_) {}

    fetch(`/api/${tenantId}/item-category-map/all`, { headers: hdr })
      .then((r) => (r.ok ? r.json() : []))
      .then((rows) => {
        if (!Array.isArray(rows)) return;
        const map = {};
        for (const row of rows) {
          const id = String(row.itemId || "").trim();
          const cat = String(row.categoryName || "").trim();
          if (!id || !cat) continue;
          if (!map[id]) map[id] = [];
          if (!map[id].includes(cat)) map[id].push(cat);
        }
        setCategoryMap(map);
        try { localStorage.setItem(CACHE_KEY, JSON.stringify(map)); } catch (_) {}
      })
      .catch(() => {});

    // Load receipt modes: cache first (works offline), then refresh from server
    (async () => {
      const normalize = (rows) =>
        rows.map((r) => ({ key: r.receiptMode, receipt_mode: r.receiptMode, amount: 0 }));

      // 1. Load from cache immediately so billing works even with no internet
      const cached = await loadReceiptModesFromCache();
      if (cached.length > 0) setReceipts(normalize(cached));

      // 2. Try server in background; update cache and state if reachable
      try {
        const res = await fetch(`/api/${tenantId}/receipt-modes`, { headers: hdr });
        if (res.ok) {
          const rows = await res.json();
          if (Array.isArray(rows) && rows.length > 0) {
            await saveReceiptModesToCache(rows);
            setReceipts(normalize(rows));
          }
        }
      } catch (_) {
        // offline — cached data already applied above
      }
    })();
  }, []);

  // Load items pre-filled from KOT Convert-to-POS
  useEffect(() => {
    if (!prefillItems?.length) return;
    setItems(prefillItems);
    onPrefillUsed?.();
    setTimeout(() => itemSearchRef.current?.focus?.(), 100);
  }, [prefillItems]);

  const isItemDynamic = (itemId) =>
    (categoryMapRef.current[String(itemId || "")] || []).includes("DYNAMIC");

  const openLookup = (q = "") => { log("openLookup:", q); setLookupQuery(q); setLookupOpen(true); };
  const focusQtyInput = (rowKey, delay = 0) => {
    setTimeout(() => qtyInputRefs.current[rowKey]?.focus?.(), delay);
  };
  const closeLookup = ({ focusSearch = true } = {}) => {
    setLookupOpen(false);
    if (focusSearch) setTimeout(() => itemSearchRef.current?.focus?.(), 50);
  };

  const [receipts, setReceipts] = useState([
    { key: "CASH", receipt_mode: "CASH", amount: 0 },
  ]);

  const totalAmount      = useMemo(() => items.reduce((s, r) => s + (Number(r.amount) || 0), 0), [items]);
  const activeOffers     = useMemo(() => evaluateSchemes(items, schemes, categoryMap), [items, schemes, categoryMap]);
  const totalQty         = useMemo(() => items.reduce((s, r) => s + (Number(r.qty) || 0), 0), [items]);
  const totalReceived    = useMemo(() => receipts.reduce((s, r) => s + (Number(r.amount) || 0), 0), [receipts]);

  // Sum all itemwise discount amounts from active ITEMWISE_DISCOUNT scheme offers
  const itemwiseDiscount = useMemo(
    () => activeOffers
      .filter((o) => o.offerType === "Itemwise Discount")
      .reduce((s, o) => s + (Number(o.totalDiscountAmount) || 0), 0),
    [activeOffers]
  );
  // Net amount the customer actually pays after itemwise discount
  const netPayable = useMemo(
    () => Math.max(round2n(totalAmount - itemwiseDiscount), 0),
    [totalAmount, itemwiseDiscount]
  );
  // Round-off to nearest rupee (Indian retail standard)
  const roundOff = useMemo(() => {
    if (netPayable <= 0) return 0;
    return round2n(Math.round(netPayable) - netPayable);
  }, [netPayable]);
  const roundedPayable = useMemo(() => round2n(netPayable + roundOff), [netPayable, roundOff]);

  const [tendered, setTendered] = useState(0);
  const balance = useMemo(
    () => Math.max((Number(tendered) || 0) - (Number(roundedPayable) || 0), 0),
    [tendered, roundedPayable]
  );

  const [dayEndDone, setDayEndDone] = useState(false);
  const [upiSession, setUpiSession] = useState({ open: false, merchantTransactionId: null, amount: 0, qrData: "" });

  const canSave = useMemo(() => {
    if (dayEndDone) return false;
    const gross = Number(totalAmount) || 0;
    const net   = Number(roundedPayable) || 0;
    const rec   = Number(totalReceived) || 0;
    const ten   = Number(tendered) || 0;
    if (gross <= 0) return false;
    // Receipts must cover the rounded payable amount
    if (Math.abs(rec - net) > 0.001) return false;
    if (ten > 0 && ten < net) return false;
    return true;
  }, [dayEndDone, totalAmount, roundedPayable, totalReceived, tendered]);

  // Auto-set CASH receipt — uses roundedPayable so round-off and discount are pre-applied
  useEffect(() => {
    const net  = Number(roundedPayable) || 0;
    const ten  = Number(tendered) || 0;
    const cash = ten > 0 ? Math.min(ten, net) : net;
    setReceipts((prev) =>
      prev.map((r) => r.receipt_mode.toUpperCase() === "CASH" ? { ...r, amount: round2n(cash) } : r)
    );
  }, [tendered, roundedPayable]);

  const setSingleReceiptToTotal = (mode) => {
    const net = round2n(roundedPayable);
    setReceipts((prev) => prev.map((r) => ({ ...r, amount: r.receipt_mode === mode ? net : 0 })));
  };

  const getAvailableQty = (row) => {
    const n = Number(row?.available_qty);
    return Number.isFinite(n) ? n : null;
  };

  const updateItem = (key, patch) => {
    setItems((prev) =>
      prev.map((r) => {
        if (r.key !== key) return r;
        const next = { ...r, ...patch };
        const available   = getAvailableQty(next);
        const requestedQty = Number(next.qty) || 0;
        if (!isItemDynamic(next.item_id) && Object.hasOwn(patch, "qty") && available !== null && requestedQty > available) {
          next.qty = available;
          message.warning(`Only ${available} in stock for ${next.item_name}`);
        }
        next.amount = round2n((Number(next.qty) || 0) * (Number(next.standard_price) || 0));
        return next;
      })
    );
  };

  const deleteItem = (key) => setItems((p) => p.filter((r) => r.key !== key));

  const addItemToBillRef = useRef(null);
  const addItemToBill = (itm, { closeModal = false } = {}) => {
    const batch     = itm.batchCode || "";
    const available = Number.isFinite(Number(itm.availableQty)) ? Number(itm.availableQty) : null;

    let resolvedKey = null;
    let wasExisting = false;

    setItems((prev) => {
      const existing = prev.find((r) => r.item_id === itm.itemId && (r.batch || "") === batch);
      if (existing) {
        const nextQty = (Number(existing.qty) || 0) + 1;
        const allowed = getAvailableQty(existing) ?? available;
        if (!isItemDynamic(itm.itemId) && allowed !== null && nextQty > allowed) {
          message.warning(`Only ${allowed} in stock for ${existing.item_name}`);
          return prev; // no change
        }
        resolvedKey = existing.key;
        wasExisting = true;
        return prev.map((r) => {
          if (r.key !== existing.key) return r;
          const next = { ...r, qty: nextQty, available_qty: allowed };
          next.amount = round2n(nextQty * (Number(next.standard_price) || 0));
          return next;
        });
      } else {
        if (!isItemDynamic(itm.itemId) && available !== null && available <= 0) {
          message.warning(`No stock for ${itm.itemName}`);
          return prev; // no change
        }
        const row = {
          key: crypto.randomUUID(), item_id: itm.itemId, item_name: itm.itemName,
          barcode: itm.barcode, qty: 1, available_qty: available,
          tax_rate: itm.taxRate, standard_price: itm.standardPrice,
          amount: round2n(Number(itm.standardPrice) || 0),
          batch, unit: itm.unitName || "", expiry: itm.expiry || "",
          category: itm.category || "",
        };
        resolvedKey = row.key;
        wasExisting = false;
        return [row, ...prev];
      }
    });

    setItemQuery("");
    if (resolvedKey) pendingQtyFocusKey.current = resolvedKey;
    if (closeModal) closeLookup({ focusSearch: false });
    else if (resolvedKey) focusQtyInput(resolvedKey, wasExisting ? 50 : 80);
  };
  addItemToBillRef.current = addItemToBill;

  const initiateUpiPayment = async (amount) => {
    const tenantId  = localStorage.getItem("tenancyId") || "";
    const token     = localStorage.getItem("jwtToken") || "";
    // Use a temporary reference — the real invoice number is only assigned when the
    // bill is saved. Generating a voucher number here would burn the sequence if UPI
    // fails or if the cashier cancels, creating gaps in bill numbers.
    const tempRef = `UPI-${Date.now()}`;
    try {
      const res = await fetch(`/api/${tenantId}/upi/initiate`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ amount, voucherNumber: tempRef, branchCode: selectedBranchCode }),
      });
      if (!res.ok) throw new Error(`UPI initiate failed: ${res.status}`);
      const { merchantTransactionId, qrData } = await res.json();

      // Open customer display on second monitor
      await window.POS?.upi?.showCustomerDisplay?.({
        qrData,
        amount,
        shopName: branchInfo?.branchName || "",
      });

      // Set UPI receipt amount and open cashier-side modal
      setReceipts((prev) =>
        prev.map((r) =>
          r.receipt_mode.toUpperCase() === "UPI" ? { ...r, amount: round2n(amount) } : { ...r, amount: 0 }
        )
      );
      setUpiSession({ open: true, merchantTransactionId, amount, qrData });
    } catch (e) {
      message.error("Could not initiate UPI payment: " + e.message);
    }
  };

  const clearForm = () => {
    setItems([]); setTendered(0);
    setReceipts((prev) => prev.map((r) => ({ ...r, amount: 0 })));
    setCustomerMobile("");
    setTimeout(() => itemSearchRef.current?.focus?.(), 50);
  };

  const openReprint = async () => {
    const history = await db.pos_receipts.orderBy("id").reverse().limit(10).toArray();
    setReprintHistory(history);
    setReprintOpen(true);
  };

  const reprintVoucher = async (record) => {
    if (!window.POS?.printHtml) { message.error("Print API not available"); return; }
    const html = buildReceiptHtml(record);
    try {
      await window.POS.printHtml({ html, silent: false, deviceName: selectedPrinter || "" });
      message.success(`Reprinted: ${record.voucherNumber}`);
    } catch (e) {
      message.error("Reprint failed: " + e.message);
    }
  };

  const onHold = async () => {
    if (!items.length) return;
    await db.pos_holds.add({
      heldAt:         nowIST(),
      branchCode:     selectedBranchCode,
      items,
      customerMobile,
      salesmanCode,
      salesmanName,
      receipts,
      tendered,
    });
    const count = await db.pos_holds.count();
    setHoldCount(count);
    message.success("Bill put on hold");
    clearForm();
  };

  const openRecall = async () => {
    const all = await db.pos_holds.orderBy("heldAt").reverse().toArray();
    setHeldBills(all);
    setRecallOpen(true);
  };

  const recallBill = async (hold) => {
    // Re-check current stock for each held item so negative qty can't happen
    const adjustedItems = await Promise.all(
      (hold.items || []).map(async (r) => {
        if (isItemDynamic(r.item_id)) return r; // DYNAMIC items have no stock limit
        const cached = await db.items.get(String(r.item_id)).catch(() => null);
        const currentQty = cached?.availableQty != null ? Number(cached.availableQty) : null;
        if (currentQty === null) return r; // no stock info — leave as-is
        const cappedQty = Math.min(Number(r.qty) || 0, currentQty);
        return { ...r, qty: cappedQty, available_qty: currentQty,
                 amount: round2n(cappedQty * (Number(r.standard_price) || 0)) };
      })
    );

    const zeroed = adjustedItems.filter((r) => r.qty === 0 && !isItemDynamic(r.item_id));
    const capped = adjustedItems.filter(
      (r, i) => !isItemDynamic(r.item_id) && Number(r.qty) < Number((hold.items || [])[i]?.qty || 0) && r.qty > 0
    );

    if (zeroed.length || capped.length) {
      const msgs = [];
      if (capped.length) msgs.push(`Qty reduced (stock changed): ${capped.map((r) => r.item_name).join(", ")}`);
      if (zeroed.length) msgs.push(`Removed (no stock): ${zeroed.map((r) => r.item_name).join(", ")}`);
      message.warning(msgs.join(" | "), 6);
    }

    const finalItems = adjustedItems.filter((r) => r.qty > 0 || isItemDynamic(r.item_id));

    setItems(finalItems);
    setCustomerMobile(hold.customerMobile || "");
    setSalesmanCode(hold.salesmanCode || "");
    setSalesmanName(hold.salesmanName || "");
    setReceipts(hold.receipts?.length ? hold.receipts : [{ key: "CASH", receipt_mode: "CASH", amount: 0 }]);
    setTendered(hold.tendered || 0);
    await db.pos_holds.delete(hold.id);
    const count = await db.pos_holds.count();
    setHoldCount(count);
    setRecallOpen(false);
    setTimeout(() => itemSearchRef.current?.focus?.(), 50);
  };

  const deleteHold = async (id) => {
    await db.pos_holds.delete(id);
    const remaining = await db.pos_holds.orderBy("heldAt").reverse().toArray();
    setHeldBills(remaining);
    setHoldCount(remaining.length);
  };

  const onSave = async () => {
    log("onSave called | canSave:", canSave, "| items:", items.length, "| branch:", selectedBranchCode);
    if (savingRef.current) { warn("onSave blocked: already saving"); return; }
    if (dayEndDone) { message.error("Day End is already completed for today. Billing is not allowed."); return; }
    if (!canSave) { warn("onSave blocked: canSave=false"); return; }
    if (!selectedBranchCode) { message.warning("Select branch code"); return; }
    savingRef.current = true;
    setIsSaving(true);

    const tenantId  = localStorage.getItem("tenancyId") || "79001a";
    const token     = localStorage.getItem("jwtToken") || "";
    const branchCode = selectedBranchCode || "";

    // ── Apply schemes: remove stale offer rows, re-evaluate, inject free items ──
    const baseItems = items.filter((r) => !r.is_offer);
    const offers = evaluateSchemes(baseItems, schemes, categoryMap);
    const offerRows = await buildOfferRows(offers, findItemByName);
    const finalItems = [...baseItems, ...offerRows];
    if (offerRows.length > 0) {
      setItems(finalItems);
      const labels = offerRows.map((r) => `${r.item_name} ×${r.qty} (FREE)`).join(", ");
      message.success(`Scheme applied — ${labels}`, 4);
    }
    // Cash-back offers: informational
    offers
      .filter((o) => o.offerType === "Cash Back")
      .forEach((o) =>
        message.info(`Cash Back: ₹${o.cashBackAmount} from scheme "${o.schemeName}"`, 5)
      );

    // Compute itemwise discount from re-evaluated offers at save time
    const itemwiseDiscountAmount = round2n(
      offers
        .filter((o) => o.offerType === "Itemwise Discount")
        .reduce((s, o) => s + (Number(o.totalDiscountAmount) || 0), 0)
    );

    const headerId = crypto.randomUUID();
    const { voucherNumber, numericSeq } = generateVoucherNumber(branchCode);
    const numericVoucherNumber = numericSeq;
    const voucherPrefix = localStorage.getItem(`posBranchPrefix_${branchCode}`) || "POS";

    const header = {
      id: headerId,
      branch_code: branchCode,
      sales_man_name: salesmanName || "",
      customer_mobile: customerMobile || "",
      numeric_voucher_number: numericVoucherNumber,
      voucher_number: voucherNumber,
      voucher_prefix: voucherPrefix,
      voucher_date: nowIST(),
      company_mst_id: tenantId,
      is_synched: "0",
    };

    const details = finalItems.map((item) => ({
      id: crypto.randomUUID(),
      parent_id: headerId,
      item_name: item.item_name || "",
      item_id: item.item_id || "",
      barcode: item.barcode || "",
      tax_rate: Number(item.tax_rate) || 0,
      cess_rate: 0,
      unit: item.unit || "",
      item_code: item.item_code || "",
      qty: Number(item.qty) || 0,
      rate: Number(item.standard_price) || 0,
      standard_price: Number(item.standard_price) || 0,
      amount: Number(item.amount) || 0,
      batch: item.batch || "",
      expiry: item.expiry || null,
      description: item.description || "",
    }));

    const receiptLines = receipts
      .filter((r) => (Number(r.amount) || 0) > 0)
      .map((r) => ({ receipt_mode: r.receipt_mode, amount: Number(r.amount) }));

    // Inject DISCOUNT receipt line as negative amount — stored in sales_receipts_dtl
    if (itemwiseDiscountAmount > 0) {
      receiptLines.push({ receipt_mode: "DISCOUNT", amount: -itemwiseDiscountAmount });
    }
    // Round-off adjustment (negative = store absorbs fraction, positive = customer pays extra paise)
    if (roundOff !== 0) {
      receiptLines.push({ receipt_mode: "ROUND_OFF", amount: roundOff });
    }

    const payload = { sales: [{ header, details, receipts: receiptLines }] };

    try {
      log("posting sale | tenantId:", tenantId, "| branch:", branchCode,
          "| lines:", details.length, "| hasToken:", !!token, "| tokenLen:", token.length,
          "| payload:", JSON.stringify(payload));
      const saleUrl = apiUrl(`/api/${tenantId}/sales-upload/${branchCode}`);
      log("sale POST url:", saleUrl);
      const response = await fetch(saleUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          "X-Tenant-Id": tenantId,
        },
        body: JSON.stringify(payload),
      });
      log("sale POST response:", response.status, response.statusText);
      const rawText = await response.text().catch(() => "");
      log("sale POST response body:", rawText);
      if (!response.ok) {
        logError("sale POST error body (raw):", rawText);
        let errMsg = `Save failed: ${response.status}`;
        try { const j = JSON.parse(rawText); errMsg = j.message || errMsg; } catch (_) {}
        const err = new Error(errMsg);
        err.httpStatus = response.status;
        throw err;
      }
      let result;
      try { result = JSON.parse(rawText); } catch (_) { result = {}; }
      if (result.failedIds?.length > 0) {
        const msgs = Object.values(result.errorMessages || {}).join("; ");
        logError("sale upload failed ids:", JSON.stringify(result.failedIds), "| errors:", msgs);
        throw new Error(msgs || "Sale upload reported failures");
      }
      await applySaleToCache(finalItems.map((item) => ({
        itemId: item.item_id, batchCode: item.batch || "", qty: Number(item.qty) || 0,
      })));
      message.success("Sales saved successfully");
      persistSalesmanCode(salesmanCode);
      doPrint({ snapshot: [...finalItems], voucherNumber, itemwiseDiscount: itemwiseDiscountAmount, roundOff });
      clearForm();
    } catch (e) {
      if (e.httpStatus === 401) {
        message.error("Session expired — please log in again.", 6);
        return;
      }
      const isNetworkError = !navigator.onLine || e instanceof TypeError;
      const isServerError  = e.httpStatus >= 500;
      if (isNetworkError || isServerError) {
        try {
          await queueSale({ tenantId, branchCode, payload, voucherNumber });
          await applySaleToCache(finalItems.map((item) => ({
            itemId: item.item_id, batchCode: item.batch || "", qty: Number(item.qty) || 0,
          })));
          message.warning(isNetworkError
            ? "No network — sale saved offline, will sync automatically when connected"
            : `Server error (${e.httpStatus}) — sale saved offline, will retry when server recovers`);
          persistSalesmanCode(salesmanCode);
          doPrint({ snapshot: [...finalItems], voucherNumber, itemwiseDiscount: itemwiseDiscountAmount, roundOff });
          clearForm();
          setPendingCount((c) => c + 1);
        } catch (qErr) {
          logError("offlineQueue: failed to queue sale:", qErr.message);
          message.error("Save failed and could not queue offline: " + qErr.message);
        }
      } else {
        message.error("Save failed: " + (e.message || "Unknown error"));
      }
    } finally {
      savingRef.current = false;
      setIsSaving(false);
    }
  };
  onSaveRef.current  = onSave;
  canSaveRef.current = canSave;

  // Branch info (name, address, GST) for receipt header
  useEffect(() => {
    const today = todayIST();
    const records = JSON.parse(localStorage.getItem("day_end_records") || "[]");
    const done = records.some((r) => r.dateKey === today && r.branchCode === selectedBranchCode);
    setDayEndDone(done);
  }, [selectedBranchCode]);

  const [branchInfo, setBranchInfo] = useState(null);
  useEffect(() => {
    if (!selectedBranchCode) { log("branchInfo: no selectedBranchCode, skipping fetch"); return; }
    const tenantId = localStorage.getItem("tenancyId") || "";
    const token    = localStorage.getItem("jwtToken") || "";
    log("branchInfo fetch | tenantId:", tenantId, "| branchCode:", selectedBranchCode);
    fetch(apiUrl(`/api/${tenantId}/branches`), { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.text())
      .then((text) => {
        log("branchInfo raw response (first 300):", text.substring(0, 300));
        let data;
        try { data = JSON.parse(text); } catch { data = {}; }
        // Spring may double-encode the string — unwrap one level if so
        if (typeof data === "string") { try { data = JSON.parse(data); } catch { data = {}; } }
        const list = Array.isArray(data) ? data : data.branches || data.data || [];
        log("branchInfo list length:", list.length, "| codes:", list.map((b) => b.branchCode).join(","));
        const found = list.find((b) => b.branchCode === selectedBranchCode) || null;
        setBranchInfo(found);
        log("branchInfo set:", JSON.stringify(found));
      })
      .catch((e) => logError("branchInfo fetch error:", e.message));
  }, [selectedBranchCode]);

  // Printing
  const [printers, setPrinters] = useState([]);
  const [selectedPrinter, setSelectedPrinter] = useState(
    () => localStorage.getItem("posPrinter") || ""
  );

  const savePrinterSelection = (name) => {
    setSelectedPrinter(name);
    if (name) localStorage.setItem("posPrinter", name);
  };

  const refreshPrinters = async () => {
    if (!window.POS?.listPrinters) return;
    const list = await window.POS.listPrinters();
    setPrinters(list || []);
    const cached = localStorage.getItem("posPrinter");
    const stillAvailable = cached && list?.some((p) => p.name === cached);
    if (!selectedPrinter && !stillAvailable && list?.length) {
      savePrinterSelection(list[0].name);
    }
  };

  useEffect(() => { refreshPrinters(); }, []);

  const doPrint = async ({ snapshot, voucherNumber, itemwiseDiscount: discount = 0, roundOff: ro = 0 }) => {
    if (!window.POS?.printHtml) { log("doPrint: window.POS.printHtml not available"); return; }
    const printData = {
      items: snapshot, totalAmount, tendered, balance, receipts,
      itemwiseDiscount: discount,
      roundOff: ro,
      branchInfo, salesmanName, customerMobile, voucherNumber,
    };
    const html = buildReceiptHtml(printData);
    log("doPrint | htmlLen:", html.length, "| snapshotLen:", snapshot?.length);
    try {
      await window.POS.printHtml({ html, silent: true, deviceName: selectedPrinter || "" });
      log("doPrint | success");
    } catch (e) {
      log("doPrint | error:", e.message);
      message.error("Print failed: " + e.message);
    }
    // Save to reprint history — keep only the latest 10
    try {
      await db.pos_receipts.add({ ...printData, savedAt: nowIST(), branchCode: selectedBranchCode });
      const count = await db.pos_receipts.count();
      if (count > 10) {
        const oldest = await db.pos_receipts.orderBy("id").limit(count - 10).primaryKeys();
        await db.pos_receipts.bulkDelete(oldest);
      }
    } catch (e) {
      logError("doPrint: failed to save receipt history:", e.message);
    }
  };

  const printTestInvoice = async () => {
    if (!window.POS?.printHtml) return;
    if (selectedPrinter && window.POS.getPrinterPaperSize) {
      try {
        const result = await window.POS.getPrinterPaperSize(selectedPrinter);
        if (result?.paperWidthMm && result?.paperHeightMm) {
          await window.POS.savePrinterConfig({ paperWidthMm: result.paperWidthMm, paperHeightMm: result.paperHeightMm });
          message.success(`Paper size saved: ${result.paperWidthMm}×${result.paperHeightMm}mm`);
        } else {
          log("printTestInvoice: paper size not detected | raw:", JSON.stringify(result?.raw));
        }
      } catch (e) {
        log("printTestInvoice: paper size error:", e.message);
      }
    }
    const html = buildReceiptHtml({
      items, totalAmount, tendered, balance, receipts,
      itemwiseDiscount,
      roundOff,
      branchInfo, salesmanName, customerMobile, voucherNumber: "TEST",
    });
    try {
      await window.POS.printHtml({ html, silent: false, deviceName: selectedPrinter || "" });
    } catch (e) {
      message.error("Test print failed: " + e.message);
    }
  };

  const itemColumns = [
    { title: "Item", dataIndex: "item_name", width: 200, render: (v) => <span style={{ fontWeight: 600 }}>{v}</span> },
    { title: "barcode",   dataIndex: "barcode",       width: 120 },
    { title: "stock",     dataIndex: "available_qty", width: 70, render: (v) => (v == null ? "-" : round2(v)) },
    {
      title: "qty", dataIndex: "qty", width: 80,
      render: (_, row) => (
        <InputNumber
          ref={(el) => { if (el) qtyInputRefs.current[row.key] = el; else delete qtyInputRefs.current[row.key]; }}
          value={row.qty} min={0} controls={false} keyboard={false}
          onChange={(val) => updateItem(row.key, { qty: val })}
          onFocus={(e) => e.target.select()}
          onKeyDown={(e) => {
            if (e.key === "ArrowUp" || e.key === "ArrowDown") {
              e.preventDefault();
              const idx = items.findIndex((r) => r.key === row.key);
              const next = items[e.key === "ArrowUp" ? idx - 1 : idx + 1];
              if (next) qtyInputRefs.current[next.key]?.focus?.();
            }
          }}
          onPressEnter={() => itemSearchRef.current?.focus?.()}
          style={{ width: "100%", borderRadius: 0 }}
        />
      ),
    },
    { title: "Rate", dataIndex: "standard_price", width: 90, render: (v) => round2(v) },
    { title: "Tax",  dataIndex: "tax_rate",       width: 70 },
    { title: "amount",   dataIndex: "amount",   width: 100, render: (v) => round2(v) },
    { title: "batch",    dataIndex: "batch",    width: 90 },
    { title: "unit",     dataIndex: "unit",     width: 60 },
    { title: "expiry",   dataIndex: "expiry",   width: 100 },
    {
      title: "", key: "x", width: 42,
      render: (_, row) => (
        <Button danger size="small" style={{ borderRadius: 0, padding: "0 6px" }} onClick={() => deleteItem(row.key)}>✕</Button>
      ),
    },
  ];

  const receiptColumns = [
    { title: "Payment Type", dataIndex: "receipt_mode", width: 130 },
    {
      title: "Amount", dataIndex: "amount", width: 120,
      render: (_, row) => (
        <InputNumber
          value={row.amount} min={0} controls={false} keyboard={false} style={{ width: "100%", borderRadius: 0 }}
          onChange={(val) => setReceipts((prev) => prev.map((r) => r.key === row.key ? { ...r, amount: Number(val || 0) } : r))}
          onKeyDown={(e) => {
            if (e.key === "Enter") { setSingleReceiptToTotal(row.receipt_mode); return; }
            if (e.key === "ArrowUp" || e.key === "ArrowDown") {
              e.preventDefault();
              const inputs = [...document.querySelectorAll(".qt-receipt-table input")];
              const idx = inputs.indexOf(e.target);
              inputs[e.key === "ArrowUp" ? idx - 1 : idx + 1]?.focus();
            }
          }}
        />
      ),
    },
  ];

  const markActivity = () => { lastActivityRef.current = Date.now(); };

  const qtLabel = (text) => (
    <div style={{ fontSize: 11, fontWeight: "bold", color: "#000", marginBottom: 1 }}>{text}</div>
  );

  return (
    <div className="pos-container" onKeyDown={markActivity} onClick={markActivity}>
      {/* ── Title bar ── */}
      <div style={{
        background: "#0b3a75", color: "#fff", padding: "3px 10px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        fontSize: 13, fontWeight: "bold", flexShrink: 0,
      }}>
        <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
          POS Window{selectedBranchCode ? ` — ${selectedBranchCode}` : ""}
          <Tooltip title={wsOnline ? "Connected to server" : "Not connected to server"}>
            <span style={{
              display: "inline-block", width: 8, height: 8, borderRadius: "50%",
              background: wsOnline ? "#52c41a" : "#d9d9d9",
              boxShadow: wsOnline ? "0 0 4px #52c41a" : "none",
            }} />
          </Tooltip>
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {pendingCount > 0 && (
            <Tooltip title={syncing ? "Syncing…" : `${pendingCount} offline sale(s) — click to sync`}>
              <Tag
                color="warning"
                icon={<SyncOutlined spin={syncing} />}
                style={{ cursor: "pointer" }}
                onClick={async () => {
                  if (syncing) return;
                  setSyncing(true);
                  const { synced, failed } = await syncPendingSales();
                  if (synced > 0) message.success(`Synced ${synced} offline sale${synced > 1 ? "s" : ""}`);
                  if (failed > 0) message.warning(`${failed} still pending`);
                  setPendingCount(await getPendingCount());
                  setSyncing(false);
                }}
              >
                {pendingCount} pending
              </Tag>
            </Tooltip>
          )}
          <Tooltip title="Reprint a recent invoice">
            <Button size="small" onClick={openReprint}
              style={{ color: "#fff", borderColor: "rgba(255,255,255,0.4)", background: "transparent" }}>
              ⎙ Reprint
            </Button>
          </Tooltip>
        </div>
      </div>

      {/* ── Day End block banner ── */}
      {dayEndDone && (
        <div style={{
          background: "#ff4d4f", color: "#fff", padding: "4px 12px",
          fontSize: 13, fontWeight: "bold", textAlign: "center", flexShrink: 0,
        }}>
          Day End completed for today — Billing is not allowed
        </div>
      )}

      {/* ── Main two-panel body ── */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden", minHeight: 0 }}>

        {/* ══ LEFT PANEL (controls + payment) ══ */}
        <div style={{
          width: 270, minWidth: 250, flexShrink: 0,
          background: "#d4d0c8",
          borderRight: "2px solid #808080",
          display: "flex", flexDirection: "column",
          padding: "6px 8px", gap: 4, overflow: "auto",
        }}>
          {/* Customer Mobile */}
          <div>
            {qtLabel("Customer Mobile")}
            <Input
              size="small" value={customerMobile}
              onChange={(e) => setCustomerMobile(e.target.value)}
              style={{ borderRadius: 0 }}
            />
          </div>

          {/* Salesman */}
          <div>
            {qtLabel("SalesMan Code")}
            <AutoComplete
              size="small"
              value={salesmanCode}
              options={salesmanOptions}
              filterOption={(input, opt) =>
                opt.value.toLowerCase().includes(input.toLowerCase())
              }
              onChange={(val) => { setSalesmanCode(val); setSalesmanName(val); }}
              style={{ width: "100%", borderRadius: 0 }}
            />
          </div>

          {/* Receipt Details */}
          <div style={{ fontWeight: "bold", fontSize: 13, color: "#000", marginTop: 4, borderBottom: "1px solid #808080", paddingBottom: 2 }}>
            Receipt Details
          </div>
          <Table
            className="qt-receipt-table"
            size="small"
            dataSource={receipts}
            columns={receiptColumns}
            pagination={false}
            rowKey="key"
            showHeader
            onRow={(record) => ({
              onClick: () => {
                if (record.receipt_mode.toUpperCase() === "UPI") {
                  if (totalAmount <= 0) { message.warning("Add items before UPI payment"); return; }
                  initiateUpiPayment(round2n(roundedPayable));
                } else {
                  setSingleReceiptToTotal(record.receipt_mode);
                }
              },
              style: record.receipt_mode.toUpperCase() === "UPI" ? { cursor: "pointer", background: "#e6f4ff" } : { cursor: "pointer" },
            })}
          />

          {/* Itemwise Discount summary — shown only when an ITEMWISE_DISCOUNT scheme is active */}
          {itemwiseDiscount > 0 && (
            <div style={{
              background: "#f0fff0", border: "1px solid #b7eb8f",
              padding: "4px 6px", marginTop: 4,
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 11, color: "#555" }}>Gross Amount</span>
                <span style={{ fontSize: 12, fontWeight: "bold" }}>₹{round2(totalAmount)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 11, color: "#389e0d", fontWeight: "bold" }}>Itemwise Discount</span>
                <span style={{ fontSize: 12, fontWeight: "bold", color: "#389e0d" }}>-₹{round2(itemwiseDiscount)}</span>
              </div>
              <div style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                borderTop: "1px dashed #b7eb8f", marginTop: 3, paddingTop: 3,
              }}>
                <span style={{ fontSize: 12, fontWeight: "bold" }}>Net Payable</span>
                <span style={{ fontSize: 14, fontWeight: "bold", color: "#0b3a75" }}>₹{round2(netPayable)}</span>
              </div>
            </div>
          )}

          {/* Round-off row */}
          {roundOff !== 0 && (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 2 }}>
              <span style={{ fontSize: 11, color: "#888" }}>Round Off</span>
              <span style={{ fontSize: 12, color: roundOff < 0 ? "#cf1322" : "#389e0d" }}>
                {roundOff > 0 ? "+" : ""}{round2(roundOff)}
              </span>
            </div>
          )}

          {/* Payment totals */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 4 }}>
            <span style={{ fontSize: 12, fontWeight: "bold" }}>Total Received</span>
            <Input readOnly value={round2(totalReceived)}
              style={{ width: 110, fontSize: 14, fontWeight: "bold", borderRadius: 0, textAlign: "right" }} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 12, fontWeight: "bold" }}>Amount Tendered</span>
            <InputNumber
              ref={tenderedRef} value={tendered} min={0}
              onChange={(v) => setTendered(Number(v || 0))}
              onPressEnter={onSave}
              style={{ width: 110, fontSize: 14, fontWeight: "bold", borderRadius: 0 }}
            />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 12, fontWeight: "bold" }}>Balance to Pay</span>
            <Input readOnly value={round2(balance)}
              style={{ width: 110, fontSize: 14, fontWeight: "bold", borderRadius: 0, textAlign: "right" }} />
          </div>

          {/* Offer panel — live scheme results */}
          {activeOffers.length > 0 && (
            <div style={{
              background: "#fffbe6", border: "1px solid #ffe58f",
              borderRadius: 0, padding: "4px 6px", marginTop: 4,
            }}>
              <div style={{ fontSize: 11, fontWeight: "bold", color: "#7c5800", marginBottom: 2 }}>
                Offers Applicable
              </div>
              {activeOffers.map((o, i) => (
                <div key={i} style={{ fontSize: 11, color: "#5a4000", lineHeight: 1.5 }}>
                  {o.offerType === "Free Qty" && `🎁 ${o.offerItemName} ×${o.offerQty} FREE`}
                  {o.offerType === "Item Discount Percent" && `🏷 ${o.offerDiscountPercent}% off on ${o.offerItemName}`}
                  {o.offerType === "Cash Back" && `💵 Cash Back ₹${o.cashBackAmount}`}
                  {o.offerType === "Itemwise Discount" && `🏷 Discount ₹${round2(o.totalDiscountAmount)} on ${o.appliedItems?.length || 0} item(s)`}
                  <span style={{ color: "#999", marginLeft: 4 }}>({o.schemeName})</span>
                </div>
              ))}
            </div>
          )}

          {/* Save + Hold + Recall + Close buttons */}
          <div style={{ marginTop: "auto", paddingTop: 8, display: "flex", gap: 6 }}>
            <button
              ref={saveButtonRef}
              onClick={onSave}
              disabled={!canSave || isSaving}
              style={{
                flex: 2, height: 44, fontSize: 17, fontWeight: "bold",
                background: canSave && !isSaving ? "#ffc8ff" : "#c8c8c8",
                border: "2px outset #ccc",
                cursor: canSave && !isSaving ? "pointer" : "not-allowed",
                color: "#000",
              }}
            >
              {isSaving ? "Saving…" : "Save"}
            </button>
            <Tooltip title="Hold bill — come back to it later">
              <button
                onClick={onHold}
                disabled={!items.length}
                style={{
                  flex: 1, height: 44, fontSize: 13, fontWeight: "bold",
                  background: items.length ? "#fff3cd" : "#c8c8c8",
                  border: "2px outset #ccc",
                  cursor: items.length ? "pointer" : "not-allowed",
                  color: "#000",
                }}
              >
                <PauseCircleOutlined /> Hold
              </button>
            </Tooltip>
            <Tooltip title="Recall a held bill">
              <Badge count={holdCount} size="small" offset={[-4, 4]}>
                <button
                  onClick={openRecall}
                  style={{
                    flex: 1, height: 44, fontSize: 13, fontWeight: "bold",
                    background: holdCount ? "#d4edda" : "#d4d0c8",
                    border: "2px outset #ccc", cursor: "pointer", color: "#000",
                  }}
                >
                  <PlayCircleOutlined /> Recall
                </button>
              </Badge>
            </Tooltip>
            <button
              onClick={() => { logout(); onLogout?.(); }}
              style={{
                flex: 1, height: 44, fontSize: 13, fontWeight: "bold",
                background: "#d4d0c8", border: "2px outset #ccc", cursor: "pointer", color: "#000",
              }}
            >
              Close
            </button>
          </div>

          {/* Recall modal */}
          <Modal
            open={recallOpen}
            title="Held Bills"
            onCancel={() => setRecallOpen(false)}
            footer={null}
            width={560}
          >
            {heldBills.length === 0 ? (
              <p style={{ textAlign: "center", color: "#999" }}>No bills on hold</p>
            ) : (
              <Table
                size="small"
                dataSource={heldBills}
                rowKey="id"
                pagination={false}
                columns={[
                  { title: "Time",     dataIndex: "heldAt",    width: 140,
                    render: (v) => v?.slice(11, 19) ?? "" },
                  { title: "Items",    dataIndex: "items",     width: 60,
                    render: (v) => v?.length ?? 0 },
                  { title: "Amount",   dataIndex: "items",     width: 90,
                    render: (v) => "₹" + (v?.reduce((s, r) => s + (Number(r.amount) || 0), 0) ?? 0).toFixed(2) },
                  { title: "Customer", dataIndex: "customerMobile", width: 110,
                    render: (v) => v || "—" },
                  { title: "", key: "actions", width: 110,
                    render: (_, row) => (
                      <div style={{ display: "flex", gap: 6 }}>
                        <Button size="small" type="primary" onClick={() => recallBill(row)}>Recall</Button>
                        <Button size="small" danger icon={<DeleteOutlined />} onClick={() => deleteHold(row.id)} />
                      </div>
                    ),
                  },
                ]}
              />
            )}
          </Modal>

          {/* Reprint modal */}
          <Modal
            open={reprintOpen}
            title="Reprint Invoice"
            onCancel={() => setReprintOpen(false)}
            footer={null}
            width={580}
          >
            {reprintHistory.length === 0 ? (
              <p style={{ textAlign: "center", color: "#999" }}>No recent invoices</p>
            ) : (
              <Table
                size="small"
                dataSource={reprintHistory}
                rowKey="id"
                pagination={false}
                columns={[
                  { title: "Time",    dataIndex: "savedAt",       width: 80,
                    render: (v) => v?.slice(11, 19) ?? "" },
                  { title: "Voucher", dataIndex: "voucherNumber", width: 160 },
                  { title: "Items",   dataIndex: "items",         width: 55,
                    render: (v) => v?.length ?? 0 },
                  { title: "Amount",  dataIndex: "totalAmount",   width: 90,
                    render: (v) => "₹" + Number(v || 0).toFixed(2) },
                  { title: "Customer", dataIndex: "customerMobile", width: 100,
                    render: (v) => v || "—" },
                  { title: "", key: "action", width: 80,
                    render: (_, row) => (
                      <Button size="small" type="primary"
                        icon={<span>⎙</span>}
                        onClick={() => reprintVoucher(row)}>
                        Print
                      </Button>
                    ),
                  },
                ]}
              />
            )}
          </Modal>

          {/* Printer */}
          <div style={{ marginTop: 6 }}>
            {qtLabel("Printer")}
            <div style={{ display: "flex", gap: 4 }}>
              <Select
                size="small" style={{ flex: 1 }} value={selectedPrinter} onChange={savePrinterSelection}
                options={printers.map((p) => ({ value: p.name, label: p.name }))}
                placeholder="Select printer"
              />
              <Button size="small" style={{ borderRadius: 0 }} onClick={refreshPrinters}>↻</Button>
            </div>
            <Button size="small" style={{ width: "100%", marginTop: 3, borderRadius: 0 }} onClick={printTestInvoice}>
              Print Test Invoice
            </Button>
          </div>
        </div>

        {/* ══ RIGHT PANEL (items table) ══ */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "6px 8px", overflow: "hidden", background: "#d4d0c8" }}>
          {/* Item search + totals on same line */}
          <div style={{ display: "flex", alignItems: "flex-end", gap: 10, marginBottom: 5 }}>
            <div style={{ flex: 1 }}>
              {qtLabel("Item Search / Barcode")}
              <Input
                className="item-search-input"
                ref={itemSearchRef}
                value={itemQuery}
                onChange={(e) => setItemQuery(e.target.value)}
                placeholder="Scan barcode or type name — Enter / F2 to browse"
                style={{ borderRadius: 0 }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    openLookup(itemQuery.trim() || "");
                    setItemQuery("");
                  } else if (e.key === "Tab" && !e.shiftKey) {
                    e.preventDefault();
                    saveButtonRef.current?.focus?.();
                  } else if (e.key === "F2") {
                    e.preventDefault();
                    openLookup(itemQuery || "");
                  }
                }}
              />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
              <span style={{ fontSize: 13, fontWeight: "bold", color: "#000" }}>QTY</span>
              <Input readOnly value={round2(totalQty)}
                style={{ width: 80, fontSize: 14, fontWeight: "bold", borderRadius: 0, textAlign: "right" }} />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
              <span style={{ fontSize: 13, fontWeight: "bold", color: "#000" }}>Total</span>
              <Input readOnly value={round2(totalAmount)}
                style={{ width: 120, fontSize: 18, fontWeight: "bold", borderRadius: 0, textAlign: "right", background: "#fffff0" }} />
            </div>
          </div>

          {/* Quick-pick bar — fixed shortcuts (Alt+1…Alt+0) */}
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 5, alignItems: "center" }}>
            {quickItems.map((itm, idx) => {
              const shortcut = idx < 9 ? `Alt+${idx + 1}` : "Alt+0";
              return (
                <button
                  key={itm.itemId}
                  onClick={() => addItemToBill(itm)}
                  title={`${itm.itemName}  •  ₹${Number(itm.standardPrice || 0).toFixed(2)}  •  ${shortcut}`}
                  style={{
                    position: "relative", padding: "3px 10px 3px 26px",
                    fontSize: 12, cursor: "pointer",
                    background: "#1e3a5f", color: "#fff", border: "none",
                    borderRadius: 3, whiteSpace: "nowrap", maxWidth: 170,
                    overflow: "hidden", textOverflow: "ellipsis",
                  }}
                >
                  <span style={{
                    position: "absolute", left: 3, top: "50%", transform: "translateY(-50%)",
                    background: "rgba(255,255,255,0.25)", borderRadius: 2,
                    fontSize: 9, fontWeight: "bold", padding: "1px 3px", lineHeight: 1,
                  }}>
                    {idx < 9 ? idx + 1 : 0}
                  </span>
                  {itm.itemName}
                </button>
              );
            })}
            <button
              onClick={() => setShortcutMgrOpen(true)}
              title="Manage shortcut items"
              style={{
                padding: "3px 8px", fontSize: 12, cursor: "pointer",
                background: "transparent", color: "#555",
                border: "1px dashed #aaa", borderRadius: 3,
                whiteSpace: "nowrap", flexShrink: 0,
              }}
            >
              ⚙ Shortcuts
            </button>
          </div>

          {/* Items table — olive/khaki */}
          <Table
            className="qt-items-table"
            size="small"
            dataSource={items}
            columns={itemColumns}
            pagination={false}
            rowKey="key"
            scroll={{ x: 1000, y: "calc(100vh - 210px)" }}
            style={{ flex: 1 }}
          />
        </div>
      </div>

      <UpiPaymentModal
        open={upiSession.open}
        amount={upiSession.amount}
        qrData={upiSession.qrData}
        merchantTransactionId={upiSession.merchantTransactionId}
        onSuccess={() => {
          setUpiSession({ open: false, merchantTransactionId: null, amount: 0, qrData: "" });
          onSave();
        }}
        onCancel={() => {
          setUpiSession({ open: false, merchantTransactionId: null, amount: 0, qrData: "" });
          setReceipts((prev) => prev.map((r) => ({ ...r, amount: 0 })));
        }}
      />

      <ShortcutManageModal
        open={shortcutMgrOpen}
        onClose={() => setShortcutMgrOpen(false)}
        onChanged={(updated) => setQuickItems(updated)}
      />

      <ItemLookupModal
        open={lookupOpen}
        initialQuery={lookupQuery}
        onClose={closeLookup}
        onAfterClose={() => {
          const key = pendingQtyFocusKey.current;
          if (key) {
            pendingQtyFocusKey.current = null;
            qtyInputRefs.current[key]?.focus?.();
          }
        }}
        onPick={(itm) => addItemToBill(itm, { closeModal: true })}
      />

    </div>
  );
}

function round2(v)  { return (Number(v) || 0).toFixed(2); }
function round2n(v) { return Math.round((Number(v) || 0) * 100) / 100; }

function buildReceiptHtml({ items, totalAmount, tendered, balance, receipts, itemwiseDiscount = 0, roundOff = 0, branchInfo, salesmanName, customerMobile, voucherNumber }) {
  const b = branchInfo || {};
  const addrParts = [
    b.branchBuildingAddress,
    b.branchAddress1,
    b.branchState,
    b.branchCountry,
  ].filter(Boolean);

  const addrHtml  = addrParts.map((line) => `<div class="addr">${esc(line)}</div>`).join("");
  const phoneHtml = b.branchStreetAddress ? `<div class="addr">Ph: ${esc(b.branchStreetAddress)}</div>` : "";
  const gstHtml   = b.branchGst ? `<div class="addr">GST: ${esc(b.branchGst)}</div>` : "";

  const now = new Date();
  const dateStr = now.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  const timeStr = now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });

  // Item rows
  let serial = 0;
  const itemRows = items.map((r) => {
    serial++;
    const taxLabel = Number(r.tax_rate) > 0 ? `(${Number(r.tax_rate).toFixed(0)}%)` : "";
    const qty = Number(r.qty) || 0;
    const amt = Number(r.amount) || 0;
    // Show effective per-unit rate derived from amount so Rate × Qty always equals Amount
    const effectiveRate = qty > 0 ? (Math.round((amt / qty) * 100) / 100) : (Number(r.standard_price) || 0);
    return `
      <tr>
        <td class="sno">${serial}</td>
        <td class="iname">${esc(r.item_name)}${taxLabel ? `<span class="tax-badge">${taxLabel}</span>` : ""}</td>
        <td class="num">${qty.toFixed(2)}</td>
        <td class="num">${effectiveRate.toFixed(2)}</td>
        <td class="num">${amt.toFixed(2)}</td>
      </tr>`;
  }).join("");

  // Tax breakdown — back-calculate tax from GST-inclusive amount (Indian retail: MRP includes GST)
  const taxMap = {};
  items.forEach((r) => {
    const rate = Number(r.tax_rate) || 0;
    if (rate <= 0) return;
    if (!taxMap[rate]) taxMap[rate] = 0;
    taxMap[rate] += (Number(r.amount) || 0) * rate / (100 + rate);
  });
  let totalTax = 0;
  const taxRows = Object.entries(taxMap).map(([rate, taxAmt]) => {
    totalTax += taxAmt;
    const half = taxAmt / 2;
    return `
      <tr><td colspan="3">CGST @${(rate/2).toFixed(1)}%</td><td class="num">${half.toFixed(2)}</td></tr>
      <tr><td colspan="3">SGST @${(rate/2).toFixed(1)}%</td><td class="num">${half.toFixed(2)}</td></tr>`;
  }).join("");
  const taxTotalRow = totalTax > 0
    ? `<tr class="tax-total"><td colspan="3"><b>Total Tax</b></td><td class="num"><b>${totalTax.toFixed(2)}</b></td></tr>`
    : "";

  // Payment rows
  const payRows = (receipts || [])
    .filter((r) => Number(r.amount) > 0)
    .map((r) => `
      <tr>
        <td class="pay-mode">${esc(r.receipt_mode)}</td>
        <td class="num">${Number(r.amount).toFixed(2)}</td>
      </tr>`).join("");

  const tenderRow = Number(tendered) > 0
    ? `<tr><td class="pay-mode">Tendered</td><td class="num">${Number(tendered).toFixed(2)}</td></tr>` : "";
  const balanceRow = Number(balance) > 0
    ? `<tr class="balance-row"><td class="pay-mode"><b>Balance</b></td><td class="num"><b>${Number(balance).toFixed(2)}</b></td></tr>` : "";

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<style>
  @page { margin: 0; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: Arial, Helvetica, sans-serif;
    font-size: 11px;
    width: 258px;
    color: #000;
    background: #fff;
    padding: 6px 4px 6px 1px;
  }
  .shop-name { font-size: 14px; font-weight: bold; text-align: center; letter-spacing: 1px; margin-bottom: 2px; }
  .addr { font-size: 10px; text-align: center; line-height: 1.4; }
  .gst  { font-size: 10px; text-align: center; font-weight: bold; margin-top: 1px; }
  .dash { border: none; border-top: 1px dashed #000; margin: 4px 0; }
  .solid { border: none; border-top: 2px solid #000; margin: 4px 0; }
  .meta { font-size: 10px; display: flex; justify-content: space-between; margin: 2px 0; }
  .meta-single { font-size: 10px; margin: 1px 0; }
  .invoice-title { text-align: center; font-size: 11px; font-weight: bold; letter-spacing: 2px; margin: 3px 0; }

  table.items { width: 100%; border-collapse: collapse; font-size: 10px; }
  table.items th { text-align: left; font-size: 10px; padding: 1px 2px; border-bottom: 1px dashed #000; }
  table.items th.num { text-align: right; padding-right: 3px; }
  table.items td { padding: 1px 2px; vertical-align: top; }
  table.items td.sno  { width: 14px; color: #000; }
  table.items td.iname { width: 118px; }
  table.items td.num { text-align: right; padding-right: 3px; }
  .tax-badge { font-size: 9px; color: #000; margin-left: 2px; }

  table.tax  { width: 100%; border-collapse: collapse; font-size: 10px; }
  table.tax td { padding: 1px 2px; }
  table.tax td.num { text-align: right; padding-right: 3px; }
  .tax-label { font-size: 10px; font-weight: bold; margin: 3px 0 1px 0; }
  .tax-total td { border-top: 1px dashed #000; }

  .total-line { display: flex; justify-content: space-between; font-size: 13px; font-weight: bold; margin: 4px 0; }

  table.pay { width: 100%; border-collapse: collapse; font-size: 10px; }
  table.pay td { padding: 1px 2px; }
  table.pay td.pay-mode { text-transform: uppercase; }
  table.pay td.num { text-align: right; padding-right: 3px; }
  .balance-row td { border-top: 1px dashed #000; font-size: 11px; }

  .footer { text-align: center; font-size: 10px; margin-top: 4px; line-height: 1.6; }
  .footer .thanks { font-weight: bold; font-size: 11px; }
</style>
</head>
<body>
  <div class="shop-name">${esc(b.branchName || b.branchCode || "POS INVOICE")}</div>
  ${addrHtml}
  ${phoneHtml}
  ${gstHtml}
  <hr class="solid"/>
  <div class="invoice-title">TAX INVOICE</div>
  <hr class="dash"/>
  <div class="meta"><span>Invoice: ${esc(voucherNumber || "—")}</span><span>${dateStr} ${timeStr}</span></div>
  ${customerMobile ? `<div class="meta-single">Customer: ${esc(customerMobile)}</div>` : ""}
  ${salesmanName   ? `<div class="meta-single">Served by: ${esc(salesmanName)}</div>` : ""}
  <hr class="dash"/>

  <table class="items">
    <thead>
      <tr>
        <th></th>
        <th>Item</th>
        <th class="num">Qty</th>
        <th class="num">Rate</th>
        <th class="num">Amt</th>
      </tr>
    </thead>
    <tbody>${itemRows}</tbody>
  </table>
  <hr class="dash"/>

  ${totalTax > 0 ? `
  <div class="tax-label">Tax Details</div>
  <table class="tax">
    <tbody>
      ${taxRows}
      ${taxTotalRow}
    </tbody>
  </table>
  <hr class="dash"/>` : ""}

  ${Number(itemwiseDiscount) > 0 ? `
  <div class="total-line"><span>GROSS</span><span>${Number(totalAmount||0).toFixed(2)}</span></div>
  <div class="total-line" style="color:#389e0d"><span>DISCOUNT</span><span>-${Number(itemwiseDiscount).toFixed(2)}</span></div>
  <div class="total-line"><span>SUB TOTAL</span><span>${(Number(totalAmount||0) - Number(itemwiseDiscount)).toFixed(2)}</span></div>
  ${Number(roundOff) !== 0 ? `<div class="total-line" style="font-size:11px;color:#888"><span>ROUND OFF</span><span>${Number(roundOff) > 0 ? "+" : ""}${Number(roundOff).toFixed(2)}</span></div>` : ""}
  <div class="total-line"><span>NET PAYABLE</span><span>${(Number(totalAmount||0) - Number(itemwiseDiscount) + Number(roundOff)).toFixed(2)}</span></div>
  ` : `
  <div class="total-line"><span>TOTAL</span><span>${Number(totalAmount||0).toFixed(2)}</span></div>
  ${Number(roundOff) !== 0 ? `<div class="total-line" style="font-size:11px;color:#888"><span>ROUND OFF</span><span>${Number(roundOff) > 0 ? "+" : ""}${Number(roundOff).toFixed(2)}</span></div>
  <div class="total-line"><span>NET PAYABLE</span><span>${(Number(totalAmount||0) + Number(roundOff)).toFixed(2)}</span></div>` : ""}
  `}
  <hr class="solid"/>

  <table class="pay">
    <tbody>
      ${payRows}
      ${tenderRow}
      ${balanceRow}
    </tbody>
  </table>
  <hr class="dash"/>

  <div class="footer">
    <div class="thanks">Thank you for your business!</div>
    <div>Please visit us again</div>
  </div>
  <br/><br/>
</body>
</html>`;
}

function esc(s) {
  return String(s||"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;");
}
