// MyReports.jsx
// Every background report the user has asked for, from any report screen, with its status and
// a Download button. The "report ready" task (R01) opens this screen with ?requestId=.
import React from "react";
import { useSearchParams } from "react-router-dom";
import { Box, Button, CircularProgress, Paper, Typography } from "@mui/material";
import ReportRequestsTable from "./backgroundReports/ReportRequestsTable";
import { useReportRequests } from "./backgroundReports/reportRequestsApi";

const MyReports = () => {
  const [searchParams] = useSearchParams();
  const highlightId = searchParams.get("requestId") || "";
  const { requests, loading, reload } = useReportRequests();

  return (
    <Box sx={{ flexGrow: 1, p: 3, ml: "240px", mt: 2 }}>
      <Paper elevation={3} sx={{ p: 3 }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
          <Box>
            <Typography variant="h5">My Reports</Typography>
            <Typography variant="body2" color="text.secondary">
              Reports you asked to run in the background. Files are kept for 7 days.
            </Typography>
          </Box>
          <Button size="small" onClick={reload}>
            Refresh
          </Button>
        </Box>
        {loading ? (
          <Box textAlign="center" py={4}>
            <CircularProgress />
          </Box>
        ) : (
          <ReportRequestsTable requests={requests} highlightId={highlightId} />
        )}
      </Paper>
    </Box>
  );
};

export default MyReports;
