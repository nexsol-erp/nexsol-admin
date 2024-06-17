import { Box, Paper, Stack } from '@mui/material'
import React from 'react'


const Rightbar = () => {
  return (
    <Box flex={1} p={2} sx={{ display: { xs: 'none', sm: 'block', backgroundColor: "#21295c" } }}>
    <Paper sx={{height: 50, width: 200, backgroundColor: "#21295c", position: "fixed"}}>
      <Stack direction="row" sx={{position:"relative"}}>
      <Paper sx={{height: 40, width: 40}}>
        <img src="https://mui.com/static/images/avatar/1.jpg" alt="" style={{height: 40, width: 40}} />
      </Paper>
      <h4 style={{position:"absolute", top: -10, left: 60, color: "#ffe3a3"}}>John Doe</h4>
      </Stack>
      </Paper>
    </Box>
  )
}

export default Rightbar
