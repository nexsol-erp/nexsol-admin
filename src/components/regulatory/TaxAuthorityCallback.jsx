// TaxAuthorityCallback.jsx
// Where the tax authority sends the browser back after "Connect to HMRC": finishes the
// connection with the one-time code and state in the address, then offers the way back.
import React, { useEffect, useRef, useState } from "react";
import { Alert, Box, Button, CircularProgress, Paper, Typography } from "@mui/material";
import { useNavigate } from "react-router-dom";
import { onboard } from "./regulatoryApi";
import { CALLBACK_PROVIDER_KEY } from "./ProviderSetup";

const TaxAuthorityCallback = () => {
  const navigate = useNavigate();
  const [result, setResult] = useState(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const q = new URLSearchParams(window.location.search);
    let provider = "HMRC_MTD_VAT";
    try {
      provider = sessionStorage.getItem(CALLBACK_PROVIDER_KEY) || provider;
    } catch (e) {
      // keep the default
    }
    const input = {};
    ["code", "state", "error"].forEach((k) => { if (q.get(k)) input[k] = q.get(k); });
    if (q.get("error_description")) input.error = `${input.error || ""} ${q.get("error_description")}`.trim();
    (async () => {
      const r = await onboard(provider, input);
      setResult(r.ok ? r.data : { ok: false, message: r.message, steps: [] });
      // The code is single use: drop it from the address bar.
      window.history.replaceState(null, "", window.location.pathname);
    })();
  }, []);

  return (
    <Box sx={{ flexGrow: 1, p: 3, ml: "240px", mt: 2 }}>
      <Paper elevation={3} sx={{ p: 3 }}>
        <Typography variant="h5" mb={2}>Connecting to the tax authority</Typography>
        {!result && <CircularProgress size={24} />}
        {result && (
          <>
            <Alert severity={result.ok ? "success" : "error"}>{result.message}</Alert>
            {(result.steps || []).map((s, i) => <Typography key={i} variant="body2" mt={1}>{s}</Typography>)}
            <Button variant="contained" sx={{ mt: 2 }} onClick={() => navigate("/e-invoicing")}>Back to E-Invoicing</Button>
          </>
        )}
      </Paper>
    </Box>
  );
};

export default TaxAuthorityCallback;
