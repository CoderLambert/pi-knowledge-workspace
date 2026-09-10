import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  KnowledgeBackupCreator,
  type BackupArtifactProvider,
  type BackupCapableDatabase,
  type BackupManifestArtifact,
} from "./backup.js";
import { ContentAddressedBlobStore } from "./blobStore.js";
import { chunkParsedArtifact } from "./chunker.js";
import {
  openKnowledgeDatabase,
  openKnowledgeDatabaseReadOnly,
  type KnowledgeDatabase,
} from "./database.js";
import {
  assertEvidenceMatchesArtifact,
  createStableEvidence,
  type StableEvidence,
} from "./evidence.js";
import {
  EvidenceReadApi,
  type ParsedArtifactReadStore,
  type ReadableParsedArtifact,
} from "./evidenceRead.js";
import { Fts5BaselineIndex } from "./fts5Index.js";
import { MdTextImportJobs } from "./importJobs.js";
import { IndexBuildPublisher } from "./indexBuildPublication.js";
import { IndexBuildRetention } from "./indexBuildRetention.js";
import {
  ParsedArtifactCanonicalizer,
  type DocumentNode,
  type ParsedArtifactCanonical,
} from "./parsedArtifact.js";
import {
  KnowledgeRestore,
  type RestoreArtifactSink,
  type RestoreEvidenceVerifier,
} from "./restore.js";
import { SourceDomain, type KnowledgeSourceVersion } from "./sourceDomain.js";
import { captureWorkspaceFile } from "./workspaceFileReader.js";

const roots: string[] = [];
const WORKSPACE_ID = "workspace-durability";
const INSTALLATION_ID = "installation-durability";
const HISTORICAL_QUOTE = "历史证据必须精确保留 😀";
const SEARCH_ANCHOR = "durabilityanchor";

