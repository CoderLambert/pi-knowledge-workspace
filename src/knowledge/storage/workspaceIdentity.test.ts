import { mkdtempSync, mkdirSync, realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import type { KnowledgeDatabase, SqliteStatement } from "./database.js";
import { resolveKnowledgeWorkspaceIdentity } from "./workspaceIdentity.js";

class IdentityDatabase implements KnowledgeDatabase {
  installation: { id: string; created_at: string } | undefined;
  workspaces: Array<{ id: string; installation_id: string; canonical_realpath: string; external_binding: string | null }> = [];
  exec(): void {}
  close(): void {}
  pragma(): unknown { return undefined; }
  prepare(sql: string): SqliteStatement {
    return {
      get: (...params: unknown[]) => {
        if (sql.startsWith("SELECT id FROM installations")) return this.installation;
        if (sql.startsWith("SELECT id, external_binding FROM knowledge_workspaces")) {
          const [installationId, path] = params;
          const row = this.workspaces.find((item) => item.installation_id === installationId && item.canonical_realpath === path);
          return row ? { id: row.id, external_binding: row.external_binding } : undefined;
        }
        throw new Error(`unexpected get SQL: ${sql}`);
      },
      run: (...params: unknown[]) => {
        if (sql.startsWith("INSERT INTO installations")) {
          this.installation = { id: String(params[0]), created_at: String(params[1]) };
        } else if (sql.startsWith("INSERT INTO knowledge_workspaces")) {
          this.workspaces.push({ id: String(params[0]), installation_id: String(params[1]), canonical_realpath: String(params[2]), external_binding: params[3] as string | null });
        } else if (sql.startsWith("UPDATE knowledge_workspaces")) {
          const row = this.workspaces.find((item) => item.id === params[1]);
          if (row) row.external_binding = params[0] as string | null;
        } else throw new Error(`unexpected run SQL: ${sql}`);
        return { changes: 1, lastInsertRowid: 0 };
      },
      all: () => [],
    };
  }
}

function workspace(name: string): string {
  const root = mkdtempSync(join(tmpdir(), "pi-knowledge-identity-"));
  const path = join(root, name);
  mkdirSync(path);
  return path;
}

describe("Knowledge workspace identity", () => {
  it("keeps one durable installation and stable identity for the same realpath", () => {
    const db = new IdentityDatabase();
    const path = workspace("repo");
    const first = resolveKnowledgeWorkspaceIdentity(db, { workspacePath: path, externalBinding: "pi:web:a" });
    const second = resolveKnowledgeWorkspaceIdentity(db, { workspacePath: path });
    expect(second.installationId).toBe(first.installationId);
    expect(second.knowledgeWorkspaceId).toBe(first.knowledgeWorkspaceId);
    expect(second.canonicalRealpath).toBe(realpathSync.native(path));
    expect(second.externalBinding).toBe("pi:web:a");
  });

  it("isolates different worktree realpaths", () => {
    const db = new IdentityDatabase();
    const a = resolveKnowledgeWorkspaceIdentity(db, { workspacePath: workspace("worktree-a") });
    const b = resolveKnowledgeWorkspaceIdentity(db, { workspacePath: workspace("worktree-b") });
    expect(b.installationId).toBe(a.installationId);
    expect(b.knowledgeWorkspaceId).not.toBe(a.knowledgeWorkspaceId);
    expect(b.canonicalRealpath).not.toBe(a.canonicalRealpath);
  });

  it("allows routing metadata to change without changing Knowledge identity", () => {
    const db = new IdentityDatabase();
    const path = workspace("repo");
    const first = resolveKnowledgeWorkspaceIdentity(db, { workspacePath: path, externalBinding: "machine:a/workspace:1" });
    const rebound = resolveKnowledgeWorkspaceIdentity(db, { workspacePath: path, externalBinding: "machine:b/workspace:9" });
    expect(rebound.knowledgeWorkspaceId).toBe(first.knowledgeWorkspaceId);
    expect(rebound.externalBinding).toBe("machine:b/workspace:9");
  });
});
