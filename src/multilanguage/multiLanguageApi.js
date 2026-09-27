// Calls to /api/{tenant}/multi-language (the optional multi-language module) and the existing
// branch translation endpoints. Every call resolves to { ok, data, message }.

const authHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem("jwtToken")}` });
const tenant = () => localStorage.getItem("tenancyId");

async function call(path, { method = "GET", body } = {}) {
  try {
    const res = await fetch(`/api/${tenant()}${path}`, {
      method,
      headers: body === undefined ? authHeaders() : { ...authHeaders(), "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      const message = (data && data.message)
        || (res.status === 403 ? "Only an admin can do this." : `The server answered ${res.status}.`);
      return { ok: false, data, message };
    }
    return { ok: true, data, message: null };
  } catch (e) {
    return { ok: false, data: null, message: "Could not reach the server. Please try again." };
  }
}

const enc = encodeURIComponent;

export const getSettings = () => call("/multi-language/settings");
export const saveSettings = (scope, key, body) =>
  call(`/multi-language/settings/${enc(scope)}${key ? `?key=${enc(key)}` : ""}`, { method: "PUT", body });
export const deleteSettings = (scope, key) =>
  call(`/multi-language/settings/${enc(scope)}${key ? `?key=${enc(key)}` : ""}`, { method: "DELETE" });
export const listItems = (language, { search, missingOnly, page }) =>
  call(`/multi-language/items?language=${enc(language)}&page=${page || 0}&missingOnly=${!!missingOnly}${search ? `&search=${enc(search)}` : ""}`);
export const saveItems = (language, names) => call(`/multi-language/items/${enc(language)}`, { method: "PUT", body: names });
export const getBranchTranslations = (branchCode) => call(`/branches/${enc(branchCode)}/translations`);
export const saveBranchTranslation = (branchCode, language, body) =>
  call(`/branches/${enc(branchCode)}/translations/${enc(language)}`, { method: "PUT", body });
