// Invoice Designer's server calls (/api/{tenant}/web-invoice-templates).

const base = () => `/api/${localStorage.getItem("tenancyId")}/web-invoice-templates`;
const headers = () => ({
  Authorization: `Bearer ${localStorage.getItem("jwtToken")}`,
  "Content-Type": "application/json",
});

async function call(path, opts = {}) {
  const res = await fetch(`${base()}${path}`, { headers: headers(), ...opts });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || `Request failed (${res.status})`);
  return data;
}

export const listTemplates = () => call("");
export const getTemplate = (id) => call(`/${id}`);
export const createTemplate = (body) => call("", { method: "POST", body: JSON.stringify(body) });
export const updateTemplate = (id, body) => call(`/${id}`, { method: "PUT", body: JSON.stringify(body) });
export const deleteTemplate = (id) => call(`/${id}`, { method: "DELETE" });
export const setTemplateUse = (docType, templateId) =>
  call(`/in-use/${docType}`, { method: "PUT", body: JSON.stringify({ templateId }) });

// The template an invoice type prints with, or null for the built-in invoice. Never throws: an
// older server or a tenant without V086 simply prints the built-in invoice.
export async function templateInUse(docType) {
  try {
    const res = await fetch(`${base()}/in-use/${docType}`, { headers: headers() });
    if (!res.ok) return null;
    const data = await res.json();
    return data && data.template ? data.template : null;
  } catch {
    return null;
  }
}
