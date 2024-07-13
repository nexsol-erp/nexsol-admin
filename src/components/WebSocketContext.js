import React, { createContext, useContext, useState, useEffect } from "react";

const WebSocketContext = createContext();

export const useWebSocket = () => useContext(WebSocketContext);

export const WebSocketProvider = ({ children }) => {
  const [data, setData] = useState({});
  const [ws, setWs] = useState(null);

  useEffect(() => {
    const tenancyId = localStorage.getItem("tenancyId");
    if (tenancyId) {
      const wsUrl = `ws://tradelink247.com:8081/${tenancyId}/WEB`;
      const websocket = new WebSocket(wsUrl);

      websocket.onopen = () => {
        console.log("WebSocket connected");
        setWs(websocket);
        // Fetch items and categories when WebSocket connects
        websocket.send(JSON.stringify({ action: "GET_ITEMS" }));
        websocket.send(JSON.stringify({ action: "GET_CATEGORIES" }));
      };

      websocket.onmessage = (event) => {
        const message = JSON.parse(event.data);
        if (message.action === "ITEM_MST") {
          const items = JSON.parse(message.message).items;
          localStorage.setItem("items", JSON.stringify(items));
          setData((prevData) => ({ ...prevData, items }));
        } else if (message.action === "CATEGORIES_LIST") {
          const categories = JSON.parse(message.message).categories;
          localStorage.setItem("categories", JSON.stringify(categories));
          setData((prevData) => ({ ...prevData, categories }));
        } else {
          setData((prevData) => ({ ...prevData, ...message }));
        }
      };

      websocket.onclose = () => {
        console.log("WebSocket disconnected");
      };

      websocket.onerror = (error) => {
        console.error("WebSocket error:", error);
      };
    }
  }, []);

  const sendMessage = (message) => {
    if (ws) {
      ws.send(JSON.stringify(message));
    }
  };

  return (
    <WebSocketContext.Provider value={{ data, sendMessage }}>
      {children}
    </WebSocketContext.Provider>
  );
};
