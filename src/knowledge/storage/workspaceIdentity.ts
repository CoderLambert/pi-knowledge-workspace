import { randomUUID } from "node:crypto";
import { realpathSync } from "node:fs";

import type { KnowledgeDatabase } from "./database.js";
import { withTransaction } from "./database.js";

export interface KnowledgeWorkspaceIdentity {
  installationId: string;
  knowledgeWorkspaceId: string;
  canonicalRealpath: string;
  externalBinding: string | null;
}

export interface ResolveWorkspaceIdentityInput {
  workspacePath: string;
  externalBinding?: string | null;
}

function nowIso(): string {
  return new Date().toISOString();
}

export function ensureInstallation(db: KnowledgeDatabase): string {
  const existing = db.prepare("SELECT id FROM installations ORDER BY created_at LIMIT 1").get() as
    | { id: string }
    | undefined;
  if (existing) return existing.id;

  const id = randomUUID();
  db.prepare("INSERT INTO installations (id, created_at) VALUES (?, ?)").run(id, nowIso());
  return id;
}

export function resolveKnowledgeWorkspaceIdentity(
  db: KnowledgeDatabase,
  input: ResolveWorkspaceIdentityInput,
): KnowledgeWorkspaceIdentity {
  const canonicalRealpath = realpathSync.native(input.workspacePath);

  return withTransaction(db, () => {
    const installationId = ensureInstallation(db);
    const existing = db
      .prepare(
        "SELECT id, external_binding FROM knowledge_workspaces WHERE installation_id = ? AND canonical_realpath = ?",
      )
      .get(installationId, canonicalRealpath) as { id: string; external_binding: string | null } | undefined;

    if (existing) {
      if (input.externalBinding !== undefined && input.externalBinding !== existing.external_binding) {
        db.prepare("UPDATE knowledge_workspaces SET external_binding = ? WHERE id = ?").run(
          input.externalBinding,
          existing.id,
        );
      }
      return {
        installationId,
        knowledgeWorkspaceId: existing.id,
        canonicalRealpath,
        externalBinding: input.externalBinding === undefined ? existing.external_binding : input.externalBinding,
      };
    }

    const knowledgeWorkspaceId = randomUUID();
    const externalBinding = input.externalBinding ?? null;
    db.prepare(
      "INSERT INTO knowledge_workspaces (id, installation_id, canonical_realpath, external_binding, created_at) VALUES (?, ?, ?, ?, ?)",
    ).run(knowledgeWorkspaceId, installationId, canonicalRealpath, externalBinding, nowIso());

    return { installationId, knowledgeWorkspaceId, canonicalRealpath, externalBinding };
  });
}
