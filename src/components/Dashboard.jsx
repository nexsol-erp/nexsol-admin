import React, { useEffect, useState } from 'react';
import { Typography } from '@mui/material';
import { useWebSocket } from './WebSocketContext';
import Feed from './Feed';
import Layout from './Layout';
import { Box   } from "@mui/material";


const Dashboard = () => {
  const { data } = useWebSocket();
  const [dashboardData, setDashboardData] = useState(null);

  useEffect(() => {
    if (data && data.type === 'dashboard') {
      setDashboardData(data.payload);
    }
  }, [data]);

  return (
  <Box
      sx={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        
        backgroundColor: '#4CAF50', // Green background color
      }}
    >
    <Layout>
      <Feed></Feed>
       
      </Layout>
      </Box>
  );
};

export default Dashboard;
