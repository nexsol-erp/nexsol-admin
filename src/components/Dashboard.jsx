import React, { useEffect, useState } from 'react';
import { Button, Box } from '@mui/material';
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

  const handlePublish = async () => {
    try {
      const tenancyId = localStorage.getItem("tenancyId");
      const token = localStorage.getItem("jwtToken");

      const response = await fetch(`/api/${tenancyId}/item-category-map/publish`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (response.ok) {
        alert("✅ Item categories published successfully!");
      } else {
        alert("❌ Failed to publish item categories.");
      }
    } catch (error) {
      console.error("Error publishing:", error);
      alert("⚠️ An error occurred while publishing item categories.");
    }
  };


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
        <Button variant="contained" color="primary" onClick={handlePublish}>
          Publish Item Categories
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
