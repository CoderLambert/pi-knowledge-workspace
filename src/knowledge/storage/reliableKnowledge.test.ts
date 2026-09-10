import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { ContentAddressedBlobStore } from "./blobStore.js";
import { chunkParsedArtifact } from "./chunker.js";
import { KNOWLEDGE_SCHEMA_VERSION, type KnowledgeDatabase, type SqliteStatement } from "./database.js";
import { createStableEvidence } from "./evidence.js";
import { EvidenceReadApi } from "./evidenceRead.js";
import { Fts5BaselineIndex } from "./fts5Index.js";
import { IndexBuildPublicationConflictError, IndexBuildPublisher } from "./indexBuildPublication.js";
import { applyMigrations } from "./migrations.js";
import { ParsedArtifactCanonicalizer, SqliteParsedArtifactStore } from "./parsedArtifact.js";
import { acquirePublishedKnowledgeSnapshot } from "./publishedKnowledge.js";
import { ReliableKnowledgePublisher } from "./reliableKnowledge.js";
import { SourceDomain, type KnowledgeSourceVersion } from "./sourceDomain.js";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("P3-A1 Reliable Knowledge", () => {
  it("keeps capture/failure isolated and publishes A -> B -> A by explicit generations", async () => {
    const fixture = await createFixture();
    const source = fixture.sources.createSource({
      knowledgeWorkspaceId: "workspace-a",
      kind: "manual",
      displayName: "guide.md",
    });
    const versionA = await fixture.sources.captureSourceVersion(source.id, Buffer.from("# A\n\nalpha evidence\n"));
    const publishedA = await fixture.reliable.publish(candidate("workspace-a", versionA, "retrieval-v1"));
    const artifactA = publishedA.parsedArtifacts[0];
    if (artifactA === undefined) throw new Error("A publication has no ParsedArtifact");

    expect(readSnapshot(fixture.db, "workspace-a", "read-a")).toMatchObject({
      generation: 1,
      sourceVersionIds: [versionA.id],
      parsedArtifactIds: [artifactA.parsedArtifactId],
      indexBuildId: publishedA.indexBuild.id,
      retrievalConfigRevision: "retrieval-v1",
    });
    expect(() => fixture.db.prepare(
      "UPDATE knowledge_publications SET retrieval_config_revision='rewritten' WHERE index_build_id=?",
    ).run(publishedA.indexBuild.id)).toThrow(/immutable/);

    const versionB = await fixture.sources.captureSourceVersion(source.id, Buffer.from("# B\n\nbeta evidence\n"));
    expect(readSnapshot(fixture.db, "workspace-a", "after-capture").sourceVersionIds).toEqual([versionA.id]);

    const invalidVersion = await fixture.sources.captureSourceVersion(source.id, Uint8Array.from([0xc3, 0x28]));
    await expect(
      fixture.reliable.publish(candidate("workspace-a", invalidVersion, "retrieval-v1")),
    ).rejects.toThrow();
    expect(readSnapshot(fixture.db, "workspace-a", "after-parse-failure").generation).toBe(1);

    const failedBuild = fixture.builds.createStaging("workspace-a", "fts5", {
      retrievalConfigRevision: "retrieval-v1",
    });
    expect(() => fixture.builds.markValidated(failedBuild.id)).toThrow(/cannot be validated/);
    expect(readSnapshot(fixture.db, "workspace-a", "after-index-failure").generation).toBe(1);

    const publishedB = await fixture.reliable.publish(candidate("workspace-a", versionB, "retrieval-v1"));
    expect(readSnapshot(fixture.db, "workspace-a", "read-b")).toMatchObject({
      generation: 2,
      sourceVersionIds: [versionB.id],
      indexBuildId: publishedB.indexBuild.id,
    });

    const republishedA = await fixture.reliable.publish(candidate("workspace-a", versionA, "retrieval-v1"));
    const snapshotA3 = readSnapshot(fixture.db, "workspace-a", "read-a3");
    expect(snapshotA3).toMatchObject({
      generation: 3,
      sourceVersionIds: [versionA.id],
      parsedArtifactIds: [artifactA.parsedArtifactId],
      indexBuildId: republishedA.indexBuild.id,
    });
    expect(republishedA.indexBuild.id).not.toBe(publishedA.indexBuild.id);

    const historical = fixture.artifacts.read("workspace-a", artifactA.parsedArtifactId);
    expect(historical.canonicalText).toContain("alpha evidence");
    const startByte = Buffer.byteLength("# A\n\n", "utf8");
    const evidence = createStableEvidence({
      id: "evidence-a",
      knowledgeWorkspaceId: "workspace-a",
      parsedArtifactId: artifactA.parsedArtifactId,
      canonicalBytes: artifactA.canonicalBytes,
      range: { startByte, endByte: startByte + Buffer.byteLength("alpha evidence") },
      locatorSnapshot: { sourceVersionId: versionA.id },
      createdAt: "2026-09-10T00:00:00.000Z",
    });
    fixture.db.prepare(`
INSERT INTO evidence (
  id, knowledge_workspace_id, parsed_artifact_id, start_byte, end_byte,
  exact_quote, quote_hash, locator_snapshot, created_at
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`).run(
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
    expect(new EvidenceReadApi(fixture.artifacts).read({
      knowledgeWorkspaceId: "workspace-a",
      evidence,
    }).text).toBe("alpha evidence");
  });

  it("rejects a stale candidate and keeps Knowledge Workspaces isolated", async () => {
    const fixture = await createFixture();
    const sourceA = fixture.sources.createSource({
      knowledgeWorkspaceId: "workspace-a",
      kind: "manual",
      displayName: "a.md",
    });
    const versionA = await fixture.sources.captureSourceVersion(sourceA.id, Buffer.from("# A\n\nalpha\n"));
    const initial = await fixture.reliable.publish(candidate("workspace-a", versionA, "retrieval-a"));
    const initialArtifact = initial.parsedArtifacts[0];
    if (initialArtifact === undefined) throw new Error("Initial publication has no ParsedArtifact");

    const versionB = await fixture.sources.captureSourceVersion(sourceA.id, Buffer.from("# B\n\nbeta\n"));
    const versionC = await fixture.sources.captureSourceVersion(sourceA.id, Buffer.from("# C\n\ngamma\n"));
    const staleB = await prepareCandidate(fixture, "workspace-a", versionB);
    const winningC = await prepareCandidate(fixture, "workspace-a", versionC);
    fixture.builds.publish(winningC);
    expect(() => fixture.builds.publish(staleB)).toThrow(IndexBuildPublicationConflictError);
    expect(readSnapshot(fixture.db, "workspace-a", "after-race")).toMatchObject({
      generation: 2,
      sourceVersionIds: [versionC.id],
      indexBuildId: winningC,
    });

    const sourceOther = fixture.sources.createSource({
      knowledgeWorkspaceId: "workspace-b",
      kind: "manual",
      displayName: "other.txt",
    });
    const versionOther = await fixture.sources.captureSourceVersion(sourceOther.id, Buffer.from("other workspace\n"));
    await fixture.reliable.publish({
      knowledgeWorkspaceId: "workspace-b",
      sources: [{ sourceVersion: versionOther, sourceKind: "txt" }],
      retrievalConfigRevision: "retrieval-b",
    });

    expect(readSnapshot(fixture.db, "workspace-b", "read-other")).toMatchObject({
      generation: 1,
      sourceVersionIds: [versionOther.id],
      retrievalConfigRevision: "retrieval-b",
    });
    expect(() => fixture.artifacts.read("workspace-b", initialArtifact.parsedArtifactId)).toThrow();
    expect(readSnapshot(fixture.db, "workspace-a", "read-a-again").sourceVersionIds).toEqual([versionC.id]);
  });

  it("creates distinct immutable artifacts for material interpretation revisions", async () => {
    const fixture = await createFixture();
    const source = fixture.sources.createSource({
      knowledgeWorkspaceId: "workspace-a",
      kind: "manual",
      displayName: "identity.md",
    });
    const version = await fixture.sources.captureSourceVersion(source.id, Buffer.from("# Identity\n"));
    const first = await fixture.canonicalizer.fromSourceVersion(version, "md", {
      interpretationConfigRevision: "config-a",
    });
    const second = await fixture.canonicalizer.fromSourceVersion(version, "md", {
      interpretationConfigRevision: "config-b",
    });
    const storedFirst = fixture.artifacts.materialize("workspace-a", first);
    const storedSecond = fixture.artifacts.materialize("workspace-a", second);

    expect(storedFirst.parsedArtifactId).not.toBe(storedSecond.parsedArtifactId);
    expect(storedFirst.interpretationConfigSha256).not.toBe(storedSecond.interpretationConfigSha256);
    expect(fixture.artifacts.read("workspace-a", storedFirst.parsedArtifactId).canonicalText).toBe("# Identity\n");
    expect(fixture.artifacts.read("workspace-a", storedSecond.parsedArtifactId).canonicalText).toBe("# Identity\n");
  });

  it("deterministically backfills an unambiguous schema-v7 active publication", () => {
    const db = legacyV7Database(false);
    applyMigrations(db, KNOWLEDGE_SCHEMA_VERSION);

    expect(db.pragma("user_version", { simple: true })).toBe(KNOWLEDGE_SCHEMA_VERSION);
    expect(readSnapshot(db, "legacy-workspace", "legacy-reader")).toMatchObject({
      generation: 1,
      sourceVersionIds: ["legacy-version"],
      parsedArtifactIds: ["legacy-artifact"],
      indexBuildId: "legacy-build",
      retrievalConfigRevision: "legacy-unspecified",
    });
    expect(db.prepare("SELECT id FROM parsed_artifacts WHERE id=?").get("legacy-artifact")).toEqual({
      id: "legacy-artifact",
    });
    db.close();
  });

  it("fails closed instead of guessing an ambiguous schema-v7 selection", () => {
    const db = legacyV7Database(true);

    expect(() => {
      applyMigrations(db, KNOWLEDGE_SCHEMA_VERSION);
    }).toThrow(/migration 8/);
    expect(db.pragma("user_version", { simple: true })).toBe(7);
    expect(db.prepare("SELECT COUNT(*) AS count FROM parsed_artifacts").get()).toEqual({ count: 2 });
    db.close();
  });
});

interface Fixture {
  db: NodeSqliteDatabase;
  sources: SourceDomain;
  canonicalizer: ParsedArtifactCanonicalizer;
  artifacts: SqliteParsedArtifactStore;
  index: Fts5BaselineIndex;
  builds: IndexBuildPublisher;
  reliable: ReliableKnowledgePublisher;
}

async function createFixture(): Promise<Fixture> {
  const root = await mkdtemp(path.join(os.tmpdir(), "pi-reliable-knowledge-"));
  roots.push(root);
  const db = new NodeSqliteDatabase();
  applyMigrations(db, KNOWLEDGE_SCHEMA_VERSION);
  db.exec("PRAGMA foreign_keys = ON");
  db.prepare("INSERT INTO installations (id, created_at) VALUES (?, ?)").run(
    "installation",
    "2026-09-10T00:00:00.000Z",
  );
  for (const workspaceId of ["workspace-a", "workspace-b"]) {
    db.prepare(`
INSERT INTO knowledge_workspaces (
  id, installation_id, canonical_realpath, external_binding, created_at
) VALUES (?, ?, ?, NULL, ?)
`).run(workspaceId, "installation", path.join(root, workspaceId), "2026-09-10T00:00:00.000Z");
  }

  const blobs = new ContentAddressedBlobStore(root);
  let id = 0;
  const createId = (prefix: string) => () => `${prefix}-${String(++id)}`;
  const sources = new SourceDomain(db, blobs, { createId: createId("source") });
  const canonicalizer = new ParsedArtifactCanonicalizer(blobs);
  const artifacts = new SqliteParsedArtifactStore(db, { now: () => new Date("2026-09-10T00:00:00.000Z") });
  const index = new Fts5BaselineIndex(db);
  const builds = new IndexBuildPublisher(db, {
    createId: createId("build"),
    createPublicationId: createId("publication"),
    now: () => new Date("2026-09-10T00:00:00.000Z"),
  });
  const reliable = new ReliableKnowledgePublisher(canonicalizer, artifacts, index, builds);
  return { db, sources, canonicalizer, artifacts, index, builds, reliable };
}

function candidate(workspaceId: string, sourceVersion: KnowledgeSourceVersion, retrievalConfigRevision: string) {
  return {
    knowledgeWorkspaceId: workspaceId,
    sources: [{ sourceVersion, sourceKind: "md" as const }],
    retrievalConfigRevision,
  };
}

async function prepareCandidate(fixture: Fixture, workspaceId: string, version: KnowledgeSourceVersion): Promise<string> {
  const canonical = await fixture.canonicalizer.fromSourceVersion(version, "md");
  const artifact = fixture.artifacts.materialize(workspaceId, canonical);
  const build = fixture.builds.createStaging(workspaceId, "fts5", {
    retrievalConfigRevision: "retrieval-race",
  });
  fixture.index.replaceArtifactChunks({
    knowledgeWorkspaceId: workspaceId,
    indexBuildId: build.id,
    sourceVersionId: version.id,
    parsedArtifactId: artifact.parsedArtifactId,
    chunks: chunkParsedArtifact(artifact),
  });
  fixture.builds.markValidated(build.id);
  return build.id;
}

function readSnapshot(db: KnowledgeDatabase, workspaceId: string, ownerId: string) {
  const snapshot = acquirePublishedKnowledgeSnapshot(db, workspaceId, {
    ownerType: "test",
    ownerId,
    leaseMs: 60_000,
  });
  try {
    return {
      generation: snapshot.generation,
      sourceVersionIds: [...snapshot.sourceVersionIds],
      parsedArtifactIds: [...snapshot.parsedArtifactIds],
      indexBuildId: snapshot.indexBuildId,
      retrievalConfigRevision: snapshot.retrievalConfigRevision,
    };
  } finally {
    snapshot.release();
  }
}

function legacyV7Database(ambiguous: boolean): NodeSqliteDatabase {
  const db = new NodeSqliteDatabase();
  applyMigrations(db, 7);
  db.exec("PRAGMA foreign_keys = ON");
  const at = "2026-09-09T00:00:00.000Z";
  db.prepare("INSERT INTO installations (id, created_at) VALUES (?, ?)").run("legacy-installation", at);
  db.prepare(`
INSERT INTO knowledge_workspaces (id, installation_id, canonical_realpath, external_binding, created_at)
VALUES (?, ?, ?, NULL, ?)
`).run("legacy-workspace", "legacy-installation", "/legacy", at);
  db.prepare(`
INSERT INTO sources (id, knowledge_workspace_id, kind, display_name, archived_at, created_at)
VALUES (?, ?, 'manual', 'legacy', NULL, ?)
`).run("legacy-source", "legacy-workspace", at);
  insertLegacyVersionAndArtifact(db, "legacy-version", "legacy-artifact", "a".repeat(64), at);
  if (ambiguous) insertLegacyVersionAndArtifact(db, "legacy-version-2", "legacy-artifact-2", "b".repeat(64), at);
  db.prepare(`
INSERT INTO index_builds (
  id, knowledge_workspace_id, strategy, status, created_at, completed_at,
  base_generation, base_active_build_id, validated_at, published_at
) VALUES (?, ?, 'fts5', 'active', ?, ?, 0, NULL, ?, ?)
`).run("legacy-build", "legacy-workspace", at, at, at, at);
  insertLegacyChunk(db, "legacy-chunk", "legacy-artifact", "legacy-version", "alpha", at);
  if (ambiguous) insertLegacyChunk(db, "legacy-chunk-2", "legacy-artifact-2", "legacy-version-2", "beta", at);
  db.prepare(`
UPDATE knowledge_workspaces SET active_index_build_id=?, index_generation=1 WHERE id=?
`).run("legacy-build", "legacy-workspace");
  return db;
}

function insertLegacyVersionAndArtifact(
  db: KnowledgeDatabase,
  sourceVersionId: string,
  parsedArtifactId: string,
  hash: string,
  at: string,
): void {
  db.prepare(`
INSERT INTO source_versions (id, source_id, content_sha256, blob_key, byte_length, created_at)
VALUES (?, 'legacy-source', ?, ?, 5, ?)
`).run(sourceVersionId, hash, hash, at);
  db.prepare(`
INSERT INTO parsed_artifacts (id, source_version_id, parser_version, canonical_text_sha256, created_at)
VALUES (?, ?, ?, ?, ?)
`).run(parsedArtifactId, sourceVersionId, `parser-${parsedArtifactId}`, hash, at);
}

function insertLegacyChunk(
  db: KnowledgeDatabase,
  chunkId: string,
  parsedArtifactId: string,
  sourceVersionId: string,
  text: string,
  at: string,
): void {
  db.prepare(`
INSERT INTO chunks (
  id, index_build_id, parsed_artifact_id, source_version_id, ordinal,
  text, start_byte, end_byte, node_kinds_json, created_at
) VALUES (?, 'legacy-build', ?, ?, 0, ?, 0, 5, '["paragraph"]', ?)
`).run(chunkId, parsedArtifactId, sourceVersionId, text, at);
  db.prepare(`
INSERT INTO chunk_fts (
  chunk_id, knowledge_workspace_id, source_version_id, parsed_artifact_id, index_build_id, text
) VALUES (?, 'legacy-workspace', ?, ?, 'legacy-build', ?)
`).run(chunkId, sourceVersionId, parsedArtifactId, text);
}

class NodeSqliteDatabase implements KnowledgeDatabase {
  private readonly database = new DatabaseSync(":memory:");

  exec(sql: string): void { this.database.exec(sql); }
  close(): void { this.database.close(); }
  pragma(source: string, options?: { simple?: boolean }): unknown {
    const row = this.database.prepare(`PRAGMA ${source}`).get();
    if (options?.simple !== true || row === undefined) return row;
    return Object.values(row)[0];
  }
  prepare(sql: string): SqliteStatement {
    const statement = this.database.prepare(sql);
    return {
      run: (...params: unknown[]) => {
        const result = statement.run(...asSqlValues(params));
        return { changes: result.changes, lastInsertRowid: result.lastInsertRowid };
      },
      get: (...params: unknown[]) => statement.get(...asSqlValues(params)),
      all: (...params: unknown[]) => statement.all(...asSqlValues(params)),
    };
  }
}

function asSqlValues(values: unknown[]): SQLInputValue[] {
  return values.map((value) => {
    if (
      value === null
      || typeof value === "string"
      || typeof value === "number"
      || typeof value === "bigint"
      || value instanceof Uint8Array
    ) {
      return value;
    }
    throw new TypeError("Unsupported SQLite test value");
  });
}
