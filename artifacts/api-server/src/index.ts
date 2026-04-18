import * as Sentry from "@sentry/node";
import app from "./app";
import { logger } from "./lib/logger";
import { autoSeedIfEmpty, autoFixExpiredAllocations } from "./lib/auto-seed";

// ── Sentry (P5-T6) — only initialised when SENTRY_DSN is provided ─────────────
if (process.env["SENTRY_DSN"]) {
  Sentry.init({
    dsn: process.env["SENTRY_DSN"],
    environment: process.env["NODE_ENV"] ?? "development",
    tracesSampleRate: process.env["NODE_ENV"] === "production" ? 0.2 : 1.0,
  });
  logger.info("Sentry error tracking initialised");
}

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

async function start() {
  try {
    await autoSeedIfEmpty();
  } catch (err) {
    logger.error({ err }, "[auto-seed] Seed failed — continuing server startup");
  }

  try {
    await autoFixExpiredAllocations();
  } catch (err) {
    logger.error({ err }, "[auto-fix] Allocation date fix failed — continuing");
  }

  app.listen(port, (err) => {
    if (err) {
      logger.error({ err }, "Error listening on port");
      process.exit(1);
    }
    logger.info({ port }, "Server listening");
  });
}

start();
