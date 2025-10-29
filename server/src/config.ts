import dotenv from "dotenv";

dotenv.config();

const numberFromEnv = (value: string | undefined, fallback: number): number => {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const parseOrigins = (
  value: string | undefined,
  fallback: string[]
): string[] => {
  if (!value) {
    return fallback;
  }

  const entries = value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
  return entries.length > 0 ? entries : fallback;
};

const normalizeOrigin = (value: string): string => {
  try {
    const url = new URL(value);
    return `${url.protocol}//${url.host}`;
  } catch (_error) {
    return value.replace(/\/+$/, "");
  }
};

const fallbackOrigins = ["http://localhost:5173"];
const parsedOrigins = parseOrigins(
  process.env.CLIENT_ORIGINS ?? process.env.CLIENT_ORIGIN,
  fallbackOrigins
).map(normalizeOrigin);
const allowedOrigins = new Set(parsedOrigins);

export const config = {
  port: numberFromEnv(process.env.PORT, 4000),
  clientOrigins: parsedOrigins,
};

export const isAllowedOrigin = (origin: string | undefined | null): boolean => {
  if (!origin) {
    return true;
  }

  return allowedOrigins.has(normalizeOrigin(origin));
};