interface ArtifactBundle {
  knowledgeWorkspaceId: string;
  parsedArtifactId: string;
  sourceVersionId: string;
  parserVersion: string;
  canonicalTextSha256: string;
  canonicalBytesBase64: string;
  documentStructure: DocumentNode[];
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("P1-T22 Evidence durability E2E", () => {
  it("preserves exact historical Evidence across rechunk, reparse, update, GC, restart, backup and restore", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "pi-knowledge-durability-"));
    roots.push(root);
    const workspaceRoot = path.join(root, "workspace");
    const dataRoot = path.join(root, "data");
    const databasePath = path.join(dataRoot, "knowledge.sqlite");
    const sourcePath = path.join(workspaceRoot, "docs", "guide.md");
    const backupPath = path.join(root, "backup");
    const restorePath = path.join(root, "restored");
    await mkdir(path.dirname(sourcePath), { recursive: true });
    await mkdir(dataRoot, { recursive: true });

    const originalText = [
      "# Stable Evidence",
      "",
      `${SEARCH_ANCHOR} ${HISTORICAL_QUOTE}`,
      "",
      "Only the historical version contains the original wording.",
      "",
    ].join("\n");
    await writeFile(sourcePath, originalText, "utf8");

    let db = openKnowledgeDatabase(databasePath);
    seedWorkspace(db, workspaceRoot);
    let blobs = new ContentAddressedBlobStore(dataRoot);
    const artifacts = new FixtureArtifactStore(dataRoot);
    const sources = new SourceDomain(db, blobs);
    const imports = new MdTextImportJobs(db, sources);

    // Import through the durable P1-T07 job path.
    const submitted = imports.submit({
      knowledgeWorkspaceId: WORKSPACE_ID,
      relativePath: "docs/guide.md",
      idempotencyKey: "durability-import-v1",
      displayName: "guide.md",
    });
    const imported = await imports.run(submitted.id);
    expect(imported.status).toBe("succeeded");
    if (imported.result === null) throw new Error("Import succeeded without a durable result");
    const sourceId = imported.result.sourceId;
    const originalVersion = requireVersion(sources, sourceId, imported.result.sourceVersionId);

    // Parse, index, search and create server-derived Stable Evidence.
    const canonicalizer = new ParsedArtifactCanonicalizer(blobs);
    const originalCanonical = await canonicalizer.fromSourceVersion(originalVersion, "md");
    const originalArtifactId = "artifact-original-v1";
    persistArtifact(
      db,
      artifacts,
      originalArtifactId,
      originalCanonical,
      originalVersion.id,
      originalCanonical.parserFingerprint,
    );

    const publisher = new IndexBuildPublisher(db);
    const fts = new Fts5BaselineIndex(db);
    const build1 = publishIndex(
      publisher,
      fts,
      originalArtifactId,
      originalVersion.id,
      originalCanonical,
      2400,
    );
    const hits = fts.search({
      knowledgeWorkspaceId: WORKSPACE_ID,
      indexBuildId: build1,
      query: SEARCH_ANCHOR,
      limit: 5,
    });
    expect(
      hits.some(
        (hit) => hit.parsedArtifactId === originalArtifactId && hit.text.includes(HISTORICAL_QUOTE),
      ),
    ).toBe(true);

    const quoteRange = byteRangeFor(originalCanonical.canonicalText, HISTORICAL_QUOTE);
    const evidence = createStableEvidence({
      id: "evidence-historical",
      knowledgeWorkspaceId: WORKSPACE_ID,
      parsedArtifactId: originalArtifactId,
      canonicalBytes: originalCanonical.canonicalBytes,
      range: quoteRange,
      locatorSnapshot: { heading: "Stable Evidence", sourceVersionId: originalVersion.id },
      createdAt: "2026-09-09T00:00:00.000Z",
    });
    persistEvidence(db, evidence);
    expect(
      new EvidenceReadApi(artifacts).read({ knowledgeWorkspaceId: WORKSPACE_ID, evidence }).text,
    ).toBe(HISTORICAL_QUOTE);

    // Rechunk the same immutable artifact with a different experimental budget.
    const build2 = publishIndex(
      publisher,
      fts,
      originalArtifactId,
      originalVersion.id,
      originalCanonical,
      32,
    );
    expect(build2).not.toBe(build1);

    // Reparse the same SourceVersion under a new parser fingerprint without rewriting the old artifact.
    const reparsedArtifactId = "artifact-original-v2-parser";
    persistArtifact(
      db,
      artifacts,
      reparsedArtifactId,
      originalCanonical,
      originalVersion.id,
      "md-txt-parser-v2-e2e",
    );
    const build3 = publishIndex(
      publisher,
      fts,
      reparsedArtifactId,
      originalVersion.id,
      originalCanonical,
      48,
    );
    expect(build3).not.toBe(build2);

    // Update the same Source with different bytes that no longer contain the historical quote.
    const updatedText = [
      "# Stable Evidence",
      "",
      "The current version intentionally replaces the historical wording.",
      "",
    ].join("\n");
    await writeFile(sourcePath, updatedText, "utf8");
    const capturedUpdate = await captureWorkspaceFile(workspaceRoot, "docs/guide.md");
    const updatedVersion = await sources.manualUpdate(sourceId, capturedUpdate.bytes);
    expect(updatedVersion.id).not.toBe(originalVersion.id);
    const updatedCanonical = await canonicalizer.fromSourceVersion(updatedVersion, "md");
    expect(updatedCanonical.canonicalText).not.toContain(HISTORICAL_QUOTE);
    const updatedArtifactId = "artifact-current";
    persistArtifact(
      db,
      artifacts,
      updatedArtifactId,
      updatedCanonical,
      updatedVersion.id,
      updatedCanonical.parserFingerprint,
    );
    const build4 = publishIndex(
      publisher,
      fts,
      updatedArtifactId,
      updatedVersion.id,
      updatedCanonical,
      2400,
    );

    // GC every replaced IndexBuild. SourceVersion / ParsedArtifact / Evidence history must remain.
    const retention = new IndexBuildRetention(db);
    const deletedBuilds = retention.gcRetained(WORKSPACE_ID, 20);
    expect(deletedBuilds).toEqual(expect.arrayContaining([build1, build2, build3]));
    expect(deletedBuilds).not.toContain(build4);
    expect(loadEvidence(db, evidence.id).parsedArtifactId).toBe(originalArtifactId);
    expect(
      db.prepare("SELECT COUNT(*) AS count FROM parsed_artifacts WHERE id=?").get(originalArtifactId),
    ).toEqual({ count: 1 });

    // Process restart: reopen the file-backed database and prove the old artifact still resolves.
    db.close();
    db = openKnowledgeDatabase(databasePath);
    blobs = new ContentAddressedBlobStore(dataRoot);
    const afterRestart = loadEvidence(db, evidence.id);
    const restartedRead = new EvidenceReadApi(new FixtureArtifactStore(dataRoot)).read({
      knowledgeWorkspaceId: WORKSPACE_ID,
      evidence: afterRestart,
      mode: "section",
    });
    expect(restartedRead.text).toContain(HISTORICAL_QUOTE);
    expect(restartedRead.sourceVersionId).toBe(originalVersion.id);

    // Backup the consistent SQLite/blob/artifact closure.
    if (!isBackupCapableDatabase(db)) throw new Error("Knowledge database does not support backup");
    const backup = new KnowledgeBackupCreator(
      db,
      blobs,
      {
        openSnapshotDatabase: openKnowledgeDatabaseReadOnly,
        artifactProvider: new FixtureArtifactStore(dataRoot),
      },
    );
    const manifest = await backup.create(backupPath);
    expect(
      manifest.artifacts.some((artifact) => artifact.parsedArtifactId === originalArtifactId),
    ).toBe(true);
    expect(
      manifest.blobs.some((blob) => blob.contentSha256 === originalVersion.contentSha256),
    ).toBe(true);
    db.close();

    // Restore validates the full closure and re-verifies every historical Evidence before publication.
    const restore = new KnowledgeRestore({
      openSnapshotDatabase: openKnowledgeDatabaseReadOnly,
      artifactSink: new FixtureArtifactSink(),
      evidenceVerifier: new FixtureEvidenceVerifier(),
    });
    const restored = await restore.restore(backupPath, restorePath);
    expect(restored.evidenceCount).toBe(1);

    const restoredDb = openKnowledgeDatabaseReadOnly(path.join(restorePath, "knowledge.sqlite"));
    try {
      const restoredEvidence = loadEvidence(restoredDb, evidence.id);
      const restoredRead = new EvidenceReadApi(new FixtureArtifactStore(restorePath)).read({
        knowledgeWorkspaceId: WORKSPACE_ID,
        evidence: restoredEvidence,
        mode: "exact",
      });
      expect(restoredRead.text).toBe(HISTORICAL_QUOTE);
      expect(restoredRead.parsedArtifactId).toBe(originalArtifactId);
      expect(restoredRead.sourceVersionId).toBe(originalVersion.id);

      expect(
        restoredDb.prepare("SELECT COUNT(*) AS count FROM source_versions WHERE source_id=?").get(sourceId),
      ).toEqual({ count: 2 });
      expect(
        restoredDb.prepare("SELECT id FROM source_versions WHERE id=? AND source_id=?").get(
          updatedVersion.id,
          sourceId,
        ),
      ).toEqual({ id: updatedVersion.id });
      expect(restoredEvidence.parsedArtifactId).not.toBe(updatedArtifactId);
    } finally {
      restoredDb.close();
    }
  });
});

