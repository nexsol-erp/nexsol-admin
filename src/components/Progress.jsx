import { Card, Paper, Stack } from '@mui/material'
import { Circle } from 'rc-progress'
import React from 'react'

const Progress = () => {
    return (
        <Card sx={{ width: 1000, height: 200, backgroundColor: "#21295c", display: { xs: 'none', sm: 'none', md: 'block'} }}>
            <Stack direction={'row'}>
                <Circle style={{ marginLeft: 120, marginTop: -50, height: "300", width: "150" }}
                    percent={40}
                    strokeColor={"#cca752"}
                    strokeWidth={15}
                    trailColor={"#ffe3a3"}
                    trailWidth={15}
                />
                <Stack gap={6} pl={40} pt={3} pb={0.5} sx={{ position: "relative" }}>
                    <Stack direction={"row"} gap={6}>
                        <Paper sx={{ width: 50, height: 50, backgroundColor: "#cca752" }} />
                        <h4 style={{color:"white"}} >New User in this month</h4>
                    </Stack>
                    <Stack direction={"row"} gap={6}>
                        <Paper sx={{ width: 50, height: 50, backgroundColor: "#ffe3a3" }} />
                        <h4 style={{color:"white"}} >Old users</h4>
                    </Stack>
                </Stack>
            </Stack>
        </Card>
    )
}

export default Progress
