import axios from "axios";
const token = localStorage.getItem("jwtToken");
const tenancyId = localStorage.getItem("tenancyId");
const apiClient = axios.create({
  baseURL: `/api/${tenancyId}`,
  headers: {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  },
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
export const loadWorkflow = () => {
  return apiClient.get("/workflow/fetch"); // Adjust the endpoint to your backend URL
};
 