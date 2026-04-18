import app from "./app";
import { logger } from "./lib/logger";
import { autoSeedIfEmpty, autoFixExpiredAllocations } from "./lib/auto-seed";

// ── Sentry server-side (P5-T6)
// For production: `pnpm add @sentry/node @opentelemetry/api @opentelemetry/instrumentation-http`
// then call Sentry.init({ dsn: process.env.SENTRY_DSN }) here before app.listen.
// See DEPLOYMENT.md for the full setup checklist.

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
