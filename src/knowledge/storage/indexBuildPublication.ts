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
  basePublicationId: string | null;
  retrievalConfigRevision: string;
  createdAt: string;
  validatedAt: string | null;
  publishedAt: string | null;
}

export interface IndexBuildPublisherOptions {
  now?: () => Date;
  createId?: () => string;
  createPublicationId?: () => string;
}

export interface IndexBuildCandidateOptions {
  retrievalConfigRevision?: string;
  expectedBase?: {
    generation: number;
    publicationId: string | null;
  };
}

export class IndexBuildPublicationConflictError extends Error {}

export class IndexBuildPublisher {
  private readonly now: () => Date;
  private readonly createId: () => string;
  private readonly createPublicationId: () => string;

  constructor(private readonly db: KnowledgeDatabase, options: IndexBuildPublisherOptions = {}) {
    this.now = options.now ?? (() => new Date());
    this.createId = options.createId ?? randomUUID;
    this.createPublicationId = options.createPublicationId ?? randomUUID;
  }

  createStaging(
    knowledgeWorkspaceId: string,
    strategy: string,
    options: IndexBuildCandidateOptions = {},
  ): IndexBuildRecord {
    const workspaceId = nonEmpty(knowledgeWorkspaceId, "knowledgeWorkspaceId");
    const normalizedStrategy = nonEmpty(strategy, "strategy");
    const retrievalConfigRevision = nonEmpty(
      options.retrievalConfigRevision ?? "fts5-baseline-v1",
      "retrievalConfigRevision",
    );
    return withTransaction(this.db, () => {
      const workspace = workspaceState(this.db, workspaceId);
      if (
        options.expectedBase !== undefined
        && (
          workspace.generation !== options.expectedBase.generation
          || workspace.activePublicationId !== options.expectedBase.publicationId
        )
      ) {
        throw new IndexBuildPublicationConflictError(
          "Knowledge candidate was composed from a stale publication generation",
        );
      }
      const id = this.createId();
      const createdAt = this.now().toISOString();
      this.db.prepare(
        `INSERT INTO index_builds
         (id, knowledge_workspace_id, strategy, status, created_at, completed_at,
          base_generation, base_active_build_id, base_publication_id,
          retrieval_config_revision, validated_at, published_at)
         VALUES (?, ?, ?, 'staging', ?, NULL, ?, ?, ?, ?, NULL, NULL)`,
      ).run(
        id,
        workspaceId,
        normalizedStrategy,
        createdAt,
        workspace.generation,
        workspace.activeBuildId,
        workspace.activePublicationId,
        retrievalConfigRevision,
      );
      return this.get(id);
    });
  }

