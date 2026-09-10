import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { ContentAddressedBlobStore } from "./blobStore.js";
import { KNOWLEDGE_SCHEMA_VERSION, type KnowledgeDatabase, type SqliteStatement } from "./database.js";
import { Fts5BaselineIndex } from "./fts5Index.js";
import { GroundedAskStore, type GenerationRun } from "./groundedAsk.js";
import { IndexBuildPublisher } from "./indexBuildPublication.js";
import { IndexBuildRetention } from "./indexBuildRetention.js";
import { applyMigrations } from "./migrations.js";
import { ParsedArtifactCanonicalizer, SqliteParsedArtifactStore } from "./parsedArtifact.js";
import { ReliableKnowledgePublisher } from "./reliableKnowledge.js";
import { SourceDomain, type KnowledgeSourceVersion } from "./sourceDomain.js";

const cleanup: (() => Promise<void>)[] = [];
afterEach(async () => { for (const close of cleanup.splice(0)) await close(); });

describe("Grounded Ask canonical ownership", () => {
  it("freezes [A1,B1] across [A2,B1] publication and reopens historical citations after archive, GC and restart", async () => {
    const f = await fixture();
    const a1 = await f.capture("alpha origin", "a");
    const b1 = await f.capture("beta shared", "b");
    const initial = await f.publish([a1, b1]);
    const run = f.begin();
    const first = f.ask.search("workspace", run.id, "alpha beta");
    expect(first.hits.map((hit) => hit.sourceVersionId).sort()).toEqual([a1.id, b1.id].sort());

    const a2 = await f.sources.captureSourceVersion(a1.sourceId, Buffer.from("alpha updated"));
    const updated = await f.publish([a2, b1]);
    const second = f.ask.search("workspace", run.id, "alpha beta");
    expect(second.indexBuildId).toBe(initial.indexBuild.id);
    expect(second.hits.map((hit) => hit.snippet)).toEqual(first.hits.map((hit) => hit.snippet));
    const newer = f.begin();
    expect([...newer.scope.sourceVersionIds].sort()).toEqual([a2.id, b1.id].sort());
    expect(f.ask.search("workspace", newer.id, "alpha beta").indexBuildId).toBe(updated.indexBuild.id);
    f.ask.fail("workspace", newer.id, "test complete");
    expect(new IndexBuildRetention(f.db).gcRetained("workspace")).toEqual([]);

    const delivered = f.ask.deliver({
      knowledgeWorkspaceId: "workspace", runId: run.id, invocationId: "first", attempt: 1,
      hits: second.hits.map((hit) => ({ ...hit, snippet: "untrusted text is ignored" })),
    });
    expect(delivered.evidence.map((item) => item.exactQuote)).toEqual(first.hits.map((hit) => hit.snippet));
    const evidence = delivered.evidence.find((item) => item.locatorSnapshot["sourceVersionId"] === a1.id);
    if (evidence === undefined) throw new Error("Missing A1 Evidence");
    const answer = f.ask.complete({
      knowledgeWorkspaceId: "workspace", runId: run.id, deliveredEvidenceId: delivered.id,
      text: "The original says alpha origin [1].", citations: [{ label: "1", evidenceId: evidence.id }],
    });
    f.sources.archiveSource(a1.sourceId);
    expect(new IndexBuildRetention(f.db).gcRetained("workspace")).toEqual([initial.indexBuild.id]);
    f.restart();
    const citation = answer.citations[0];
    if (citation === undefined) throw new Error("Missing citation");
    expect(f.ask.getAnswer("workspace", answer.id)).toEqual(answer);
    expect(f.ask.getRun("workspace", run.id).scope.indexBuildId).toBe(initial.indexBuild.id);
    const historical = f.ask.openCitation("workspace", answer.id, citation.id);
    expect(historical.sourceVersion.id).toBe(a1.id);
    expect(historical.highlight?.exactQuote).toBe("alpha origin");
    expect(historical.text).not.toContain("updated");
    expect(f.db.prepare("SELECT serialized_context FROM delivered_evidence WHERE id=?").get(delivered.id))
      .toEqual({ serialized_context: delivered.serializedContext });
  });

  it("treats publisher sources as full replacement, requiring unchanged selections explicitly", async () => {
    const f = await fixture();
    const a = await f.capture("alpha", "a");
    const b = await f.capture("beta", "b");
    await f.publish([a, b]);
    await f.publish([a]);
    const run = f.begin();
    expect(run.scope.sourceVersionIds).toEqual([a.id]);
    expect(f.ask.search("workspace", run.id, "beta").hits).toEqual([]);
  });

  it.each([
    ["legacy payload", "canonical_bytes=NULL", /durable canonical payload/],
    ["corrupt canonical bytes", "canonical_bytes=X'616C7465726564'", /SHA-256/],
    ["corrupt interpretation", "parser_fingerprint='rewritten'", /interpretation identity/],
  ])("rejects every invalid selected artifact before freeze: %s", async (_name, corruption, expected) => {
    const f = await fixture();
    const matched = await f.capture("alpha match", "a");
    const unmatched = await f.capture("unrelated content", "b");
    const publication = await f.publish([matched, unmatched]);
    const artifact = publication.parsedArtifacts.find((item) => item.sourceVersionId === unmatched.id);
    if (artifact === undefined) throw new Error("Missing unmatched artifact");
    f.db.prepare(`UPDATE parsed_artifacts SET ${corruption} WHERE id=?`).run(artifact.parsedArtifactId);
    expect(() => f.begin()).toThrow(expected);
    expect(f.db.prepare("SELECT count(*) AS count FROM generation_runs").get()).toEqual({ count: 0 });
    expect(f.db.prepare("SELECT count(*) AS count FROM index_build_pins").get()).toEqual({ count: 0 });
  });

  it("rejects cross-workspace publication selections instead of silently dropping them", async () => {
    const f = await fixture();
    const a = await f.capture("alpha", "a");
    const b = await f.capture("beta", "b");
    await f.publish([a, b]);
    f.db.prepare("UPDATE sources SET knowledge_workspace_id='other' WHERE id=?").run(b.sourceId);
    expect(() => f.begin()).toThrow(/cross-workspace/);
    expect(f.db.prepare("SELECT count(*) AS count FROM generation_runs").get()).toEqual({ count: 0 });
  });

  it("never reacquires current after a frozen snapshot is lost", async () => {
    const f = await fixture();
    const a = await f.capture("alpha", "a");
    const old = await f.publish([a]);
    const run = f.begin();
    await f.publish([await f.sources.captureSourceVersion(a.sourceId, Buffer.from("new alpha"))]);
    f.db.prepare("DELETE FROM index_build_pins WHERE owner_id=?").run(run.id);
    expect(new IndexBuildRetention(f.db).gcRetained("workspace")).toEqual([old.indexBuild.id]);
    expect(() => f.ask.search("workspace", run.id, "alpha")).toThrow(/snapshot is unavailable/);
    expect(() => f.ask.deliver({ knowledgeWorkspaceId: "workspace", runId: run.id,
      invocationId: "invoke", attempt: 1, hits: [] })).toThrow(/snapshot is unavailable/);
    f.ask.fail("workspace", run.id, "Frozen snapshot was lost");
    expect(f.ask.getRun("workspace", run.id).status).toBe("failed");
    expect(f.ask.listAnswers("workspace")).toEqual([]);
  });

  it("persists ordered invocation/attempt deliveries and rejects citations not delivered to that attempt", async () => {
    const f = await fixture();
    await f.publish([await f.capture("alpha", "a"), await f.capture("beta", "b")]);
    const run = f.begin();
    const hits = f.ask.search("workspace", run.id, "alpha beta").hits;
    const first = f.ask.deliver({ knowledgeWorkspaceId: "workspace", runId: run.id,
      invocationId: "invocation", attempt: 1, hits });
    const retry = f.ask.deliver({ knowledgeWorkspaceId: "workspace", runId: run.id,
      invocationId: "invocation", attempt: 2, hits: [...hits].reverse().slice(0, 1) });
    const unavailable = first.evidence[0];
    const available = retry.evidence[0];
    if (unavailable === undefined || available === undefined) throw new Error("Missing delivery Evidence");
    const completion = { knowledgeWorkspaceId: "workspace", runId: run.id,
      deliveredEvidenceId: retry.id, text: "Answer [1]", citations: [{ label: "1", evidenceId: unavailable.id }] };
    expect(() => f.ask.complete(completion)).toThrow(/not delivered/);
    expect(f.ask.getRun("workspace", run.id).status).toBe("running");
    expect(f.ask.listAnswers("workspace")).toEqual([]);
    expect(() => f.ask.getRun("other", run.id)).toThrow(/Workspace/);
    const answer = f.ask.complete({ ...completion, citations: [{ label: "1", evidenceId: available.id }] });
    expect(() => f.ask.getAnswer("other", answer.id)).toThrow(/Workspace/);
    expect(() => f.ask.complete({ ...completion, citations: [{ label: "1", evidenceId: available.id }] })).toThrow(/completed/);
    expect(() => f.db.prepare("UPDATE answers SET text='rewritten' WHERE id=?").run(answer.id)).toThrow(/immutable/);
    expect(() => f.db.prepare("UPDATE evidence SET exact_quote='rewritten' WHERE id=?").run(available.id)).toThrow(/immutable/);
    expect(() => f.db.prepare("UPDATE generation_runs SET model='rewritten' WHERE id=?").run(run.id)).toThrow(/immutable/);
    expect(() => f.db.prepare("UPDATE citation_refs SET evidence_id=? WHERE answer_id=?").run(unavailable.id, answer.id))
      .toThrow(/immutable/);
  });

  it("uses renewable GenerationRun pins and recovers an expired running lease after restart", async () => {
    const f = await fixture();
    await f.publish([await f.capture("alpha", "a")]);
    const run = f.begin();
    const pin = f.db.prepare("SELECT lease_expires_at FROM index_build_pins WHERE owner_type='generation-run' AND owner_id=?")
      .get(run.id);
    if (pin === undefined) throw new Error("Missing GenerationRun pin");
    const leaseExpiresAt = recordField(pin, "lease_expires_at");
    expect(typeof leaseExpiresAt).toBe("string");

    f.db.prepare("UPDATE index_build_pins SET lease_expires_at='2000-01-01T00:00:00.000Z' WHERE owner_id=?").run(run.id);
    expect(() => f.ask.search("workspace", run.id, "alpha")).toThrow(/lease expired/);

    f.restart();
    const recovered = f.ask.getRun("workspace", run.id);
    expect(recovered.status).toBe("failed");
    expect(recovered.error).toMatch(/lease expired before recovery/);
    expect(f.db.prepare("SELECT count(*) AS count FROM index_build_pins WHERE owner_id=?").get(run.id))
      .toEqual({ count: 0 });
  });

  it("keeps quoted-literal-or retrieval and the ten result limit", async () => {
    const f = await fixture();
    const versions = [];
    for (let index = 0; index < 12; index += 1) versions.push(await f.capture(`alpha OR literal ${String(index)}`, String(index)));
    await f.publish(versions);
    const run = f.begin();
    const result = f.ask.search("workspace", run.id, 'alpha OR "literal"');
    expect(result.hits).toHaveLength(10);
    expect(result.debug).toMatchObject({ backend: "fts5", effectiveLimit: 10 });
    const hit = result.hits[0];
    if (hit === undefined) throw new Error("Missing lexical hit");
    expect(() => f.ask.deliver({ knowledgeWorkspaceId: "workspace", runId: run.id, invocationId: "bad", attempt: 1,
      hits: [{ ...hit, locator: { ...hit.locator, endByte: hit.locator.endByte + 1 } }] })).toThrow(/snapshot/);
  });
});

