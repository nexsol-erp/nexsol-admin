import React, { useEffect, useState } from "react";
import { Menu } from "antd";
import POSPage from "./pos/POSPage";
import LoginPage from "./auth/LoginPage";
import DayEndPage from "./dayend/DayEndPage";
import AcceptStockPage from "./accept-stock/AcceptStockPage";
import StockTransferPage from "./stock-transfer/StockTransferPage";
import WeighBridgePage from "./pos/WeighBridgePage";
import PhysicalStockPage from "./pos/PhysicalStockPage";
import UpdateChecker from "./components/UpdateChecker";
import { isLoggedIn } from "./auth/auth";
import { log } from "./utils/logger";

export default function App() {
  const [loggedIn, setLoggedIn] = useState(isLoggedIn());
  const [activePage, setActivePage] = useState("pos");

  useEffect(() => {
    log("App mounted | loggedIn:", loggedIn, "| activePage:", activePage);
    if (!window.POS?.onNavigate) {
      log("window.POS.onNavigate not available (browser mode?)");
      return undefined;
    }
    const unsubscribe = window.POS.onNavigate((page) => {
      log("onNavigate received:", page);
      if (page === "pos" || page === "day-end" || page === "accept-stock" || page === "stock-transfer" || page === "weigh-bridge" || page === "physical-stock") {
        setActivePage(page);
      } else {
        log("onNavigate: unknown page ignored:", page);
      }
    });
    return () => unsubscribe?.();
  }, []);

  return (
    <div style={{ minHeight: "100vh", background: "#f0f2f5" }}>
      {!loggedIn ? (
        <LoginPage onLoggedIn={() => { log("Login successful, switching to app"); setLoggedIn(true); }} />
      ) : (
        <div style={{ background: "#ffffff" }}>
          <UpdateChecker />
          <Menu
            mode="horizontal"
            selectedKeys={[activePage]}
            onClick={(e) => { log("Menu clicked:", e.key); setActivePage(e.key); }}
            items={[
              { key: "pos", label: "POS" },
              { key: "stock-transfer", label: "Stock Transfer" },
              { key: "day-end", label: "Day End" },
              { key: "accept-stock", label: "Accept Stock" },
              { key: "weigh-bridge", label: "Weigh Bridge" },
              { key: "physical-stock", label: "Physical Stock" },
            ]}
            style={{ marginBottom: 8 }}
          />
          {activePage === "stock-transfer" && <StockTransferPage onClose={() => setActivePage("pos")} />}
          {activePage === "day-end" && <DayEndPage />}
          {activePage === "accept-stock" && <AcceptStockPage onClose={() => setActivePage("pos")} />}
          {activePage === "pos" && <POSPage onLogout={() => setLoggedIn(false)} />}
          {activePage === "weigh-bridge" && <WeighBridgePage />}
          {activePage === "physical-stock" && <PhysicalStockPage onClose={() => setActivePage("pos")} />}
        </div>
      )}
    </div>
  );
}