function seedWorkspace(db: KnowledgeDatabase, workspaceRoot: string): void {
  const createdAt = "2026-09-09T00:00:00.000Z";
  db.prepare("INSERT INTO installations (id, created_at) VALUES (?, ?)").run(
    INSTALLATION_ID,
    createdAt,
  );
  db.prepare(
    `INSERT INTO knowledge_workspaces
     (id, installation_id, canonical_realpath, external_binding, created_at)
     VALUES (?, ?, ?, ?, ?)`,
  ).run(WORKSPACE_ID, INSTALLATION_ID, workspaceRoot, "pi-web:durability", createdAt);
}

function requireVersion(
  sources: SourceDomain,
  sourceId: string,
  sourceVersionId: string,
): KnowledgeSourceVersion {
  const version = sources.listSourceVersions(sourceId).find(
    (candidate) => candidate.id === sourceVersionId,
  );
  if (!version) throw new Error(`Missing SourceVersion: ${sourceVersionId}`);
  return version;
}

function persistArtifact(
  db: KnowledgeDatabase,
  artifacts: FixtureArtifactStore,
  parsedArtifactId: string,
  canonical: ParsedArtifactCanonical,
  sourceVersionId: string,
  parserVersion: string,
): void {
  db.prepare(
    `INSERT INTO parsed_artifacts
     (id, source_version_id, parser_version, canonical_text_sha256, created_at)
     VALUES (?, ?, ?, ?, ?)`,
  ).run(
    parsedArtifactId,
    sourceVersionId,
    parserVersion,
    canonical.canonicalTextSha256,
    new Date().toISOString(),
  );
  artifacts.write({
    knowledgeWorkspaceId: WORKSPACE_ID,
    parsedArtifactId,
    sourceVersionId,
    parserVersion,
    canonicalTextSha256: canonical.canonicalTextSha256,
    canonicalBytesBase64: Buffer.from(canonical.canonicalBytes).toString("base64"),
    documentStructure: canonical.documentStructure.map((node) => ({ ...node })),
  });
}

