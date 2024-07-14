import React, { createContext, useContext, useState, useEffect } from "react";

const WebSocketContext = createContext();

export const useWebSocket = () => useContext(WebSocketContext);

export const WebSocketProvider = ({ children }) => {
  const [data, setData] = useState({});
  const [ws, setWs] = useState(null);

  useEffect(() => {
    const tenancyId = localStorage.getItem("tenancyId");
    const branchId = "WEB";
    console.log("WebSocket useEffect triggered with tenancyId:", tenancyId);

    if (tenancyId) {
      const wsUrl = `ws://localhost:8081/ws?company=${tenancyId}&branch=${branchId}`;
      //?company=${tenancyId}&branch=${branchId}
      //const wsUrl = `ws://localhost/ws?company=${tenancyId}&branch=${branchId}`;
      console.log(`Attempting to connect to WebSocket at ${wsUrl}`);
      const websocket = new WebSocket(wsUrl);

      websocket.onopen = function () {
        console.log("WebSocket connected successfully");
        setWs(websocket);

        // Fetch items and categories when WebSocket connects
        const getItemsMessage = { action: "GET_ITEMS" };
        const getCategoriesMessage = { action: "GET_CATEGORIES" };
        console.log("Sending GET_ITEMS action:", getItemsMessage);
        websocket.send(JSON.stringify(getItemsMessage));
        console.log("Sending GET_CATEGORIES action:", getCategoriesMessage);
        websocket.send(JSON.stringify(getCategoriesMessage));
      };

      websocket.onmessage = (event) => {
        console.log("WebSocket message received:", event.data);
        const message = JSON.parse(event.data);
        if (message.action === "ITEM_MST") {
          const items = JSON.parse(message.message).items;
          console.log("Received ITEM_MST action, items:", items);
          localStorage.setItem("items", JSON.stringify(items));
          setData((prevData) => ({ ...prevData, items }));
        } else if (message.action === "CATEGORIES_LIST") {
          const categories = JSON.parse(message.message).categories;
          console.log(
            "Received CATEGORIES_LIST action, categories:",
            categories
          );
          localStorage.setItem("categories", JSON.stringify(categories));
          setData((prevData) => ({ ...prevData, categories }));
        } else {
          console.log("Received other message action:", message);
          setData((prevData) => ({ ...prevData, ...message }));
        }
      };

      websocket.onclose = (event) => {
        console.log("WebSocket disconnected", event);
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
      console.log("Sending message:", message);
      ws.send(JSON.stringify(message));
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