async function fixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), "grounded-ask-"));
  const filename = path.join(root, "knowledge.sqlite");
  let db = new NodeDatabase(filename);
  applyMigrations(db, KNOWLEDGE_SCHEMA_VERSION);
  db.exec("PRAGMA foreign_keys=ON");
  db.prepare("INSERT INTO installations (id, created_at) VALUES ('installation', '2026-09-10')").run();
  for (const id of ["workspace", "other"]) {
    db.prepare(`INSERT INTO knowledge_workspaces (id, installation_id, canonical_realpath, created_at)
      VALUES (?, 'installation', ?, '2026-09-10')`).run(id, path.join(root, id));
  }
  const blobs = new ContentAddressedBlobStore(root);
  const sources = new SourceDomain(db, blobs);
  const publisher = new ReliableKnowledgePublisher(new ParsedArtifactCanonicalizer(blobs),
    new SqliteParsedArtifactStore(db), new Fts5BaselineIndex(db), new IndexBuildPublisher(db));
  let ask = new GroundedAskStore(db);
  cleanup.push(async () => { db.close(); await rm(root, { recursive: true, force: true }); });
  return {
    get db() { return db; }, get ask() { return ask; }, sources,
    capture: async (text: string, name: string) => {
      const source = sources.createSource({ knowledgeWorkspaceId: "workspace", kind: "manual", displayName: name });
      return sources.captureSourceVersion(source.id, Buffer.from(text));
    },
    publish: (versions: KnowledgeSourceVersion[]) => publisher.publish({ knowledgeWorkspaceId: "workspace",
      sources: versions.map((sourceVersion) => ({ sourceVersion, sourceKind: "txt" })), retrievalConfigRevision: "fts5-baseline-v1" }),
    begin: (): GenerationRun => ask.begin({ knowledgeWorkspaceId: "workspace", question: "alpha beta",
      provider: "test", model: "fixture-model", modelRevision: "fixture-v1" }),
    restart: () => { db.close(); db = new NodeDatabase(filename); db.exec("PRAGMA foreign_keys=ON"); ask = new GroundedAskStore(db); },
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

function recordField(value: unknown, key: string): unknown {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error("Invalid fixture row");
  return Object.fromEntries(Object.entries(value))[key];
}

function sqlValues(values: unknown[]): SQLInputValue[] {
  return values.map((value) => {
    if (value === null || typeof value === "string" || typeof value === "number"
      || typeof value === "bigint" || value instanceof Uint8Array) return value;
    throw new TypeError("Invalid SQLite fixture parameter");
  });
}
