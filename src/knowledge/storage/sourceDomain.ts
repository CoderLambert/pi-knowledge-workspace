import { randomUUID } from "node:crypto";

import type { KnowledgeDatabase } from "./database.js";
import { withTransaction } from "./database.js";
import type { ContentAddressedBlobStore } from "./blobStore.js";

export interface KnowledgeSource {
  id: string;
  knowledgeWorkspaceId: string;
  kind: string;
  displayName: string;
  archivedAt: string | null;
  createdAt: string;
}

export interface KnowledgeSourceVersion {
  id: string;
  sourceId: string;
  contentSha256: string;
  blobKey: string;
  byteLength: number;
  createdAt: string;
}

export interface SourceDomainOptions {
  now?: () => Date;
  createId?: () => string;
}

export class SourceDomain {
  private readonly now: () => Date;
  private readonly createId: () => string;

  constructor(
    private readonly db: KnowledgeDatabase,
    private readonly blobs: ContentAddressedBlobStore,
    options: SourceDomainOptions = {},
  ) {
    this.now = options.now ?? (() => new Date());
    this.createId = options.createId ?? randomUUID;
  }

  createSource(input: {
    knowledgeWorkspaceId: string;
    kind: string;
    displayName: string;
  }): KnowledgeSource {
    const knowledgeWorkspaceId = requireNonEmpty(input.knowledgeWorkspaceId, "knowledgeWorkspaceId");
    const kind = requireNonEmpty(input.kind, "kind");
    const displayName = requireNonEmpty(input.displayName, "displayName");
    const source: KnowledgeSource = {
      id: this.createId(),
      knowledgeWorkspaceId,
      kind,
      displayName,
      archivedAt: null,
      createdAt: this.now().toISOString(),
    };

    this.db
      .prepare(
        `INSERT INTO sources (id, knowledge_workspace_id, kind, display_name, archived_at, created_at)
         VALUES (?, ?, ?, ?, NULL, ?)`,
      )
      .run(source.id, source.knowledgeWorkspaceId, source.kind, source.displayName, source.createdAt);

    return source;
  }

  listSources(knowledgeWorkspaceId: string, options: { includeArchived?: boolean } = {}): KnowledgeSource[] {
    const workspaceId = requireNonEmpty(knowledgeWorkspaceId, "knowledgeWorkspaceId");
    const rows = options.includeArchived
      ? this.db
          .prepare(
            `SELECT id, knowledge_workspace_id, kind, display_name, archived_at, created_at
             FROM sources WHERE knowledge_workspace_id = ? ORDER BY created_at, id`,
          )
          .all(workspaceId)
      : this.db
          .prepare(
            `SELECT id, knowledge_workspace_id, kind, display_name, archived_at, created_at
             FROM sources
             WHERE knowledge_workspace_id = ? AND archived_at IS NULL
             ORDER BY created_at, id`,
          )
          .all(workspaceId);
    return rows.map(mapSourceRow);
  }

  renameSource(sourceId: string, displayName: string): KnowledgeSource {
    const id = requireNonEmpty(sourceId, "sourceId");
    const name = requireNonEmpty(displayName, "displayName");
    const result = this.db.prepare("UPDATE sources SET display_name = ? WHERE id = ?").run(name, id);
    if (Number(result.changes) !== 1) throw new Error(`Unknown Source: ${id}`);
    return this.getSource(id);
  }

  archiveSource(sourceId: string): KnowledgeSource {
    const id = requireNonEmpty(sourceId, "sourceId");
    const archivedAt = this.now().toISOString();
    const result = this.db
      .prepare("UPDATE sources SET archived_at = COALESCE(archived_at, ?) WHERE id = ?")
      .run(archivedAt, id);
    if (Number(result.changes) !== 1) throw new Error(`Unknown Source: ${id}`);
    return this.getSource(id);
  }

  getSource(sourceId: string): KnowledgeSource {
    const id = requireNonEmpty(sourceId, "sourceId");
    const row = this.db
      .prepare(
        `SELECT id, knowledge_workspace_id, kind, display_name, archived_at, created_at
         FROM sources WHERE id = ?`,
      )
      .get(id);
    if (!row) throw new Error(`Unknown Source: ${id}`);
    return mapSourceRow(row);
  }

  listSourceVersions(sourceId: string): KnowledgeSourceVersion[] {
    const id = requireNonEmpty(sourceId, "sourceId");
    return this.db
      .prepare(
        `SELECT id, source_id, content_sha256, blob_key, byte_length, created_at
         FROM source_versions WHERE source_id = ? ORDER BY created_at, id`,
      )
      .all(id)
      .map(mapSourceVersionRow);
  }

  async captureSourceVersion(sourceId: string, rawBytes: Uint8Array): Promise<KnowledgeSourceVersion> {
    const id = requireNonEmpty(sourceId, "sourceId");
    this.getSource(id);

    const blob = await this.blobs.put(rawBytes);
    const existing = this.findSourceVersionByHash(id, blob.hash);
    if (existing) return existing;

    const version: KnowledgeSourceVersion = {
      id: this.createId(),
      sourceId: id,
      contentSha256: blob.hash,
      blobKey: blob.hash,
      byteLength: blob.size,
      createdAt: this.now().toISOString(),
    };

    try {
      withTransaction(this.db, () => {
        this.db
          .prepare(
            `INSERT INTO source_versions
             (id, source_id, content_sha256, blob_key, byte_length, created_at)
             VALUES (?, ?, ?, ?, ?, ?)`,
          )
          .run(
            version.id,
            version.sourceId,
            version.contentSha256,
            version.blobKey,
            version.byteLength,
            version.createdAt,
          );
      });
      return version;
    } catch (error) {
      // A concurrent capture of identical bytes may win the UNIQUE(source_id, content_sha256) race.
      const raced = this.findSourceVersionByHash(id, blob.hash);
      if (raced) return raced;
      throw error;
    }
  }

  async manualUpdate(sourceId: string, rawBytes: Uint8Array): Promise<KnowledgeSourceVersion> {
    return this.captureSourceVersion(sourceId, rawBytes);
  }

  private findSourceVersionByHash(sourceId: string, hash: string): KnowledgeSourceVersion | null {
    const row = this.db
      .prepare(
        `SELECT id, source_id, content_sha256, blob_key, byte_length, created_at
         FROM source_versions WHERE source_id = ? AND content_sha256 = ?`,
      )
      .get(sourceId, hash);
    return row ? mapSourceVersionRow(row) : null;
  }
}

function requireNonEmpty(value: string, name: string): string {
  const normalized = value.trim();
  if (!normalized) throw new TypeError(`${name} must be non-empty`);
  return normalized;
}

function mapSourceRow(row: unknown): KnowledgeSource {
  const value = row as {
    id: string;
    knowledge_workspace_id: string;
    kind: string;
    display_name: string;
    archived_at: string | null;
    created_at: string;
  };
  return {
    id: value.id,
    knowledgeWorkspaceId: value.knowledge_workspace_id,
    kind: value.kind,
    displayName: value.display_name,
    archivedAt: value.archived_at,
    createdAt: value.created_at,
  };
}

function mapSourceVersionRow(row: unknown): KnowledgeSourceVersion {
  const value = row as {
    id: string;
    source_id: string;
    content_sha256: string;
    blob_key: string;
    byte_length: number;
    created_at: string;
  };
  return {
    id: value.id,
    sourceId: value.source_id,
    contentSha256: value.content_sha256,
    blobKey: value.blob_key,
    byteLength: value.byte_length,
    createdAt: value.created_at,
  };
}
