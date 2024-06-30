import axios from "axios";

export const getSeasonalReport = (tenantId, seasonCode) => {
  return axios.get(`/api/reports/${tenantId}/${seasonCode}`);
};
