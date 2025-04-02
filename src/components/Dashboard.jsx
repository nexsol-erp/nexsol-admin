import React, { useEffect, useState } from 'react';
import {  Button, Box } from '@mui/material';
import { useWebSocket } from './WebSocketContext';
import Feed from './Feed';
import Layout from './Layout';
import { useNavigate } from 'react-router-dom'; // ✅ Make sure this is imported

const Dashboard = () => {
  const { data } = useWebSocket();
  const [dashboardData, setDashboardData] = useState(null);
  const navigate = useNavigate(); // ✅ Must be declared inside the component

  useEffect(() => {
    if (data && data.type === 'dashboard') {
      setDashboardData(data.payload);
    }
  }, [data]);

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100vh',
        backgroundColor: '#4CAF50',
      }}
    >
      {/* Top Bar with Back Button */}
      <Box sx={{ p: 2, textAlign: 'left' }}>
        <Button
          variant="contained"
          color="secondary"
          onClick={() => navigate('/main')}
        >
          Back to Home
        </Button>
      </Box>

      {/* Main Layout and Feed */}
      <Layout>
        <Feed />
      </Layout>
    </Box>
  );
};

export default Dashboard;
