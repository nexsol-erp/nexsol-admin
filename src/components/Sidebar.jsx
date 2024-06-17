import { Box, List, ListItem, ListItemButton, ListItemIcon, ListItemText, Switch } from '@mui/material';
import { Home, Luggage, Man, ModeNightRounded, Pages, Settings } from '@mui/icons-material';
import React from 'react';
import { Link } from 'react-router-dom';

const Sidebar = ({ mode, setMode }) => {
  return (
    <Box 
      sx={{ 
        width: 240, 
        height: '100vh', 
        position: 'fixed', 
        backgroundColor: "#21295c", 
        color: "#ffe3a3", 
        overflowY: 'auto' 
      }}
    >
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
          <ListItemButton component="button" onClick={() => setMode(mode === "light" ? "dark" : "light")}>
            <ListItemIcon>
              <ModeNightRounded sx={{ color: "#ffe3a3" }} />
            </ListItemIcon>
            <Switch checked={mode === "dark"} />
          </ListItemButton>
        </ListItem>
      </List>
    </Box>
  );
};

export default Sidebar;
