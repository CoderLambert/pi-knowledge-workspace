import { randomUUID } from "node:crypto";

import type { KnowledgeDatabase } from "./database.js";
import { withTransaction } from "./database.js";

export interface IndexBuildPin {
  id: string;
  indexBuildId: string;
  ownerType: string;
  ownerId: string;
  leaseExpiresAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface IndexBuildRetentionOptions {
  now?: () => Date;
  createId?: () => string;
}

export interface ActiveIndexBuildLease {
  readonly pin: IndexBuildPin;
  readonly indexBuildId: string;
  release(): void;
}

const MAX_LEASE_MS = 60 * 60 * 1000;

export class IndexBuildRetention {
  private readonly now: () => Date;
  private readonly createId: () => string;

  constructor(private readonly db: KnowledgeDatabase, options: IndexBuildRetentionOptions = {}) {
    this.now = options.now ?? (() => new Date());
    this.createId = options.createId ?? randomUUID;
  }

  acquireActiveLease(
    knowledgeWorkspaceId: string,
    ownerType: string,
    ownerId: string,
    leaseMs: number,
  ): ActiveIndexBuildLease {
    const workspaceId = nonEmpty(knowledgeWorkspaceId, "knowledgeWorkspaceId");
    const type = nonEmpty(ownerType, "ownerType");
    const owner = nonEmpty(ownerId, "ownerId");
    const duration = leaseDuration(leaseMs);

    const pin = withTransaction(this.db, () => {
      const row = this.db.prepare(`
SELECT ib.id
FROM knowledge_workspaces kw
JOIN index_builds ib ON ib.id = kw.active_index_build_id
WHERE kw.id=?
  AND ib.knowledge_workspace_id=kw.id
  AND ib.status='active'
  AND ib.published_at IS NOT NULL
LIMIT 1
`).get(workspaceId);
      const buildId = rowId(row, "active IndexBuild");
      return this.pin(buildId, type, owner, duration);
    });

    let released = false;
    return {
      pin,
      indexBuildId: pin.indexBuildId,
      release: () => {
        if (released) return;
        released = true;
        this.release(pin.id);
      },
    };
  }

  pin(indexBuildId: string, ownerType: string, ownerId: string, leaseMs?: number): IndexBuildPin {
    const buildId = nonEmpty(indexBuildId, "indexBuildId");
    const type = nonEmpty(ownerType, "ownerType");
    const owner = nonEmpty(ownerId, "ownerId");
    const nowDate = this.now();
    const now = nowDate.toISOString();
    const leaseExpiresAt = leaseMs === undefined
      ? null
      : new Date(nowDate.getTime() + leaseDuration(leaseMs)).toISOString();
    const existing = this.find(buildId, type, owner);
    if (existing !== null) return existing;

    const id = this.createId();
    try {
      this.db.prepare(
        `INSERT INTO index_build_pins
         (id, index_build_id, owner_type, owner_id, lease_expires_at, created_at, updated_at)
         SELECT ?, ?, ?, ?, ?, ?, ?
         WHERE EXISTS (SELECT 1 FROM index_builds WHERE id=?)`,
      ).run(id, buildId, type, owner, leaseExpiresAt, now, now, buildId);
      const created = this.find(buildId, type, owner);
      if (created === null) throw new Error(`Unknown IndexBuild: ${buildId}`);
      return created;
    } catch (error) {
      const raced = this.find(buildId, type, owner);
      if (raced !== null) return raced;
      throw error;
    }
  }

  renew(pinId: string, leaseMs: number): IndexBuildPin {
    const id = nonEmpty(pinId, "pinId");
    const duration = leaseDuration(leaseMs);
    const nowDate = this.now();
    const now = nowDate.toISOString();
    const expires = new Date(nowDate.getTime() + duration).toISOString();
    const result = this.db.prepare(
      `UPDATE index_build_pins SET lease_expires_at=?, updated_at=?
       WHERE id=? AND lease_expires_at IS NOT NULL AND lease_expires_at>?`,
    ).run(expires, now, id, now);
    if (Number(result.changes) !== 1) throw new Error(`IndexBuild pin ${id} is missing, durable, or expired`);
    return this.get(id);
  }

  release(pinId: string): void {
    const id = nonEmpty(pinId, "pinId");
    this.db.prepare(`DELETE FROM index_build_pins WHERE id=?`).run(id);
  }

  cleanupExpiredPins(limit = 100): number {
    const bounded = boundedLimit(limit);
    const now = this.now().toISOString();
    const rows = this.db.prepare(
      `SELECT id FROM index_build_pins
       WHERE lease_expires_at IS NOT NULL AND lease_expires_at<=?
       ORDER BY lease_expires_at ASC, id ASC LIMIT ?`,
    ).all(now, bounded);
    let removed = 0;
    for (const row of rows) {
      const id = rowId(row, "expired pin");
      removed += Number(this.db.prepare(
        `DELETE FROM index_build_pins WHERE id=? AND lease_expires_at IS NOT NULL AND lease_expires_at<=?`,
      ).run(id, now).changes);
    }
    return removed;
  }

