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
  const [branchSalesLoadedViaSocket, setBranchSalesLoadedViaSocket] = useState(false);

  // WebSocket send on mount
  useEffect(() => {
    sendMessage({ action: "GET_USED_SPACE" });
    sendMessage({ action: "GET_REVENUE" });
    sendMessage({ action: "GET_USERS" });
    sendMessage({ action: "GET_TOP_USERS" });
    sendMessage({ action: "GET_BRANCH_SALES_SUMMARY" }); // ✅ WebSocket for branch sales
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
        } catch (err) {
          console.error("Failed to parse top users:", err);
        }
      }

      if (parsedData.BRANCH_SALES_SUMMARY) {
        try {
          const parsed = JSON.parse(parsedData.BRANCH_SALES_SUMMARY);
          setBranchSalesData(parsed);
          setBranchSalesLoadedViaSocket(true); // ✅ WebSocket succeeded
        } catch (err) {
          console.error("Failed to parse branch sales summary:", err);
        }
      }
    }
  }, [data]);

  // Fallback to API if WebSocket doesn’t respond in 2s
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!branchSalesLoadedViaSocket) {
        fetchBranchSalesFallback();
      }
    }, 2000);
    return () => clearTimeout(timer); // Cleanup
  }, [branchSalesLoadedViaSocket]);

  const fetchBranchSalesFallback = async () => {
    try {
      const tenancyId = localStorage.getItem("tenancyId");
      const token = localStorage.getItem("jwtToken");

      const res = await fetch(`/api/${tenancyId}/sales/branchwise-today`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const json = await res.json();
        setBranchSalesData(json);
      } else {
        console.warn("Fallback: Failed to fetch branch sales data.");
      }
    } catch (err) {
      console.error("Fallback: Error fetching branch sales:", err);
    }
  };

  return (
    <Box flex={5} p={2}>
      <Stack spacing={4}>
        {/* Top Info Cards */}
        <Stack direction={{ xs: "column", md: "row" }} spacing={4}>
          
           
           
        </Stack>

        {/* Chart Section */}
        <Chart topUsers={topUsers} branchSalesData={branchSalesData} />

      
      </Stack>
    </Box>
  );
};

export default Feed;
