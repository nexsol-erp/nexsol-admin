import React, { useState } from "react";
import { Box, Button, Paper, Typography, Chip, Tooltip, IconButton } from "@mui/material";
import { useNavigate } from "react-router-dom";
import DownloadIcon from "@mui/icons-material/Download";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import ScaleIcon from "@mui/icons-material/Scale";
import { DOWNLOAD_URL } from "./weighbridgeContent";

// "Get Started" for weighbridge accounts (menu "Weighbridge Setup"). Weighbridge-only sign-ups land
// here after signing in; it walks through setting up a site and its weighbridge PC.
const WeighbridgeStartPage = () => {
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);
  const server = window.location.origin;
  const username = (() => {
    try {
      const payload = JSON.parse(atob(localStorage.getItem("jwtToken").split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
      return payload.sub || "";
    } catch {
      return "";
    }
  })();

  const copyServer = async () => {
    try {
      await navigator.clipboard.writeText(server);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard blocked; the address is on screen */ }
  };

  const steps = [
    {
      title: "Add your weighbridge site",
      text: "Type the weighbridge's name and address. They print on the voucher, and each weighbridge counts its own voucher numbers.",
      actions: [{ label: "Add weighbridge", to: "/branchcreationpage?type=WB" }],
    },
    {
      title: "Set your rates",
      text: "Enter the charge per wheel type. Every PC at the branch picks up changes within a minute. Vehicle Wheel Type fixes a vehicle's wheel type so operators can't change it.",
      actions: [
        { label: "Weighbridge rates", to: "/weighbridge-rates" },
        { label: "Vehicle wheel types", to: "/vehicle-wheel-type", outlined: true },
      ],
    },
    {
      title: "Install the app on the weighbridge PC",
      text: "Run the installer on the Windows 10 or 11 PC connected to the indicator. It needs no admin rights. When it asks for the server, enter the address below.",
      custom: (
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1.5, alignItems: "center", mt: 1.5 }}>
          <Button variant="contained" href={DOWNLOAD_URL} startIcon={<DownloadIcon />} sx={{ textTransform: "none", fontWeight: 700 }}>
            Download for Windows
          </Button>
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, px: 1.5, py: 0.5, borderRadius: "8px", border: 1, borderColor: "divider", fontFamily: "monospace", fontSize: 14 }}>
            {server}
            <Tooltip title={copied ? "Copied" : "Copy"}>
              <IconButton size="small" aria-label="Copy server address" onClick={copyServer}>
                <ContentCopyIcon fontSize="inherit" />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>
      ),
    },
    {
      title: "Sign in and choose the branch",
      text: `Sign in on the PC${username ? ` as ${username}` : ""} and pick the branch you created. The PC then shows up under Weighbridge PCs.`,
      actions: [{ label: "Weighbridge PCs", to: "/weighbridge-pcs" }],
    },
    {
      title: "Connect the indicator and printer",
      text: "On Weighbridge PCs, allow settings changes for the new PC. Then in the app's Settings pick the indicator preset and COM port (or network address), the printer and paper size, and the camera if you have one. Settings lock again after a restart.",
    },
    {
      title: "Add your operators",
      text: "Give each operator their own login and the branches they work at. Weighings show who saved them.",
      actions: [
        { label: "Create users", to: "/usercreationpage" },
        { label: "Assign branches", to: "/branchassingment", outlined: true },
      ],
    },
    {
      title: "Watch the weighings come in",
      text: "Every saved weighing, with its photo, appears under Weighbridge Entry. Reopen a closed weighing there if a vehicle needs a free second weight.",
      actions: [{ label: "Weighbridge entry", to: "/weighbridge" }],
    },
  ];

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 900, mx: "auto" }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 1 }}>
        <ScaleIcon color="primary" sx={{ fontSize: 32 }} />
        <Typography variant="h5" component="h1" sx={{ fontWeight: 800 }}>Set up your weighbridge</Typography>
      </Box>
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        Seven steps from a new account to the first printed voucher. You can come back to this page from Weighbridge &gt; Get Started.
      </Typography>
      {steps.map((s, i) => (
        <Paper key={s.title} variant="outlined" sx={{ p: { xs: 2, md: 2.5 }, mb: 2, borderRadius: "12px", display: "flex", gap: 2 }}>
          <Chip label={i + 1} color="primary" sx={{ fontWeight: 800, minWidth: 34 }} />
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontWeight: 700, fontSize: 16 }}>{s.title}</Typography>
            <Typography color="text.secondary" sx={{ fontSize: 14, mt: 0.5, lineHeight: 1.6 }}>{s.text}</Typography>
            {s.custom}
            {s.actions && (
              <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", mt: 1.5 }}>
                {s.actions.map((a) => (
                  <Button key={a.to} size="small" variant={a.outlined ? "outlined" : "contained"} onClick={() => navigate(a.to)} sx={{ textTransform: "none", fontWeight: 600 }}>
                    {a.label}
                  </Button>
                ))}
              </Box>
            )}
          </Box>
        </Paper>
      ))}
    </Box>
  );
};

export default WeighbridgeStartPage;
