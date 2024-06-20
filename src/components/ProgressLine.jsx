import { Card, Paper, Stack } from "@mui/material";
import React from "react";
import { Line } from "rc-progress";
const ProgressLine = () => {
  return (
    <Card
      sx={{
        width: 650,
        backgroundColor: "#21295c",
        color: "#f0f0f0",
        display: { xs: "none", sm: "none", md: "block" },
      }}
    >
      <Line
        style={{
          marginTop: 40,
          marginLeft: 20,
          marginRight: 20,
          marginBottom: 10,
        }}
        percent={80}
        strokeColor={"red"}
        strokeWidth={3}
        trailColor={"#ffe3a3"}
        trailWidth={3}
      />
      <Line
        style={{
          marginTop: 40,
          marginLeft: 20,
          marginRight: 20,
          marginBottom: 10,
        }}
        percent={70}
        strokeColor={"green"}
        strokeWidth={3}
        trailColor={"#ffe3a3"}
        trailWidth={3}
      />
      <Stack
        direction={"row"}
        gap={12}
        pl={10}
        pt={3}
        pb={0.5}
        sx={{ position: "relative" }}
      >
        <Paper sx={{ width: 30, height: 30, backgroundColor: "red" }} />
        <h5 style={{ position: "absolute", left: "38%", bottom: "-17px" }}>
          Accepted
        </h5>
        <Paper sx={{ width: 30, height: 30, backgroundColor: "green" }} />
        <h5 style={{ position: "absolute", left: "18%", bottom: "-17px" }}>
          Transfer Out
        </h5>
      </Stack>
    </Card>
  );
};

export default ProgressLine;
