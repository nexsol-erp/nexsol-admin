import { Card, Paper, Stack } from '@mui/material'
import React from 'react'
import { Line } from 'rc-progress'
const ProgressLine = () => {
  return (
    <Card sx={{ width: 650, backgroundColor: "#21295c", color:"#f0f0f0", display: { xs: 'none', sm: 'none', md: 'block'}}}>
      <Line style={{ marginTop: 40, marginLeft: 20, marginRight: 20, marginBottom: 10 }}
        percent={40}
        strokeColor={"#cca752"}
        strokeWidth={3}
        trailColor={"#ffe3a3"}
        trailWidth={3}
      />
      <Line style={{ marginTop: 40, marginLeft: 20, marginRight: 20, marginBottom: 10 }}
        percent={80}
        strokeColor={"#cca752"}
        strokeWidth={3}
        trailColor={"#ffe3a3"}
        trailWidth={3}
      />
      <Stack direction={"row"} gap={12} pl={10} pt={3} pb={0.5} sx={{position: "relative"}}>
        <Paper sx={{ width: 30, height: 30, backgroundColor: "#cca752" }} />
        <h5 style={{position: "absolute", left: "42%", bottom: "-17px"}}>Profit</h5>
        <Paper sx={{ width: 30, height: 30, backgroundColor: "#ffe3a3" }} />
        <h5 style={{position: "absolute", left: "20%", bottom: "-17px"}}>Loss</h5>
      </Stack>
    </Card>

  )
}

export default ProgressLine
