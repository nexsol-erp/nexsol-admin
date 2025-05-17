import React, { useState, useEffect } from "react";
import {
  Box,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Collapse,
  Switch,
  Drawer,
  IconButton,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Button,
  Typography,
} from "@mui/material";
import {
  Home,
  Luggage,
  Man,
  ModeNightRounded,
  Pages,
  Settings,
  Menu as MenuIcon,
  ExpandLess,
  ExpandMore,
  Assessment,
  AccountTree,
  Category,
  ExitToApp,
  Refresh,
} from "@mui/icons-material";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import axios from "axios";

const Sidebar = ({ mode, setMode, roles = [] }) => {
  const { t } = useTranslation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openMenus, setOpenMenus] = useState({});
  const [branches, setBranches] = useState([]);
  const [selectedBranch, setSelectedBranch] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    const fetchBranches = async () => {
      try {
        const token = localStorage.getItem("jwtToken");
        const tenancyId = localStorage.getItem("tenancyId");
        const response = await fetch(`/api/${tenancyId}/branches`, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        });
        const data = await response.json();
        setBranches(data.branches);
      } catch (error) {
        console.error("Error fetching branches:", error);
      }
    };
    fetchBranches();
  }, []);

  const handleDrawerToggle = () => setMobileOpen(!mobileOpen);
  const handleBranchChange = (event) => {
    setSelectedBranch(event.target.value);
    localStorage.setItem("branchCode", event.target.value);
  };
  const handleLogout = () => {
    localStorage.removeItem("tenancyId");
    localStorage.removeItem("authToken");
    localStorage.removeItem("branchCode");
    window.location.reload();
  };
  const handleRefresh = () => {
    localStorage.removeItem("items");
    localStorage.removeItem("categories");
    window.location.reload();
  };
  const toggleSubmenu = (label) => {
    setOpenMenus((prev) => ({ ...prev, [label]: !prev[label] }));
  };

  const menuItems = [
    { label: "Dashboard", icon: <Home />, link: "/dashboard" },
    { label: "POS", icon: <Pages />, link: "/pos" },
    { label: "Sales Entry", icon: <Pages />, link: "/salesentryform" },
    { label: "HSN wise Sales", icon: <Pages />, link: "/hsnsales" },
    { label: "HSN wise Purchase", icon: <Pages />, link: "/hsnwise-purchase-report" },
    {
      label: "Purchase",
      icon: <Luggage />,
      hasSubmenu: true,
      submenu: [
        { label: "Purchase Entry", link: "/purchaseentry" },
      ],
    },
    { label: "Weighbridge", icon: <Luggage />, link: "/weighbridge" },
    { label: "Branch Creation", icon: <Luggage />, link: "/branchcreationpage" },
    { label: "User Creation", icon: <Luggage />, link: "/usercreationpage" },
    {
      label: "Scheme",
      icon: <AccountTree />,
      hasSubmenu: true,
      submenu: [
        { label: "Scheme Creation", link: "/schemepage" },
        { label: "Manage Scheme", link: "/publishschemepage" },
      ],
    },
    {
      label: "Masters",
      icon: <Category />,
      hasSubmenu: true,
      submenu: [
        { label: "Item Search", link: "/itemsearch" },
        { label: "Item Creation", link: "/createitemmaster" },
        { label: "Category Type", link: "/categorytypemaster" },
        { label: "Category Name", link: "/categorynamemaster" },
        { label: "Supplier Creation", link: "/suppliercreation" },
      ],
    },
    {
      label: "Reports",
      icon: <Assessment />,
      hasSubmenu: true,
      submenu: [
        { label: "Sales Re Print", link: "/salessummaryreport" },
        { label: "Sales Report", link: "/sales" },
        { label: "Purchase Report", link: "/purchasereport" },
        { label: "Stock Movement Report", link: "/stockmovementreport" },
        { label: "All Branch Stock Report", link: "/stock-report-all-branch" },
        { label: "Item Stock Report", link: "/item-stock-report" },
        { label: "Bill Series Report", link: "/billseriesreport" },
        { label: "Season Sales Report", link: "/seasonalreport" },
        { label: "Stock Turnover Report", link: "/stock-turnover" },
        { label: "Item Sales Report", link: "/item-sales" },
        { label: "Documents List", link: "/documents-list" },
      ],
    },
    { label: "Download", icon: <Settings />, link: "/download" },
    { label: "Upload", icon: <Settings />, link: "/uploadpage" },
    { label: "Invoice Designer", icon: <Settings />, link: "/invoicedesigner" },
    { label: "Workflow Designer", icon: <Settings />, link: "/workflowdesign" },
    { label: "About", icon: <Man />, link: "/about" },
    { label: "Help", icon: <Settings />, link: "/help" },
    { label: "Logout", icon: <ExitToApp />, action: handleLogout },
  ];

  const drawerContent = (
    <List sx={{ fontSize: "15px" }}>
      <ListItem>
        <FormControl fullWidth>
          <InputLabel sx={{ color: "#ffffff" }}>Select Branch</InputLabel>
          <Select value={selectedBranch} onChange={handleBranchChange} sx={{ color: "#ffffff" }}>
            {branches.map((branch) => (
              <MenuItem key={branch.branchCode} value={branch.branchCode}>
                {branch.branchCode}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </ListItem>
      <ListItem>
        <Button
          variant="contained"
          startIcon={<Refresh />}
          onClick={handleRefresh}
          sx={{ width: "100%", backgroundColor: "#3949ab", color: "#fff" }}
        >
          Refresh
        </Button>
      </ListItem>
      {menuItems.map((item, index) => (
        <React.Fragment key={index}>
          {item.hasSubmenu ? (
            <>
              <ListItemButton onClick={() => toggleSubmenu(item.label)}>
                <ListItemIcon sx={{ color: "#ffcc80" }}>{item.icon}</ListItemIcon>
                <ListItemText primary={item.label} />
                {openMenus[item.label] ? <ExpandLess /> : <ExpandMore />}
              </ListItemButton>
              <Collapse in={openMenus[item.label]} timeout="auto" unmountOnExit>
                <List component="div" disablePadding>
                  {item.submenu.map((sub, subIndex) => (
                    <ListItemButton key={subIndex} component={Link} to={sub.link} sx={{ pl: 4 }}>
                      <ListItemText primary={sub.label} />
                    </ListItemButton>
                  ))}
                </List>
              </Collapse>
            </>
          ) : item.action ? (
            <ListItemButton onClick={item.action}>
              <ListItemIcon sx={{ color: "#ffcc80" }}>{item.icon}</ListItemIcon>
              <ListItemText primary={item.label} />
            </ListItemButton>
          ) : (
            <ListItemButton component={Link} to={item.link}>
              <ListItemIcon sx={{ color: "#ffcc80" }}>{item.icon}</ListItemIcon>
              <ListItemText primary={item.label} />
            </ListItemButton>
          )}
        </React.Fragment>
      ))}
      <ListItemButton onClick={() => setMode(mode === "light" ? "dark" : "light")}>
        <ListItemIcon sx={{ color: "#ffcc80" }}><ModeNightRounded /></ListItemIcon>
        <Switch checked={mode === "dark"} />
      </ListItemButton>
    </List>
  );

  return (
    <Box sx={{ display: "flex" }}>
      <IconButton
        color="inherit"
        aria-label="open drawer"
        edge="start"
        onClick={handleDrawerToggle}
        sx={{ display: { sm: "none" }, color: "#ffffff" }}
      >
        <MenuIcon />
      </IconButton>
      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={handleDrawerToggle}
        ModalProps={{ keepMounted: true }}
        sx={{
          display: { xs: "block", sm: "none" },
          "& .MuiDrawer-paper": {
            boxSizing: "border-box",
            width: 240,
            backgroundColor: "#263238",
            color: "#ffffff",
          },
        }}
      >
        {drawerContent}
      </Drawer>
      <Drawer
        variant="permanent"
        sx={{
          display: { xs: "none", sm: "block" },
          "& .MuiDrawer-paper": {
            boxSizing: "border-box",
            width: 240,
            backgroundColor: "#263238",
            color: "#ffffff",
          },
        }}
        open
      >
        {drawerContent}
      </Drawer>
    </Box>
  );
};

export default Sidebar;
