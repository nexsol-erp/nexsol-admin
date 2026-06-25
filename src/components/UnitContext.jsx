import React, { createContext, useContext, useEffect, useState } from "react";

const UnitContext = createContext([]);

export function UnitProvider({ children }) {
  const [units, setUnits] = useState([]);

  useEffect(() => {
    const tenancyId = localStorage.getItem("tenancyId");
    const token = localStorage.getItem("jwtToken");
    if (!tenancyId || !token) return;

    fetch(`/api/${tenancyId}/units`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        setUnits(
          Array.isArray(data)
            ? data.map((u) => u.unitName).filter(Boolean).sort()
            : []
        );
      })
      .catch(() => {});
  }, []);

  return <UnitContext.Provider value={units}>{children}</UnitContext.Provider>;
}

export function useUnits() {
  return useContext(UnitContext);
}
