#!/usr/bin/env node
import { runBackupCli } from "./backupCli.js";
import { buildKnowledgeApp } from "./app.js";
import { loadKnowledgeServiceConfig } from "./config.js";

try {
  if (process.argv[2] === "backup") {
    const manifest = await runBackupCli(process.argv.slice(3));
    console.log(
      `Knowledge backup created: schema=${String(manifest.schemaVersion)} blobs=${String(manifest.blobs.length)} artifacts=${String(manifest.artifacts.length)}`,
    );
  } else {
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
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
