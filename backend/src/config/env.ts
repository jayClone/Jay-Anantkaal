import "dotenv/config";

const requiredEnv = (key: string, fallback?: string) => {
  const value = process.env[key] ?? fallback;

  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }

  return value;
};

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: Number(process.env.PORT ?? 4000),
  clientUrl: process.env.CLIENT_URL ?? "*",
  databaseUrl: requiredEnv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/anantkaal"),
  jwtSecret: requiredEnv("JWT_SECRET", "dev-super-secret-change-me"),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? "7d",
  geminiApiKey: process.env.GEMINI_API_KEY,
  geminiPrimaryModel: process.env.GEMINI_PRIMARY_MODEL ?? "gemini-2.5-flash",
  geminiFallbackModels: (process.env.GEMINI_FALLBACK_MODELS ?? "gemini-2.5-flash-lite,gemini-2.0-flash")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean),
  authRateLimitWindowMs: Number(process.env.AUTH_RATE_LIMIT_WINDOW_MS ?? 15 * 60 * 1000),
  authRateLimitMax: Number(process.env.AUTH_RATE_LIMIT_MAX ?? 20),
  aiRateLimitWindowMs: Number(process.env.AI_RATE_LIMIT_WINDOW_MS ?? 60 * 1000),
  aiRateLimitMax: Number(process.env.AI_RATE_LIMIT_MAX ?? 5),
  googleClientId: process.env.GOOGLE_CLIENT_ID,
};
