import React, { useState } from "react";
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
} from "@mui/icons-material";
import { Link } from "react-router-dom";

const Sidebar = ({ mode, setMode, roles }) => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openAIReports, setOpenAIReports] = useState(false);
  const [openScheme, setOpenScheme] = useState(false);

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const handleClickAIReports = () => {
    setOpenAIReports(!openAIReports);
  };

  const handleClickScheme = () => {
    setOpenScheme(!openScheme);
  };

  const menuItems = [
    {
      label: "Dashboard",
      icon: <Home sx={{ color: "#ffe3a3" }} />,
      link: "/dashboard",
      roles: ["admin", "user"],
    },
    {
      label: "Sales",
      icon: <Pages sx={{ color: "#ffe3a3" }} />,
      link: "/sales",
      roles: ["user"],
    },
    {
      label: "HSN wise Sales",
      icon: <Pages sx={{ color: "#ffe3a3" }} />,
      link: "/hsnsales",
      roles: ["admin", "user"],
    },
    {
      label: "Purchase",
      icon: <Luggage sx={{ color: "#ffe3a3" }} />,
      link: "/purchase",
      roles: ["user", "manager"],
    },
    {
      label: "Weighbridge",
      icon: <Luggage sx={{ color: "#ffe3a3" }} />,
      link: "/weighbridge",
      roles: ["admin"],
    },
    {
      label: "Branch Creation",
      icon: <Luggage sx={{ color: "#ffe3a3" }} />,
      link: "/branchcreationpage",
      roles: ["admin"],
    },
    {
      label: "User Creation",
      icon: <Luggage sx={{ color: "#ffe3a3" }} />,
      link: "/usercreationpage",
      roles: ["admin"],
    },
    {
      label: "Scheme",
      icon: <AccountTree sx={{ color: "#ffe3a3" }} />,
      link: "",
      roles: ["admin"],
      hasSubmenu: true,
      submenu: [
        {
          label: "Scheme Creation",
          link: "/schemepage",
          roles: ["admin"],
        },
        {
          label: "Manage Scheme",
          link: "/publishschemepage",
          roles: ["admin"],
        },
      ],
    },
    {
      label: "AI Reports",
      icon: <Assessment sx={{ color: "#ffe3a3" }} />,
      link: "",
      roles: ["admin"],
      hasSubmenu: true,
      submenu: [
        {
          label: "Season Sales Report",
          link: "/seasonalreport",
          roles: ["admin"],
        },
      ],
    },
    {
      label: "About",
      icon: <Man sx={{ color: "#ffe3a3" }} />,
      link: "/about",
      roles: ["user"],
    },
    {
      label: "Settings",
      icon: <Settings sx={{ color: "#ffe3a3" }} />,
      link: "/settings",
      roles: ["admin", "user", "manager"],
    },
    {
      label: "Download",
      icon: <Settings sx={{ color: "#ffe3a3" }} />,
      link: "/download",
      roles: ["user"],
    },
    {
      label: "Help",
      icon: <Settings sx={{ color: "#ffe3a3" }} />,
      link: "/help",
      roles: ["user"],
    },
  ];

  const drawerContent = (
    <List>
      {menuItems.map((item, index) => {
        if (item.roles.some((role) => roles.includes(role))) {
          if (item.hasSubmenu) {
            const isOpen =
              item.label === "AI Reports" ? openAIReports : openScheme;
            const handleClick =
              item.label === "AI Reports"
                ? handleClickAIReports
                : handleClickScheme;

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
