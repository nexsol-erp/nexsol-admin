// RunInBackground.jsx
// "Run in background" for a report screen: asks the server for the report as a file, then says
// where it will turn up. Screens also use SYNC_MAX_DAYS to stop loading long periods on screen.
import React, { useState } from "react";
import { Link as RouterLink } from "react-router-dom";
import { Alert, Button, CircularProgress, Link } from "@mui/material";
import dayjs from "dayjs";
import { requestReport } from "./reportRequestsApi";

/** Longer periods than this are only offered in the background. */
export const SYNC_MAX_DAYS = 7;

export const rangeDays = (fromDate, toDate) =>
  fromDate && toDate ? dayjs(toDate).diff(dayjs(fromDate), "day") : 0;

export const isLongRange = (fromDate, toDate) => rangeDays(fromDate, toDate) > SYNC_MAX_DAYS;

/** Explains why the on-screen button is disabled for a long period. */
export const LongRangeNotice = ({ fromDate, toDate, sx }) =>
  isLongRange(fromDate, toDate) ? (
    <Alert severity="info" sx={sx}>
      This period is longer than {SYNC_MAX_DAYS} days, so it can't be shown on screen. Use Run in background to get
      it as an Excel file.
    </Alert>
  ) : null;

const RunInBackground = ({ type, params, disabled, sx }) => {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  const run = async () => {
    setBusy(true);
    setResult(await requestReport(type, params));
    setBusy(false);
  };

  return (
    <>
      <Button variant="outlined" onClick={run} disabled={disabled || busy} sx={sx}>
        {busy ? <CircularProgress size={22} /> : "Run in background"}
      </Button>
      {result && (
        <Alert severity={result.ok ? "success" : "error"} sx={{ mt: 1, mb: 2 }} onClose={() => setResult(null)}>
          {result.message}{" "}
          {result.ok && (
            <Link component={RouterLink} to="/my-reports">
              Open My Reports
            </Link>
          )}
        </Alert>
      )}
    </>
  );
};

export default RunInBackground;
