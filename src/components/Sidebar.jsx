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
import { Link } from "react-router-dom";
import { useNavigate } from "react-router-dom";
  import { useTranslation } from "react-i18next"; // Import the useTranslation hook for translations

import axios from "axios";

const Sidebar = ({ mode, setMode, roles = []}) => {
   const { t } = useTranslation(); 

  const [mobileOpen, setMobileOpen] = useState(false);
  const [openReports, setOpenReports] = useState(false);
  const [openScheme, setOpenScheme] = useState(false);
  const [openMasters, setOpenMasters] = useState(false);
  const [openPurchase, setOpenPurchase] = useState(false);
  const [branches, setBranches] = useState([]);
  const [selectedBranch, setSelectedBranch] = useState("");
  const navigate = useNavigate(); // Initialize navigate

  useEffect(() => {
    // Fetch branches from the backend API
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

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const handleBranchChange = (event) => {
    setSelectedBranch(event.target.value);
    localStorage.setItem("branchCode", event.target.value);
  };

  const handleClickReports = () => {
    setOpenReports(!openReports);
  };

  const handleClickScheme = () => {
    setOpenScheme(!openScheme);
  };

  const handleClickMasters = () => {
    setOpenMasters(!openMasters);
  };

  const handleClickPurchase = () => {
    setOpenPurchase(!openPurchase);
  };

  const handleLogout = () => {
    // Clear user session data or tokens here
    localStorage.removeItem("tenancyId");
    localStorage.removeItem("authToken");
    localStorage.removeItem("branchCode");
    // Navigate to the login page
    window.location.reload(); 
    console.log("User logged out");
  };

  const handleRefresh = () => {
    
      localStorage.removeItem('items');
      localStorage.removeItem('categories');
      console.log('Cache cleared and refresh request sent.');
    window.location.reload(); 
    console.log("Page refreshed");
  };
  const menuItems = [
    {
      label: t("Dashboard"),
      icon: <Home sx={{ color: "#ffe3a3" }} />,
      link: "/dashboard",
      roles: ["admin","user"],
    },
    {
      label: t("POS"),
      icon: <Home sx={{ color: "#ffe3a3" }} />,
      link: "/pos",
      roles: ["admin1","user1"],
    },
    {
      label: t("Sales Entry"),
      icon: <Pages sx={{ color: "#ffe3a3" }} />,
      link: "/salesentryform",
      roles: ["user"],
    },
    {
      label: t("HSN wise Sales"),
      icon: <Pages sx={{ color: "#ffe3a3" }} />,
      link: "/hsnsales",
      roles: ["admin", "user"],
    },
    
    {
      label: t("HSN wise Purchase"),
      icon: <Pages sx={{ color: "#ffe3a3" }} />,
      link: "/hsnwise-purchase-report",
      roles: ["admin", "user"],
    },
    {
      label: t("Purchase"),
      icon: <Luggage sx={{ color: "#ffe3a3" }} />,
      link: "",
      roles: ["user", "manager"],
      hasSubmenu: true,
      submenu: [
        {
          label: t("Purchase Entry"),
          link: "/purchaseentry",
          roles: ["user", "manager"],
        },
      ],
    },
    {
      label: t("Weighbridge"),
      icon: <Luggage sx={{ color: "#ffe3a3" }} />,
      link: "/weighbridge",
      roles: ["WB"],
    },
    {
      label: t("Branch Creation"),
      icon: <Luggage sx={{ color: "#ffe3a3" }} />,
      link: "/branchcreationpage",
      roles: ["admin"],
    },
    {
      label: t("User Creation"),
      icon: <Luggage sx={{ color: "#ffe3a3" }} />,
      link: "/usercreationpage",
      roles: ["admin"],
    },
    {
      label: t("Scheme"),
      icon: <AccountTree sx={{ color: "#ffe3a3" }} />,
      link: "",
      roles: ["admin"],
      hasSubmenu: true,
      submenu: [
        {
          label: t("Scheme Creation"),
          link: "/schemepage",
          roles: ["admin"],
        },
        {
          label: t("Manage Scheme"),
          link: "/publishschemepage",
          roles: ["admin"],
        },
      ],
    },
    {
      label: t("Masters"),
      icon: <Category sx={{ color: "#ffe3a3" }} />,
      link: "",
      roles: ["admin"],
      hasSubmenu: true,
      submenu: [
        {
          label: t("Item Search"),
          link: "/itemsearch",
          roles: ["admin"],
        },
        {
          label: t("Item Creation"),
          link: "/createitemmaster",
          roles: ["admin"],
        },
        
        {
          label: t("Category Type"),
          link: "/categorytypemaster",
          roles: ["admin"],
        },
        {
          label: t("Category Name"),
          link: "/categorynamemaster",
          roles: ["admin"],
        },
        {
          label: t("Supplier Creation"),
          link: "/suppliercreation",
          roles: ["admin"],
        },
      ],
    },
    {
      label: t("Reports"),
      icon: <Assessment sx={{ color: "#ffe3a3" }} />,
      link: "",
      roles: ["admin", "user", "manager"],
      hasSubmenu: true,
      submenu: [
        {
          label: t("Sales  Re Print"),
          link: "/salessummaryreport",
          roles: ["admin", "user", "manager"],
        },
        {
          label: t("Sales Report"),
          link: "/sales",
          roles: ["admin", "user", "manager"],
        },
        {
          label: t("Purchase Report"),
          link: "/purchasereport",
          roles: ["admin", "user", "manager"],
        },
        {
          label: t("Stock Movement Report"),
          link: "/stockmovementreport",
          roles: ["admin", "user", "manager"],
        },
        {
          label: t("All Branch Stock Report"),
          link: "/stock-report-all-branch",
          roles: ["admin", "user", "manager"],
        },
        {
          label: t("Item Stock Report"),
          link: "/item-stock-report",
          roles: ["admin", "user", "manager"],
        },
        
        {
          label: t("Bill Series Report"),
          link: "/billseriesreport",
          roles: ["admin", "user", "manager"],
        },

        {
          label: t("Season Sales Report"),
          link: "/seasonalreport",
          roles: ["admin"],
        },
        {
          label: t("Stock Turnover Report"),
          link: "/stock-turnover",
          roles: ["user","admin"],
        },
        {
          label: t("Item Sales Report"),
          link: "/item-sales",
          roles: ["user","admin"],
        },
        {
          label: t("Documents List"),
          link: "/documents-list",
          roles: ["user","admin"],
        },
        

      ],
    },

    {
      label: t("Download"),
      icon: <Settings sx={{ color: "#ffe3a3" }} />,
      link: "/download",
      roles: ["user", "manager", "admin"],
    },
    {
      label: t("Upload"),
      icon: <Settings sx={{ color: "#ffe3a3" }} />,
      link: "/uploadpage",
      roles: ["admin"],
    },
    {
      label: t("Invoice Designer"),
      icon: <Settings sx={{ color: "#ffe3a3" }} />,
      link: "/invoicedesigner",
      roles: ["user", "admin", "manager"],
    },
    {
      label: t("Workflow Designer"),
      icon: <Settings sx={{ color: "#ffe3a3" }} />,
      link: "/workflowdesign",
      roles: ["user", "admin", "manager"],
    },

    {
      label: t("About"),
      icon: <Man sx={{ color: "#ffe3a3" }} />,
      link: "/about",
      roles: ["manager"],
    },
    {
      label: t("Help"),
      icon: <Settings sx={{ color: "#ffe3a3" }} />,
      link: "/help",
      roles: ["user", "admin", "manager"],
    },

    {
      label: t("Logout"),
      icon: <ExitToApp sx={{ color: "#ffe3a3" }} />,
      action: handleLogout,
      roles: ["admin", "user", "manager"],
    },
  ];

  const drawerContent = (
    <List>
        <ListItem>
          <FormControl fullWidth>
            {/* Translate the label "Select Branch" */}
            <InputLabel sx={{ color: "#ffe3a3" }}>
              {t("Select Branch")}
            </InputLabel>
            <Select
              value={selectedBranch}
              onChange={handleBranchChange}
              sx={{ color: "#ffe3a3" }}
            >
              {branches.map((branch) => (
                <MenuItem key={branch.branchCode} value={branch.branchCode}>
                  {/* Optionally translate branch codes if needed */}
                  {t(branch.branchCode)}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </ListItem>
   
        <ListItem>
        <Button
          variant="contained"
          color="primary"
          startIcon={<Refresh />}
          onClick={handleRefresh}
          sx={{ width: "100%", backgroundColor: "#21295c", color: "#ffe3a3" }}
        >
          {t("Refresh")}
        </Button>
      </ListItem>

      {/* Other Menu Items */}
      {menuItems.map((item, index) => {
        if (item.roles.some((role) => roles.includes(role))) {
          if (item.hasSubmenu) {
            const isOpen =
              item.label === "Reports"
                ? openReports
                : item.label === "Scheme"
                ? openScheme
                : item.label === "Masters"
                ? openMasters
                : openPurchase;
            const handleClick =
              item.label === "Reports"
                ? handleClickReports
                : item.label === "Scheme"
                ? handleClickScheme
                : item.label === "Masters"
                ? handleClickMasters
                : handleClickPurchase;

            return (
              <React.Fragment key={index}>
                <ListItem disablePadding>
                  <ListItemButton onClick={handleClick}>
                    <ListItemIcon>{item.icon}</ListItemIcon>
                    <ListItemText primary={item.label} />
                    {isOpen ? <ExpandLess /> : <ExpandMore />}
                  </ListItemButton>
                </ListItem>
                <Collapse in={isOpen} timeout="auto" unmountOnExit>
                  <List component="div" disablePadding>
                    {item.submenu.map(
                      (subItem, subIndex) =>
                        subItem.roles.some((role) => roles.includes(role)) && (
                          <ListItem key={subIndex} disablePadding>
                            <ListItemButton
                              component={Link}
                              to={subItem.link}
                              sx={{ pl: 4 }}
                            >
                              <ListItemText primary={subItem.label} />
                            </ListItemButton>
                          </ListItem>
                        )
                    )}
                  </List>
                </Collapse>
              </React.Fragment>
            );
          } else if (item.action) {
            return (
              <ListItem disablePadding key={index}>
                <ListItemButton onClick={item.action}>
                  <ListItemIcon>{item.icon}</ListItemIcon>
                  <ListItemText primary={item.label} />
                </ListItemButton>
              </ListItem>
            );
          } else {
            return (
              <ListItem disablePadding key={index}>
                <ListItemButton component={Link} to={item.link}>
                  <ListItemIcon>{item.icon}</ListItemIcon>
                  <ListItemText primary={item.label} />
                </ListItemButton>
              </ListItem>
            );
          }
        }
        return null;
      })}
      <ListItem disablePadding>
        <ListItemButton
          component="button"
          onClick={() => setMode(mode === "light" ? "dark" : "light")}
        >
          <ListItemIcon>
            <ModeNightRounded sx={{ color: "#ffe3a3" }} />
          </ListItemIcon>
          <Switch checked={mode === "dark"} />
        </ListItemButton>
      </ListItem>
    </List>
  );

  return (
    <Box sx={{ display: "flex" }}>
      <IconButton
        color="inherit"
        aria-label="open drawer"
        edge="start"
        onClick={handleDrawerToggle}
        sx={{ display: { sm: "none" }, color: "#ffe3a3" }}
      >
        <MenuIcon />
      </IconButton>
      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={handleDrawerToggle}
        ModalProps={{
          keepMounted: true, // Better open performance on mobile.
        }}
        sx={{
          display: { xs: "block", sm: "none" },
          "& .MuiDrawer-paper": {
            boxSizing: "border-box",
            width: 240,
            backgroundColor: "#21295c",
            color: "#ffe3a3",
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
            backgroundColor: "#21295c",
            color: "#ffe3a3",
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
