import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Fetches the Product 360 graph.
 *
 * The interesting part is cancellation. Switching product mid-flight has to abort the
 * previous request, and — more subtly — a late response from an abandoned product must never
 * be allowed to paint. Without that guard a user who types quickly ends up looking at one
 * product's name above another product's numbers, which is the kind of wrong that gets acted
 * on before anyone notices.
 */
export const useProduct360 = ({ tenancyId, productId, fromDate, toDate, branchCodes }) => {
  const [graph, setGraph] = useState(null);
  const [status, setStatus] = useState("idle"); // idle | loading | ready | error | denied | notFound
  const [error, setError] = useState(null);

  const abortRef = useRef(null);
  // Identifies the request whose response is still wanted.
  const requestIdRef = useRef(0);

  const load = useCallback(async () => {
    if (!tenancyId || !productId) {
      setGraph(null);
      setStatus("idle");
      return;
    }

    if (abortRef.current) {
      abortRef.current.abort();
    }
    const controller = new AbortController();
    abortRef.current = controller;

    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    setStatus("loading");
    setError(null);

    const params = new URLSearchParams();
    if (fromDate) params.set("fromDate", fromDate);
    if (toDate) params.set("toDate", toDate);
    (branchCodes || []).forEach((code) => params.append("branchCodes", code));

    try {
      const response = await fetch(
        `/api/${tenancyId}/product-360/${encodeURIComponent(productId)}?${params.toString()}`,
        {
          signal: controller.signal,
          headers: {
            Authorization: `Bearer ${localStorage.getItem("jwtToken")}`,
            "X-Tenant-ID": tenancyId,
          },
        }
      );

      // A newer request started while this one was in flight. Its answer is the one the
      // user is waiting for, so this response is discarded rather than painted.
      if (requestId !== requestIdRef.current) return;

      if (response.status === 403) {
        setStatus("denied");
        return;
      }
      if (response.status === 404) {
        setStatus("notFound");
        return;
      }
      if (!response.ok) {
        setStatus("error");
        setError("The product view could not be loaded.");
        return;
      }

      const body = await response.json();
      if (requestId !== requestIdRef.current) return;

      setGraph(body);
      setStatus("ready");
    } catch (e) {
      if (e.name === "AbortError") return; // superseded, not a failure
      if (requestId !== requestIdRef.current) return;
      setStatus("error");
      setError("The product view could not be loaded.");
    }
  }, [tenancyId, productId, fromDate, toDate, branchCodes]);

  useEffect(() => {
    load();
    return () => {
      if (abortRef.current) abortRef.current.abort();
    };
  }, [load]);

  return { graph, status, error, reload: load };
};

/** Debounced product search for the selector. */
export const useProductSearch = (tenancyId) => {
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const timerRef = useRef(null);
  const abortRef = useRef(null);

  const search = useCallback(
    (query) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (abortRef.current) abortRef.current.abort();

      // Under two characters is not a search, it is a request for the head of the item
      // master. The server refuses it too; this just avoids the round trip.
      if (!tenancyId || !query || query.trim().length < 2) {
        setResults([]);
        setSearching(false);
        return;
      }

      setSearching(true);
      timerRef.current = setTimeout(async () => {
        const controller = new AbortController();
        abortRef.current = controller;
        try {
          const response = await fetch(
            `/api/${tenancyId}/product-360/search?q=${encodeURIComponent(query.trim())}&limit=20`,
            {
              signal: controller.signal,
              headers: {
                Authorization: `Bearer ${localStorage.getItem("jwtToken")}`,
                "X-Tenant-ID": tenancyId,
              },
            }
          );
          if (!response.ok) {
            setResults([]);
            return;
          }
          setResults(await response.json());
        } catch (e) {
          if (e.name !== "AbortError") setResults([]);
        } finally {
          setSearching(false);
        }
      }, 300);
    },
    [tenancyId]
  );

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (abortRef.current) abortRef.current.abort();
    },
    []
  );

  return { results, searching, search };
};
