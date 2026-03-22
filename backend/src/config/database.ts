import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import pg from "pg";
import { env } from "./env.js";

const { Pool } = pg;

declare global {
  // eslint-disable-next-line no-var
  var __prisma__: PrismaClient | undefined;
  // eslint-disable-next-line no-var
  var __pgPool__: pg.Pool | undefined;
}

// Reuse the same pool/client during local rebuilds so Prisma does not open duplicate connections.
const pool =
  global.__pgPool__ ??
  new Pool({
    connectionString: env.databaseUrl,
  });

const adapter = new PrismaPg(pool);

export const prisma =
  global.__prisma__ ??
  new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["query", "warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  // Keep instances cached across reloads in development only.
  global.__prisma__ = prisma;
  global.__pgPool__ = pool;
}
