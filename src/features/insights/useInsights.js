import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Fetches the insight list.
 *
 * Same cancellation discipline as useProduct360: switching filters mid-flight aborts the
 * previous request, and a late response from an abandoned filter must never paint. Without
 * that a user who changes branch quickly ends up reading one branch's insights under another
 * branch's heading — and an insight is a claim about a specific branch, so that is the kind
 * of wrong somebody acts on.
 */
export const useInsights = ({ tenancyId, status, type, severity, branchCodes }) => {
  const [insights, setInsights] = useState([]);
  const [scope, setScope] = useState([]);
  const [state, setState] = useState("idle"); // idle | loading | ready | error | denied | notFound
  const [error, setError] = useState(null);

  const abortRef = useRef(null);
  const requestIdRef = useRef(0);

  const load = useCallback(async () => {
    if (!tenancyId) {
      setInsights([]);
      setState("idle");
      return;
    }

    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    setState("loading");
    setError(null);

    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (type) params.set("type", type);
    if (severity) params.set("severity", severity);
    (branchCodes || []).forEach((code) => params.append("branchCodes", code));

    try {
      const response = await fetch(`/api/${tenancyId}/insights?${params.toString()}`, {
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${localStorage.getItem("jwtToken")}`,
          "X-Tenant-ID": tenancyId,
        },
      });

      if (requestId !== requestIdRef.current) return;

      if (response.status === 403) {
        setState("denied");
        return;
      }
      if (response.status === 404) {
        // The feature is off for this tenant. Deliberately indistinguishable from "no such
        // endpoint" on the server side, so the screen says the same thing for both.
        setState("notFound");
        return;
      }
      if (!response.ok) {
        setState("error");
        setError("Insights could not be loaded.");
        return;
      }

      const body = await response.json();
      if (requestId !== requestIdRef.current) return;

      setInsights(body.insights || []);
      setScope(body.branchCodes || []);
      setState("ready");
    } catch (e) {
      if (e.name === "AbortError") return;
      if (requestId !== requestIdRef.current) return;
      setState("error");
      setError("Insights could not be loaded.");
    }
  }, [tenancyId, status, type, severity, branchCodes]);

  useEffect(() => {
    load();
    return () => {
      if (abortRef.current) abortRef.current.abort();
    };
  }, [load]);

  return { insights, scope, state, error, reload: load };
};

/**
 * Dismisses one insight.
 *
 * Not folded into the hook above because it is a write with a different failure story: the
 * caller needs to know whether it actually happened so it can leave the dialog open and keep
 * the typed reason, rather than closing over a failure and losing what the user wrote.
 */
export const dismissInsight = async (tenancyId, insightId, reason) => {
  const response = await fetch(
    `/api/${tenancyId}/insights/${encodeURIComponent(insightId)}/dismiss`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("jwtToken")}`,
        "X-Tenant-ID": tenancyId,
      },
      body: JSON.stringify({ reason }),
    }
  );

  if (response.ok) return { ok: true };

  let message = "The insight could not be dismissed.";
  try {
    const body = await response.json();
    if (body && body.error) message = body.error;
  } catch (e) {
    // Keep the generic message.
  }
  return { ok: false, error: message };
};
