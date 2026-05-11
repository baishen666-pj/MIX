import "dotenv/config";
import { loadConfig } from "./utils/config.js";
import { createServer } from "./server.js";
import { logger } from "./utils/logger.js";

async function main() {
  const config = loadConfig();
  const { app, channels } = await createServer(config);

  await channels.startAll();

  try {
    await app.listen({ port: config.port, host: config.host });
    logger.info(`MIX Gateway running on http://${config.host}:${config.port}`);
    logger.info(`Engine bridge target: http://${config.engine.host}:${config.engine.port}`);
  } catch (err) {
    logger.error("Failed to start gateway", err);
    process.exit(1);
  }

  const shutdown = async () => {
    logger.info("Shutting down...");
    await channels.stopAll();
    await app.close();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main();
