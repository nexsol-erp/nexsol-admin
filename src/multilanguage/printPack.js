// Loads the optional multi-language print pack for a branch. Never throws and never blocks
// printing: any failure (old server, network, module not installed) means OFF, which prints
// English exactly as before. Cached for five minutes per tenant and branch.
import { OFF } from "./localizer";

const TTL_MS = 5 * 60 * 1000;
const cache = new Map();

export async function loadPrintPack(branchCode) {
  const tenant = localStorage.getItem("tenancyId");
  if (!tenant) return OFF;
  const key = `${tenant}|${branchCode || ""}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.pack;
  let pack = OFF;
  try {
    const q = branchCode ? `?branch=${encodeURIComponent(branchCode)}` : "";
    const res = await fetch(`/api/${tenant}/multi-language/print-pack${q}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem("jwtToken")}` },
    });
    if (res.ok) {
      const data = await res.json();
      if (data && data.enabled === true) pack = data;
      else if (data && data.defaultUiLanguage) pack = { enabled: false, defaultUiLanguage: data.defaultUiLanguage };
    }
  } catch (e) {
    pack = OFF;
  }
  cache.set(key, { at: Date.now(), pack });
  return pack;
}

export function clearPrintPackCache() {
  cache.clear();
}
