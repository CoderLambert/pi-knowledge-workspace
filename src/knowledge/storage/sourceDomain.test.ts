import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import type { KnowledgeDatabase, SqliteStatement } from "./database.js";
import { ContentAddressedBlobStore } from "./blobStore.js";
import { SourceDomain } from "./sourceDomain.js";

interface SourceRow {
  id: string;
  knowledge_workspace_id: string;
  kind: string;
  display_name: string;
  archived_at: string | null;
  created_at: string;
}

interface VersionRow {
  id: string;
  source_id: string;
  content_sha256: string;
  blob_key: string;
  byte_length: number;
  created_at: string;
}

class SourceDatabase implements KnowledgeDatabase {
  readonly sources: SourceRow[] = [];
  readonly versions: VersionRow[] = [];
  exec(): void { /* no-op test database */ }
  close(): void { /* no-op test database */ }
  pragma(): unknown { return undefined; }

  prepare(sql: string): SqliteStatement {
    return {
      run: (...params: unknown[]) => this.run(sql, params),
      get: (...params: unknown[]) => this.get(sql, params),
      all: (...params: unknown[]) => this.all(sql, params),
    };
  }

  private run(sql: string, params: unknown[]): { changes: number; lastInsertRowid: number } {
    if (sql.includes("INSERT INTO sources")) {
      this.sources.push({
        id: String(params[0]),
        knowledge_workspace_id: String(params[1]),
        kind: String(params[2]),
        display_name: String(params[3]),
        archived_at: null,
        created_at: String(params[4]),
      });
      return changed();
    }
    if (sql.startsWith("UPDATE sources SET display_name")) {
      const row = this.sources.find((source) => source.id === params[1]);
      if (!row) return unchanged();
      row.display_name = String(params[0]);
      return changed();
    }
    if (sql.startsWith("UPDATE sources SET archived_at")) {
      const row = this.sources.find((source) => source.id === params[1]);
      if (!row) return unchanged();
      row.archived_at ??= String(params[0]);
      return changed();
    }
    if (sql.includes("INSERT INTO source_versions")) {
      const duplicate = this.versions.find(
        (version) => version.source_id === params[1] && version.content_sha256 === params[2],
      );
      if (duplicate) throw new Error("UNIQUE constraint failed");
      this.versions.push({
        id: String(params[0]),
        source_id: String(params[1]),
        content_sha256: String(params[2]),
        blob_key: String(params[3]),
        byte_length: Number(params[4]),
        created_at: String(params[5]),
      });
      return changed();
    }
    throw new Error(`unexpected run SQL: ${sql}`);
  }

  private get(sql: string, params: unknown[]): unknown {
    if (sql.includes("FROM sources WHERE id = ?")) {
      return this.sources.find((source) => source.id === params[0]);
    }
    if (sql.includes("FROM source_versions WHERE source_id = ? AND content_sha256 = ?")) {
      return this.versions.find(
        (version) => version.source_id === params[0] && version.content_sha256 === params[1],
      );
    }
    throw new Error(`unexpected get SQL: ${sql}`);
  }

  private all(sql: string, params: unknown[]): unknown[] {
    if (sql.includes("FROM source_versions WHERE source_id = ?")) {
      return this.versions.filter((version) => version.source_id === params[0]);
    }
    if (sql.includes("FROM sources")) {
      return this.sources.filter(
        (source) =>
          source.knowledge_workspace_id === params[0] &&
          (sql.includes("archived_at IS NULL") ? source.archived_at === null : true),
      );
    }
    throw new Error(`unexpected all SQL: ${sql}`);
  }
}

function changed() { return { changes: 1, lastInsertRowid: 0 }; }
function unchanged() { return { changes: 0, lastInsertRowid: 0 }; }

const tempRoots: string[] = [];
afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

async function fixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), "pi-knowledge-source-domain-"));
  tempRoots.push(root);
  const db = new SourceDatabase();
  let id = 0;
  let time = 0;
  const domain = new SourceDomain(db, new ContentAddressedBlobStore(root), {
    createId: () => `id-${String(++id)}`,
    now: () => new Date(Date.UTC(2026, 8, 9, 0, 0, time++)),
  });
  return { db, domain };
}

describe("SourceDomain", () => {
  it("creates, lists, renames and archives Sources without creating SourceVersions", async () => {
    const { db, domain } = await fixture();
    const source = domain.createSource({
      knowledgeWorkspaceId: "workspace-1",
      kind: "workspace-file",
      displayName: "README.md",
    });

    expect(domain.listSources("workspace-1")).toEqual([source]);
    expect(domain.renameSource(source.id, "Guide.md").displayName).toBe("Guide.md");
    expect(db.versions).toHaveLength(0);

    const archived = domain.archiveSource(source.id);
    expect(archived.archivedAt).not.toBeNull();
    expect(domain.listSources("workspace-1")).toEqual([]);
    expect(domain.listSources("workspace-1", { includeArchived: true })).toHaveLength(1);
    expect(db.versions).toHaveLength(0);
  });

  it("captures one immutable SourceVersion for raw bytes and deduplicates identical recaptures", async () => {
    const { domain } = await fixture();
    const source = domain.createSource({ knowledgeWorkspaceId: "workspace-1", kind: "manual", displayName: "notes" });
    const bytes = Buffer.from("same bytes 中文\n");

    const first = await domain.captureSourceVersion(source.id, bytes);
    const same = await domain.manualUpdate(source.id, bytes);

    expect(same).toEqual(first);
    expect(first.contentSha256).toBe(ContentAddressedBlobStore.sha256(bytes));
    expect(first.blobKey).toBe(first.contentSha256);
    expect(first.byteLength).toBe(bytes.byteLength);
    expect(domain.listSourceVersions(source.id)).toEqual([first]);
  });

  it("creates a new SourceVersion only when raw bytes change", async () => {
    const { domain } = await fixture();
    const source = domain.createSource({ knowledgeWorkspaceId: "workspace-1", kind: "manual", displayName: "notes" });

    const v1 = await domain.captureSourceVersion(source.id, Buffer.from("alpha"));
    domain.renameSource(source.id, "renamed metadata only");
    const stillV1 = await domain.captureSourceVersion(source.id, Buffer.from("alpha"));
    const v2 = await domain.manualUpdate(source.id, Buffer.from("alpha\n"));

    expect(stillV1.id).toBe(v1.id);
    expect(v2.id).not.toBe(v1.id);
    expect(domain.listSourceVersions(source.id).map((version) => version.id)).toEqual([v1.id, v2.id]);
  });

  it("rejects captures for unknown Sources", async () => {
    const { domain } = await fixture();
    await expect(domain.captureSourceVersion("missing", Buffer.from("data"))).rejects.toThrow("Unknown Source");
  });

  it("keeps Sources isolated by Knowledge Workspace when listing", async () => {
    const { domain } = await fixture();
    domain.createSource({ knowledgeWorkspaceId: "workspace-a", kind: "manual", displayName: "A" });
    domain.createSource({ knowledgeWorkspaceId: "workspace-b", kind: "manual", displayName: "B" });

    expect(domain.listSources("workspace-a").map((source) => source.displayName)).toEqual(["A"]);
    expect(domain.listSources("workspace-b").map((source) => source.displayName)).toEqual(["B"]);
  });
});
