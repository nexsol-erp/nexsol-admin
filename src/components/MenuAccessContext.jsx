import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from "react";

// ============================================================================
// MENU ACCESS - one shared source for "which menus may this user open?".
//
// Previously the Sidebar fetched this on its own; the top-bar search and the
// menu map need exactly the same answer, so it lives here and is fetched once.
//
// Visibility rule (unchanged from the Sidebar):
//   - system-admin sees everything;
//   - when role-menu assignments exist they are the SOLE source of truth;
//   - with no assignments configured, fall back to the hardcoded role lists.
// ============================================================================

const MenuAccessContext = createContext({
  allowedMenuNames: null,
  loading: false,
  isMenuAllowed: () => true,
  isEntryAllowed: () => true,
  refresh: () => {},
});

export const MenuAccessProvider = ({ roles = [], children }) => {
  // null = not loaded yet; empty Set = loaded, no assignments (fall back to roles)
  const [allowedMenuNames, setAllowedMenuNames] = useState(null);
  const [fetchTrigger, setFetchTrigger] = useState(0);

  useEffect(() => {
    if (!roles || roles.length === 0) return;
    const tenancyId = localStorage.getItem("tenancyId");
    const token = localStorage.getItem("jwtToken");
    fetch(`/api/${tenancyId}/role-menus/accessible-menus`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(roles),
    })
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setAllowedMenuNames(new Set(Array.isArray(data) ? data : [])))
      .catch(() => setAllowedMenuNames(new Set()));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roles, fetchTrigger]);

  const isSystemAdmin = roles.includes("system-admin");
  const usingAssignments = allowedMenuNames !== null && allowedMenuNames.size > 0;

  /**
   * @param menuKey   backend menu name of the entry
   * @param itemRoles role list declared on the entry (fallback when no
   *                  assignments are configured)
   */
  const isMenuAllowed = useCallback(
    (menuKey, itemRoles) => {
      if (isSystemAdmin) return true;
      if (usingAssignments) return allowedMenuNames.has(menuKey);
      if (!itemRoles) return true;
      return itemRoles.some((r) => roles.includes(r));
    },
    [isSystemAdmin, usingAssignments, allowedMenuNames, roles]
  );

  /**
   * Same rule as isMenuAllowed, plus the parent-group role gate the Sidebar
   * applies to submenu entries. Note the gate only bites in fallback mode:
   * with assignments configured, an assigned leaf is reachable regardless of
   * whether its group name was assigned.
   */
  const isEntryAllowed = useCallback(
    (menuKey, itemRoles, parentRoles) => {
      if (isSystemAdmin) return true;
      if (usingAssignments) return allowedMenuNames.has(menuKey);
      if (parentRoles && parentRoles.length && !parentRoles.some((r) => roles.includes(r))) return false;
      if (!itemRoles) return true;
      return itemRoles.some((r) => roles.includes(r));
    },
    [isSystemAdmin, usingAssignments, allowedMenuNames, roles]
  );

  const refresh = useCallback(() => {
    setAllowedMenuNames(null);
    setFetchTrigger((n) => n + 1);
  }, []);

  const value = useMemo(
    () => ({
      allowedMenuNames,
      usingAssignments,
      isSystemAdmin,
      loading: allowedMenuNames === null && fetchTrigger > 0,
      isMenuAllowed,
      isEntryAllowed,
      refresh,
    }),
    [allowedMenuNames, usingAssignments, isSystemAdmin, fetchTrigger, isMenuAllowed, isEntryAllowed, refresh]
  );

  return <MenuAccessContext.Provider value={value}>{children}</MenuAccessContext.Provider>;
};

export const useMenuAccess = () => useContext(MenuAccessContext);

export default MenuAccessContext;
