import React, { useState, useEffect, useCallback } from "react";
import {
  Box, Stepper, Step, StepLabel, Button, Typography, TextField,
  Checkbox, FormControlLabel, Paper, Alert, CircularProgress,
  LinearProgress, Chip, Grid, Table, TableBody, TableCell,
  TableHead, TableRow, IconButton, Divider, Stack, Card,
  CardContent, FormGroup, Switch, Tooltip, CssBaseline,
} from "@mui/material";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";

// The wizard is always rendered in a forced light theme regardless of the app's dark/light mode.
// This avoids white-text-on-white-background issues caused by hardcoded light bg colours.
const wizardTheme = createTheme({ palette: { mode: "light" } });

const STEPS = [
  { label: "Company Profile",   optional: false },
  { label: "Menu Setup",        optional: false },
  { label: "Role Setup",        optional: false },
  { label: "Menu Permissions",  optional: false },
  { label: "Branch Setup",      optional: false },
  { label: "User Setup",        optional: false },
  { label: "Branch Assignment", optional: false },
  { label: "Role Assignment",   optional: false },
  { label: "Category Setup",    optional: true  },
  { label: "Item Setup",        optional: true  },
  { label: "Finish",            optional: false },
];

const DEFAULT_MENUS = [
  "Dashboard","POS Billing","Sales","Purchase",
  "Inventory","Stock Transfer","Reports","User Management","Settings",
];
const DEFAULT_ROLES = ["Admin","Owner","Manager","Cashier","Inventory Staff","Accountant"];
const DEFAULT_CATEGORIES_BAKERY = ["Cakes","Pastries","Bread","Snacks","Raw Materials","Beverages"];
const DEFAULT_CATEGORIES_SUPERMARKET = ["Grocery","Dairy","Frozen Foods","Personal Care","Household","Fruits & Vegetables"];

