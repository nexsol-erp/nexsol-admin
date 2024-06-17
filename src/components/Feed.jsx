import { Box, Stack } from '@mui/material';
import MediaControlCard from './Card1';
import Chart from './Chart';
import ProfilCard from './ProfilCard';
import Progress from './Progress';
import ProgressLine from './ProgressLine';
import img1 from "../hosting.png";
import img3 from "../user.png";
import img2 from "../money-bag.png";
import { useWebSocket } from './WebSocketContext'; // Ensure the path is correct
import { useEffect } from 'react';

const Feed = () => {
    const { data, sendMessage } = useWebSocket();

    useEffect(() => {
        // Send commands to fetch initial data once
        sendMessage({ action: 'GET_USED_SPACE' });
        sendMessage({ action: 'GET_REVENUE' });
        sendMessage({ action: 'GET_USERS' });
       
    },[]); // Empty dependency array to ensure it runs only once

    return (
        <Box flex={5} p={2}>
            <Stack spacing={4}>
                <Stack direction={{ xs: "column", md: "row" }} spacing={4}>
                    <ProfilCard
                        bgcolor="#21295c"
                        h1="Used Space"
                        h2={data.GET_USED_SPACE || 'Loading...'}
                        img={img1}
                        pr="Get More Space"
                    />
                    <ProfilCard
                        bgcolor="#21295c"
                        h1="Revenue"
                        h2={data.GET_REVENUE || 'Loading...'}
                        img={img2}
                        pr="Total Revenue"
                    />
                    <ProfilCard
                        bgcolor="#21295c"
                        h1="Users"
                        h2={data.GET_USERS || 'Loading...'}
                        img={img3}
                        pr="Total Users"
                    />
                   
                </Stack>

                <Stack direction={{ xs: "column", md: "row" }} spacing={4}>
                    <MediaControlCard />
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
