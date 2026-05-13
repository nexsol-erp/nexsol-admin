import React, { useEffect, useState } from "react";
import { Menu } from "antd";
import POSPage from "./pos/POSPage";
import LoginPage from "./auth/LoginPage";
import DayEndPage from "./dayend/DayEndPage";
import AcceptStockPage from "./accept-stock/AcceptStockPage";
import StockTransferPage from "./stock-transfer/StockTransferPage";
import UpdateChecker from "./components/UpdateChecker";
import { isLoggedIn } from "./auth/auth";

export default function App() {
  const [loggedIn, setLoggedIn] = useState(isLoggedIn());
  const [activePage, setActivePage] = useState("pos");

  useEffect(() => {
    if (!window.POS?.onNavigate) return undefined;
    const unsubscribe = window.POS.onNavigate((page) => {
      if (page === "pos" || page === "day-end" || page === "accept-stock" || page === "stock-transfer") {
        setActivePage(page);
      }
    });
    return () => unsubscribe?.();
  }, []);

  return (
    <div style={{ minHeight: "100vh", background: "#f0f2f5" }}>
      {!loggedIn ? (
        <LoginPage onLoggedIn={() => setLoggedIn(true)} />
      ) : (
        <div style={{ background: "#ffffff" }}>
          <UpdateChecker />
          <Menu
            mode="horizontal"
            selectedKeys={[activePage]}
            onClick={(e) => setActivePage(e.key)}
            items={[
              { key: "pos", label: "POS" },
              { key: "stock-transfer", label: "Stock Transfer" },
              { key: "day-end", label: "Day End" },
              { key: "accept-stock", label: "Accept Stock" },
            ]}
            style={{ marginBottom: 8 }}
          />
          {activePage === "stock-transfer" && <StockTransferPage onClose={() => setActivePage("pos")} />}
          {activePage === "day-end" && <DayEndPage />}
          {activePage === "accept-stock" && <AcceptStockPage onClose={() => setActivePage("pos")} />}
          {activePage === "pos" && <POSPage onLogout={() => setLoggedIn(false)} />}
        </div>
      )}
    </div>
  );
}
