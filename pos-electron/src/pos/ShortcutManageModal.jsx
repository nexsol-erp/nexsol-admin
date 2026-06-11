import React, { useEffect, useRef, useState } from "react";
import { Button, Input, List, Modal, Space, Typography, message } from "antd";
import { DeleteOutlined, DownOutlined, PlusOutlined, UpOutlined } from "@ant-design/icons";
import { getShortcutItems, saveShortcutItemIds, localSearchItems } from "../cache/itemCache";

const MAX = 10;

export default function ShortcutManageModal({ open, onClose, onChanged }) {
  const [items,         setItems]         = useState([]);
  const [searchQ,       setSearchQ]       = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const searchTimer = useRef(null);

  useEffect(() => {
    if (open) getShortcutItems().then(setItems).catch(() => {});
  }, [open]);

  const persist = async (next) => {
    setItems(next);
    await saveShortcutItemIds(next.map((i) => i.itemId));
    onChanged?.(next);
  };

  const remove = (itemId) => persist(items.filter((i) => i.itemId !== itemId));

  const move = (idx, dir) => {
    const next = [...items];
    const swap = idx + dir;
    if (swap < 0 || swap >= next.length) return;
    [next[idx], next[swap]] = [next[swap], next[idx]];
    persist(next);
  };

  const handleSearchChange = (e) => {
    const q = e.target.value;
    setSearchQ(q);
    clearTimeout(searchTimer.current);
    if (!q.trim()) { setSearchResults([]); return; }
    searchTimer.current = setTimeout(async () => {
      const results = await localSearchItems(q, 20);
      setSearchResults(results.filter((r) => !items.find((i) => i.itemId === r.itemId)));
    }, 120);
  };

  const addItem = async (itm) => {
    if (items.length >= MAX) { message.warning("Maximum 10 shortcut items allowed"); return; }
    await persist([...items, itm]);
    setSearchQ("");
    setSearchResults([]);
  };

  const label = (idx) => (idx < 9 ? idx + 1 : 0);

  return (
    <Modal
      title="Manage Shortcut Keys"
      open={open}
      onCancel={onClose}
      footer={<Button type="primary" onClick={onClose}>Done</Button>}
      width={480}
    >
      <Typography.Text type="secondary" style={{ fontSize: 12, display: "block", marginBottom: 12 }}>
        Alt+1 → Alt+9 = items 1–9 &nbsp;·&nbsp; Alt+0 = item 10.
        Shortcuts are fixed — order only changes when you move them here.
      </Typography.Text>

      <List
        dataSource={items}
        locale={{ emptyText: "No shortcuts configured — add items below" }}
        renderItem={(itm, idx) => (
          <List.Item style={{ padding: "5px 0" }}>
            <Space style={{ width: "100%" }}>
              <span style={{
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                width: 22, height: 22, background: "#1e3a5f", color: "#fff",
                borderRadius: 3, fontSize: 11, fontWeight: "bold", flexShrink: 0,
              }}>
                {label(idx)}
              </span>
              <span style={{ flex: 1, fontSize: 13 }}>{itm.itemName}</span>
              <span style={{ fontSize: 12, color: "#888", minWidth: 64, textAlign: "right" }}>
                ₹{Number(itm.standardPrice || 0).toFixed(2)}
              </span>
              <Button size="small" icon={<UpOutlined />}   disabled={idx === 0}              onClick={() => move(idx, -1)} />
              <Button size="small" icon={<DownOutlined />} disabled={idx === items.length - 1} onClick={() => move(idx, +1)} />
              <Button size="small" danger icon={<DeleteOutlined />} onClick={() => remove(itm.itemId)} />
            </Space>
          </List.Item>
        )}
      />

      {items.length < MAX && (
        <div style={{ marginTop: 12, position: "relative" }}>
          <Input
            prefix={<PlusOutlined style={{ color: "#aaa" }} />}
            placeholder={`Search item to add (${items.length}/${MAX} used)…`}
            value={searchQ}
            onChange={handleSearchChange}
            allowClear
            onClear={() => setSearchResults([])}
          />
          {searchResults.length > 0 && (
            <div style={{
              position: "absolute", left: 0, right: 0, zIndex: 10,
              border: "1px solid #d9d9d9", borderTop: "none",
              borderRadius: "0 0 6px 6px", background: "#fff",
              maxHeight: 220, overflowY: "auto", boxShadow: "0 4px 8px rgba(0,0,0,.1)",
            }}>
              {searchResults.map((r) => (
                <div
                  key={r.itemId}
                  onClick={() => addItem(r)}
                  style={{
                    padding: "7px 12px", cursor: "pointer", fontSize: 13,
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "#f0f4ff")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "#fff")}
                >
                  <span>{r.itemName}</span>
                  <span style={{ color: "#888", fontSize: 12 }}>
                    ₹{Number(r.standardPrice || 0).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {items.length >= MAX && (
        <Typography.Text type="secondary" style={{ fontSize: 12, display: "block", marginTop: 10 }}>
          All 10 shortcut slots are filled. Remove an item to add another.
        </Typography.Text>
      )}
    </Modal>
  );
}
