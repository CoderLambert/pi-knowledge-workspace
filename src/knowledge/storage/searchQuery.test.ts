import { describe, expect, it } from "vitest";

import type { KnowledgeDatabase, SqliteStatement } from "./database.js";
import { Fts5BaselineIndex } from "./fts5Index.js";
import type { ActiveIndexBuildLease } from "./indexBuildRetention.js";
import { SearchQueryApi, type SearchIndexBuildResolver } from "./searchQuery.js";

interface PreparedCall {
  sql: string;
  gets: unknown[][];
  alls: unknown[][];
}

class FakeKnowledgeDatabase implements KnowledgeDatabase {
  readonly prepared: PreparedCall[] = [];
  searchRows: unknown[] = [];
  metadataRows = new Map<string, unknown>();
  exec(): void { /* no-op test database */ }
  prepare(sql: string): SqliteStatement {
    const call: PreparedCall = { sql, gets: [], alls: [] };
    this.prepared.push(call);
    return {
      run: () => ({ changes: 1, lastInsertRowid: 1 }),
      get: (...params: unknown[]) => {
        call.gets.push(params);
        if (sql.includes("FROM chunks c")) return this.metadataRows.get(String(params[0]));
        return undefined;
      },
      all: (...params: unknown[]) => {
        call.alls.push(params);
        return sql.includes("FROM chunk_fts") ? this.searchRows : [];
      },
    };
  }
  pragma(): unknown { return undefined; }
  close(): void { /* no-op test database */ }
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

function leasedResolver(buildId = "build-2") {
  let releases = 0;
  const resolver: SearchIndexBuildResolver = {
    acquire: () => ({
      indexBuildId: buildId,
      pin: {
        id: "pin-1", indexBuildId: buildId, ownerType: "query", ownerId: "q-1",
        leaseExpiresAt: "2026-09-09T06:01:00.000Z", createdAt: "2026-09-09T06:00:00.000Z", updatedAt: "2026-09-09T06:00:00.000Z",
      },
      release: () => { releases += 1; },
    } satisfies ActiveIndexBuildLease),
  };
  return { resolver, releases: () => releases };
}

describe("search.query baseline", () => {
  it("uses a leased IndexBuild and releases it after returning stable source/locator metadata", () => {
    const db = new FakeKnowledgeDatabase();
    db.searchRows = [{ chunkId: "chunk-1", sourceVersionId: "version-1", parsedArtifactId: "artifact-1", text: "stable evidence", rank: -2.5 }];
    db.metadataRows.set("chunk-1", metadata("chunk-1"));
    const leased = leasedResolver();
    const api = new SearchQueryApi(db, new Fts5BaselineIndex(db), leased.resolver);

    const first = api.query({ knowledgeWorkspaceId: "workspace-1", query: " evidence ", limit: 5 });
    const second = api.query({ knowledgeWorkspaceId: "workspace-1", query: "evidence", limit: 5 });

    expect(first.queryHandle).toMatch(/^search_query_[0-9a-f]{64}$/);
    expect(first.runHandle).toMatch(/^search_run_[0-9a-f]{64}$/);
    expect(second.queryHandle).toBe(first.queryHandle);
    expect(second.runHandle).toBe(first.runHandle);
    expect(first.indexBuildId).toBe("build-2");
    expect(first.hits[0]).toMatchObject({
      chunkId: "chunk-1", sourceVersionId: "version-1", snippet: "stable evidence",
      locator: { parsedArtifactId: "artifact-1", startByte: 20, endByte: 32 }, rank: -2.5, ordinal: 3,
    });
    expect(leased.releases()).toBe(2);
  });

  it("compiles natural-language punctuation and FTS operators as quoted literal OR terms", () => {
    const db = new FakeKnowledgeDatabase();
    const api = new SearchQueryApi(db, new Fts5BaselineIndex(db), leasedResolver().resolver);

    api.query({
      knowledgeWorkspaceId: "workspace-1",
      query: "Node.js `fsPromises.cp` ref's .value AND OR NOT what?",
      limit: 10,
    });

    const search = db.prepared.find((call) => call.sql.includes("FROM chunk_fts"));
    expect(search?.alls[0]?.[0]).toBe(
      '"Node.js" OR "`fsPromises.cp`" OR "ref\'s" OR ".value" OR "AND" OR "OR" OR "NOT" OR "what?"',
    );
  });

  it("applies allowed SourceVersion scope and result budget before invoking FTS Top-K", () => {
    const db = new FakeKnowledgeDatabase();
    const api = new SearchQueryApi(db, new Fts5BaselineIndex(db), leasedResolver().resolver);
    const result = api.query({
      knowledgeWorkspaceId: "workspace-1", query: "needle",
      allowedSourceVersionIds: ["version-2", "version-1", "version-2"], limit: 10, budget: { maxResults: 3 },
    });
    expect(result.debug).toEqual({ backend: "fts5", requestedLimit: 10, effectiveLimit: 3, allowedSourceVersionCount: 2 });
    const search = db.prepared.find((call) => call.sql.includes("FROM chunk_fts"));
    expect(search?.alls[0]).toEqual(['"needle"', "workspace-1", "build-2", "version-1", "version-2", 3]);
  });

  it("preserves an explicit empty SourceVersion scope without global fallback", () => {
    const db = new FakeKnowledgeDatabase();
    const api = new SearchQueryApi(db, new Fts5BaselineIndex(db), leasedResolver().resolver);
    const result = api.query({ knowledgeWorkspaceId: "workspace-1", query: "needle", allowedSourceVersionIds: [] });
    expect(result.hits).toEqual([]);
    expect(db.prepared.some((call) => call.sql.includes("FROM chunk_fts"))).toBe(false);
  });

  it("releases the IndexBuild lease when metadata validation fails", () => {
    const db = new FakeKnowledgeDatabase();
    db.searchRows = [{ chunkId: "chunk-1", sourceVersionId: "version-1", parsedArtifactId: "artifact-1", text: "needle", rank: -1 }];
    const leased = leasedResolver();
    const api = new SearchQueryApi(db, new Fts5BaselineIndex(db), leased.resolver);
    expect(() => api.query({ knowledgeWorkspaceId: "workspace-1", query: "needle" })).toThrow(/metadata is missing or inconsistent/);
    expect(leased.releases()).toBe(1);
  });

  it("rejects malformed limits, budgets and identity inputs before acquiring a lease", () => {
    const db = new FakeKnowledgeDatabase();
    let acquires = 0;
    const resolver: SearchIndexBuildResolver = {
      acquire: () => { acquires += 1; return leasedResolver("build-1").resolver.acquire("workspace-1"); },
    };
    const api = new SearchQueryApi(db, new Fts5BaselineIndex(db), resolver);

    expect(() => api.query({ knowledgeWorkspaceId: " ", query: "needle" })).toThrow(/knowledgeWorkspaceId/);
    expect(() => api.query({ knowledgeWorkspaceId: "workspace-1", query: " " })).toThrow(/query/);
    expect(() => api.query({ knowledgeWorkspaceId: "workspace-1", query: "needle", limit: 101 })).toThrow(/limit/);
    expect(() => api.query({ knowledgeWorkspaceId: "workspace-1", query: "needle", budget: { maxResults: 0 } })).toThrow(/budget.maxResults/);
    expect(() => api.query({ knowledgeWorkspaceId: "workspace-1", query: "needle", allowedSourceVersionIds: [" "] })).toThrow(/allowedSourceVersionId/);
    expect(acquires).toBe(0);
  });
});
