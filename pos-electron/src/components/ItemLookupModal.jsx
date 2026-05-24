import React, { useEffect, useMemo, useRef, useState } from "react";
import { Modal, Input, Table, Typography, message, Spin, Button, Space } from "antd";
import { localSearchItems, loadAllItemsToCache, hasCache } from "../cache/itemCache";

const { Text } = Typography;

export default function ItemLookupModal({ open, initialQuery, onClose, onPick }) {
  const inputRef = useRef(null);

  const [q, setQ] = useState(initialQuery || "");
  const [rows, setRows] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [cacheReady, setCacheReady] = useState(false);
  const [limit, setLimit] = useState(10);
  const [moreAvailable, setMoreAvailable] = useState(false);

  // Ensure cache is loaded when modal opens
  useEffect(() => {
    if (!open) return;
    
    (async () => {
      try {
        console.log("ItemLookupModal: Checking cache status...");
        const ready = await hasCache();
        console.log("Cache ready:", ready);
        
        if (!ready) {
          console.log("Cache not ready, loading...");
          setLoading(true);
          await loadAllItemsToCache({
            onProgress: ({ loaded, total }) => {
              console.log("Cache load progress:", loaded, "/", total);
            },
          });
          console.log("Cache loaded successfully");
        }
        setCacheReady(true);
        setLoading(false);
      } catch (e) {
        console.error("Cache load error:", e);
        message.error("Failed to load item cache: " + e.message);
        setLoading(false);
      }
    })();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setQ(initialQuery || "");
    setSelectedIndex(0);
    setTimeout(() => inputRef.current?.focus?.(), 50);
  }, [open, initialQuery]);

  useEffect(() => {
    if (!open || !cacheReady) return;
    let cancelled = false;

    const run = async () => {
      try {
        // request one more than limit to detect if more results exist
        const list = await localSearchItems(q, limit + 1);
        if (!cancelled) {
          setMoreAvailable(list.length > limit);
          setRows(list.slice(0, limit));
          setSelectedIndex(0);
        }
      } catch (e) {
        if (!cancelled) {
          message.error("Search error: " + e.message);
          setRows([]);
          setMoreAvailable(false);
        }
      }
    };

    const t = setTimeout(run, 80);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [open, q, cacheReady]);

  const selectedRow = useMemo(() => rows[selectedIndex], [rows, selectedIndex]);

  const pick = (r) => {
    if (!r) return;
    onPick?.(r);
  };

  const onKeyDown = (e) => {
    if (e.key === "Escape") return onClose?.();
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, Math.max(rows.length - 1, 0)));
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    }
    if (e.key === "Enter") {
      e.preventDefault();
      pick(selectedRow);
    }
  };

  const columns = [
    { title: "Name", dataIndex: "itemName", width: 320 },
    { title: "Barcode", dataIndex: "barcode", width: 160 },
    { title: "Stock", dataIndex: "availableQty", width: 90, render: (v) => (v == null ? "-" : Number(v).toFixed(2)) },
    { title: "MRP", dataIndex: "standardPrice", width: 90, render: (v) => Number(v || 0).toFixed(2) },
    { title: "Tax%", dataIndex: "taxRate", width: 70 },
    { title: "Unit", dataIndex: "unitName", width: 90 },
  ];

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      width={900}
      centered
      title="Item Lookup"
      className="item-lookup-modal"
      styles={{ body: { color: "#1f2937", fontSize: 12 } }}
    >
      <Spin spinning={loading} description="Loading cache...">
        <div onKeyDown={onKeyDown}>
          <Input
            size="small"
            ref={inputRef} 
            value={q} 
            onChange={(e) => setQ(e.target.value)} 
            placeholder="Type name/barcode (Enter to select, Esc to close)"
            disabled={loading}
          />
          <div style={{ margin: "8px 0" }}>
            <Text type="secondary">
              {loading ? "Loading items..." : rows.length ? `${rows.length}${moreAvailable ? '+' : ''} results` : "No results"}
            </Text>
          </div>
          {rows.length === 0 && !loading && (
            <div style={{ padding: "20px", textAlign: "center", background: "#fef9e7", border: "1px solid #fde68a", borderRadius: "6px" }}>
              <Text style={{ color: "#92400e" }}>
                No items found. Try a different search term or check backend configuration.
              </Text>
            </div>
          )}
          <Table
            size="small"
            dataSource={rows}
            columns={columns}
            pagination={false}
            rowKey={(r) => `${r.itemId}-${r.batchCode || ""}-${r.barcode || ""}`}
            onRow={(record, index) => ({
              onClick: () => { setSelectedIndex(index ?? 0); inputRef.current?.focus?.(); },
              onDoubleClick: () => pick(record),
            })}
            rowClassName={(_, idx) => (idx === selectedIndex ? "lookup-row-selected" : "")}
          />
          {moreAvailable && (
            <div style={{ marginTop: 8, textAlign: "right" }}>
              <Space>
                <Button size="small" onClick={() => setLimit((l) => Math.min(1000, l * 10))}>
                  Show more
                </Button>
                <Button size="small" onClick={() => { setLimit(10); setQ(""); inputRef.current?.focus?.(); }}>
                  Reset
                </Button>
              </Space>
            </div>
          )}
        </div>
      </Spin>
    </Modal>
  );
}
