#!/usr/bin/env node
import { buildKnowledgeApp } from "./app.js";
import { loadKnowledgeServiceConfig } from "./config.js";

try {
  const config = loadKnowledgeServiceConfig();
  const app = await buildKnowledgeApp({
    token: config.token,
    maxRequestBytes: config.maxRequestBytes,
    maxResponseBytes: config.maxResponseBytes,
    logger: true,
  });

  await app.listen({ host: config.host, port: config.port });

  let closing = false;
  const close = async (signal: NodeJS.Signals): Promise<void> => {
    if (closing) return;
    closing = true;
    app.log.info({ signal }, "stopping pi-knowledge");
    await app.close();
  };

  process.once("SIGINT", () => {
    void close("SIGINT").catch((error: unknown) => {
      app.log.error({ err: error }, "failed to stop pi-knowledge cleanly");
      process.exitCode = 1;
    });
  });
  process.once("SIGTERM", () => {
    void close("SIGTERM").catch((error: unknown) => {
      app.log.error({ err: error }, "failed to stop pi-knowledge cleanly");
      process.exitCode = 1;
    });
  });
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