  markValidated(buildId: string): IndexBuildRecord {
    const id = nonEmpty(buildId, "buildId");
    const at = this.now().toISOString();
    const update = this.db.prepare(
      `UPDATE index_builds SET status='validated', validated_at=?
       WHERE id=? AND status='staging'
         AND EXISTS (
           SELECT 1 FROM index_build_selections selection
           WHERE selection.index_build_id=index_builds.id
         )
         AND NOT EXISTS (
           SELECT 1
           FROM index_build_selections selection
           JOIN source_versions version ON version.id=selection.source_version_id
           JOIN sources source ON source.id=selection.source_id
           JOIN parsed_artifacts artifact ON artifact.id=selection.parsed_artifact_id
           WHERE selection.index_build_id=index_builds.id
             AND (
               version.source_id<>selection.source_id
               OR artifact.source_version_id<>selection.source_version_id
               OR source.knowledge_workspace_id<>index_builds.knowledge_workspace_id
             )
         )
         AND NOT EXISTS (
           SELECT 1
           FROM index_build_selections selection
           WHERE selection.index_build_id=index_builds.id
             AND NOT EXISTS (
               SELECT 1 FROM chunks chunk
               WHERE chunk.index_build_id=selection.index_build_id
                 AND chunk.source_version_id=selection.source_version_id
                 AND chunk.parsed_artifact_id=selection.parsed_artifact_id
             )
             AND NOT EXISTS (
               SELECT 1 FROM parsed_artifacts artifact
               WHERE artifact.id=selection.parsed_artifact_id
                 AND artifact.canonical_bytes IS NOT NULL
                 AND length(artifact.canonical_bytes)=0
             )
         )
         AND NOT EXISTS (
           SELECT 1
           FROM chunks chunk
           JOIN source_versions sv ON sv.id=chunk.source_version_id
           WHERE chunk.index_build_id=index_builds.id
             AND NOT EXISTS (
               SELECT 1 FROM index_build_selections selection
               WHERE selection.index_build_id=chunk.index_build_id
                 AND selection.source_id=sv.source_id
                 AND selection.source_version_id=chunk.source_version_id
                 AND selection.parsed_artifact_id=chunk.parsed_artifact_id
             )
         )`,
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
      if (
        workspace.generation !== build.baseGeneration
        || workspace.activeBuildId !== build.baseActiveBuildId
        || workspace.activePublicationId !== build.basePublicationId
      ) {
        throw new IndexBuildPublicationConflictError(`IndexBuild ${id} was built from a stale publication generation`);
      }

      const publishedAt = this.now().toISOString();
      const publicationId = nonEmpty(this.createPublicationId(), "publicationId");
      const nextGeneration = build.baseGeneration + 1;
      if (!Number.isSafeInteger(nextGeneration)) {
        throw new IndexBuildPublicationConflictError("Knowledge publication generation is exhausted");
      }
      this.db.prepare(
        `INSERT INTO knowledge_publications
         (id, knowledge_workspace_id, generation, index_build_id, retrieval_config_revision, published_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      ).run(
        publicationId,
        build.knowledgeWorkspaceId,
        nextGeneration,
        id,
        build.retrievalConfigRevision,
        publishedAt,
      );
      const selectionInsert = this.db.prepare(
        `INSERT INTO knowledge_publication_selections
         (publication_id, source_id, source_version_id, parsed_artifact_id)
         SELECT ?, source_id, source_version_id, parsed_artifact_id
         FROM index_build_selections
         WHERE index_build_id=?`,
      ).run(publicationId, id);
      one(selectionInsert.changes, `IndexBuild ${id} has no complete canonical selection`, false);

      const workspaceUpdate = this.db.prepare(
        `UPDATE knowledge_workspaces
         SET active_index_build_id=?, active_knowledge_publication_id=?, index_generation=index_generation+1
         WHERE id=? AND index_generation=?
           AND ((active_index_build_id IS NULL AND ? IS NULL) OR active_index_build_id=?)
           AND ((active_knowledge_publication_id IS NULL AND ? IS NULL) OR active_knowledge_publication_id=?)`,
      ).run(
        id,
        publicationId,
        build.knowledgeWorkspaceId,
        build.baseGeneration,
        build.baseActiveBuildId,
        build.baseActiveBuildId,
        build.basePublicationId,
        build.basePublicationId,
      );
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
              base_active_build_id, base_publication_id, retrieval_config_revision,
              created_at, validated_at, published_at
       FROM index_builds WHERE id=?`,
    ).get(id);
    if (row === undefined) throw new Error(`Unknown IndexBuild: ${id}`);
    return mapBuild(row);
  }
}

function workspaceState(db: KnowledgeDatabase, workspaceId: string): {
  generation: number;
  activeBuildId: string | null;
  activePublicationId: string | null;
} {
  const raw = db.prepare(
    `SELECT index_generation, active_index_build_id, active_knowledge_publication_id
     FROM knowledge_workspaces WHERE id=?`,
  ).get(workspaceId);
  if (raw === undefined) throw new Error(`Unknown Knowledge Workspace: ${workspaceId}`);
  const row = recordValue(raw, "Knowledge Workspace index state");
  const generation = row["index_generation"];
  if (typeof generation !== "number" || !Number.isSafeInteger(generation) || generation < 0) {
    throw new Error("Workspace index generation is invalid");
  }
  const active = row["active_index_build_id"];
  const activePublication = row["active_knowledge_publication_id"];
  const activePublicationId = nullableValue(activePublication, "Workspace active Knowledge publication");
  if (active === null) {
    if (activePublicationId !== null || generation !== 0) {
      throw new Error("Workspace Knowledge publication state is inconsistent");
    }
    return { generation, activeBuildId: null, activePublicationId };
  }
  if (typeof active !== "string" || active.length === 0) throw new Error("Workspace active IndexBuild is invalid");
  if (activePublicationId === null || generation === 0) {
    throw new Error("Workspace Knowledge publication state is inconsistent");
  }
  return { generation, activeBuildId: active, activePublicationId };
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
    basePublicationId: nullable(r, "base_publication_id"),
    retrievalConfigRevision: str(r, "retrieval_config_revision"),
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
function one(changes: number | bigint, message: string, exactlyOne = true): void {
  const count = Number(changes);
  if ((exactlyOne && count !== 1) || (!exactlyOne && count < 1)) {
    throw new IndexBuildPublicationConflictError(message);
  }
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
function nullableValue(value: unknown, label: string): string | null {
  if (value === null) return null;
  if (typeof value !== "string" || value.length === 0) throw new Error(`${label} is invalid`);
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
