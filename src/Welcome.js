import React, { Suspense, useState } from "react";
import { useTranslation } from "react-i18next";
import Welcome from "./Welcome"; // Your Welcome component
import "./i18n"; // Your i18n setup

function App() {
  const { i18n } = useTranslation();
  const [language, setLanguage] = useState("en"); // Default language

  // Change language when user selects from dropdown
  const changeLanguage = (lang) => {
    i18n.changeLanguage(lang);
    setLanguage(lang);
  };

  return (
    <Suspense fallback={<div>Loading...</div>}>
      <div className="App">
        <header className="App-header">
          <h1>Internationalized React App</h1>
          <div>
            {/* Language Selection Dropdown */}
            <label>Select Language: </label>
            <select
              value={language}
              onChange={(e) => changeLanguage(e.target.value)}
            >
              <option value="en">English</option>
              <option value="fr">Français</option>
              {/* Add more languages as needed */}
            </select>
          </div>
        </header>

        {/* Render a component that uses translations */}
        <Welcome />
      </div>
    </Suspense>
  );
}

export default App;
