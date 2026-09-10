#!/usr/bin/env node
import { runBackupCli } from "./backupCli.js";
import { runRestoreCli } from "./restoreCli.js";
import { buildKnowledgeApp } from "./app.js";
import { loadKnowledgeServiceConfig } from "./config.js";
import { join } from "node:path";
import { ModelRuntime } from "@earendil-works/pi-coding-agent";
import { ContentAddressedBlobStore } from "../storage/blobStore.js";
import { openKnowledgeRuntimeDatabase } from "../storage/database.js";
import { Fts5BaselineIndex } from "../storage/fts5Index.js";
import { GroundedAskStore } from "../storage/groundedAsk.js";
import { IndexBuildPublisher } from "../storage/indexBuildPublication.js";
import { MdTextImportJobs } from "../storage/importJobs.js";
import { ParsedArtifactCanonicalizer, SqliteParsedArtifactStore } from "../storage/parsedArtifact.js";
import { ReliableKnowledgePublisher } from "../storage/reliableKnowledge.js";
import { SourceDomain } from "../storage/sourceDomain.js";
import {
  createKnowledgeImportPort,
  createKnowledgeServiceComposition,
  createReliableKnowledgePublishPort,
} from "./composition.js";
import { GroundedAskService } from "./groundedAsk.js";
import { createPiModelGroundedAskAdapter } from "./piModelProvider.js";
import { createKnowledgeViewerDispatch, createKnowledgeWorkspaceScopeResolver } from "./viewerDispatch.js";

try {
  if (process.argv[2] === "backup") {
    const manifest = await runBackupCli(process.argv.slice(3));
    console.log(
      `Knowledge backup created: schema=${String(manifest.schemaVersion)} blobs=${String(manifest.blobs.length)} artifacts=${String(manifest.artifacts.length)}`,
    );
  } else if (process.argv[2] === "restore") {
    const result = await runRestoreCli(process.argv.slice(3));
    console.log(
      `Knowledge restore created: schema=${String(result.schemaVersion)} blobs=${String(result.blobCount)} artifacts=${String(result.artifactCount)} evidence=${String(result.evidenceCount)} target=${result.targetDirectory}`,
    );
  } else {
    const config = loadKnowledgeServiceConfig();
    const db = openKnowledgeRuntimeDatabase(join(config.dataDir, "knowledge.sqlite"));
    const blobs = new ContentAddressedBlobStore(config.dataDir);
    const sources = new SourceDomain(db, blobs);
    const artifacts = new SqliteParsedArtifactStore(db);
    const reliable = new ReliableKnowledgePublisher(
      new ParsedArtifactCanonicalizer(blobs),
      artifacts,
      new Fts5BaselineIndex(db),
      new IndexBuildPublisher(db),
    );
    const scopeResolver = createKnowledgeWorkspaceScopeResolver(db);
    const modelRuntime = config.model === undefined
      ? undefined
      : await ModelRuntime.create({
          authPath: join(config.agentDir, "auth.json"),
          modelsPath: join(config.agentDir, "models.json"),
          allowModelNetwork: false,
        });
    const grounded = config.model === undefined || modelRuntime === undefined
      ? undefined
      : createPiModelGroundedAskAdapter({
          runtime: modelRuntime,
          provider: config.model.provider,
          model: config.model.model,
          modelRevision: config.model.revision,
        });
    const composition = createKnowledgeServiceComposition({
      importJobs: createKnowledgeImportPort(new MdTextImportJobs(db, sources)),
      publish: createReliableKnowledgePublishPort(db, sources, reliable),
      scopeResolver,
      ...(grounded === undefined ? {} : {
        groundedAsk: new GroundedAskService(new GroundedAskStore(db), grounded.provider),
        modelIdentity: grounded.identity,
      }),
    });
    const app = await buildKnowledgeApp({
      token: config.token,
      maxRequestBytes: config.maxRequestBytes,
      maxResponseBytes: config.maxResponseBytes,
      logger: true,
      viewer: createKnowledgeViewerDispatch(db, artifacts),
      importJobs: composition.importJobs,
      publish: composition.publish,
      ...(composition.groundedAsk === undefined ? {} : { groundedAsk: composition.groundedAsk }),
    });

    await app.listen({ host: config.host, port: config.port });

    let closing = false;
    const close = async (signal: NodeJS.Signals): Promise<void> => {
      if (closing) return;
      closing = true;
      app.log.info({ signal }, "stopping pi-knowledge");
      await app.close();
      db.close();
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
