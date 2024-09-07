import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./i18n"; // Import the i18n configuration at the very beginning

const container = document.getElementById("root");
const root = createRoot(container);

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
