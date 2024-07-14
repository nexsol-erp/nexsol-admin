import React, { createContext, useContext, useState, useEffect } from "react";

const WebSocketContext = createContext();

export const useWebSocket = () => useContext(WebSocketContext);

export const WebSocketProvider = ({ children }) => {
  const [data, setData] = useState({});
  const [ws, setWs] = useState(null);

  useEffect(() => {
    const tenancyId = localStorage.getItem("tenancyId");
    if (tenancyId) {
      const wsUrl = `wss://tradelink247.com/ws`;
      console.log(`Attempting to connect to WebSocket at ${wsUrl}`);
      const websocket = new WebSocket(wsUrl);

      websocket.onopen = () => {
        websocket.onopen = function () {
          websocket.send(
            JSON.stringify({
              action: "setHeaders",
              company: tenancyId,
              branch: "WEB",
            })
          );
        };
        console.log("WebSocket connected successfully");
        setWs(websocket);
        // Fetch items and categories when WebSocket connects
        websocket.send(JSON.stringify({ action: "GET_ITEMS" }));
        console.log("Sent GET_ITEMS action");
        websocket.send(JSON.stringify({ action: "GET_CATEGORIES" }));
        console.log("Sent GET_CATEGORIES action");
      };

      websocket.onmessage = (event) => {
        console.log("WebSocket message received:", event.data);
        const message = JSON.parse(event.data);
        if (message.action === "ITEM_MST") {
          const items = JSON.parse(message.message).items;
          localStorage.setItem("items", JSON.stringify(items));
          setData((prevData) => ({ ...prevData, items }));
          console.log("Items updated:", items);
        } else if (message.action === "CATEGORIES_LIST") {
          const categories = JSON.parse(message.message).categories;
          localStorage.setItem("categories", JSON.stringify(categories));
          setData((prevData) => ({ ...prevData, categories }));
          console.log("Categories updated:", categories);
        } else {
          setData((prevData) => ({ ...prevData, ...message }));
          console.log("Other message received:", message);
        }
      };

      websocket.onclose = () => {
        console.log("WebSocket disconnected");
        setWs(null); // Ensure ws is reset on close
      };

      websocket.onerror = (error) => {
        console.error("WebSocket error:", error);
      };

      // Clean up WebSocket on unmount
      return () => {
        console.log("Cleaning up WebSocket connection");
        websocket.close();
      };
    } else {
      console.warn("No tenancyId found in localStorage");
    }
  }, []);

  const sendMessage = (message) => {
    if (ws) {
      ws.send(JSON.stringify(message));
      console.log("Sent message:", message);
    } else {
      console.warn("WebSocket is not connected. Message not sent:", message);
    }
  };

  return (
    <WebSocketContext.Provider value={{ data, sendMessage }}>
      {children}
    </WebSocketContext.Provider>
  );
};
