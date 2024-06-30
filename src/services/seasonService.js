import axios from "axios";

export const getSeasons = () => {
  const tenancyId = localStorage.getItem("tenancyId");
  return axios.get(`/api/seasons/${tenancyId}`);
};
