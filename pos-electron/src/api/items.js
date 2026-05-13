import { apiUrl } from "../utils/apiUrl";

export async function searchItems({ query, page = 0, size = 20 }) {
  const tenancyId = localStorage.getItem("tenancyId");
  const token = localStorage.getItem("jwtToken");
  const branchCode = String(globalThis.POS_BRANCH_CODE || localStorage.getItem("selectedBranchCode") || "").trim();

  if (!tenancyId) throw new Error("tenancyId missing. Please login again.");
  if (!token) throw new Error("jwtToken missing. Please login again.");

  const params = new URLSearchParams();
  if (query) params.set("query", query);
  params.set("page", String(page));
  params.set("size", String(size));
  params.set("sortField", "itemName");
  params.set("sortOrder", "asc");
  if (branchCode) params.set("branchCode", branchCode);

  const urls = [
    apiUrl(`/api/${tenancyId}/items-search-with-stock?${params.toString()}`),
    apiUrl(`/api/${tenancyId}/items-search?${params.toString()}`),
  ];

  let res = null;
  let lastError = "";
  for (const url of urls) {
    res = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });
    if (res.ok) break;
    const t = await res.text().catch(() => "");
    lastError = `${url} -> (${res.status}) ${t || res.statusText}`;
    if (res.status !== 404 && res.status !== 403) break;
  }

  if (!res || !res.ok) {
    throw new Error(`Item search failed: ${lastError || "Unknown error"}`);
  }

  const data = await res.json();

  // Spring Page -> items are in content
  return {
    items: Array.isArray(data?.content) ? data.content : [],
    total: Number(data?.totalElements || 0),
    page: Number(data?.number || 0),
    size: Number(data?.size || size),
  };
}
