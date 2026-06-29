import React, { useState } from 'react';
import BarChart from './BarChart';
import PieChart from './PieChart';
import MediaControlCard from "./Card1";
import { UserData } from '../Data';
import { Card, Stack } from '@mui/material';

const Chart = ({ topUsers, branchSalesData = [] }) => {
  // Chart data for Users Lost
  const [userData2, setUserData2] = useState({
    labels: UserData.map((data) => data.year),
    datasets: [
      {
        label: "Users Lost",
        data: UserData.map((data) => data.Lost),
        backgroundColor: ["#fff", "#ffe3a3", "#ffd166", "#ffda85", "#cca752"],
        borderColor: "white",
        borderWidth: 2,
        color: "white",
      },
    ],
  });

  // Chart data for Branch-wise Sales
  const branchSalesChartData = {
    labels: branchSalesData.map(branch => branch.branchCode),
    datasets: [
      {
        label: "Sales",
        data: branchSalesData.map(branch => branch.totalSales),
        backgroundColor: "#90caf9",
        borderColor: "#fff",
        borderWidth: 2,
      },
    ],
  };

  return (
    <div>
      <Stack direction={{ xs: "column", md: "row" }} spacing={4} flexWrap="wrap">
        <MediaControlCard topUsers={topUsers} />
        {branchSalesData.length > 0 && (
          <Card sx={{ width: 620, backgroundColor: "#0f172a", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 3 }}>
            <div style={{ width: 600, padding: 10 }}>
              <BarChart chartData={branchSalesChartData} />
            </div>
          </Card>
        )}
      </Stack>
    </div>
  );
};

export default Chart;
