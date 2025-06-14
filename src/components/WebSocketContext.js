import React, { createContext, useContext, useState, useEffect } from "react";

const WebSocketContext = createContext();

export const useWebSocket = () => useContext(WebSocketContext);

export const WebSocketProvider = ({ children }) => {
  const [data, setData] = useState({});
  const [ws, setWs] = useState(null);

  useEffect(() => {
    const tenancyId = localStorage.getItem("tenancyId");
    const branchId = `WEB-${tenancyId}`;
    console.log("WebSocket useEffect triggered with tenancyId:", tenancyId);

    if (tenancyId) {
      //const wsUrl = `ws://localhost:8081/ws?company=${tenancyId}&branch=${branchId}`;
      const wsUrl = `wss://tradelink247.com/ws?company=${tenancyId}&branch=${branchId}`;
      console.log(`Attempting to connect to WebSocket at ${wsUrl}`);
      const websocket = new WebSocket(wsUrl);

      websocket.onopen = function () {
        console.log("WebSocket connected successfully");
        setWs(websocket);

        // Check if items are already in local storage
        const cachedItems = localStorage.getItem("items");
        const cachedCategories = localStorage.getItem("categories");

        if (cachedItems) {
          try {
            const parsedItems = JSON.parse(cachedItems);
            console.log("Items found in local storage:", parsedItems);

            if (Array.isArray(parsedItems) && parsedItems.length === 0) {
              // Fetch if items are empty
              console.log("Cached items are empty. Fetching from server...");
              websocket.send(JSON.stringify({ action: "GET_ITEMS" }));
            } else {
              setData((prevData) => ({ ...prevData, items: parsedItems }));
            }

             
          } catch (error) {
            console.error("Error parsing cached items from local storage:", cachedItems, error);
            // Optionally remove corrupted data
            localStorage.removeItem("items");
          }
        } else {
          // Fetch items if not found in local storage
          const getItemsMessage = { action: "GET_ITEMS" };
          console.log("Items not found in local storage. Sending GET_ITEMS action:", getItemsMessage);
          websocket.send(JSON.stringify(getItemsMessage));
        }
        

        if (cachedCategories) {
          console.log("Categories found in local storage");
          setData((prevData) => ({ ...prevData, categories: JSON.parse(cachedCategories) }));
        } else {
          // Fetch categories if not found in local storage
          const getCategoriesMessage = { action: "GET_CATEGORIES" };
          console.log("Categories not found in local storage. Sending GET_CATEGORIES action:", getCategoriesMessage);
          websocket.send(JSON.stringify(getCategoriesMessage));
        }
      };

      websocket.onmessage = (event) => {
        console.log("WebSocket message received:", event.data);
      
        // Safely parse the JSON message
        let message;
        try {
          message = JSON.parse(event.data);
        } catch (error) {
          console.error("Error parsing WebSocket message as JSON:", event.data, error);
          return; // Exit early if parsing fails
        }
      
        if (!message || !message.action) {
          console.warn("Received message is invalid or missing action:", message);
          return;
        }
      
        switch (message.action) {
          case "ITEM_MST":
            try {
              const items = JSON.parse(message.message)?.items || [];
              console.log("Received ITEM_MST action, items:", items);
              localStorage.setItem("items", JSON.stringify(items)); // Cache items in local storage
              setData((prevData) => ({ ...prevData, items }));
            } catch (error) {
              console.error("Error processing ITEM_MST action:", message.message, error);
            }
            break;
      
          case "CATEGORIES_LIST":
            try {
              const categories = message.message?.categories || [];
              console.log("Received CATEGORIES_LIST action, categories:", categories);
              localStorage.setItem("categories", JSON.stringify(categories)); // Cache categories in local storage
              setData((prevData) => ({ ...prevData, categories }));
            } catch (error) {
              console.error("Error processing CATEGORIES_LIST action:", message.message, error);
            }
            break;
      
          default:
            console.log("Received other message action:", message.action, message);
            setData((prevData) => ({ ...prevData, ...message }));
            break;
        }
      };
      
      websocket.onclose = (event) => {
        console.log("WebSocket disconnected", event);
        setWs(null);
      };

      websocket.onerror = (error) => {
        console.error("WebSocket error:", error);
      };

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