  gcRetained(knowledgeWorkspaceId: string, limit = 20): string[] {
    const workspaceId = nonEmpty(knowledgeWorkspaceId, "knowledgeWorkspaceId");
    const bounded = boundedLimit(limit);
    const now = this.now().toISOString();
    return withTransaction(this.db, () => {
      const rows = this.db.prepare(`
SELECT ib.id
FROM index_builds ib
JOIN knowledge_workspaces kw ON kw.id=ib.knowledge_workspace_id
WHERE ib.knowledge_workspace_id=?
  AND ib.status='retained'
  AND (kw.active_index_build_id IS NULL OR kw.active_index_build_id<>ib.id)
  AND NOT EXISTS (
    SELECT 1 FROM index_build_pins p
    WHERE p.index_build_id=ib.id
      AND (p.lease_expires_at IS NULL OR p.lease_expires_at>?)
  )
ORDER BY ib.published_at ASC, ib.created_at ASC, ib.id ASC
LIMIT ?
`).all(workspaceId, now, bounded);

      const deleted: string[] = [];
      for (const row of rows) {
        const buildId = rowId(row, "GC candidate");
        // Re-check pin/active state in each destructive statement. This keeps GC
        // fail-closed even if the candidate-selection query changes later.
        const eligible = this.db.prepare(`
SELECT 1 AS eligible
FROM index_builds ib
JOIN knowledge_workspaces kw ON kw.id=ib.knowledge_workspace_id
WHERE ib.id=? AND ib.knowledge_workspace_id=? AND ib.status='retained'
  AND (kw.active_index_build_id IS NULL OR kw.active_index_build_id<>ib.id)
  AND NOT EXISTS (
    SELECT 1 FROM index_build_pins p
    WHERE p.index_build_id=ib.id
      AND (p.lease_expires_at IS NULL OR p.lease_expires_at>?)
  )
`).get(buildId, workspaceId, now);
        if (eligible === undefined) continue;

        this.db.prepare(`DELETE FROM chunk_fts WHERE index_build_id=?`).run(buildId);
        this.db.prepare(`DELETE FROM chunks WHERE index_build_id=?`).run(buildId);
        const result = this.db.prepare(
          `DELETE FROM index_builds
           WHERE id=? AND knowledge_workspace_id=? AND status='retained'
             AND NOT EXISTS (
               SELECT 1 FROM index_build_pins p
               WHERE p.index_build_id=index_builds.id
                 AND (p.lease_expires_at IS NULL OR p.lease_expires_at>?)
             )`,
        ).run(buildId, workspaceId, now);
        if (Number(result.changes) === 1) deleted.push(buildId);
      }
      return deleted;
    });
  }

  get(pinId: string): IndexBuildPin {
    const id = nonEmpty(pinId, "pinId");
    const row = this.db.prepare(
      `SELECT id, index_build_id, owner_type, owner_id, lease_expires_at, created_at, updated_at
       FROM index_build_pins WHERE id=?`,
    ).get(id);
    if (row === undefined) throw new Error(`Unknown IndexBuild pin: ${id}`);
    return mapPin(row);
  }

  private find(buildId: string, ownerType: string, ownerId: string): IndexBuildPin | null {
    const row = this.db.prepare(
      `SELECT id, index_build_id, owner_type, owner_id, lease_expires_at, created_at, updated_at
       FROM index_build_pins WHERE index_build_id=? AND owner_type=? AND owner_id=?`,
    ).get(buildId, ownerType, ownerId);
    return row === undefined ? null : mapPin(row);
  }
}

function mapPin(row: unknown): IndexBuildPin {
  const r = recordValue(row, "IndexBuild pin row");
  return {
    id: str(r, "id"),
    indexBuildId: str(r, "index_build_id"),
    ownerType: str(r, "owner_type"),
    ownerId: str(r, "owner_id"),
    leaseExpiresAt: nullable(r, "lease_expires_at"),
    createdAt: str(r, "created_at"),
    updatedAt: str(r, "updated_at"),
  };
}
function nonEmpty(value: string, name: string): string {
  const v = value.trim();
  if (v.length === 0) throw new TypeError(`${name} must be non-empty`);
  return v;
}
function leaseDuration(value: number): number {
  if (!Number.isSafeInteger(value) || value <= 0 || value > MAX_LEASE_MS) throw new TypeError("leaseMs is invalid");
  return value;
}
function boundedLimit(value: number): number {
  if (!Number.isSafeInteger(value) || value <= 0 || value > 1_000) throw new TypeError("limit is invalid");
  return value;
}
function str(row: Record<string, unknown>, key: string): string {
  const v = row[key];
  if (typeof v !== "string" || v.length === 0) throw new Error(`${key} is invalid`);
  return v;
}
function nullable(row: Record<string, unknown>, key: string): string | null {
  const v = row[key];
  if (v === null) return null;
  if (typeof v !== "string" || v.length === 0) throw new Error(`${key} is invalid`);
  return v;
}
function rowId(value: unknown, label: string): string {
  const row = recordValue(value, label);
  const id = row["id"];
  if (typeof id !== "string" || id.length === 0) throw new Error(`${label} id is invalid`);
  return id;
}
function recordValue(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be an object record`);
  }
  return Object.fromEntries(Object.entries(value));
}
