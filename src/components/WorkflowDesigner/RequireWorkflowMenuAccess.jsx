import React from "react";
import { Navigate } from "react-router-dom";
import { useMenuAccess } from "../MenuAccessContext";

/**
 * Closes the direct-URL gap: the sidebar hides menu items the current role isn't assigned
 * in role_menu_mst, but nothing stopped a user typing the route in directly.
 *
 * Answers the question by asking MenuAccessContext rather than re-deriving it. This guard
 * used to run its own fetch of /role-menus/accessible-menus and its own comparison, which
 * had drifted from the sidebar's copy: the context short-circuits on system-admin, this did
 * not. A system administrator therefore saw every entry in the sidebar and was bounced to
 * the home page on clicking one - reported against Insights and Product 360, and present on
 * /my-tasks, /bpmn-editorr and /workflow-instances too.
 *
 * Sharing the context also means one lookup per session instead of one per guarded
 * navigation, and leaves no second copy of the rule to drift again.
 *
 * menuKey defaults to "Workflow Designer" for the original caller; pass another
 * (e.g. "My Tasks") to reuse this guard for a different route.
 */
export default function RequireWorkflowMenuAccess({ children, menuKey = "Workflow Designer" }) {
  const { allowedMenuNames, isSystemAdmin, isMenuAllowed } = useMenuAccess();

  // The same first rule the sidebar applies. Checked ahead of the loading state below so an
  // administrator is never held on a blank frame waiting for an answer that cannot deny them.
  if (isSystemAdmin) return children;

  // null means the lookup has not resolved yet. Render nothing rather than redirect -
  // treating "not known yet" as "denied" would bounce permitted users to the home page
  // whenever they open a guarded route directly.
  if (allowedMenuNames === null) return null;

  // No itemRoles to pass: a route carries no role list of its own. With assignments
  // configured this is a membership test against them; with none configured isMenuAllowed
  // falls through to allow, which is the default-allow posture this guard always had.
  return isMenuAllowed(menuKey) ? children : <Navigate to="/" replace />;
}
