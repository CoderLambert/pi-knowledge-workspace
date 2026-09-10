import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { ContentAddressedBlobStore } from "../storage/blobStore.js";
import { KNOWLEDGE_SCHEMA_VERSION, type KnowledgeDatabase, type SqliteStatement } from "../storage/database.js";
import { Fts5BaselineIndex } from "../storage/fts5Index.js";
import { IndexBuildPublisher, IndexBuildPublicationConflictError } from "../storage/indexBuildPublication.js";
import { MdTextImportJobs, type ImportJob } from "../storage/importJobs.js";
import { applyMigrations } from "../storage/migrations.js";
import { ParsedArtifactCanonicalizer, SqliteParsedArtifactStore } from "../storage/parsedArtifact.js";
import { ReliableKnowledgePublisher } from "../storage/reliableKnowledge.js";
import { SourceDomain } from "../storage/sourceDomain.js";
import { createKnowledgeImportPort, createReliableKnowledgePublishPort } from "./composition.js";

const cleanup: (() => Promise<void>)[] = [];

afterEach(async () => {
  for (const close of cleanup.splice(0)) await close();
});

describe("Knowledge product composition", () => {
  it("runs real Markdown/TXT imports and reuses one Source for an updated file", async () => {
    const fixture = await createFixture();
    await writeFile(path.join(fixture.workspaceRoot, "guide.md"), "alpha version one");
    const first = await importJob(fixture.imports.submit({
      knowledgeWorkspaceId: "workspace",
      relativePath: "guide.md",
      idempotencyKey: "guide:v1",
      displayName: "Release Guide",
    }));

    await writeFile(path.join(fixture.workspaceRoot, "guide.md"), "alpha version two");
    const second = await importJob(fixture.imports.submit({
      knowledgeWorkspaceId: "workspace",
      relativePath: "guide.md",
      idempotencyKey: "guide:v2",
      sourceId: requiredResult(first).sourceId,
    }));

    expect(first.status).toBe("succeeded");
    expect(second.status).toBe("succeeded");
    expect(second.result?.sourceId).toBe(first.result?.sourceId);
    expect(second.result?.sourceVersionId).not.toBe(first.result?.sourceVersionId);
    expect(fixture.sources.listSources("workspace")).toHaveLength(1);
    expect(fixture.sources.listSourceVersions(first.result?.sourceId ?? "missing")).toHaveLength(2);
    await expect(fixture.publish.publish({
      knowledgeWorkspaceId: "workspace",
      sourceIds: [requiredResult(second).sourceId],
      sourceVersionIds: [requiredResult(second).sourceVersionId],
    })).resolves.toMatchObject({ generation: 1 });
  });

  it("composes a partial file update into a complete [A2,B1] replacement publication", async () => {
    const fixture = await createFixture();
    const a1 = await fixture.capture("a.md", "alpha one", "a:v1");
    const b1 = await fixture.capture("b.txt", "beta stable", "b:v1");
    await fixture.publish.publish({
      knowledgeWorkspaceId: "workspace",
      sourceIds: [a1.sourceId, b1.sourceId],
      sourceVersionIds: [a1.sourceVersionId, b1.sourceVersionId],
    });

    await writeFile(path.join(fixture.workspaceRoot, "a.md"), "alpha two");
    const a2 = await importJob(fixture.imports.submit({
      knowledgeWorkspaceId: "workspace",
      relativePath: "a.md",
      idempotencyKey: "a:v2",
      sourceId: a1.sourceId,
    }));
    const publication = await fixture.publish.publish({
      knowledgeWorkspaceId: "workspace",
      sourceIds: [a1.sourceId],
      sourceVersionIds: [requiredResult(a2).sourceVersionId],
    });

    expect(publication).toMatchObject({ generation: 2 });
    const expectedSelections: [string, string][] = [
      [a1.sourceId, requiredResult(a2).sourceVersionId],
      [b1.sourceId, b1.sourceVersionId],
    ];
    expect(activeSelections(fixture.db)).toEqual(
      expectedSelections.sort(([left], [right]) => left.localeCompare(right)),
    );
  });

  it("rejects a candidate composed from an obsolete publication before staging", async () => {
    const fixture = await createFixture();
    const first = await fixture.capture("a.md", "alpha one", "a:v1");
    await fixture.publish.publish({
      knowledgeWorkspaceId: "workspace",
      sourceIds: [first.sourceId],
      sourceVersionIds: [first.sourceVersionId],
    });
    const obsolete = { generation: 1, publicationId: activePublicationId(fixture.db) };
    const secondVersion = await fixture.sources.captureSourceVersion(first.sourceId, Buffer.from("alpha two"));
    await fixture.publish.publish({
      knowledgeWorkspaceId: "workspace",
      sourceIds: [first.sourceId],
      sourceVersionIds: [secondVersion.id],
    });

    await expect(fixture.reliable.publish({
      knowledgeWorkspaceId: "workspace",
      sources: [{ sourceVersion: first.sourceVersion, sourceKind: "md" }],
      retrievalConfigRevision: "fts5-baseline-v1",
      expectedBase: obsolete,
    })).rejects.toBeInstanceOf(IndexBuildPublicationConflictError);
    expect(activePublicationId(fixture.db)).not.toBe(obsolete.publicationId);
  });
});

