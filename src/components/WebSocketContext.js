import React, { createContext, useEffect, useRef, useState } from "react";

const WebSocketContext = createContext(null);

export const WebSocketProvider = ({ children }) => {
  const ws = useRef(null);
  const [data, setData] = useState({});

  useEffect(() => {
    ws.current = new WebSocket("ws://localhost:8081/KOLLAM/nexsoldb");

    ws.current.onopen = () => {
      console.log("WebSocket connected");
    };

    ws.current.onmessage = (event) => {
      const message = JSON.parse(event.data);
      setData((prevData) => ({ ...prevData, ...message }));
    };

    ws.current.onclose = () => {
      console.log("WebSocket disconnected");
    };

    ws.current.onerror = (error) => {
      console.error("WebSocket error", error);
    };

    return () => {
      if (ws.current) {
        ws.current.close();
      }
    };
  }, []);

  const sendMessage = (message) => {
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify(message));
    }
  };

  return (
    <WebSocketContext.Provider value={{ data, sendMessage }}>
      {children}
    </WebSocketContext.Provider>
  );
};

export const useWebSocket = () => {
  return React.useContext(WebSocketContext);
};
