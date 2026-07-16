import React, { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";

/**
 * Closes the direct-URL gap: the sidebar already hides "Workflow Designer" based on
 * role_menu_mst assignments, but nothing stopped a user from typing /bpmn-editorr in
 * directly. Mirrors resolveLoginLanding()'s exact fetch/default-allow logic in App.js
 * so behavior stays consistent with how menu access is resolved everywhere else.
 */
export default function RequireWorkflowMenuAccess({ children }) {
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
        setStatus(allowed.size === 0 || allowed.has("Workflow Designer") ? "allowed" : "denied");
      })
      .catch(() => setStatus("allowed"));
  }, []);

  if (status === "checking") return null;
  if (status === "denied") return <Navigate to="/" replace />;
  return children;
}
