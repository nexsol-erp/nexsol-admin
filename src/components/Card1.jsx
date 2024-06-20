import * as React from "react";
import { useTheme } from "@mui/material/styles";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import CardMedia from "@mui/material/CardMedia";
import Typography from "@mui/material/Typography";
import { Stack } from "@mui/material";

export default function MediaControlCard({ topUsers }) {
  const theme = useTheme();

  return (
    <Card
      sx={{
        display: "flex",
        width: 310,
        backgroundColor: "#21295c",
        color: "#fff6e0",
      }}
    >
      <Stack spacing={3}>
        <Box sx={{ display: "flex", flexDirection: "column" }}>
          <CardContent sx={{ flex: "1 2 auto" }}>
            <Typography component="div" variant="h5">
              Online Status
            </Typography>
            {topUsers.map((user) => (
              <Typography
                key={user.id}
                variant="subtitle1"
                color="#ffedc2"
                component="div"
              >
                {user.branchCode} - {user.connectionStatus}
              </Typography>
            ))}
          </CardContent>
        </Box>
      </Stack>
    </Card>
  );
}
