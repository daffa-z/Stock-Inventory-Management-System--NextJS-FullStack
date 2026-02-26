import axios from "axios";
import Cookies from "js-cookie";

const resolvedBaseURL =
  process.env.NEXT_PUBLIC_API_BASE_URL?.trim() || "/api";

const axiosInstance = axios.create({
  baseURL: resolvedBaseURL,
  headers: {
    "Content-Type": "application/json",
  },
  withCredentials: true, // Ensure cookies are sent with requests
});

axiosInstance.interceptors.request.use((config) => {
  const token = Cookies.get("session_id");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default axiosInstance;