async function createFixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), "knowledge-composition-"));
  const workspaceRoot = path.join(root, "workspace");
  await mkdir(workspaceRoot);
  const db = new NodeDatabase(path.join(root, "knowledge.sqlite"));
  applyMigrations(db, KNOWLEDGE_SCHEMA_VERSION);
  db.exec("PRAGMA foreign_keys=ON");
  db.prepare("INSERT INTO installations (id, created_at) VALUES ('installation', '2026-09-10')").run();
  db.prepare(`INSERT INTO knowledge_workspaces
    (id, installation_id, canonical_realpath, created_at)
    VALUES ('workspace', 'installation', ?, '2026-09-10')`).run(workspaceRoot);
  const blobs = new ContentAddressedBlobStore(path.join(root, "blobs"));
  const sources = new SourceDomain(db, blobs);
  const jobs = new MdTextImportJobs(db, sources);
  const imports = createKnowledgeImportPort(jobs);
  const reliable = new ReliableKnowledgePublisher(
    new ParsedArtifactCanonicalizer(blobs),
    new SqliteParsedArtifactStore(db),
    new Fts5BaselineIndex(db),
    new IndexBuildPublisher(db),
  );
  const publish = createReliableKnowledgePublishPort(db, sources, reliable);
  cleanup.push(async () => {
    db.close();
    await rm(root, { recursive: true, force: true });
  });
  return {
    db,
    workspaceRoot,
    sources,
    imports,
    reliable,
    publish,
    async capture(relativePath: string, text: string, idempotencyKey: string) {
      await writeFile(path.join(workspaceRoot, relativePath), text);
      const job = await importJob(imports.submit({
        knowledgeWorkspaceId: "workspace",
        relativePath,
        idempotencyKey,
      }));
      const result = requiredResult(job);
      const sourceVersion = sources.listSourceVersions(result.sourceId)
        .find((candidate) => candidate.id === result.sourceVersionId);
      if (sourceVersion === undefined) throw new Error("Imported SourceVersion is missing");
      return { ...result, sourceVersion };
    },
  };
}

async function importJob(value: object | Promise<object>): Promise<ImportJob> {
  const job = await value;
  if (!isImportJob(job)) throw new Error("Import adapter returned an invalid job");
  return job;
}

function isImportJob(value: object): value is ImportJob {
  return "id" in value
    && typeof value.id === "string"
    && "status" in value
    && (value.status === "queued"
      || value.status === "running"
      || value.status === "succeeded"
      || value.status === "failed"
      || value.status === "cancelled")
    && "result" in value
    && (value.result === null || isImportResult(value.result));
}

function isImportResult(value: unknown): value is NonNullable<ImportJob["result"]> {
  return isRecord(value)
    && typeof value["sourceId"] === "string"
    && typeof value["sourceVersionId"] === "string"
    && typeof value["contentSha256"] === "string"
    && typeof value["byteLength"] === "number";
}

function requiredResult(job: ImportJob): NonNullable<ImportJob["result"]> {
  if (job.result === null) throw new Error("Import job has no result");
  return job.result;
}

function activePublicationId(db: KnowledgeDatabase): string {
  const row = db.prepare("SELECT active_knowledge_publication_id FROM knowledge_workspaces WHERE id='workspace'").get();
  if (!isRecord(row) || typeof row["active_knowledge_publication_id"] !== "string") {
    throw new Error("Active publication is missing");
  }
  return row["active_knowledge_publication_id"];
}

function activeSelections(db: KnowledgeDatabase): [string, string][] {
  return db.prepare(`SELECT source_id, source_version_id FROM knowledge_publication_selections
    WHERE publication_id=? ORDER BY source_id`).all(activePublicationId(db)).map((row) => {
    if (!isRecord(row) || typeof row["source_id"] !== "string" || typeof row["source_version_id"] !== "string") {
      throw new Error("Invalid active selection");
    }
    return [row["source_id"], row["source_version_id"]];
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

class NodeDatabase implements KnowledgeDatabase {
  private readonly database: DatabaseSync;

  constructor(filename: string) {
    this.database = new DatabaseSync(filename);
  }

  exec(sql: string): void {
    this.database.exec(sql);
  }

  close(): void {
    this.database.close();
  }

  pragma(sql: string, options?: { simple?: boolean }): unknown {
    const row = this.database.prepare(`PRAGMA ${sql}`).get();
    return options?.simple === true && row !== undefined ? Object.values(row)[0] : row;
  }

  prepare(sql: string): SqliteStatement {
    const statement = this.database.prepare(sql);
    return {
      run: (...params) => statement.run(...sqlValues(params)),
      get: (...params) => statement.get(...sqlValues(params)),
      all: (...params) => statement.all(...sqlValues(params)),
    };
  }
}

function sqlValues(values: unknown[]): SQLInputValue[] {
  return values.map((value) => {
    if (
      value === null
      || typeof value === "string"
      || typeof value === "number"
      || typeof value === "bigint"
      || value instanceof Uint8Array
    ) return value;
    throw new TypeError("Invalid SQLite fixture parameter");
  });
}
