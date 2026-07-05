import * as React from "react";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Typography from "@mui/material/Typography";
import { Stack } from "@mui/material";

function fmtLastSeen(isoStr) {
  if (!isoStr) return "";
  const diff = Math.floor((Date.now() - new Date(isoStr).getTime()) / 1000);
  if (diff < 60)  return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

export default function MediaControlCard({ topUsers }) {
  return (
    <Card sx={{ display: "flex", minWidth: 260, backgroundColor: "#21295c", color: "#fff6e0" }}>
      <Stack spacing={0} width="100%">
        <CardContent>
          <Typography component="div" variant="h6" sx={{ mb: 1.5, fontWeight: 700, color: "#fff" }}>
            Branch Online Status
          </Typography>
          {topUsers.length === 0 && (
            <Typography variant="body2" sx={{ color: "#94a3b8" }}>No status data</Typography>
          )}
          {topUsers.map((user) => {
            const online = user.connectionStatus === "ONLINE";
            return (
              <Box
                key={user.branchCode || user.id}
                sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.75 }}
              >
                <Box sx={{
                  width: 8, height: 8, borderRadius: "50%", flexShrink: 0,
                  bgcolor: online ? "#4ade80" : "#f87171",
                  boxShadow: online ? "0 0 6px #4ade80" : "none",
                }} />
                <Typography variant="body2" sx={{ color: "#ffedc2", fontWeight: 600, minWidth: 80 }}>
                  {user.branchCode}
                </Typography>
                <Typography variant="caption" sx={{ color: online ? "#4ade80" : "#f87171", fontWeight: 500 }}>
                  {user.connectionStatus}
                </Typography>
                {user.clientVersion && (
                  <Typography variant="caption" sx={{ color: "#94a3b8", fontFamily: "monospace" }}>
                    v{user.clientVersion}
                  </Typography>
                )}
                {user.lastSeen && (
                  <Typography variant="caption" sx={{ color: "#64748b", ml: "auto" }}>
                    {fmtLastSeen(user.lastSeen)}
                  </Typography>
                )}
              </Box>
            );
          })}
        </CardContent>
      </Stack>
    </Card>
  );
}
