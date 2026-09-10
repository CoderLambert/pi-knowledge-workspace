import { describe, expect, it } from "vitest";

import type { KnowledgeDatabase, SqliteStatement } from "./database.js";
import { Fts5BaselineIndex } from "./fts5Index.js";
import type { StructureAwareChunk } from "./chunker.js";

interface PreparedCall {
  sql: string;
  runs: unknown[][];
  gets: unknown[][];
  alls: unknown[][];
}

class FakeKnowledgeDatabase implements KnowledgeDatabase {
  readonly execLog: string[] = [];
  readonly prepared: PreparedCall[] = [];
  authorityResult: unknown = { id: "build-1", source_id: "source-1" };
  searchRows: unknown[] = [];

  exec(sql: string): void {
    this.execLog.push(sql);
  }

  prepare(sql: string): SqliteStatement {
    const call: PreparedCall = { sql, runs: [], gets: [], alls: [] };
    this.prepared.push(call);
    return {
      run: (...params: unknown[]) => {
        call.runs.push(params);
        return { changes: 1, lastInsertRowid: 1 };
      },
      get: (...params: unknown[]) => {
        call.gets.push(params);
        return sql.includes("FROM index_builds ib") ? this.authorityResult : undefined;
      },
      all: (...params: unknown[]) => {
        call.alls.push(params);
        return sql.includes("FROM chunk_fts") ? this.searchRows : [];
      },
    };
  }

  pragma(): unknown {
    return undefined;
  }

  close(): void { /* no-op test database */ }
}

function chunks(): StructureAwareChunk[] {
  return [
    { ordinal: 0, startByte: 0, endByte: 5, text: "alpha", nodeKinds: ["paragraph"] },
    { ordinal: 1, startByte: 6, endByte: 10, text: "beta", nodeKinds: ["paragraph"] },
  ];
}

describe("FTS5 baseline index", () => {
  it("refuses indexing when build/artifact/source authority is outside the requested Workspace", () => {
    const db = new FakeKnowledgeDatabase();
    db.authorityResult = undefined;
    const index = new Fts5BaselineIndex(db);

    expect(() => {
      index.replaceArtifactChunks({
        knowledgeWorkspaceId: "workspace-1",
        indexBuildId: "build-1",
        sourceVersionId: "version-1",
        parsedArtifactId: "artifact-1",
        chunks: chunks(),
      });
    }).toThrow(/do not belong to the requested Knowledge Workspace/);
    expect(db.execLog).toEqual([]);
    expect(db.prepared.some((call) => call.sql.includes("INSERT INTO chunks"))).toBe(false);
  });

  it("replaces one artifact atomically with deterministic chunk ids and mirrored FTS rows", () => {
    const db = new FakeKnowledgeDatabase();
    const index = new Fts5BaselineIndex(db);
    const input = {
      knowledgeWorkspaceId: "workspace-1",
      indexBuildId: "build-1",
      sourceVersionId: "version-1",
      parsedArtifactId: "artifact-1",
      chunks: chunks(),
      createdAt: "2026-09-09T00:00:00.000Z",
    } as const;

    index.replaceArtifactChunks(input);

    expect(db.execLog).toEqual(["BEGIN IMMEDIATE", "COMMIT"]);
    const chunkInsert = db.prepared.find((call) => call.sql.includes("INSERT INTO chunks"));
    const ftsInsert = db.prepared.find((call) => call.sql.includes("INSERT INTO chunk_fts"));
    expect(chunkInsert?.runs).toHaveLength(2);
    expect(ftsInsert?.runs).toHaveLength(2);
    const firstChunkId = chunkInsert?.runs[0]?.[0];
    expect(firstChunkId).toMatch(/^chunk_[0-9a-f]{64}$/);
    expect(ftsInsert?.runs[0]?.[0]).toBe(firstChunkId);

    const firstRunIds = chunkInsert?.runs.map((params) => params[0]);
    db.prepared.length = 0;
    db.execLog.length = 0;
    index.replaceArtifactChunks(input);
    const secondChunkInsert = db.prepared.find((call) => call.sql.includes("INSERT INTO chunks"));
    expect(secondChunkInsert?.runs.map((params) => params[0])).toEqual(firstRunIds);
  });

  it("applies Workspace, IndexBuild, and allowed SourceVersion predicates before ranking and Top-K", () => {
    const db = new FakeKnowledgeDatabase();
    db.searchRows = [
      {
        chunkId: "chunk-1",
        sourceVersionId: "version-2",
        parsedArtifactId: "artifact-2",
        text: "needle",
        rank: -1.25,
      },
    ];
    const index = new Fts5BaselineIndex(db);

    const hits = index.search({
      knowledgeWorkspaceId: "workspace-1",
      indexBuildId: "build-1",
      query: "needle",
      allowedSourceVersionIds: ["version-2", "version-3"],
      limit: 5,
    });

    expect(hits).toHaveLength(1);
    const search = db.prepared.find((call) => call.sql.includes("FROM chunk_fts"));
    const normalized = search?.sql.replace(/\s+/g, " ") ?? "";
    expect(normalized).toContain("chunk_fts MATCH ? AND knowledge_workspace_id = ? AND index_build_id = ?");
    expect(normalized).toContain("source_version_id IN (?, ?)");
    expect(normalized.indexOf("knowledge_workspace_id = ?")).toBeLessThan(normalized.indexOf("ORDER BY bm25"));
    expect(normalized.indexOf("source_version_id IN")).toBeLessThan(normalized.indexOf("LIMIT ?"));
    expect(search?.alls[0]).toEqual(["needle", "workspace-1", "build-1", "version-2", "version-3", 5]);
  });

  it("returns no results without issuing a global query when explicit SourceVersion scope is empty", () => {
    const db = new FakeKnowledgeDatabase();
    const index = new Fts5BaselineIndex(db);

    expect(
      index.search({
        knowledgeWorkspaceId: "workspace-1",
        indexBuildId: "build-1",
        query: "needle",
        allowedSourceVersionIds: [],
      }),
    ).toEqual([]);
    expect(db.prepared).toEqual([]);
  });

  it("rejects invalid search/query/chunk inputs before SQL execution", () => {
    const db = new FakeKnowledgeDatabase();
    const index = new Fts5BaselineIndex(db);

    expect(() => index.search({ knowledgeWorkspaceId: "workspace-1", indexBuildId: "build-1", query: "  " })).toThrow(
      /query must not be empty/,
    );
    expect(() => {
      index.search({ knowledgeWorkspaceId: "workspace-1", indexBuildId: "build-1", query: "x", limit: 101 });
    }).toThrow(/between 1 and 100/);
    expect(() => {
      index.replaceArtifactChunks({
        knowledgeWorkspaceId: "workspace-1",
        indexBuildId: "build-1",
        sourceVersionId: "version-1",
        parsedArtifactId: "artifact-1",
        chunks: [{ ordinal: 1, startByte: 0, endByte: 1, text: "x", nodeKinds: [] }],
      });
    }).toThrow(/ordinals must be contiguous/);
  });

  it("fails closed when SQLite returns a malformed FTS5 row", () => {
    const db = new FakeKnowledgeDatabase();
    db.searchRows = [{ chunkId: "chunk-1", rank: "not-a-number" }];
    const index = new Fts5BaselineIndex(db);

    expect(() =>
      index.search({ knowledgeWorkspaceId: "workspace-1", indexBuildId: "build-1", query: "needle" }),
    ).toThrow(/invalid FTS5 search row/);
  });
});
