const fallbackUrl = "http://192.168.1.48:4000";

export const apiConfig = {
  serverUrl: import.meta.env.VITE_SERVER_URL ?? fallbackUrl,
};
