import React, { useEffect, useState } from "react";
import { Box, Stack } from "@mui/material";
import ProfilCard from "./ProfilCard";
import Chart from "./Chart";
import img1 from "../hosting.png";
import img2 from "../money-bag.png";
import img3 from "../user.png";
import { useWebSocket } from "./WebSocketContext";

const Feed = () => {
  const { data, sendMessage } = useWebSocket();

  const [usedSpace, setUsedSpace] = useState("Loading...");
  const [revenue, setRevenue] = useState("Loading...");
  const [totalUsers, setTotalUsers] = useState("Loading...");
  const [topUsers, setTopUsers] = useState([]);

  const [branchSalesData, setBranchSalesData] = useState([]);
  const [branchSalesLoadedViaSocket,  setBranchSalesLoadedViaSocket]  = useState(false);
  const [topUsersLoadedViaSocket,     setTopUsersLoadedViaSocket]     = useState(false);

  // Request all data on mount
  useEffect(() => {
    fetchAll();
  }, []);

  // WebSocket receive handler
  useEffect(() => {
    if (data && data.message) {
      const parsedData = JSON.parse(data.message);

      if (parsedData.GET_USED_SPACE) setUsedSpace(parsedData.GET_USED_SPACE);
      if (parsedData.GET_REVENUE) setRevenue(parsedData.GET_REVENUE);
      if (parsedData.GET_USERS) setTotalUsers(parsedData.GET_USERS);

      if (parsedData.GET_TOP_USERS) {
        try {
          setTopUsers(JSON.parse(parsedData.GET_TOP_USERS));
          setTopUsersLoadedViaSocket(true);
        } catch (err) {
          console.error("Failed to parse top users:", err);
        }
      }

      if (parsedData.BRANCH_SALES_SUMMARY) {
        try {
          const parsed = JSON.parse(parsedData.BRANCH_SALES_SUMMARY);
          setBranchSalesData(parsed);
          setBranchSalesLoadedViaSocket(true);
        } catch (err) {
          console.error("Failed to parse branch sales summary:", err);
        }
      }
    }
  }, [data]);

  // Fallback: if WebSocket doesn't deliver within 2s, hit REST directly
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!branchSalesLoadedViaSocket) fetchBranchSalesFallback();
    }, 2000);
    return () => clearTimeout(timer);
  }, [branchSalesLoadedViaSocket]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!topUsersLoadedViaSocket) fetchConnectionStatusFallback();
    }, 2000);
    return () => clearTimeout(timer);
  }, [topUsersLoadedViaSocket]);

  // Poll connection status and branch sales every 30 seconds so the dashboard stays live
  useEffect(() => {
    const interval = setInterval(() => {
      fetchConnectionStatusFallback();
      fetchBranchSalesFallback();
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchAll = () => {
    sendMessage({ action: "GET_USED_SPACE" });
    sendMessage({ action: "GET_REVENUE" });
    sendMessage({ action: "GET_USERS" });
    sendMessage({ action: "GET_TOP_USERS" });
    setBranchSalesLoadedViaSocket(false);
    setTopUsersLoadedViaSocket(false);
    sendMessage({ action: "GET_BRANCH_SALES_SUMMARY" });
  };

  const fetchBranchSalesFallback = async () => {
    try {
      const tenancyId = localStorage.getItem("tenancyId");
      const token = localStorage.getItem("jwtToken");
      const res = await fetch(`/api/${tenancyId}/sales/branchwise-today`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setBranchSalesData(await res.json());
      else console.warn("Fallback: Failed to fetch branch sales data.");
    } catch (err) {
      console.error("Fallback: Error fetching branch sales:", err);
    }
  };

  const fetchConnectionStatusFallback = async () => {
    try {
      const tenancyId = localStorage.getItem("tenancyId");
      const token = localStorage.getItem("jwtToken");
      const res = await fetch(`/api/${tenancyId}/connection-status`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setTopUsers(await res.json());
      else console.warn("Fallback: Failed to fetch connection status.");
    } catch (err) {
      console.error("Fallback: Error fetching connection status:", err);
    }
  };

  return (
    <Box flex={5} p={2}>
      <Stack spacing={4}>
        {/* Top Info Cards */}
        <Stack direction={{ xs: "column", md: "row" }} spacing={4}>
          {/* Add your ProfilCards here */}
        </Stack>

        {/* Chart Section */}
        <Chart topUsers={topUsers} branchSalesData={branchSalesData} />
      </Stack>
    </Box>
  );
};

export default Feed;
