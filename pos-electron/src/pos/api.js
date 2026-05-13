import { getToken, getTenancyId } from "../auth/auth";

function mapItem(e) {
  const rawAvailable = e.availableQty ?? e.availableStock ?? e.stockQty ?? e.stock ?? e.qty;
  const availableQty = Number(rawAvailable);
  return {
    item_id: e.itemId ?? e.id ?? "",
    item_name: e.itemName ?? "",
    barcode: e.barcode ?? "",
    tax_rate: e.taxRate ?? 0,
    standard_price: e.standardPrice ?? e.mrp ?? 0,
    unit: e.unitName ?? e.unit ?? "",
    batch: e.batchCode ?? e.batch ?? "",
    expiry: e.expiryDate ?? e.expiry ?? "",
    available_qty: Number.isFinite(availableQty) ? availableQty : null,
  };
}

export async function searchItems(q, page = 0, size = 50) {
  const tenancyId = getTenancyId();
  const token = getToken();
  const branchCode = String(globalThis.POS_BRANCH_CODE || localStorage.getItem("selectedBranchCode") || "").trim();

  const qs = new URLSearchParams({
    query: q || "",
    page: String(page),
    size: String(size),
  });
  if (branchCode) qs.set("branchCode", branchCode);

  const urls = [
    `/api/${encodeURIComponent(tenancyId)}/items-search-with-stock?${qs.toString()}`,
    `/api/${encodeURIComponent(tenancyId)}/items-search?${qs.toString()}`,
  ];

  let pageObj = null;
  for (const url of urls) {
    const r = await fetch(url, {
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    });
    if (!r.ok) {
      if (r.status === 404 || r.status === 403) continue;
      return [];
    }
    pageObj = await r.json();
    break;
  }
  if (!pageObj) return [];
  return (pageObj?.content || []).map(mapItem);
}

export async function fetchItemByBarcode(barcode) {
  const list = await searchItems(barcode, 0, 10);
  const exact = list.find((x) => (x.barcode || "").trim() === barcode.trim());
  return exact || list[0] || null;
}
