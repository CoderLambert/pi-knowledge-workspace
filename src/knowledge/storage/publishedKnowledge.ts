import type { KnowledgeDatabase } from "./database.js";
import { IndexBuildRetention } from "./indexBuildRetention.js";

export interface PublishedKnowledgeSelection {
  readonly sourceId: string;
  readonly sourceVersionId: string;
  readonly parsedArtifactId: string;
}

export interface PublishedKnowledgeSnapshot {
  knowledgeWorkspaceId: string;
  publicationId: string;
  generation: number;
  indexBuildId: string;
  retrievalConfigRevision: string;
  selections: readonly PublishedKnowledgeSelection[];
  sourceVersionIds: readonly string[];
  parsedArtifactIds: readonly string[];
  publishedAt: string;
}

export interface PublishedKnowledgeSnapshotLease extends PublishedKnowledgeSnapshot {
  release(): void;
}

export interface AcquirePublishedKnowledgeSnapshotOptions {
  ownerType: string;
  ownerId: string;
  leaseMs: number;
}

/**
 * Freezes the explicit canonical publication and protects its retrieval projection.
 * Future GenerationRun code can hold this lease rather than reacquiring "current".
 */
export function acquirePublishedKnowledgeSnapshot(
  db: KnowledgeDatabase,
  knowledgeWorkspaceId: string,
  options: AcquirePublishedKnowledgeSnapshotOptions,
  retention = new IndexBuildRetention(db),
): PublishedKnowledgeSnapshotLease {
  const workspaceId = nonEmpty(knowledgeWorkspaceId, "knowledgeWorkspaceId");
  const lease = retention.acquireActiveLease(
    workspaceId,
    nonEmpty(options.ownerType, "ownerType"),
    nonEmpty(options.ownerId, "ownerId"),
    options.leaseMs,
  );

  try {
    const publicationRow = db.prepare(`
SELECT
  kp.id,
  kp.knowledge_workspace_id,
  kp.generation,
  kp.index_build_id,
  kp.retrieval_config_revision,
  kp.published_at
FROM knowledge_publications kp
WHERE kp.knowledge_workspace_id = ? AND kp.index_build_id = ?
`).get(workspaceId, lease.indexBuildId);
    if (publicationRow === undefined) {
      throw new Error("Active IndexBuild has no explicit Knowledge publication");
    }
    const publication = recordValue(publicationRow, "Knowledge publication row");
    const publicationId = stringField(publication, "id");
    const generation = positiveIntegerField(publication, "generation");
    const indexBuildId = stringField(publication, "index_build_id");
    if (
      stringField(publication, "knowledge_workspace_id") !== workspaceId
      || indexBuildId !== lease.indexBuildId
    ) {
      throw new Error("Knowledge publication authority does not match its leased retrieval snapshot");
    }

    const selectionRows = db.prepare(`
SELECT
  selection.source_id,
  selection.source_version_id,
  selection.parsed_artifact_id
FROM knowledge_publication_selections selection
JOIN sources source ON source.id = selection.source_id
JOIN source_versions version
  ON version.id = selection.source_version_id
 AND version.source_id = selection.source_id
JOIN parsed_artifacts artifact
  ON artifact.id = selection.parsed_artifact_id
 AND artifact.source_version_id = selection.source_version_id
WHERE selection.publication_id = ?
  AND source.knowledge_workspace_id = ?
ORDER BY selection.source_id
`).all(publicationId, workspaceId);
    if (selectionRows.length === 0) {
      throw new Error("Knowledge publication has no canonical Source selection");
    }
    const selectionCount = recordValue(db.prepare(
      "SELECT COUNT(*) AS count FROM knowledge_publication_selections WHERE publication_id = ?",
    ).get(publicationId), "Knowledge selection count")["count"];
    if (selectionCount !== selectionRows.length) {
      throw new Error("Knowledge publication contains unavailable or cross-workspace canonical selections");
    }
    const selections = selectionRows.map((row) => Object.freeze(mapSelection(row)));
    if (new Set(selections.map((selection) => selection.sourceId)).size !== selections.length) {
      throw new Error("Knowledge publication contains duplicate Source selections");
    }

    let released = false;
    return {
      knowledgeWorkspaceId: workspaceId,
      publicationId,
      generation,
      indexBuildId,
      retrievalConfigRevision: stringField(publication, "retrieval_config_revision"),
      selections: Object.freeze(selections),
      sourceVersionIds: Object.freeze(selections.map((selection) => selection.sourceVersionId)),
      parsedArtifactIds: Object.freeze(selections.map((selection) => selection.parsedArtifactId)),
      publishedAt: stringField(publication, "published_at"),
      release: () => {
        if (released) return;
        released = true;
        lease.release();
      },
    };
  } catch (error) {
    lease.release();
    throw error;
  }
}

function mapSelection(raw: unknown): PublishedKnowledgeSelection {
  const row = recordValue(raw, "Knowledge publication selection row");
  return {
    sourceId: stringField(row, "source_id"),
    sourceVersionId: stringField(row, "source_version_id"),
    parsedArtifactId: stringField(row, "parsed_artifact_id"),
  };
}

function nonEmpty(value: string, name: string): string {
  const normalized = value.trim();
  if (normalized.length === 0) throw new TypeError(`${name} must be non-empty`);
  return normalized;
}

function recordValue(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be an object record`);
  }
  return Object.fromEntries(Object.entries(value));
}

function stringField(row: Record<string, unknown>, key: string): string {
  const value = row[key];
  if (typeof value !== "string" || value.length === 0) throw new Error(`${key} is invalid`);
  return value;
}

function positiveIntegerField(row: Record<string, unknown>, key: string): number {
  const value = row[key];
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${key} is invalid`);
  }
  return value;
}
