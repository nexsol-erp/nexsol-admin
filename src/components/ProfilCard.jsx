import { Card, Divider, Stack, Typography } from "@mui/material";
import React from "react";
import SimplePaper from "./Paper";

const ProfilCard = ({ bgcolor, h1, h2, img, pr }) => {
  return (
    <Card
      sx={{
        width: 310,
        height: 150,
        position: "relative",
        backgroundColor: `${bgcolor}`,
        color: "white",
      }}
    >
      <Stack>
        <Stack direction={"row"}>
          <SimplePaper elevation={3} img={img} />
          <Stack>
            <Typography
              variant="subtitle1"
              color="white"
              component="div"
              sx={{
                position: "absolute",
                right: 50,
                marginTop: 2,
              }}
            >
              {h1}
            </Typography>
            <Typography
              variant="h5"
              color="#ffedc2"
              component="div"
              sx={{
                position: "absolute",
                right: 50,
                marginTop: 6,
              }}
            >
              {h2}
            </Typography>
          </Stack>
        </Stack>
        <Divider variant="middle" sx={{ color: "#fff" }} />
        <p
          style={{
            fontSize: 13,
            position: "absolute",
            marginTop: 125,
            left: 100,
          }}
        >
          {pr}
        </p>
      </Stack>
    </Card>
  );
};

export default ProfilCard;
