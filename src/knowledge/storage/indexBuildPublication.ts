import { randomUUID } from "node:crypto";

import type { KnowledgeDatabase } from "./database.js";
import { withTransaction } from "./database.js";

export interface IndexBuildRecord {
  id: string;
  knowledgeWorkspaceId: string;
  strategy: string;
  status: string;
  baseGeneration: number;
  baseActiveBuildId: string | null;
  createdAt: string;
  validatedAt: string | null;
  publishedAt: string | null;
}

export interface IndexBuildPublisherOptions {
  now?: () => Date;
  createId?: () => string;
}

export class IndexBuildPublicationConflictError extends Error {}

export class IndexBuildPublisher {
  private readonly now: () => Date;
  private readonly createId: () => string;

  constructor(private readonly db: KnowledgeDatabase, options: IndexBuildPublisherOptions = {}) {
    this.now = options.now ?? (() => new Date());
    this.createId = options.createId ?? randomUUID;
  }

  createStaging(knowledgeWorkspaceId: string, strategy: string): IndexBuildRecord {
    const workspaceId = nonEmpty(knowledgeWorkspaceId, "knowledgeWorkspaceId");
    const normalizedStrategy = nonEmpty(strategy, "strategy");
    return withTransaction(this.db, () => {
      const workspace = workspaceState(this.db, workspaceId);
      const id = this.createId();
      const createdAt = this.now().toISOString();
      this.db.prepare(
        `INSERT INTO index_builds
         (id, knowledge_workspace_id, strategy, status, created_at, completed_at,
          base_generation, base_active_build_id, validated_at, published_at)
         VALUES (?, ?, ?, 'staging', ?, NULL, ?, ?, NULL, NULL)`,
      ).run(id, workspaceId, normalizedStrategy, createdAt, workspace.generation, workspace.activeBuildId);
      return this.get(id);
    });
  }

  markValidated(buildId: string): IndexBuildRecord {
    const id = nonEmpty(buildId, "buildId");
    const at = this.now().toISOString();
    const update = this.db.prepare(
      `UPDATE index_builds SET status='validated', validated_at=?
       WHERE id=? AND status='staging'`,
    ).run(at, id);
    one(update.changes, `IndexBuild ${id} cannot be validated from its current state`);
    return this.get(id);
  }

  publish(buildId: string): IndexBuildRecord {
    const id = nonEmpty(buildId, "buildId");
    return withTransaction(this.db, () => {
      const build = this.get(id);
      if (build.status !== "validated") throw new Error(`IndexBuild ${id} must be validated before publication`);
      const workspace = workspaceState(this.db, build.knowledgeWorkspaceId);
      if (workspace.generation !== build.baseGeneration || workspace.activeBuildId !== build.baseActiveBuildId) {
        throw new IndexBuildPublicationConflictError(`IndexBuild ${id} was built from a stale publication generation`);
      }

      const publishedAt = this.now().toISOString();
      const workspaceUpdate = this.db.prepare(
        `UPDATE knowledge_workspaces
         SET active_index_build_id=?, index_generation=index_generation+1
         WHERE id=? AND index_generation=?
           AND ((active_index_build_id IS NULL AND ? IS NULL) OR active_index_build_id=?)`,
      ).run(id, build.knowledgeWorkspaceId, build.baseGeneration, build.baseActiveBuildId, build.baseActiveBuildId);
      one(workspaceUpdate.changes, `IndexBuild ${id} publication lost compare-and-swap race`);

      const buildUpdate = this.db.prepare(
        `UPDATE index_builds SET status='active', completed_at=?, published_at=?
         WHERE id=? AND status='validated'`,
      ).run(publishedAt, publishedAt, id);
      one(buildUpdate.changes, `IndexBuild ${id} publication state changed concurrently`);

      if (build.baseActiveBuildId !== null) {
        this.db.prepare(
          `UPDATE index_builds SET status='retained'
           WHERE id=? AND knowledge_workspace_id=? AND status='active'`,
        ).run(build.baseActiveBuildId, build.knowledgeWorkspaceId);
      }
      return this.get(id);
    });
  }

  active(knowledgeWorkspaceId: string): IndexBuildRecord | null {
    const state = workspaceState(this.db, nonEmpty(knowledgeWorkspaceId, "knowledgeWorkspaceId"));
    return state.activeBuildId === null ? null : this.get(state.activeBuildId);
  }

  get(buildId: string): IndexBuildRecord {
    const id = nonEmpty(buildId, "buildId");
    const row = this.db.prepare(
      `SELECT id, knowledge_workspace_id, strategy, status, base_generation,
              base_active_build_id, created_at, validated_at, published_at
       FROM index_builds WHERE id=?`,
    ).get(id);
    if (row === undefined) throw new Error(`Unknown IndexBuild: ${id}`);
    return mapBuild(row);
  }
}

function workspaceState(db: KnowledgeDatabase, workspaceId: string): { generation: number; activeBuildId: string | null } {
  const raw = db.prepare(
    `SELECT index_generation, active_index_build_id FROM knowledge_workspaces WHERE id=?`,
  ).get(workspaceId);
  if (raw === undefined) throw new Error(`Unknown Knowledge Workspace: ${workspaceId}`);
  const row = recordValue(raw, "Knowledge Workspace index state");
  const generation = row["index_generation"];
  if (typeof generation !== "number" || !Number.isSafeInteger(generation) || generation < 0) {
    throw new Error("Workspace index generation is invalid");
  }
  const active = row["active_index_build_id"];
  if (active === null) return { generation, activeBuildId: null };
  if (typeof active !== "string" || active.length === 0) throw new Error("Workspace active IndexBuild is invalid");
  return { generation, activeBuildId: active };
}

function mapBuild(row: unknown): IndexBuildRecord {
  const r = recordValue(row, "IndexBuild row");
  return {
    id: str(r, "id"),
    knowledgeWorkspaceId: str(r, "knowledge_workspace_id"),
    strategy: str(r, "strategy"),
    status: str(r, "status"),
    baseGeneration: integer(r, "base_generation"),
    baseActiveBuildId: nullable(r, "base_active_build_id"),
    createdAt: str(r, "created_at"),
    validatedAt: nullable(r, "validated_at"),
    publishedAt: nullable(r, "published_at"),
  };
}

function nonEmpty(value: string, name: string): string {
  const normalized = value.trim();
  if (normalized.length === 0) throw new TypeError(`${name} must be non-empty`);
  return normalized;
}
function one(changes: number | bigint, message: string): void {
  if (Number(changes) !== 1) throw new IndexBuildPublicationConflictError(message);
}
function str(row: Record<string, unknown>, key: string): string {
  const value = row[key];
  if (typeof value !== "string" || value.length === 0) throw new Error(`${key} is invalid`);
  return value;
}
function nullable(row: Record<string, unknown>, key: string): string | null {
  const value = row[key];
  if (value === null) return null;
  if (typeof value !== "string" || value.length === 0) throw new Error(`${key} is invalid`);
  return value;
}
function integer(row: Record<string, unknown>, key: string): number {
  const value = row[key];
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) throw new Error(`${key} is invalid`);
  return value;
}
function recordValue(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be an object record`);
  }
  return Object.fromEntries(Object.entries(value));
}
