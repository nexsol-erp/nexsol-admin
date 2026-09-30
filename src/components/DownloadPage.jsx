import React from "react";
import {
  Box,
  Button,
  Chip,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import CloudDownloadIcon from "@mui/icons-material/CloudDownload";
import PointOfSaleIcon from "@mui/icons-material/PointOfSale";
import SyncAltIcon from "@mui/icons-material/SyncAlt";
import ScaleIcon from "@mui/icons-material/Scale";

// Every file a customer installs comes from this page. Add new downloads to
// this list so the explanation, purpose and steps always sit next to the file.
const DOWNLOADS = [
  {
    key: "pos-launcher",
    icon: PointOfSaleIcon,
    title: "POS Launcher",
    file: "TradeLink247-POS-Launcher.zip",
    // Served by the backend with a server.json for this server added to the zip, so the
    // launcher (and the POS it starts) connect here without any setup.
    href: "/api/updates/pos/launcher.zip",
    tags: ["Windows", "Zip, no installer", "Install once per PC"],
    what:
      "A small Windows program (launchPOSClinet.exe) that downloads, updates and opens the TradeLink247 cashier POS.",
    purpose:
      "This is how you install the desktop POS on a cashier PC and keep it up to date. Every time the launcher starts, it asks the server for the latest POS version, downloads it if the PC is behind, and then opens the POS. You never reinstall for an upgrade.",
    steps: [
      "Download the zip on the cashier PC.",
      "Extract it to a permanent folder, for example C:\\TradeLink247\\. Keep all the files together; the launcher needs the DLLs and folders next to it.",
      "Run launchPOSClinet.exe. It already knows this server (the zip carries a server.json for it). On the first run it downloads the POS (TradeLink247-POS.exe) into the same folder, which needs an internet connection.",
      "Log in to the POS and pick the branch. New PCs may need approval in POS Machine Approval.",
      "Right-click launchPOSClinet.exe and choose Send to > Desktop (create shortcut). Always open the POS from this shortcut, not from TradeLink247-POS.exe, so updates are picked up.",
    ],
    notes:
      "Download the zip from this page on each server; a zip from another server connects to that server. If the POS says it is not found and no update is available, check the PC can reach this server and try again. To point a PC at a different server, run launchPOSClinet.exe --change-server.",
  },
  {
    key: "tally-connector",
    icon: SyncAltIcon,
    title: "Tally Connector",
    file: "Tally Connector setup (.exe)",
    href: "/api/updates/tally-connector/download",
    tags: ["Windows", "Installer", "Only if you use Tally"],
    what:
      "A small tray app for the PC that runs TallyPrime. It picks up vouchers prepared on this server and posts them into your Tally company.",
    purpose:
      "Keeps your books in Tally in step with sales, purchases and GL vouchers recorded here, without typing them in again. The connector does the talking to Tally, so Tally never has to be exposed to the internet.",
    steps: [
      "Download and run the installer on the PC where TallyPrime is installed.",
      "Keep TallyPrime open with the company you want to sync, and turn on Tally's connectivity (acting as a server, usually on port 9000).",
      "Here in the admin, open Accounting > Tally Integration. Choose what to send on the Settings tab, then on the Connectors tab add a connector to get a server address and a one-time pairing key.",
      "Open the connector from the system tray, enter the server and pairing key, and leave it running while Tally is open.",
      "Watch progress and any errors in Tally Sync Status.",
    ],
    notes: null,
  },
  {
    key: "weighbridge",
    icon: ScaleIcon,
    title: "Weighbridge",
    file: "TradeLink247 Weighbridge setup (.exe)",
    href: "/api/updates/weighbridge/download",
    tags: ["Windows", "Installer", "Only for weighbridge sites"],
    what:
      "A desktop app for the weighbridge PC. It reads the live weight from the indicator, works out the charge, prints the weighment voucher and uploads every weighing to this server.",
    purpose:
      "Runs the weighbridge counter on its own, even when the internet is down: weighings and tare weights are kept on the PC and uploaded when the connection is back. It follows the same charging rule as before (a return weighing of a paid first weighing is free) and continues each branch's voucher numbers.",
    steps: [
      "Download and run the installer on the PC connected to the weighbridge indicator.",
      "Open TradeLink247 Weighbridge, enter this server's address and sign in. Pick the branch if you have more than one.",
      "Open Settings > Indicator. Pick the preset for your indicator make (or Custom), choose the COM port or network address, and use Show live data to check the weight is read correctly.",
      "Open Settings > Printing to choose the printer, paper size (A5 or 80 mm) and number of copies.",
      "Check the rates on the Rates tab, then start weighing from the Weighing tab (F9 saves and prints).",
    ],
    notes:
      "Weighings made in the app show up under Weighbridge > WeighBridge Usage here, and Resync Records can ask the PC to upload a day again. An indicator setup that works can be exported from Settings and imported on other PCs with the same indicator.",
  },
];

function DownloadCard({ item }) {
  const Icon = item.icon;
  return (
    <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 }, borderRadius: 2 }}>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={2}
        alignItems={{ xs: "flex-start", sm: "center" }}
        justifyContent="space-between"
        sx={{ mb: 2 }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          <Icon color="primary" sx={{ fontSize: 36 }} />
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 600, lineHeight: 1.2 }}>
              {item.title}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {item.file}
            </Typography>
          </Box>
        </Box>
        <Button
          variant="contained"
          startIcon={<CloudDownloadIcon />}
          href={item.href}
          download
          sx={{ flexShrink: 0, width: { xs: "100%", sm: "auto" } }}
        >
          Download
        </Button>
      </Stack>

      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, mb: 2 }}>
        {item.tags.map((t) => (
          <Chip key={t} label={t} size="small" variant="outlined" />
        ))}
      </Box>

      <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
        What it is
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
        {item.what}
      </Typography>

      <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
        Why you need it
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
        {item.purpose}
      </Typography>

      <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
        How to use it
      </Typography>
      <Box component="ol" sx={{ m: 0, pl: 3, color: "text.secondary" }}>
        {item.steps.map((s, i) => (
          <Typography component="li" variant="body2" key={i} sx={{ mb: 0.5 }}>
            {s}
          </Typography>
        ))}
      </Box>

      {item.notes && (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5, fontStyle: "italic" }}>
          {item.notes}
        </Typography>
      )}
    </Paper>
  );
}

const DownloadPage = () => (
  <Box sx={{ flexGrow: 1, p: { xs: 2, sm: 3 }, maxWidth: 900, mx: "auto", width: "100%" }}>
    <Typography variant="h5" sx={{ fontWeight: 600 }} gutterBottom>
      Downloads
    </Typography>
    <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
      Everything you install on your own PCs is here. Each download says what it
      is, why you would need it, and how to set it up.
    </Typography>
    <Stack spacing={3}>
      {DOWNLOADS.map((d) => (
        <DownloadCard key={d.key} item={d} />
      ))}
    </Stack>
  </Box>
);

export default DownloadPage;