async function api(path, method = "GET", body = null) {
  const tenancyId = localStorage.getItem("tenancyId");
  const token = localStorage.getItem("jwtToken");
  const r = await fetch(`/api/${tenancyId}/setup-wizard${path}`, {
    method,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: body != null ? JSON.stringify(body) : undefined,
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.message || `Server error ${r.status}`);
  return data;
}

// ── Step Components ────────────────────────────────────────────────────────────

function CompanyProfileStep({ data, onChange }) {
  const fields = [
    { key: "companyName",   label: "Company Name *" },
    { key: "companyGst",    label: "GST / VAT Number" },
    { key: "address1",      label: "Address Line 1" },
    { key: "address2",      label: "Address Line 2" },
    { key: "state",         label: "State" },
    { key: "country",       label: "Country" },
    { key: "emailId",       label: "Email" },
    { key: "mobNo",         label: "Phone" },
    { key: "currencyName",  label: "Default Currency" },
  ];
  return (
    <Grid container spacing={2}>
      {fields.map(({ key, label }) => (
        <Grid item xs={12} sm={6} key={key}>
          <TextField
            label={label} fullWidth size="small" value={data[key] || ""}
            onChange={e => onChange({ ...data, [key]: e.target.value })}
          />
        </Grid>
      ))}
    </Grid>
  );
}

function MenuSetupStep({ selected, onChange }) {
  const toggle = name => onChange(
    selected.includes(name) ? selected.filter(n => n !== name) : [...selected, name]
  );
  return (
    <Box>
      <Alert severity="info" sx={{ mb: 2 }}>
        Select the menus to enable for your business. You can change these later.
      </Alert>
      <FormGroup row sx={{ flexWrap: "wrap", gap: 1 }}>
        {DEFAULT_MENUS.map(name => (
          <FormControlLabel
            key={name}
            control={<Checkbox checked={selected.includes(name)} onChange={() => toggle(name)} />}
            label={name}
            sx={{ minWidth: 180, border: "1px solid", borderColor: "divider", borderRadius: 1, px: 1, py: 0.5 }}
          />
        ))}
      </FormGroup>
    </Box>
  );
}

function RoleSetupStep({ roles, onChange }) {
  const [newRole, setNewRole] = useState("");
  const add = () => {
    if (newRole.trim() && !roles.includes(newRole.trim())) {
      onChange([...roles, newRole.trim()]);
      setNewRole("");
    }
  };
  const remove = name => {
    if (name === "Admin") return; // Admin cannot be removed
    onChange(roles.filter(r => r !== name));
  };
  return (
    <Box>
      <Alert severity="info" sx={{ mb: 2 }}>
        The Admin role cannot be removed. Add custom roles for your business.
      </Alert>
      <Stack direction="row" spacing={1} mb={2}>
        <TextField
          label="New Role Name" size="small" value={newRole}
          onChange={e => setNewRole(e.target.value)}
          onKeyDown={e => e.key === "Enter" && add()}
          sx={{ flex: 1 }}
        />
        <Button variant="outlined" startIcon={<AddIcon />} onClick={add}>Add</Button>
      </Stack>
      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
        {roles.map(r => (
          <Chip
            key={r} label={r}
            onDelete={r === "Admin" ? undefined : () => remove(r)}
            color={r === "Admin" ? "primary" : "default"}
          />
        ))}
      </Box>
    </Box>
  );
}

function RoleMenuPermissionStep({ roles, menus, assignments, onChange, onGetIds }) {
  const isAssigned = (role, menu) =>
    assignments.some(a => a.roleName === role && a.menuName === menu);

  const toggle = (role, menu) => {
    if (isAssigned(role, menu)) {
      onChange(assignments.filter(a => !(a.roleName === role && a.menuName === menu)));
    } else {
      onChange([...assignments, { roleName: role, menuName: menu }]);
    }
  };

  const assignAll = role => {
    const existing = assignments.filter(a => a.roleName !== role);
    onChange([...existing, ...menus.map(m => ({ roleName: role, menuName: m }))]);
  };

  return (
    <Box sx={{ overflowX: "auto" }}>
      <Alert severity="info" sx={{ mb: 2 }}>
        Configure which menus each role can access. Admin role gets full access by default.
      </Alert>
      <Table size="small" stickyHeader>
        <TableHead>
          <TableRow>
            <TableCell sx={{ fontWeight: 700, minWidth: 140 }}>Role \ Menu</TableCell>
            {menus.map(m => (
              <TableCell key={m} align="center" sx={{ fontWeight: 700, minWidth: 90, fontSize: 11 }}>
                {m}
              </TableCell>
            ))}
            <TableCell align="center">All</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {roles.map(role => (
            <TableRow key={role} hover>
              <TableCell sx={{ fontWeight: 600 }}>{role}</TableCell>
              {menus.map(menu => (
                <TableCell key={menu} align="center" padding="checkbox">
                  <Checkbox
                    checked={isAssigned(role, menu) || role === "Admin"}
                    disabled={role === "Admin"}
                    onChange={() => toggle(role, menu)}
                    size="small"
                  />
                </TableCell>
              ))}
              <TableCell align="center">
                <Tooltip title="Grant all menus">
                  <IconButton size="small" onClick={() => assignAll(role)} disabled={role === "Admin"}>
                    <CheckCircleIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Box>
  );
}

function BranchSetupStep({ branches, onChange }) {
  const empty = () => ({ branchCode: "", branchName: "", address: "", state: "", gst: "", invoicePrefix: "" });
  const add = () => onChange([...branches, empty()]);
  const remove = i => onChange(branches.filter((_, idx) => idx !== i));
  const update = (i, field, val) => onChange(branches.map((b, idx) => idx === i ? { ...b, [field]: val } : b));

  return (
    <Box>
      <Alert severity="warning" sx={{ mb: 2 }}>At least one branch is required.</Alert>
      {branches.map((b, i) => (
        <Card key={i} variant="outlined" sx={{ mb: 2 }}>
          <CardContent>
            <Stack direction="row" justifyContent="space-between" mb={1}>
              <Typography variant="subtitle2">Branch {i + 1}</Typography>
              {branches.length > 1 && (
                <IconButton size="small" onClick={() => remove(i)}><DeleteIcon fontSize="small" /></IconButton>
              )}
            </Stack>
            <Grid container spacing={1.5}>
              {[
                ["branchCode", "Branch Code *"], ["branchName", "Branch Name *"],
                ["address", "Address"], ["state", "State"],
                ["gst", "GST / VAT Number"], ["invoicePrefix", "Invoice Prefix"],
              ].map(([field, label]) => (
                <Grid item xs={12} sm={6} key={field}>
                  <TextField
                    label={label} size="small" fullWidth value={b[field] || ""}
                    onChange={e => update(i, field, e.target.value)}
                  />
                </Grid>
              ))}
            </Grid>
          </CardContent>
        </Card>
      ))}
      <Button startIcon={<AddIcon />} variant="outlined" onClick={add}>Add Branch</Button>
    </Box>
  );
}

function UserSetupStep({ users, onChange, existingUsername }) {
  const empty = () => ({ username: "", password: "", role: "user", fullName: "" });
  const add = () => onChange([...users, empty()]);
  const remove = i => onChange(users.filter((_, idx) => idx !== i));
  const update = (i, field, val) => onChange(users.map((u, idx) => idx === i ? { ...u, [field]: val } : u));

  return (
    <Box>
      <Alert severity="info" sx={{ mb: 2 }}>
        The admin user <strong>{existingUsername}</strong> already exists and will be assigned Admin role automatically.
        Add additional users here.
      </Alert>
      {users.map((u, i) => (
        <Card key={i} variant="outlined" sx={{ mb: 2 }}>
          <CardContent>
            <Stack direction="row" justifyContent="space-between" mb={1}>
              <Typography variant="subtitle2">User {i + 1}</Typography>
              <IconButton size="small" onClick={() => remove(i)}><DeleteIcon fontSize="small" /></IconButton>
            </Stack>
            <Grid container spacing={1.5}>
              {[
                ["fullName", "Full Name"], ["username", "Username *"],
                ["password", "Password *"], ["role", "Role"],
              ].map(([field, label]) => (
                <Grid item xs={12} sm={6} key={field}>
                  <TextField
                    label={label} size="small" fullWidth value={u[field] || ""}
                    type={field === "password" ? "password" : "text"}
                    onChange={e => update(i, field, e.target.value)}
                  />
                </Grid>
              ))}
            </Grid>
          </CardContent>
        </Card>
      ))}
      <Button startIcon={<AddIcon />} variant="outlined" onClick={add}>Add User</Button>
    </Box>
  );
}

function UserBranchAssignmentStep({ users, branches, assignments, onChange }) {
  const isAssigned = (username, branchCode) =>
    assignments.some(a => a.username === username && a.branchCode === branchCode);
  const toggle = (username, branchCode) => {
    if (isAssigned(username, branchCode)) {
      onChange(assignments.filter(a => !(a.username === username && a.branchCode === branchCode)));
    } else {
      onChange([...assignments, { username, branchCode }]);
    }
  };
  if (!users.length || !branches.length) {
    return <Alert severity="warning">Create users and branches first to make assignments.</Alert>;
  }
  return (
    <Box sx={{ overflowX: "auto" }}>
      <Alert severity="info" sx={{ mb: 2 }}>Assign users to branches they can access.</Alert>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell sx={{ fontWeight: 700 }}>User</TableCell>
            {branches.map(b => (
              <TableCell key={b.branchCode} align="center" sx={{ fontWeight: 700 }}>{b.branchName || b.branchCode}</TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {users.map(u => (
            <TableRow key={u.username} hover>
              <TableCell>{u.username}</TableCell>
              {branches.map(b => (
                <TableCell key={b.branchCode} align="center" padding="checkbox">
                  <Checkbox
                    size="small"
                    checked={isAssigned(u.username, b.branchCode)}
                    onChange={() => toggle(u.username, b.branchCode)}
                  />
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Box>
  );
}

function UserRoleAssignmentStep({ users, roles, assignments, onChange }) {
  const isAssigned = (username, roleName) =>
    assignments.some(a => a.username === username && a.roleName === roleName);
  const toggle = (username, roleName) => {
    if (isAssigned(username, roleName)) {
      onChange(assignments.filter(a => !(a.username === username && a.roleName === roleName)));
    } else {
      onChange([...assignments, { username, roleName }]);
    }
  };
  if (!users.length || !roles.length) {
    return <Alert severity="warning">Create users and roles first to make assignments.</Alert>;
  }
  return (
    <Box sx={{ overflowX: "auto" }}>
      <Alert severity="info" sx={{ mb: 2 }}>Assign roles to users. Every active user must have at least one role.</Alert>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell sx={{ fontWeight: 700 }}>User</TableCell>
            {roles.map(r => (
              <TableCell key={r} align="center" sx={{ fontWeight: 700 }}>{r}</TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {users.map(u => (
            <TableRow key={u.username} hover>
              <TableCell>{u.username}</TableCell>
              {roles.map(role => (
                <TableCell key={role} align="center" padding="checkbox">
                  <Checkbox
                    size="small"
                    checked={isAssigned(u.username, role)}
                    onChange={() => toggle(u.username, role)}
                  />
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Box>
  );
}

function CategorySetupStep({ categories, onChange, businessType }) {
  const [newCat, setNewCat] = useState("");
  const defaults = businessType === "Bakery" ? DEFAULT_CATEGORIES_BAKERY : DEFAULT_CATEGORIES_SUPERMARKET;

  const addDefault = () => {
    const toAdd = defaults.filter(d => !categories.includes(d));
    onChange([...categories, ...toAdd]);
  };
  const add = () => {
    if (newCat.trim() && !categories.includes(newCat.trim())) {
      onChange([...categories, newCat.trim()]);
      setNewCat("");
    }
  };
  const remove = name => onChange(categories.filter(c => c !== name));

  return (
    <Box>
      <Alert severity="info" sx={{ mb: 2 }}>Categories help organise your items. This step is optional.</Alert>
      <Stack direction="row" spacing={1} mb={2}>
        <TextField
          label="Category Name" size="small" value={newCat}
          onChange={e => setNewCat(e.target.value)}
          onKeyDown={e => e.key === "Enter" && add()}
          sx={{ flex: 1 }}
        />
        <Button variant="outlined" startIcon={<AddIcon />} onClick={add}>Add</Button>
        <Button variant="outlined" onClick={addDefault}>Use Defaults</Button>
      </Stack>
      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
        {categories.map(c => (
          <Chip key={c} label={c} onDelete={() => remove(c)} />
        ))}
      </Box>
    </Box>
  );
}

function ItemSetupStep({ onSkip }) {
  return (
    <Box>
      <Alert severity="warning" sx={{ mb: 3 }}>
        Item setup can be skipped now. POS billing requires items to be configured before use.
        You can add items later via <strong>Item Creation</strong> in the main menu.
      </Alert>
      <Typography variant="body2" color="text.secondary" mb={2}>
        Items can be created individually or imported via Excel from the Item Creation page after setup.
      </Typography>
      <Button variant="outlined" color="warning" onClick={onSkip}>Skip Item Setup for Now</Button>
    </Box>
  );
}

function SetupSummaryStep({ progress, onGoToStep }) {
  const checks = [
    { label: "Company Profile",      done: progress.companyProfileCompleted, step: 0 },
    { label: "Menus Created",        done: progress.menusCompleted,          step: 1 },
    { label: "Roles Created",        done: progress.rolesCompleted,          step: 2 },
    { label: "Permissions Assigned", done: progress.roleMenuPermissionsCompleted, step: 3 },
    { label: "Branches Created",     done: progress.branchesCompleted,       step: 4 },
    { label: "Users Created",        done: progress.usersCompleted,          step: 5 },
    { label: "Branch Assignments",   done: progress.userBranchMappingCompleted, step: 6 },
    { label: "Role Assignments",     done: progress.userRoleMappingCompleted, step: 7 },
    { label: "Categories",           done: progress.categoriesCompleted,     step: 8, optional: true },
    { label: "Items",                done: progress.itemsCompleted,          step: 9, optional: true },
  ];
  const mandatory = checks.filter(c => !c.optional);
  const allMandatoryDone = mandatory.every(c => c.done);

  return (
    <Box>
      {allMandatoryDone ? (
        <Alert severity="success" sx={{ mb: 3 }}>All mandatory setup steps are complete. Click Finish to start using the system.</Alert>
      ) : (
        <Alert severity="warning" sx={{ mb: 3 }}>Some mandatory steps are incomplete. Click a red card to go back and complete it.</Alert>
      )}
      <Grid container spacing={1.5}>
        {checks.map(({ label, done, optional, step }) => (
          <Grid item xs={12} sm={6} key={label}>
            <Card
              variant="outlined"
              onClick={() => !done && onGoToStep?.(step)}
              sx={{
                bgcolor: done ? "success.main" : optional ? "warning.main" : "error.main",
                color: "#fff",
                cursor: done ? "default" : "pointer",
                transition: "opacity 0.15s",
                "&:hover": !done ? { opacity: 0.82 } : {},
              }}
            >
              <CardContent sx={{ py: 1, px: 2, "&:last-child": { pb: 1 } }}>
                <Stack direction="row" alignItems="center" spacing={1}>
                  {done ? <CheckCircleIcon fontSize="small" /> : <span>⚠</span>}
                  <Typography variant="body2" fontWeight={600}>{label}</Typography>
                  {optional && <Chip label="optional" size="small" sx={{ bgcolor: "rgba(255,255,255,0.3)", color: "#fff", height: 18 }} />}
                  {!done && <Typography variant="caption" sx={{ ml: "auto !important", opacity: 0.85 }}>Click to fix →</Typography>}
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}

// ── Main Wizard ────────────────────────────────────────────────────────────────

export default function SetupWizardPage({ onComplete }) {
  const [activeStep, setActiveStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState(null);

  // Step data
  const [companyData, setCompanyData] = useState({});
  const [selectedMenus, setSelectedMenus] = useState([...DEFAULT_MENUS]);
  const [roles, setRoles] = useState([...DEFAULT_ROLES]);
  const [permAssignments, setPermAssignments] = useState([]);
  const [branches, setBranches] = useState([{ branchCode: "", branchName: "", address: "", state: "", gst: "", invoicePrefix: "" }]);
  const [users, setUsers] = useState([]);
  const [branchAssignments, setBranchAssignments] = useState([]);
  const [roleAssignments, setRoleAssignments] = useState([]);
  const [categories, setCategories] = useState([]);

  const username = (() => {
    try { return JSON.parse(localStorage.getItem("roles") || "[]")[0] || "admin"; }
    catch { return "admin"; }
  })();

  // Load progress on mount
  useEffect(() => {
    api("/progress").then(p => {
      setProgress(p);
      if (p.currentStep && p.currentStep > 1) {
        setActiveStep(Math.min(p.currentStep - 1, 10));
      }
    }).catch(e => setError("Could not load setup progress."))
    .finally(() => setLoading(false));
  }, []);

  const handleError = msg => { setError(msg); setSaving(false); };

  const saveAndAdvance = async () => {
    setError("");
    setSaving(true);
    try {
      let result;
      switch (activeStep) {
        case 0: // Company Profile
          if (!companyData.companyName?.trim()) { handleError("Company name is required."); return; }
          result = await api("/company-profile", "POST", companyData);
          break;
        case 1: // Menu Setup
          if (!selectedMenus.length) { handleError("Select at least one menu."); return; }
          result = await api("/menus", "POST", selectedMenus);
          break;
        case 2: // Role Setup
          if (!roles.includes("Admin")) { handleError("Admin role is required."); return; }
          result = await api("/roles", "POST", roles);
          break;
        case 3: // Role-Menu Permissions
          // Build assignments from role/menu names — fetch IDs from backend
          try {
            const [menusRes, rolesRes] = await Promise.all([
              fetch(`/api/${localStorage.getItem("tenancyId")}/menus/all`, {
                headers: { Authorization: `Bearer ${localStorage.getItem("jwtToken")}` }
              }).then(r => r.json()),
              fetch(`/api/${localStorage.getItem("tenancyId")}/role-menus/roles`, {
                headers: { Authorization: `Bearer ${localStorage.getItem("jwtToken")}` }
              }).then(r => r.json()),
            ]);
            const menuMap = Object.fromEntries((menusRes || []).map(m => [m.menuName, m.id]));
            const roleMap = Object.fromEntries((rolesRes || []).map(r => [r.name, r.roleid]));

            // Admin gets all menus
            const adminId = roleMap["Admin"];
            const adminAssignments = adminId
              ? (menusRes || []).map(m => ({ roleId: adminId, menuId: m.id }))
              : [];

            const otherAssignments = permAssignments
              .filter(a => a.roleName !== "Admin")
              .map(a => ({ roleId: roleMap[a.roleName], menuId: menuMap[a.menuName] }))
              .filter(a => a.roleId && a.menuId);

            result = await api("/role-menu-permissions", "POST", [...adminAssignments, ...otherAssignments]);
          } catch (e) {
            handleError("Failed to save permissions: " + e.message); return;
          }
          break;
        case 4: // Branch Setup
          const validBranches = branches.filter(b => b.branchCode?.trim() && b.branchName?.trim());
          if (!validBranches.length) { handleError("Add at least one branch with code and name."); return; }
          result = await api("/branches", "POST", validBranches);
          break;
        case 5: { // User Setup — same endpoint as UserCreationPage
          const validUsers = users.filter(u => u.username?.trim() && u.password?.trim());
          if (validUsers.length) {
            const token = localStorage.getItem("jwtToken");
            const errs = [];
            for (const u of validUsers) {
              const r = await fetch("/api/createbranchuser", {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                body: JSON.stringify({ username: u.username.trim(), password: u.password, role: u.role || "user" }),
              });
              const d = await r.json().catch(() => ({}));
              if (!r.ok) errs.push(`${u.username}: ${d.message || `Error ${r.status}`}`);
            }
            if (errs.length) { handleError(errs.join("; ")); return; }
          }
          result = await api("/users", "POST", []); // mark step complete
          break;
        }
        case 6: // User-Branch Assignment
          result = await api("/user-branches", "POST", branchAssignments);
          break;
        case 7: // User-Role Assignment
          result = await api("/user-roles", "POST", roleAssignments);
          break;
        case 8: // Category Setup
          result = await api("/categories", "POST", categories.map(c => ({ categoryName: c })));
          break;
        case 9: // Item Setup — skip
          result = await api("/items/skip", "POST");
          break;
        case 10: // Finish — always return; never fall through to setActiveStep
          result = await api("/complete", "POST");
          if (result && result.setupStatus === "COMPLETED") {
            localStorage.setItem("setupCompleted", "true");
            onComplete?.();
          } else {
            const msg = result?.message || "Setup could not be completed. Ensure all mandatory steps are done.";
            handleError(msg);
          }
          return;
        default:
          break;
      }
      if (result) setProgress(result);
      setActiveStep(prev => Math.min(prev + 1, STEPS.length - 1));
    } catch (e) {
      handleError(e.message || "An error occurred. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleBack = () => {
    setError("");
    setActiveStep(prev => Math.max(prev - 1, 0));
  };

  const handleSkip = async () => {
    setError("");
    setSaving(true);
    try {
      let result;
      if (activeStep === 9) result = await api("/items/skip", "POST");
      if (result) setProgress(result);
      setActiveStep(prev => Math.min(prev + 1, STEPS.length - 1));
    } catch(e) {
      handleError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const progressPct = Math.round((activeStep / (STEPS.length - 1)) * 100);

  const renderStep = () => {
    switch (activeStep) {
      case 0: return <CompanyProfileStep data={companyData} onChange={setCompanyData} />;
      case 1: return <MenuSetupStep selected={selectedMenus} onChange={setSelectedMenus} />;
      case 2: return <RoleSetupStep roles={roles} onChange={setRoles} />;
      case 3:
        return (
          <RoleMenuPermissionStep
            roles={roles} menus={selectedMenus}
            assignments={permAssignments} onChange={setPermAssignments}
          />
        );
      case 4: return <BranchSetupStep branches={branches} onChange={setBranches} />;
      case 5:
        return (
          <UserSetupStep
            users={users} onChange={setUsers}
            existingUsername={username}
          />
        );
      case 6:
        return (
          <UserBranchAssignmentStep
            users={users}
            branches={branches.filter(b => b.branchCode)}
            assignments={branchAssignments}
            onChange={setBranchAssignments}
          />
        );
      case 7:
        return (
          <UserRoleAssignmentStep
            users={users}
            roles={roles}
            assignments={roleAssignments}
            onChange={setRoleAssignments}
          />
        );
      case 8:
        return (
          <CategorySetupStep
            categories={categories}
            onChange={setCategories}
            businessType="Bakery"
          />
        );
      case 9:
        return <ItemSetupStep onSkip={handleSkip} />;
      case 10:
        return <SetupSummaryStep progress={progress || {}} onGoToStep={step => { setError(""); setActiveStep(step); }} />;
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <ThemeProvider theme={wizardTheme}>
        <Box display="flex" justifyContent="center" alignItems="center" height="100vh" bgcolor="#f5f7fa">
          <CircularProgress />
        </Box>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider theme={wizardTheme}>
    <CssBaseline />
    <Box sx={{ minHeight: "100vh", bgcolor: "#f5f7fa", display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <Paper elevation={2} square sx={{ px: 3, py: 2, bgcolor: "#141a2e" }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Typography variant="h6" sx={{ color: "#ffe3a3", fontWeight: 700 }}>
            TradeLink247 — Setup Wizard
          </Typography>
          <Typography variant="body2" sx={{ color: "#aaa" }}>
            Step {activeStep + 1} of {STEPS.length}
          </Typography>
        </Stack>
        <LinearProgress
          variant="determinate" value={progressPct}
          sx={{ mt: 1, height: 6, borderRadius: 3, bgcolor: "rgba(255,255,255,0.2)" }}
        />
      </Paper>

      <Box sx={{ flex: 1, display: "flex", flexDirection: { xs: "column", md: "row" } }}>
        {/* Sidebar stepper */}
        <Box
          sx={{
            width: { xs: "100%", md: 240 }, bgcolor: "#fff", borderRight: "1px solid #e0e0e0",
            py: 3, display: { xs: "none", md: "flex" }, flexDirection: "column",
          }}
        >
          <Stepper activeStep={activeStep} orientation="vertical" sx={{ px: 2 }}>
            {STEPS.map((s, i) => (
              <Step key={s.label} completed={progress ? isStepCompleted(i, progress) : false}>
                <StepLabel
                  optional={s.optional ? <Typography variant="caption" color="text.secondary">Optional</Typography> : null}
                >
                  <Typography variant="body2" fontWeight={activeStep === i ? 700 : 400} fontSize={13}>
                    {s.label}
                  </Typography>
                </StepLabel>
              </Step>
            ))}
          </Stepper>
        </Box>

        {/* Main content */}
        <Box sx={{ flex: 1, p: { xs: 2, md: 4 }, maxWidth: 900, mx: "auto", width: "100%" }}>
          <Typography variant="h5" fontWeight={700} mb={0.5}>
            {STEPS[activeStep]?.label ?? ""}
          </Typography>
          <Divider sx={{ mb: 3 }} />

          {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError("")}>{error}</Alert>}

          <Paper elevation={1} sx={{ p: { xs: 2, md: 3 }, mb: 3 }}>
            {renderStep()}
          </Paper>

          {/* Navigation */}
          <Stack direction="row" spacing={2} justifyContent="space-between">
            <Button
              variant="outlined" onClick={handleBack}
              disabled={activeStep === 0 || saving}
            >
              Back
            </Button>
            <Stack direction="row" spacing={2}>
              {STEPS[activeStep]?.optional && activeStep < STEPS.length - 1 && (
                <Button variant="text" color="secondary" onClick={handleSkip} disabled={saving}>
                  Skip
                </Button>
              )}
              <Button
                variant="contained"
                onClick={saveAndAdvance}
                disabled={saving}
                startIcon={saving ? <CircularProgress size={16} /> : null}
                sx={{ minWidth: 160, bgcolor: "#141a2e" }}
              >
                {saving ? "Saving…" : activeStep === STEPS.length - 1 ? "Finish Setup" : "Save & Continue"}
              </Button>
            </Stack>
          </Stack>
        </Box>
      </Box>
    </Box>
    </ThemeProvider>
  );
}

function isStepCompleted(stepIndex, progress) {
  switch (stepIndex) {
    case 0: return progress.companyProfileCompleted;
    case 1: return progress.menusCompleted;
    case 2: return progress.rolesCompleted;
    case 3: return progress.roleMenuPermissionsCompleted;
    case 4: return progress.branchesCompleted;
    case 5: return progress.usersCompleted;
    case 6: return progress.userBranchMappingCompleted;
    case 7: return progress.userRoleMappingCompleted;
    case 8: return progress.categoriesCompleted;
    case 9: return progress.itemsCompleted;
    case 10: return progress.setupStatus === "COMPLETED";
    default: return false;
  }
}
