import React from "react";
import { Box, Card, CardContent, Typography, Grid } from "@mui/material";
import { Link } from "react-router-dom";
import Sidebar from "./Sidebar";

const MainLayout = ({ mode, setMode, roles }) => {
  return (
    <Box sx={{ display: "flex" }}>
      {/* Sidebar */}
      <Sidebar mode={mode} setMode={setMode} roles={roles} />

      {/* Main Content Area */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 3,
          backgroundColor: "#f0f2f5",
          minHeight: "100vh",
        }}
      >
        <Grid container spacing={4}>
          {/* Dashboard Card */}
          

          {/* Help Card */}
          <Grid item xs={12} sm={6} md={4}>
            <Card
              component={Link}
              to="/help"
              sx={{
                textDecoration: "none",
                borderRadius: "16px",
                boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                transition: "transform 0.2s ease, box-shadow 0.2s ease",
                backgroundColor: "#ffffff",
                "&:hover": {
                  transform: "translateY(-5px)",
                  boxShadow: "0 6px 20px rgba(0,0,0,0.15)",
                },
              }}
            >
              <CardContent>
                <Typography
                  variant="h5"
                  component="div"
                  sx={{
                    color: "#1976d2",
                    fontWeight: "bold",
                    mb: 1,
                    fontFamily: "Roboto, sans-serif",
                  }}
                >
                  Help
                </Typography>
                <Typography
                  variant="body2"
                  sx={{
                    color: "#555",
                    fontFamily: "Roboto, sans-serif",
                  }}
                >
                  Find guidance and documentation here.
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Box>
    </Box>
  );
};

export default MainLayout;
