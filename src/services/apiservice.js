import axios from "axios";

const apiClient = axios.create();

// Read token and tenancyId fresh on every request so they're never stale
// (module-level reads would capture null before the user logs in)
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem("jwtToken");
  const tenancyId = localStorage.getItem("tenancyId");
  config.baseURL = `/api/${tenancyId}`;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export const getItems = () => {
  return apiClient.get("/items");
};

export const saveSalesTransaction = (salesTransaction) => {
  return apiClient.post("/sales", salesTransaction);
};

export const saveWorkflow = (workflowData) => {
  return apiClient.post("/workflow", workflowData);
};

export const loadWorkflow = (workflowName) => {
  return apiClient.get("/workflow/fetch", { params: { name: workflowName } });
};
