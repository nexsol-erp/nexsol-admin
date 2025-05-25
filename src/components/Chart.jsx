import React, { useState } from 'react';
import BarChart from './BarChart';
import PieChart from './PieChart';
import MediaControlCard from "./Card1";
import { UserData } from '../Data';
import { Card, Stack } from '@mui/material';

const Chart = ({ topUsers }) => {
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

  return (
    <div>
      <Stack direction={{ xs: "column", md: "row" }} spacing={4}>
        {/* Online Status card using MediaControlCard */}
        <MediaControlCard topUsers={topUsers} />
        
        {/* Users Lost Bar Chart */}
        <Card sx={{ width: 310, backgroundColor: "#21295c" }}>
          <div style={{ width: 300, padding: 5 }}>
            <BarChart chartData={userData2} />
          </div>
        </Card>

        {/* Pie Chart */}
        <Card sx={{ width: 310, backgroundColor: "#21295c" }}>
          <div style={{ width: 300 }}>
            <PieChart chartData={userData2} />
          </div>
        </Card>
      </Stack>
    </div>
  );
};

export default Chart;
