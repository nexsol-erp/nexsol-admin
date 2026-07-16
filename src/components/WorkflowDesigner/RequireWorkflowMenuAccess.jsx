import React, { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";

/**
 * Closes the direct-URL gap: the sidebar already hides menu items the current role
 * isn't assigned in role_menu_mst, but nothing stopped a user from typing the route in
 * directly. Mirrors resolveLoginLanding()'s exact fetch/default-allow logic in App.js
 * so behavior stays consistent with how menu access is resolved everywhere else.
 * menuKey defaults to "Workflow Designer" for the original caller; pass another menuKey
 * (e.g. "My Tasks") to reuse this guard for a different route/menu entry.
 */
export default function RequireWorkflowMenuAccess({ children, menuKey = "Workflow Designer" }) {
  const [status, setStatus] = useState("checking"); // checking | allowed | denied

  useEffect(() => {
    const tenancyId = localStorage.getItem("tenancyId");
    const token = localStorage.getItem("jwtToken");
    const roles = JSON.parse(localStorage.getItem("roles") || "[]");

    fetch(`/api/${tenancyId}/role-menus/accessible-menus`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(roles),
    })
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        const allowed = new Set(Array.isArray(data) ? data : []);
        // No role-menu assignments configured for this tenant — default to allow,
        // same fallback resolveLoginLanding() uses.
        setStatus(allowed.size === 0 || allowed.has(menuKey) ? "allowed" : "denied");
      })
      .catch(() => setStatus("allowed"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [menuKey]);

  if (status === "checking") return null;
  if (status === "denied") return <Navigate to="/" replace />;
  return children;
}
