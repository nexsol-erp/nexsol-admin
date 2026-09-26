// reportRequestsApi.js
// Background reports: ask the server for a report by type, list the user's requests (polling
// while any is still running), and download a finished one. Backed by
// /api/{tenant}/report-requests on server-postgres (BackgroundReport there).
import { useCallback, useEffect, useState } from "react";
import { saveAs } from "file-saver";

const POLL_MS = 10000;

const authHeaders = () => ({
  Authorization: `Bearer ${localStorage.getItem("jwtToken")}`,
});

const base = () => `/api/${localStorage.getItem("tenancyId")}/report-requests`;

export const isPending = (r) => r.status === "QUEUED" || r.status === "RUNNING";

/** Resolves to { ok, message }. params is a plain object of strings, e.g. { fromDate, toDate }. */
export async function requestReport(type, params) {
  try {
    const res = await fetch(`${base()}/${encodeURIComponent(type)}`, {
      method: "POST",
      headers: { ...authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, message: data.message || "Could not request the report." };
    return {
      ok: true,
      message: "Report requested. It runs in the background, and you'll get a task in My Tasks when it's ready.",
    };
  } catch (e) {
    console.error("Error requesting report:", e);
    return { ok: false, message: "Could not request the report. Please try again later." };
  }
}

/** Resolves to null on success, or a message to show. */
export async function downloadReport(req) {
  try {
    const res = await fetch(`${base()}/${encodeURIComponent(req.id)}/download`, { headers: authHeaders() });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return data.message || "Could not download the report.";
    }
    const blob = await res.blob();
    const name = (req.title || `Report_${req.id}`).replace(/[^\w-]+/g, "_").replace(/_+/g, "_");
    saveAs(blob, `${name}.xlsx`);
    return null;
  } catch (e) {
    console.error("Error downloading report:", e);
    return "Could not download the report.";
  }
}

/** The user's requests, newest first; all types, or one when reportType is given. */
export function useReportRequests(reportType) {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    try {
      const q = reportType ? `?reportType=${encodeURIComponent(reportType)}` : "";
      const res = await fetch(`${base()}${q}`, { headers: authHeaders() });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setRequests(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error("Error loading report requests:", e);
    } finally {
      setLoading(false);
    }
  }, [reportType]);

  useEffect(() => {
    reload();
  }, [reload]);

  // Refresh while anything is still queued or running, so READY shows up without a reload.
  const pending = requests.some(isPending);
  useEffect(() => {
    if (!pending) return undefined;
    const t = setInterval(reload, POLL_MS);
    return () => clearInterval(t);
  }, [pending, reload]);

  return { requests, loading, reload };
}
