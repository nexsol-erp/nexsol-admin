import React from "react";
import { Box, Typography, Container, Chip, Stack } from "@mui/material";

const SEGMENTS = [
  { label: "Supermarkets", emoji: "🛒" },
  { label: "Retail Stores", emoji: "🏪" },
  { label: "Bakery", emoji: "🥐" },
  { label: "Wholesale", emoji: "🚛" },
  { label: "Manufacturing", emoji: "🏭" },
  { label: "Restaurants", emoji: "🍽️" },
  { label: "Department Stores", emoji: "🏬" },
];

const PerfectForSection = () => (
  <Box sx={{ py: { xs: 6, md: 8 }, bgcolor: "#ffffff" }}>
    <Container maxWidth="lg">
      <Typography
        sx={{
          textAlign: "center", fontWeight: 700, fontSize: 13,
          letterSpacing: "1px", color: "#64748b", mb: 3,
        }}
      >
        PERFECT FOR
      </Typography>
      <Stack direction="row" flexWrap="wrap" gap={1.5} justifyContent="center">
        {SEGMENTS.map((s) => (
          <Chip
            key={s.label}
            label={`${s.emoji}  ${s.label}`}
            sx={{
              bgcolor: "#f0f9ff", color: "#0f172a",
              border: "1px solid #dbeafe",
              fontWeight: 600, fontSize: 13.5, py: 2.4, px: 1,
              "&:hover": { bgcolor: "#dbeafe" },
            }}
          />
        ))}
      </Stack>
    </Container>
  </Box>
);

export default PerfectForSection;
