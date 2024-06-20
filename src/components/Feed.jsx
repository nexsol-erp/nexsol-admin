import { Box, Stack } from "@mui/material";
import MediaControlCard from "./Card1";
import Chart from "./Chart";
import ProfilCard from "./ProfilCard";
import Progress from "./Progress";
import ProgressLine from "./ProgressLine";
import img1 from "../hosting.png";
import img3 from "../user.png";
import img2 from "../money-bag.png";
import { useWebSocket } from "./WebSocketContext"; // Ensure the path is correct
import { useEffect, useState } from "react";

const Feed = () => {
  const { data, sendMessage } = useWebSocket();
  const [usedSpace, setUsedSpace] = useState("Loading...");
  const [revenue, setRevenue] = useState("Loading...");
  const [totalUsers, setTotalUsers] = useState("Loading...");
  const [topUsers, setTopUsers] = useState([]);

  useEffect(() => {
    // Send commands to fetch initial data once
    sendMessage({ action: "GET_USED_SPACE" });
    sendMessage({ action: "GET_REVENUE" });
    sendMessage({ action: "GET_USERS" });
    sendMessage({ action: "GET_TOP_USERS" }); // Request top users data
  }, []); // Empty dependency array to ensure it runs only once

  useEffect(() => {
    if (data && data.message) {
      const parsedData = JSON.parse(data.message);
      setUsedSpace(parsedData.GET_USED_SPACE || "Loading...");
      setRevenue(parsedData.GET_REVENUE || "Loading...");
      setTotalUsers(parsedData.GET_USERS || "Loading...");

      if (parsedData.GET_TOP_USERS) {
        try {
          const parsedTopUsers = JSON.parse(parsedData.GET_TOP_USERS);
          setTopUsers(parsedTopUsers);
        } catch (e) {
          console.error("Failed to parse top users data:", e);
        }
      }
    }
  }, [data]);

  return (
    <Box flex={5} p={2}>
      <Stack spacing={4}>
        <Stack direction={{ xs: "column", md: "row" }} spacing={4}>
          <ProfilCard
            bgcolor="#21295c"
            h1="Used Space"
            h2={usedSpace}
            img={img1}
            pr="Get More Space"
          />
          <ProfilCard
            bgcolor="#21295c"
            h1="Revenue"
            h2={revenue}
            img={img2}
            pr="Total Revenue"
          />
          <ProfilCard
            bgcolor="#21295c"
            h1="Users"
            h2={totalUsers}
            img={img3}
            pr="Total Users"
          />
        </Stack>

        <Stack direction={{ xs: "column", md: "row" }} spacing={4}>
          <MediaControlCard topUsers={topUsers} />
          <ProgressLine />
        </Stack>

        <Chart />

        <Stack direction={{ xs: "column", md: "row" }} spacing={4}>
          <Progress />
        </Stack>
      </Stack>
    </Box>
  );
};

export default Feed;
