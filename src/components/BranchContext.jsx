import React, { createContext, useContext, useEffect, useState, useMemo } from "react";

const BranchContext = createContext({ branch: "", setBranch: () => {}, branches: [] });

export function BranchProvider({ children }) {
  const [branches, setBranches] = useState([]);
  const [branch, _setBranch] = useState(localStorage.getItem("branchCode") || "");

  const allowedBranches = useMemo(() => {
    try {
      const list = JSON.parse(localStorage.getItem("allowedBranches") || "[]");
      return Array.isArray(list) ? list : [];
    } catch { return []; }
  }, []);

  useEffect(() => {
    const tenancyId = localStorage.getItem("tenancyId");
    const token = localStorage.getItem("jwtToken");
    if (!tenancyId || !token) return;

    fetch(`/api/${tenancyId}/branches`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        const list = Array.isArray(data) ? data : data.branches || data.data || [];
        const filtered = allowedBranches.length
          ? list.filter((b) => allowedBranches.includes(b.branchCode))
          : list;
        setBranches(filtered);

        // Auto-select: if saved branch is missing from list, pick the first allowed
        const saved = localStorage.getItem("branchCode") || "";
        if (!saved && filtered.length) {
          setBranch(filtered[0].branchCode);
        } else if (saved && !filtered.some((b) => b.branchCode === saved) && filtered.length) {
          setBranch(filtered[0].branchCode);
        }
      })
      .catch(() => {});
  }, []);

  function setBranch(code) {
    _setBranch(code);
    localStorage.setItem("branchCode", code);
  }

  return (
    <BranchContext.Provider value={{ branch, setBranch, branches }}>
      {children}
    </BranchContext.Provider>
  );
}

export function useBranch() {
  return useContext(BranchContext);
}
