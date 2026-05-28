import React, { useState, useEffect, useCallback } from "react";
import {
  Box,
  Typography,
  Paper,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  CircularProgress,
  Alert,
  List,
  ListItem,
  ListItemText,
  Checkbox,
  Chip,
  Divider,
} from "@mui/material";

const RoleMenuPage = () => {
  const [roles, setRoles] = useState([]);
  const [menus, setMenus] = useState([]);
  const [selectedRole, setSelectedRole] = useState("");
  const [assignedMenuIds, setAssignedMenuIds] = useState(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [toggling, setToggling] = useState(null);

  const tenancyId = localStorage.getItem("tenancyId");
  const token = localStorage.getItem("jwtToken");
  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };

  useEffect(() => {
    const fetchBase = async () => {
      setLoading(true);
      setError("");
      try {
        const [rolesRes, menusRes] = await Promise.all([
          fetch(`/api/${tenancyId}/role-menus/roles`, { headers }),
          fetch(`/api/${tenancyId}/menus/all`, { headers }),
        ]);
        if (!rolesRes.ok || !menusRes.ok) throw new Error("Failed to load data");
        const [rolesData, menusData] = await Promise.all([
          rolesRes.json(),
          menusRes.json(),
        ]);
        setRoles(rolesData);
        setMenus(menusData);
      } catch {
        setError("Could not load roles or menus.");
      } finally {
        setLoading(false);
      }
    };
    fetchBase();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchAssignments = useCallback(
    async (roleId) => {
      setError("");
      try {
        const res = await fetch(`/api/${tenancyId}/role-menus/by-role/${roleId}`, { headers });
        if (!res.ok) throw new Error();
        const data = await res.json();
        setAssignedMenuIds(new Set(data));
      } catch {
        setError("Could not load assignments.");
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tenancyId, token]
  );

  const handleRoleChange = (e) => {
    const roleId = e.target.value;
    setSelectedRole(roleId);
    setAssignedMenuIds(new Set());
    if (roleId) fetchAssignments(roleId);
  };

  const handleToggle = async (menuId) => {
    if (!selectedRole || toggling) return;
    setToggling(menuId);
    const isAssigned = assignedMenuIds.has(menuId);
    try {
      if (isAssigned) {
        await fetch(`/api/${tenancyId}/role-menus/remove`, {
          method: "DELETE",
          headers,
          body: JSON.stringify({ roleId: selectedRole, menuId }),
        });
        setAssignedMenuIds((prev) => {
          const next = new Set(prev);
          next.delete(menuId);
          return next;
        });
      } else {
        await fetch(`/api/${tenancyId}/role-menus/assign`, {
          method: "POST",
          headers,
          body: JSON.stringify({ roleId: selectedRole, menuId }),
        });
        setAssignedMenuIds((prev) => new Set([...prev, menuId]));
      }
    } catch {
      setError("Failed to update assignment.");
    } finally {
      setToggling(null);
    }
  };

  const webMenus = menus.filter((m) => m.menuType === "WEB");
  const clientMenus = menus.filter((m) => m.menuType === "CLIENT");

  const MenuSection = ({ title, items }) =>
    items.length === 0 ? null : (
      <>
        <Typography variant="caption" sx={{ px: 2, pt: 1, color: "text.secondary" }}>
          {title}
        </Typography>
        <List dense disablePadding>
          {items.map((menu) => {
            const checked = assignedMenuIds.has(menu.id);
            return (
              <ListItem
                key={menu.id}
                disablePadding
                secondaryAction={
                  toggling === menu.id ? (
                    <CircularProgress size={16} />
                  ) : (
                    <Chip
                      label={menu.menuType}
                      size="small"
                      color={menu.menuType === "WEB" ? "primary" : "secondary"}
                      variant="outlined"
                    />
                  )
                }
                sx={{ cursor: selectedRole ? "pointer" : "default" }}
                onClick={() => handleToggle(menu.id)}
              >
                <Checkbox
                  edge="start"
                  checked={checked}
                  disabled={!selectedRole || toggling !== null}
                  tabIndex={-1}
                  disableRipple
                />
                <ListItemText primary={menu.menuName} />
              </ListItem>
            );
          })}
        </List>
      </>
    );

  return (
    <Box sx={{ p: 3, maxWidth: 700, mx: "auto" }}>
      <Typography variant="h5" gutterBottom>
        Role — Menu Assignment
      </Typography>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <FormControl fullWidth sx={{ mb: 3 }} size="small">
        <InputLabel>Select Role</InputLabel>
        <Select value={selectedRole} label="Select Role" onChange={handleRoleChange}>
          {roles.map((r) => (
            <MenuItem key={r.roleid} value={r.roleid}>
              {r.name}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", mt: 4 }}>
          <CircularProgress />
        </Box>
      ) : (
        <Paper variant="outlined">
          {!selectedRole ? (
            <Typography sx={{ p: 3, color: "text.secondary" }}>
              Select a role to manage its menu access.
            </Typography>
          ) : menus.length === 0 ? (
            <Typography sx={{ p: 3, color: "text.secondary" }}>
              No menus found. Add menus in Menu Master first.
            </Typography>
          ) : (
            <>
              <MenuSection title="WEB MENUS" items={webMenus} />
              {webMenus.length > 0 && clientMenus.length > 0 && <Divider />}
              <MenuSection title="CLIENT MENUS" items={clientMenus} />
            </>
          )}
        </Paper>
      )}
    </Box>
  );
};

export default RoleMenuPage;