function publishIndex(
  publisher: IndexBuildPublisher,
  fts: Fts5BaselineIndex,
  parsedArtifactId: string,
  sourceVersionId: string,
  canonical: ParsedArtifactCanonical,
  targetBytes: number,
): string {
  const staging = publisher.createStaging(WORKSPACE_ID, `fts5-e2e-${String(targetBytes)}`);
  fts.replaceArtifactChunks({
    knowledgeWorkspaceId: WORKSPACE_ID,
    indexBuildId: staging.id,
    sourceVersionId,
    parsedArtifactId,
    chunks: chunkParsedArtifact(canonical, { targetBytes }),
  });
  publisher.markValidated(staging.id);
  return publisher.publish(staging.id).id;
}

function persistEvidence(db: KnowledgeDatabase, evidence: StableEvidence): void {
  db.prepare(
    `INSERT INTO evidence
     (id, knowledge_workspace_id, parsed_artifact_id, start_byte, end_byte,
      exact_quote, quote_hash, locator_snapshot, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    evidence.id,
    evidence.knowledgeWorkspaceId,
    evidence.parsedArtifactId,
    evidence.startByte,
    evidence.endByte,
    evidence.exactQuote,
    evidence.quoteHash,
    JSON.stringify(evidence.locatorSnapshot),
    evidence.createdAt,
  );
}

function loadEvidence(db: KnowledgeDatabase, evidenceId: string): StableEvidence {
  const row = db.prepare(
    `SELECT id, knowledge_workspace_id, parsed_artifact_id, start_byte, end_byte,
            exact_quote, quote_hash, locator_snapshot, created_at
     FROM evidence WHERE id=?`,
  ).get(evidenceId);
  if (!isRecord(row)) throw new Error(`Missing or invalid Evidence: ${evidenceId}`);
  const locatorSnapshot = parseRecordJson(requireString(row, "locator_snapshot"), "Evidence locator_snapshot");
  return {
    id: requireString(row, "id"),
    knowledgeWorkspaceId: requireString(row, "knowledge_workspace_id"),
    parsedArtifactId: requireString(row, "parsed_artifact_id"),
    startByte: requireInteger(row, "start_byte"),
    endByte: requireInteger(row, "end_byte"),
    exactQuote: requireString(row, "exact_quote"),
    quoteHash: requireString(row, "quote_hash"),
    locatorSnapshot,
    createdAt: requireString(row, "created_at"),
  };
}

function byteRangeFor(text: string, quote: string): { startByte: number; endByte: number } {
  const characterOffset = text.indexOf(quote);
  if (characterOffset < 0) throw new Error(`Quote not found: ${quote}`);
  const startByte = Buffer.byteLength(text.slice(0, characterOffset), "utf8");
  return { startByte, endByte: startByte + Buffer.byteLength(quote, "utf8") };
}

class FixtureArtifactStore implements ParsedArtifactReadStore, BackupArtifactProvider {
  constructor(private readonly root: string) {}

  read(knowledgeWorkspaceId: string, parsedArtifactId: string): ReadableParsedArtifact {
    const bundle = this.readSync(parsedArtifactId);
    if (bundle.knowledgeWorkspaceId !== knowledgeWorkspaceId) {
      throw new Error("Fixture artifact Workspace mismatch");
    }
    return {
      knowledgeWorkspaceId: bundle.knowledgeWorkspaceId,
      parsedArtifactId: bundle.parsedArtifactId,
      sourceVersionId: bundle.sourceVersionId,
      canonicalBytes: Buffer.from(bundle.canonicalBytesBase64, "base64"),
      documentStructure: bundle.documentStructure,
    };
  }

  async readArtifactBundle(parsedArtifactId: string): Promise<Uint8Array> {
    return readFile(this.filename(parsedArtifactId));
  }

  write(bundle: ArtifactBundle): void {
    const filename = this.filename(bundle.parsedArtifactId);
    mkdirSync(path.dirname(filename), { recursive: true });
    writeFileSync(filename, `${JSON.stringify(bundle)}\n`, { flag: "wx", mode: 0o600 });
  }

  private readSync(parsedArtifactId: string): ArtifactBundle {
    const raw = readFileSync(this.filename(parsedArtifactId), "utf8");
    const bundle = parseArtifactBundle(raw, parsedArtifactId);
    verifyBundle(bundle, parsedArtifactId);
    return bundle;
  }

  private filename(parsedArtifactId: string): string {
    return path.join(this.root, "artifacts", `${artifactFilename(parsedArtifactId)}.json`);
  }
}

class FixtureArtifactSink implements RestoreArtifactSink {
  async writeArtifactBundle(
    targetRoot: string,
    artifact: BackupManifestArtifact,
    bytes: Uint8Array,
  ): Promise<void> {
    const bundle = parseArtifactBundle(Buffer.from(bytes).toString("utf8"), artifact.parsedArtifactId);
    verifyBundle(bundle, artifact.parsedArtifactId);
    if (
      bundle.sourceVersionId !== artifact.sourceVersionId ||
      bundle.parserVersion !== artifact.parserVersion ||
      bundle.canonicalTextSha256 !== artifact.canonicalTextSha256
    ) {
      throw new Error(`Restored ParsedArtifact metadata mismatch: ${artifact.parsedArtifactId}`);
    }
    const directory = path.join(targetRoot, "artifacts");
    await mkdir(directory, { recursive: true });
    await writeFile(
      path.join(directory, `${artifactFilename(artifact.parsedArtifactId)}.json`),
      bytes,
      { flag: "wx", mode: 0o600 },
    );
  }
}

class FixtureEvidenceVerifier implements RestoreEvidenceVerifier {
  verifyRestoredEvidence(input: { databasePath: string; dataRoot: string }): Promise<void> {
    const db = openKnowledgeDatabaseReadOnly(input.databasePath);
    try {
      const rows = db.prepare("SELECT id FROM evidence ORDER BY id").all();
      const artifacts = new FixtureArtifactStore(input.dataRoot);
      for (const row of rows) {
        if (!isRecord(row)) throw new Error("Invalid restored Evidence row");
        const evidence = loadEvidence(db, requireString(row, "id"));
        const artifact = artifacts.read(
          evidence.knowledgeWorkspaceId,
          evidence.parsedArtifactId,
        );
        assertEvidenceMatchesArtifact(evidence, artifact.canonicalBytes);
        const exact = new EvidenceReadApi(artifacts).read({
          knowledgeWorkspaceId: evidence.knowledgeWorkspaceId,
          evidence,
        });
        if (exact.text !== evidence.exactQuote) {
          throw new Error(`Restored Evidence quote mismatch: ${evidence.id}`);
        }
      }
    } finally {
      db.close();
    }
    return Promise.resolve();
  }
}

function verifyBundle(bundle: ArtifactBundle, parsedArtifactId: string): void {
  if (bundle.parsedArtifactId !== parsedArtifactId || bundle.knowledgeWorkspaceId !== WORKSPACE_ID) {
    throw new Error(`Invalid fixture ParsedArtifact bundle: ${parsedArtifactId}`);
  }
  const bytes = Buffer.from(bundle.canonicalBytesBase64, "base64");
  const hash = createHash("sha256").update(bytes).digest("hex");
  if (hash !== bundle.canonicalTextSha256) {
    throw new Error(`Fixture ParsedArtifact hash mismatch: ${parsedArtifactId}`);
  }
}

function parseArtifactBundle(raw: string, parsedArtifactId: string): ArtifactBundle {
  const value: unknown = JSON.parse(raw);
  if (!isRecord(value)) throw new Error(`Invalid fixture ParsedArtifact bundle: ${parsedArtifactId}`);
  const documentStructure = value["documentStructure"];
  if (!Array.isArray(documentStructure) || !documentStructure.every(isDocumentNode)) {
    throw new Error(`Invalid fixture ParsedArtifact structure: ${parsedArtifactId}`);
  }
  return {
    knowledgeWorkspaceId: requireString(value, "knowledgeWorkspaceId"),
    parsedArtifactId: requireString(value, "parsedArtifactId"),
    sourceVersionId: requireString(value, "sourceVersionId"),
    parserVersion: requireString(value, "parserVersion"),
    canonicalTextSha256: requireString(value, "canonicalTextSha256"),
    canonicalBytesBase64: requireString(value, "canonicalBytesBase64"),
    documentStructure,
  };
}

function isDocumentNode(value: unknown): value is DocumentNode {
  if (!isRecord(value)) return false;
  const kind = value["kind"];
  const startByte = value["startByte"];
  const endByte = value["endByte"];
  const level = value["level"];
  return (
    (kind === "heading" || kind === "paragraph" || kind === "list-item" || kind === "code-block" || kind === "table-row") &&
    typeof startByte === "number" && Number.isSafeInteger(startByte) &&
    typeof endByte === "number" && Number.isSafeInteger(endByte) &&
    (level === undefined || (typeof level === "number" && Number.isSafeInteger(level)))
  );
}

function isBackupCapableDatabase(db: KnowledgeDatabase): db is KnowledgeDatabase & BackupCapableDatabase {
  return "backup" in db && typeof db["backup"] === "function";
}

function parseRecordJson(raw: string, label: string): Record<string, unknown> {
  const value: unknown = JSON.parse(raw);
  if (!isRecord(value)) throw new Error(`${label} must be an object`);
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function artifactFilename(parsedArtifactId: string): string {
  return createHash("sha256").update(parsedArtifactId, "utf8").digest("hex");
}

function requireString(row: Record<string, unknown>, key: string): string {
  const value = row[key];
  if (typeof value !== "string" || value.length === 0) throw new Error(`Invalid ${key}`);
  return value;
}

function requireInteger(row: Record<string, unknown>, key: string): number {
  const value = row[key];
  if (typeof value !== "number" || !Number.isSafeInteger(value)) throw new Error(`Invalid ${key}`);
  return value;
}
