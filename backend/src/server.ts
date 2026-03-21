import "dotenv/config";
import app from "./index.js";
import { prisma } from "./config/database.js";
import { env } from "./config/env.js";

const server = app.listen(env.port, () => {
  console.log(`Backend listening on port ${env.port}`);
});

const shutdown = async () => {
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
