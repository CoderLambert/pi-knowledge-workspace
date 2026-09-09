import { describe, expect, it } from "vitest";

import type { KnowledgeDatabase, SqliteStatement } from "./database.js";
import { Fts5BaselineIndex } from "./fts5Index.js";
import { SearchQueryApi, type SearchIndexBuildResolver } from "./searchQuery.js";

interface PreparedCall {
  sql: string;
  gets: unknown[][];
  alls: unknown[][];
}

class FakeKnowledgeDatabase implements KnowledgeDatabase {
  readonly prepared: PreparedCall[] = [];
  activeBuildRow: unknown = { id: "build-2" };
  searchRows: unknown[] = [];
  metadataRows = new Map<string, unknown>();

  exec(): void {}

  prepare(sql: string): SqliteStatement {
    const call: PreparedCall = { sql, gets: [], alls: [] };
    this.prepared.push(call);
    return {
      run: () => ({ changes: 1, lastInsertRowid: 1 }),
      get: (...params: unknown[]) => {
        call.gets.push(params);
        if (sql.includes("FROM knowledge_workspaces kw")) return this.activeBuildRow;
        if (sql.includes("FROM chunks c")) return this.metadataRows.get(String(params[0]));
        return undefined;
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

  close(): void {}
}

function metadata(chunkId: string, sourceVersionId = "version-1") {
  return {
    chunk_id: chunkId,
    source_version_id: sourceVersionId,
    parsed_artifact_id: "artifact-1",
    ordinal: 3,
    start_byte: 20,
    end_byte: 32,
    source_id: "source-1",
    source_kind: "workspace-file",
    source_display_name: "guide.md",
    source_archived_at: null,
  };
}

describe("search.query baseline", () => {
  it("selects the atomically published Workspace IndexBuild server-side and returns stable handles plus source/locator metadata", () => {
    const db = new FakeKnowledgeDatabase();
    db.searchRows = [
      {
        chunkId: "chunk-1",
        sourceVersionId: "version-1",
        parsedArtifactId: "artifact-1",
        text: "stable evidence",
        rank: -2.5,
      },
    ];
    db.metadataRows.set("chunk-1", metadata("chunk-1"));
    const api = new SearchQueryApi(db, new Fts5BaselineIndex(db));

    const first = api.query({ knowledgeWorkspaceId: "workspace-1", query: " evidence ", limit: 5 });
    const second = api.query({ knowledgeWorkspaceId: "workspace-1", query: "evidence", limit: 5 });

    expect(first.queryHandle).toMatch(/^search_query_[0-9a-f]{64}$/);
    expect(first.runHandle).toMatch(/^search_run_[0-9a-f]{64}$/);
    expect(second.queryHandle).toBe(first.queryHandle);
    expect(second.runHandle).toBe(first.runHandle);
    expect(first.indexBuildId).toBe("build-2");
    expect(first.hits).toEqual([
      {
        chunkId: "chunk-1",
        sourceVersionId: "version-1",
        source: {
          id: "source-1",
          kind: "workspace-file",
          displayName: "guide.md",
          archivedAt: null,
        },
        snippet: "stable evidence",
        locator: { parsedArtifactId: "artifact-1", startByte: 20, endByte: 32 },
        rank: -2.5,
        ordinal: 3,
      },
    ]);

    const buildLookup = db.prepared.find((call) => call.sql.includes("FROM knowledge_workspaces kw"));
    expect(buildLookup?.gets[0]).toEqual(["workspace-1"]);
    expect(buildLookup?.sql.replace(/\s+/g, " ")).toContain("ib.id = kw.active_index_build_id");
    expect(buildLookup?.sql.replace(/\s+/g, " ")).toContain("ib.status = 'active'");
    expect(buildLookup?.sql.replace(/\s+/g, " ")).toContain("ib.published_at IS NOT NULL");
  });

  it("applies allowed SourceVersion scope and result budget before invoking FTS Top-K", () => {
    const db = new FakeKnowledgeDatabase();
    const api = new SearchQueryApi(db, new Fts5BaselineIndex(db));

    const result = api.query({
      knowledgeWorkspaceId: "workspace-1",
      query: "needle",
      allowedSourceVersionIds: ["version-2", "version-1", "version-2"],
      limit: 10,
      budget: { maxResults: 3 },
    });

    expect(result.debug).toEqual({
      backend: "fts5",
      requestedLimit: 10,
      effectiveLimit: 3,
      allowedSourceVersionCount: 2,
    });
    const search = db.prepared.find((call) => call.sql.includes("FROM chunk_fts"));
    expect(search?.alls[0]).toEqual(["needle", "workspace-1", "build-2", "version-1", "version-2", 3]);
  });

  it("preserves an explicit empty SourceVersion scope without falling back to global search", () => {
    const db = new FakeKnowledgeDatabase();
    const api = new SearchQueryApi(db, new Fts5BaselineIndex(db));

    const result = api.query({
      knowledgeWorkspaceId: "workspace-1",
      query: "needle",
      allowedSourceVersionIds: [],
    });

    expect(result.hits).toEqual([]);
    expect(db.prepared.some((call) => call.sql.includes("FROM chunk_fts"))).toBe(false);
  });

  it("fails closed when no active published IndexBuild exists", () => {
    const db = new FakeKnowledgeDatabase();
    db.activeBuildRow = undefined;
    const api = new SearchQueryApi(db, new Fts5BaselineIndex(db));

    expect(() => api.query({ knowledgeWorkspaceId: "workspace-1", query: "needle" })).toThrow(
      /No active IndexBuild is published/,
    );
    expect(db.prepared.some((call) => call.sql.includes("FROM chunk_fts"))).toBe(false);
  });

  it("fails closed if metadata cannot prove the lexical hit still belongs to the requested Workspace/build/artifact", () => {
    const db = new FakeKnowledgeDatabase();
    db.searchRows = [
      {
        chunkId: "chunk-1",
        sourceVersionId: "version-1",
        parsedArtifactId: "artifact-1",
        text: "needle",
        rank: -1,
      },
    ];
    const api = new SearchQueryApi(db, new Fts5BaselineIndex(db));

    expect(() => api.query({ knowledgeWorkspaceId: "workspace-1", query: "needle" })).toThrow(
      /metadata is missing or inconsistent/,
    );
    const metadataLookup = db.prepared.find((call) => call.sql.includes("FROM chunks c"));
    expect(metadataLookup?.gets[0]).toEqual(["chunk-1", "build-2", "version-1", "artifact-1", "workspace-1"]);
  });

  it("rejects malformed limits, budgets and identity inputs before retrieval", () => {
    const db = new FakeKnowledgeDatabase();
    const resolver: SearchIndexBuildResolver = { resolve: () => "build-1" };
    const api = new SearchQueryApi(db, new Fts5BaselineIndex(db), resolver);

    expect(() => api.query({ knowledgeWorkspaceId: " ", query: "needle" })).toThrow(/knowledgeWorkspaceId/);
    expect(() => api.query({ knowledgeWorkspaceId: "workspace-1", query: " " })).toThrow(/query/);
    expect(() => api.query({ knowledgeWorkspaceId: "workspace-1", query: "needle", limit: 101 })).toThrow(/limit/);
    expect(() =>
      api.query({ knowledgeWorkspaceId: "workspace-1", query: "needle", budget: { maxResults: 0 } }),
    ).toThrow(/budget.maxResults/);
    expect(() =>
      api.query({ knowledgeWorkspaceId: "workspace-1", query: "needle", allowedSourceVersionIds: [" "] }),
    ).toThrow(/allowedSourceVersionId/);
  });
});
