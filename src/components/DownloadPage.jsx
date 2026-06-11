import React, { useEffect, useState } from "react";
import {
  Box,
  Button,
  Chip,
  Divider,
  Paper,
  Stack,
  Step,
  StepContent,
  StepLabel,
  Stepper,
  Typography,
} from "@mui/material";
import CloudDownloadIcon from "@mui/icons-material/CloudDownload";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import PointOfSaleIcon from "@mui/icons-material/PointOfSale";
import AutorenewIcon from "@mui/icons-material/Autorenew";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";

const LAUNCHER_URL = "/downloads/launcher/launchPOSClinet.exe";
const LAUNCHER_FILENAME = "TradeLink247-POS-Launcher.exe";

export default function DownloadPage() {
  const [posVersion, setPosVersion] = useState(null);

  // Fetch latest POS version for display only — no auth needed
  useEffect(() => {
    fetch("/api/pos-app/update-check?platform=WINDOWS&currentVersion=0.0.0")
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d?.latestVersion) setPosVersion(d.latestVersion); })
      .catch(() => {});
  }, []);

  const handleLauncherDownload = () => {
    const a = document.createElement("a");
    a.href = LAUNCHER_URL;
    a.setAttribute("download", LAUNCHER_FILENAME);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleSetupDownload = () => {
    const a = document.createElement("a");
    a.href = "/downloads/windows/TradeLink247-POS-Setup.exe";
    a.setAttribute("download", "TradeLink247-POS-Setup.exe");
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <Box sx={{ flexGrow: 1, p: 3, ml: "240px", mt: 2 }}>

      {/* ── Primary: Launcher ─────────────────────────────────────── */}
      <Paper
        elevation={3}
        sx={{
          p: 4,
          maxWidth: 640,
          margin: "auto",
          mt: 6,
          border: "2px solid",
          borderColor: "primary.main",
          borderRadius: 2,
        }}
      >
        {/* Header */}
        <Stack direction="row" alignItems="center" spacing={1.5} mb={0.5}>
          <PointOfSaleIcon color="primary" sx={{ fontSize: 34 }} />
          <Typography variant="h5" fontWeight={700}>
            TradeLink247 POS
          </Typography>
          <Chip label="Windows" size="small" color="primary" variant="outlined" />
          {posVersion && (
            <Chip
              label={`Latest v${posVersion}`}
              size="small"
              color="success"
              variant="outlined"
            />
          )}
        </Stack>

        <Typography variant="body2" color="text.secondary" mb={3}>
          Download the launcher once per PC. It keeps the POS application
          up-to-date automatically — no manual reinstalls needed.
        </Typography>

        {/* Steps */}
        <Stepper orientation="vertical" nonLinear activeStep={-1} sx={{ mb: 3 }}>
          <Step active>
            <StepLabel
              StepIconComponent={() => (
                <Box
                  sx={{
                    width: 26, height: 26, borderRadius: "50%",
                    bgcolor: "primary.main", color: "#fff",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 13, fontWeight: 700,
                  }}
                >
                  1
                </Box>
              )}
            >
              <Typography fontWeight={600}>Download the launcher</Typography>
            </StepLabel>
            <StepContent>
              <Typography variant="body2" color="text.secondary">
                Click the button below — this is a one-time download per PC.
              </Typography>
            </StepContent>
          </Step>

          <Step active>
            <StepLabel
              StepIconComponent={() => (
                <Box
                  sx={{
                    width: 26, height: 26, borderRadius: "50%",
                    bgcolor: "primary.main", color: "#fff",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 13, fontWeight: 700,
                  }}
                >
                  2
                </Box>
              )}
            >
              <Typography fontWeight={600}>Run it on the cashier PC</Typography>
            </StepLabel>
            <StepContent>
              <Typography variant="body2" color="text.secondary">
                Double-click <strong>TradeLink247-POS-Launcher.exe</strong>. It
                will download and launch the POS app automatically.
              </Typography>
            </StepContent>
          </Step>

          <Step active>
            <StepLabel
              StepIconComponent={() => (
                <Box
                  sx={{
                    width: 26, height: 26, borderRadius: "50%",
                    bgcolor: "success.main", color: "#fff",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}
                >
                  <AutorenewIcon sx={{ fontSize: 15 }} />
                </Box>
              )}
            >
              <Typography fontWeight={600}>Auto-updates from here on</Typography>
            </StepLabel>
            <StepContent>
              <Typography variant="body2" color="text.secondary">
                Every time the launcher runs it checks for a newer POS version and
                updates silently — no action needed.
              </Typography>
            </StepContent>
          </Step>
        </Stepper>

        {/* Download button */}
        <Button
          variant="contained"
          color="primary"
          size="large"
          startIcon={<CloudDownloadIcon />}
          onClick={handleLauncherDownload}
          sx={{ borderRadius: 2, px: 4, py: 1.4, fontWeight: 700, fontSize: 15 }}
        >
          Download POS Launcher (.exe)
        </Button>

        <Stack direction="row" alignItems="center" spacing={0.5} mt={2}>
          <CheckCircleOutlineIcon sx={{ fontSize: 16, color: "success.main" }} />
          <Typography variant="caption" color="text.secondary">
            Keep this file — place it in a shared folder or on the Desktop of each
            cashier PC.
          </Typography>
        </Stack>
      </Paper>

      {/* ── Secondary: Full installer (advanced) ──────────────────── */}
      <Paper
        elevation={1}
        sx={{
          p: 3,
          maxWidth: 640,
          margin: "auto",
          mt: 3,
          bgcolor: "grey.50",
          borderRadius: 2,
        }}
      >
        <Stack direction="row" alignItems="center" spacing={1} mb={1}>
          <InfoOutlinedIcon sx={{ fontSize: 20, color: "text.secondary" }} />
          <Typography variant="subtitle2" color="text.secondary" fontWeight={600}>
            Advanced — Direct Installer
          </Typography>
        </Stack>
        <Divider sx={{ mb: 2 }} />
        <Typography variant="body2" color="text.secondary" mb={2}>
          Use the full NSIS setup only when the launcher cannot reach the server
          (air-gapped network, first-time offline install, etc.).
          Does not auto-update.
        </Typography>
        <Button
          variant="outlined"
          color="inherit"
          size="small"
          startIcon={<CloudDownloadIcon />}
          onClick={handleSetupDownload}
          sx={{ color: "text.secondary", borderColor: "divider" }}
        >
          Download Full Setup (.exe)
        </Button>
      </Paper>

    </Box>
  );
}
