import axios from 'axios';

//const CACHE_KEY = 'items';
const CACHE_KEY = "pos-item-cache-v1";
/**
 * Checks if the item cache exists and contains data.
 */
export const hasCache = async () => {
  const data = localStorage.getItem(CACHE_KEY);
  try {
    const parsed = JSON.parse(data);
    return Array.isArray(parsed) && parsed.length > 0;
  } catch (e) {
    return false;
  }
};

/**
 * Retrieves items from the local storage cache.
 */
export const getItemsFromCache = async () => {
  const data = localStorage.getItem(CACHE_KEY);
  try {
    return JSON.parse(data) || [];
  } catch (e) {
    return [];
  }
};

/**
 * Fetches all items from the server and saves them to the local cache.
 * Provides progress updates via the onProgress callback.
 */
export const loadAllItemsToCache = async ({ onProgress } = {}) => {
  const tenancyId = localStorage.getItem("tenancyId");
  const token = localStorage.getItem("jwtToken");

  if (!tenancyId || !token) {
    throw new Error("Authentication session expired. Please login again.");
  }

  try {
    if (onProgress) onProgress({ loaded: 0, total: 1 });

    const response = await axios.get(`/api/${tenancyId}/items`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    const items = Array.isArray(response.data) ? response.data : [];
    localStorage.setItem(CACHE_KEY, JSON.stringify(items));

    if (onProgress) onProgress({ loaded: items.length, total: items.length });
    return items;
  } catch (error) {
    console.error("Error loading items to cache:", error);
    throw error;
  }
};

/**
 * Updates local cache quantities after a transaction (e.g., POS sale).
 */
export const applySaleToCache = async (soldItems) => {
  const items = await getItemsFromCache();
  if (!items.length) return;

  const updated = items.map(item => {
    const itemId = item.item_id || item.itemId;
    const sold = soldItems.find(s => s.itemId === itemId);
    if (sold) {
      const currentQty = Number(item.available_qty || item.availableQty || item.currentStock || 0);
      const newQty = currentQty - sold.qty;
      return {
        ...item,
        available_qty: newQty,
        availableQty: newQty,
        currentStock: newQty
      };
    }
    return item;
  });

  localStorage.setItem(CACHE_KEY, JSON.stringify(updated));
};