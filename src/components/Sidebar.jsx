import React, { useState } from "react";
import {
  Box,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
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
} from "@mui/icons-material";
import { Link } from "react-router-dom";

const Sidebar = ({ mode, setMode }) => {
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const drawerContent = (
    <List>
      <ListItem disablePadding>
        <ListItemButton component={Link} to="/dashboard">
          <ListItemIcon>
            <Home sx={{ color: "#ffe3a3" }} />
          </ListItemIcon>
          <ListItemText primary="Dashboard" />
        </ListItemButton>
      </ListItem>
      <ListItem disablePadding>
        <ListItemButton component={Link} to="/sales">
          <ListItemIcon>
            <Pages sx={{ color: "#ffe3a3" }} />
          </ListItemIcon>
          <ListItemText primary="Sales" />
        </ListItemButton>
      </ListItem>
      <ListItem disablePadding>
        <ListItemButton component={Link} to="/purchase">
          <ListItemIcon>
            <Luggage sx={{ color: "#ffe3a3" }} />
          </ListItemIcon>
          <ListItemText primary="Purchase" />
        </ListItemButton>
      </ListItem>
      <ListItem disablePadding>
        <ListItemButton component={Link} to="/weighbridge">
          <ListItemIcon>
            <Luggage sx={{ color: "#ffe3a3" }} />
          </ListItemIcon>
          <ListItemText primary="Weighbridge" />
        </ListItemButton>
      </ListItem>
      <ListItem disablePadding>
        <ListItemButton component={Link} to="/about">
          <ListItemIcon>
            <Man sx={{ color: "#ffe3a3" }} />
          </ListItemIcon>
          <ListItemText primary="About" />
        </ListItemButton>
      </ListItem>
      <ListItem disablePadding>
        <ListItemButton component={Link} to="/settings">
          <ListItemIcon>
            <Settings sx={{ color: "#ffe3a3" }} />
          </ListItemIcon>
          <ListItemText primary="Settings" />
        </ListItemButton>
      </ListItem>
      <ListItem disablePadding>
        <ListItemButton component={Link} to="/download">
          <ListItemIcon>
            <Settings sx={{ color: "#ffe3a3" }} />
          </ListItemIcon>
          <ListItemText primary="Download" />
        </ListItemButton>
      </ListItem>
      <ListItem disablePadding>
        <ListItemButton component={Link} to="/help">
          <ListItemIcon>
            <Settings sx={{ color: "#ffe3a3" }} />
          </ListItemIcon>
          <ListItemText primary="Help" />
        </ListItemButton>
      </ListItem>
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
