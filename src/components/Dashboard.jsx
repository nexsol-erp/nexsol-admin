import React, { useEffect, useState } from 'react';
import { Typography } from '@mui/material';
import { useWebSocket } from './WebSocketContext';
import Feed from './Feed';
import Layout from './Layout';

const Dashboard = () => {
  const { data } = useWebSocket();
  const [dashboardData, setDashboardData] = useState(null);

  useEffect(() => {
    if (data && data.type === 'dashboard') {
      setDashboardData(data.payload);
    }
  }, [data]);

  return (
    <Layout>
       
     
       
      <Feed></Feed>
       
    </Layout>
  );
};

export default Dashboard;
