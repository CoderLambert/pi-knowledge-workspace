import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { ContentAddressedBlobStore } from "./blobStore.js";
import { KNOWLEDGE_SCHEMA_VERSION, type KnowledgeDatabase, type SqliteStatement } from "./database.js";
import { Fts5BaselineIndex } from "./fts5Index.js";
import { GroundedAskStore } from "./groundedAsk.js";
import { IndexBuildPublisher } from "./indexBuildPublication.js";
import { applyMigrations } from "./migrations.js";
import { ParsedArtifactCanonicalizer, SqliteParsedArtifactStore } from "./parsedArtifact.js";
import { ReliableKnowledgePublisher } from "./reliableKnowledge.js";
import { SourceDomain } from "./sourceDomain.js";

const cleanup: (() => Promise<void>)[] = [];
afterEach(async () => { for (const close of cleanup.splice(0)) await close(); });

describe("GenerationRun retrieval pin lifecycle", () => {
  it("renews a leased run pin at storage boundaries and releases it on terminal state", async () => {
    const f = await fixture();
    const run = f.ask.begin({ knowledgeWorkspaceId: "workspace", question: "alpha",
      provider: "test", model: "fixture", modelRevision: "v1" });
    const initialExpiry = f.pinExpiry(run.id);
    expect(initialExpiry).not.toBeNull();

    f.advance(50);
    expect(f.ask.search("workspace", run.id, "alpha").hits).toHaveLength(1);
    const renewedExpiry = f.pinExpiry(run.id);
    if (initialExpiry === null || renewedExpiry === null) throw new Error("Expected renewable GenerationRun pin");
    expect(Date.parse(renewedExpiry)).toBeGreaterThan(Date.parse(initialExpiry));

    f.ask.fail("workspace", run.id, "fixture complete");
    expect(f.ask.getRun("workspace", run.id).status).toBe("failed");
    expect(f.pinExpiry(run.id)).toBeNull();
  });

  it("fails closed and recovers a running GenerationRun after its pin expires", async () => {
    const f = await fixture();
    const run = f.ask.begin({ knowledgeWorkspaceId: "workspace", question: "alpha",
      provider: "test", model: "fixture", modelRevision: "v1" });

    f.advance(101);
    expect(() => f.ask.search("workspace", run.id, "alpha")).toThrow(/lease expired/);

    const restarted = f.restart();
    const recovered = restarted.getRun("workspace", run.id);
    expect(recovered.status).toBe("failed");
    expect(recovered.error).toMatch(/lease expired before recovery/);
    expect(f.pinExpiry(run.id)).toBeNull();
    expect(restarted.listAnswers("workspace")).toEqual([]);
  });
});

async function fixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), "grounded-ask-lifecycle-"));
  const filename = path.join(root, "knowledge.sqlite");
  let db = new NodeDatabase(filename);
  applyMigrations(db, KNOWLEDGE_SCHEMA_VERSION);
  db.exec("PRAGMA foreign_keys=ON");
  db.prepare("INSERT INTO installations (id, created_at) VALUES ('installation', '2026-09-10')").run();
  db.prepare(`INSERT INTO knowledge_workspaces (id, installation_id, canonical_realpath, created_at)
    VALUES ('workspace', 'installation', ?, '2026-09-10')`).run(path.join(root, "workspace"));

  const blobs = new ContentAddressedBlobStore(root);
  const sources = new SourceDomain(db, blobs);
  const source = sources.createSource({ knowledgeWorkspaceId: "workspace", kind: "manual", displayName: "alpha" });
  const version = await sources.captureSourceVersion(source.id, Buffer.from("alpha"));
  const publisher = new ReliableKnowledgePublisher(new ParsedArtifactCanonicalizer(blobs),
    new SqliteParsedArtifactStore(db), new Fts5BaselineIndex(db), new IndexBuildPublisher(db));
  publisher.publish({ knowledgeWorkspaceId: "workspace",
    sources: [{ sourceVersion: version, sourceKind: "txt" }], retrievalConfigRevision: "fts5-baseline-v1" });

  let nowMs = Date.parse("2026-09-10T00:00:00.000Z");
  const options = { now: () => new Date(nowMs), runPinLeaseMs: 100 };
  let ask = new GroundedAskStore(db, options);
  cleanup.push(async () => { db.close(); await rm(root, { recursive: true, force: true }); });

  return {
    get ask() { return ask; },
    advance: (ms: number) => { nowMs += ms; },
    pinExpiry: (runId: string): string | null => {
      const raw = db.prepare("SELECT lease_expires_at FROM index_build_pins WHERE owner_type='generation-run' AND owner_id=?")
        .get(runId);
      if (raw === undefined) return null;
      const row = requireRecord(raw);
      const value = row["lease_expires_at"];
      if (typeof value !== "string") throw new Error("Invalid GenerationRun pin expiry");
      return value;
    },
    restart: () => {
      db.close();
      db = new NodeDatabase(filename);
      db.exec("PRAGMA foreign_keys=ON");
      ask = new GroundedAskStore(db, options);
      return ask;
    },
  };
}

class NodeDatabase implements KnowledgeDatabase {
  private readonly database: DatabaseSync;
  constructor(filename: string) { this.database = new DatabaseSync(filename); }
  exec(sql: string): void { this.database.exec(sql); }
  close(): void { this.database.close(); }
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

function requireRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error("Invalid fixture row");
  return Object.fromEntries(Object.entries(value));
}

function sqlValues(values: unknown[]): SQLInputValue[] {
  return values.map((value) => {
    if (value === null || typeof value === "string" || typeof value === "number"
      || typeof value === "bigint" || value instanceof Uint8Array) return value;
    throw new TypeError("Invalid SQLite fixture parameter");
  });
}
