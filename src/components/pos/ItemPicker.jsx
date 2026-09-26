// src/components/pos/ItemPicker.jsx
// Tap-to-add item picker shared by web KOT and web POS: a search box that also takes barcode
// scanner input, a camera scan button, and a grid of item tiles with recently used items first.
import React, { forwardRef, useMemo, useState } from "react";
import { Button, Empty, Input, Tooltip, Typography } from "antd";
import { CameraOutlined, SearchOutlined } from "@ant-design/icons";

const { Text } = Typography;

const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const inr = (n) => `₹${r2(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function normalizeItem(it) {
  return {
    id: it.id ?? it.itemId ?? it.code ?? it.itemCode ?? String(it.barcode ?? it.name ?? it.itemName ?? ""),
    name: it.itemName ?? it.name ?? it.title ?? it.description ?? String(it.id ?? ""),
    barcode: it.barcode ?? it.barCode ?? it.qr ?? "",
    code: it.itemCode ?? it.code ?? "",
    unit: it.unitName ?? it.unit ?? "",
    rate: Number(it.rate ?? it.saleRate ?? it.sellingPrice ?? it.mrp ?? it.standardPrice ?? it.price ?? 0) || 0,
    taxRate: Number(it.taxRate ?? it.tax_rate ?? 0) || 0,
  };
}

/** Finds an item by exact barcode or item code (what a scanner types). */
export function findByCode(items, raw) {
  const code = String(raw || "").trim().toLowerCase();
  if (!code) return null;
  return items.find((x) => String(x.barcode || "").toLowerCase() === code || String(x.code || "").toLowerCase() === code) || null;
}

/**
 * items: normalized items. recent: item ids, most recent first. qtyById: count badge per tile.
 * onPick(item) adds one. onCode(text) tries an exact barcode/code match and returns true if it added.
 */
const ItemPicker = forwardRef(function ItemPicker(
  { items, recent = [], qtyById = {}, onPick, onCode, onScan, accent = "#1677ff", accentBg = "#e6f4ff",
    isPhone, isMobile, maxHeight, placeholder, emptyText },
  searchRef
) {
  const [query, setQuery] = useState("");

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      // Recently used items first, then the rest of the list.
      const byId = new Map(items.map((it) => [it.id, it]));
      const rec = recent.map((id) => byId.get(id)).filter(Boolean);
      const seen = new Set(rec.map((it) => it.id));
      return [...rec, ...items.filter((it) => !seen.has(it.id))].slice(0, 48);
    }
    return items
      .filter((it) => it.name?.toLowerCase().includes(q) || String(it.barcode || "").toLowerCase().includes(q)
        || String(it.code || "").toLowerCase().includes(q))
      .slice(0, 60);
  }, [query, items, recent]);

  return (
    <>
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <Input
          ref={searchRef}
          size="large"
          allowClear
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onPressEnter={() => {
            if (onCode?.(query)) setQuery("");
            else if (results.length === 1) { onPick(results[0]); setQuery(""); }
          }}
          prefix={<SearchOutlined style={{ color: "#bfbfbf" }} />}
          placeholder={placeholder || (isMobile ? "Search items" : "Search item or scan barcode (F2)")}
        />
        {onScan && (
          <Tooltip title="Scan with camera">
            <Button size="large" icon={<CameraOutlined />} onClick={onScan} aria-label="Scan with camera" />
          </Tooltip>
        )}
      </div>
      <Text type="secondary" style={{ fontSize: 12 }}>
        {query.trim() ? `${results.length}${results.length === 60 ? "+" : ""} matches` : recent.length ? "Recently used first" : "Items"}
      </Text>
      {results.length ? (
        <div style={{
          display: "grid", gridTemplateColumns: `repeat(auto-fill, minmax(${isPhone ? 130 : 150}px, 1fr))`, gap: 8, marginTop: 8,
          maxHeight: isMobile ? "none" : maxHeight, overflowY: isMobile ? "visible" : "auto", paddingRight: 2,
        }}>
          {results.map((it) => {
            const q = qtyById[it.id];
            return (
              <button
                type="button"
                key={it.id}
                onClick={() => onPick(it)}
                style={{
                  textAlign: "left", border: q ? `1.5px solid ${accent}` : "1px solid #f0f0f0", background: q ? accentBg : "#fff",
                  borderRadius: 10, padding: "10px 10px", cursor: "pointer", minHeight: 72, display: "flex",
                  flexDirection: "column", justifyContent: "space-between", position: "relative", font: "inherit", color: "inherit",
                }}
              >
                <span style={{ fontWeight: 600, fontSize: 13, lineHeight: 1.25, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", paddingRight: q ? 22 : 0 }}>
                  {it.name}
                </span>
                <span style={{ fontSize: 13, color: accent, fontWeight: 700 }}>{inr(it.rate)}</span>
                {q ? (
                  <span style={{ position: "absolute", top: 6, right: 6, background: accent, color: "#fff", borderRadius: 10, fontSize: 11, padding: "0 6px", fontWeight: 700 }}>
                    {r2(q)}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      ) : (
        <Empty style={{ padding: "24px 0" }} description={items.length ? "No items match" : emptyText || "No items on this device yet. Tap Sync items."} />
      )}
    </>
  );
});

export default ItemPicker;
