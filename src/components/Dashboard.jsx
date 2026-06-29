import React, { useEffect, useState } from 'react';
import { Box, Typography, Chip } from '@mui/material';
import DashboardIcon from '@mui/icons-material/Dashboard';
import { useWebSocket } from './WebSocketContext';
import Feed from './Feed';
import Layout from './Layout';

const Dashboard = () => {
  const { data } = useWebSocket();

  useEffect(() => {
    if (data && data.type === 'dashboard') {
      // reserved for future dashboard payload handling
    }
  }, [data]);

  const now = new Date();
  const greeting = now.getHours() < 12 ? 'Good Morning' : now.getHours() < 17 ? 'Good Afternoon' : 'Good Evening';
  const dateLabel = now.toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100vh',
        background: 'linear-gradient(160deg, #0f172a 0%, #1a2038 60%, #1e293b 100%)',
      }}
    >
      {/* Page header */}
      <Box
        sx={{
          px: { xs: 2, md: 4 },
          pt: 3,
          pb: 2,
          borderBottom: '1px solid rgba(255,255,255,0.07)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 1,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box
            sx={{
              width: 40, height: 40, borderRadius: '11px',
              background: 'linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 4px 14px rgba(59,130,246,0.4)',
            }}
          >
            <DashboardIcon sx={{ color: '#fff', fontSize: 22 }} />
          </Box>
          <Box>
            <Typography sx={{ fontWeight: 700, fontSize: 20, color: '#f1f5f9', lineHeight: 1.2 }}>
              Dashboard
            </Typography>
            <Typography sx={{ fontSize: 12, color: '#64748b' }}>
              {greeting} — overview of your business today
            </Typography>
          </Box>
        </Box>

        <Chip
          label={dateLabel}
          size="small"
          sx={{
            bgcolor: 'rgba(59,130,246,0.12)',
            color: '#93c5fd',
            border: '1px solid rgba(59,130,246,0.25)',
            fontWeight: 500,
            fontSize: 12,
          }}
        />
      </Box>

      {/* Main content */}
      <Layout>
        <Feed />
      </Layout>
    </Box>
  );
};

export default Dashboard;
