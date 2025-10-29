const fallbackUrl = "http://localhost:4000";

export const apiConfig = {
  serverUrl: import.meta.env.VITE_SERVER_URL ?? fallbackUrl,
};
