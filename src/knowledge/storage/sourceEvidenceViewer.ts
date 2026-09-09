import type { KnowledgeDatabase } from "./database.js";
import { EvidenceReadApi, type ParsedArtifactReadStore } from "./evidenceRead.js";
import type { StableEvidence } from "./evidence.js";

export interface ViewerSourceSummary {
  id: string;
  displayName: string;
  kind: string;
  archivedAt: string | null;
  createdAt: string;
  versionCount: number;
  latestVersionId: string | null;
  latestVersionCreatedAt: string | null;
}

export interface ViewerParsedArtifactSummary {
  id: string;
  sourceVersionId: string;
  parserVersion: string;
  canonicalTextSha256: string;
  createdAt: string;
}

export interface ViewerSourceVersionSummary {
  id: string;
  contentSha256: string;
  byteLength: number;
  createdAt: string;
  parsedArtifacts: ViewerParsedArtifactSummary[];
}

export interface ViewerSourceDetail {
  id: string;
  knowledgeWorkspaceId: string;
  displayName: string;
  kind: string;
  archivedAt: string | null;
  createdAt: string;
  versions: ViewerSourceVersionSummary[];
}

export interface ViewerArtifactDocument {
  source: Pick<ViewerSourceDetail, "id" | "displayName" | "kind">;
  sourceVersion: Pick<ViewerSourceVersionSummary, "id" | "contentSha256" | "byteLength" | "createdAt">;
  parsedArtifact: ViewerParsedArtifactSummary;
  text: string;
  byteLength: number;
  truncated: boolean;
  highlight: null | {
    evidenceId: string;
    startByte: number;
    endByte: number;
    startByteInDocument: number;
    endByteInDocument: number;
    exactQuote: string;
    quoteHash: string;
  };
}

const DEFAULT_MAX_ARTIFACT_BYTES = 128 * 1024;
const MAX_ARTIFACT_BYTES = 256 * 1024;

/**
 * Read-only Source/Evidence projection for P1-T15.
 *
 * Every lookup is scoped by Knowledge Workspace and historical artifact identity.
 * The viewer never resolves an Evidence through the Source's latest version.
 */
export class SourceEvidenceViewer {
  private readonly evidenceRead: EvidenceReadApi;

  constructor(
    private readonly db: KnowledgeDatabase,
    private readonly artifacts: ParsedArtifactReadStore,
  ) {
    this.evidenceRead = new EvidenceReadApi(artifacts);
  }

  listSources(knowledgeWorkspaceId: string): ViewerSourceSummary[] {
    const workspaceId = requireNonEmpty(knowledgeWorkspaceId, "knowledgeWorkspaceId");
    const rows = this.db.prepare(
      `SELECT
         s.id,
         s.display_name,
         s.kind,
         s.archived_at,
         s.created_at,
         COUNT(sv.id) AS version_count,
         (
           SELECT newest.id
           FROM source_versions newest
           WHERE newest.source_id = s.id
           ORDER BY newest.created_at DESC, newest.id DESC
           LIMIT 1
         ) AS latest_version_id,
         (
           SELECT newest.created_at
           FROM source_versions newest
           WHERE newest.source_id = s.id
           ORDER BY newest.created_at DESC, newest.id DESC
           LIMIT 1
         ) AS latest_version_created_at
       FROM sources s
       LEFT JOIN source_versions sv ON sv.source_id = s.id
       WHERE s.knowledge_workspace_id = ?
       GROUP BY s.id, s.display_name, s.kind, s.archived_at, s.created_at
       ORDER BY s.archived_at IS NOT NULL, s.display_name, s.id`,
    ).all(workspaceId);

    return rows.map((row) => {
      const value = row as Record<string, unknown>;
      return {
        id: requireDbString(value, "id"),
        displayName: requireDbString(value, "display_name"),
        kind: requireDbString(value, "kind"),
        archivedAt: nullableDbString(value, "archived_at"),
        createdAt: requireDbString(value, "created_at"),
        versionCount: requireDbNonNegativeInteger(value, "version_count"),
        latestVersionId: nullableDbString(value, "latest_version_id"),
        latestVersionCreatedAt: nullableDbString(value, "latest_version_created_at"),
      };
    });
  }

  getSource(knowledgeWorkspaceId: string, sourceId: string): ViewerSourceDetail {
    const workspaceId = requireNonEmpty(knowledgeWorkspaceId, "knowledgeWorkspaceId");
    const id = requireNonEmpty(sourceId, "sourceId");
    const sourceRow = this.db.prepare(
      `SELECT id, knowledge_workspace_id, display_name, kind, archived_at, created_at
       FROM sources
       WHERE id = ? AND knowledge_workspace_id = ?`,
    ).get(id, workspaceId) as Record<string, unknown> | undefined;
    if (sourceRow === undefined) throw new Error("Source is not available in the requested Knowledge Workspace");

    const versionRows = this.db.prepare(
      `SELECT id, content_sha256, byte_length, created_at
       FROM source_versions
       WHERE source_id = ?
       ORDER BY created_at DESC, id DESC`,
    ).all(id);

    const versions = versionRows.map((row) => {
      const value = row as Record<string, unknown>;
      const versionId = requireDbString(value, "id");
      const artifactRows = this.db.prepare(
        `SELECT id, source_version_id, parser_version, canonical_text_sha256, created_at
         FROM parsed_artifacts
         WHERE source_version_id = ?
         ORDER BY created_at DESC, id DESC`,
      ).all(versionId);
      return {
        id: versionId,
        contentSha256: requireDbString(value, "content_sha256"),
        byteLength: requireDbNonNegativeInteger(value, "byte_length"),
        createdAt: requireDbString(value, "created_at"),
        parsedArtifacts: artifactRows.map(mapArtifactSummary),
      } satisfies ViewerSourceVersionSummary;
    });

    return {
      id: requireDbString(sourceRow, "id"),
      knowledgeWorkspaceId: requireDbString(sourceRow, "knowledge_workspace_id"),
      displayName: requireDbString(sourceRow, "display_name"),
      kind: requireDbString(sourceRow, "kind"),
      archivedAt: nullableDbString(sourceRow, "archived_at"),
      createdAt: requireDbString(sourceRow, "created_at"),
      versions,
    };
  }

  openArtifact(input: {
    knowledgeWorkspaceId: string;
    parsedArtifactId: string;
    evidenceId?: string;
    maxBytes?: number;
  }): ViewerArtifactDocument {
    const workspaceId = requireNonEmpty(input.knowledgeWorkspaceId, "knowledgeWorkspaceId");
    const parsedArtifactId = requireNonEmpty(input.parsedArtifactId, "parsedArtifactId");
    const maxBytes = boundedPositiveInteger(
      input.maxBytes ?? DEFAULT_MAX_ARTIFACT_BYTES,
      "maxBytes",
      MAX_ARTIFACT_BYTES,
    );

    const lineage = this.db.prepare(
      `SELECT
         s.id AS source_id,
         s.display_name,
         s.kind,
         sv.id AS source_version_id,
         sv.content_sha256,
         sv.byte_length,
         sv.created_at AS source_version_created_at,
         pa.id AS parsed_artifact_id,
         pa.parser_version,
         pa.canonical_text_sha256,
         pa.created_at AS parsed_artifact_created_at
       FROM parsed_artifacts pa
       JOIN source_versions sv ON sv.id = pa.source_version_id
       JOIN sources s ON s.id = sv.source_id
       WHERE pa.id = ? AND s.knowledge_workspace_id = ?`,
    ).get(parsedArtifactId, workspaceId) as Record<string, unknown> | undefined;
    if (lineage === undefined) {
      throw new Error("ParsedArtifact is not available in the requested Knowledge Workspace");
    }

    const artifact = this.artifacts.read(workspaceId, parsedArtifactId);
    const sourceVersionId = requireDbString(lineage, "source_version_id");
    if (
      artifact.knowledgeWorkspaceId !== workspaceId ||
      artifact.parsedArtifactId !== parsedArtifactId ||
      artifact.sourceVersionId !== sourceVersionId
    ) {
      throw new Error("ParsedArtifact store returned historical lineage that does not match the database");
    }

    let windowStart = 0;
    let windowEnd = Math.min(artifact.canonicalBytes.byteLength, maxBytes);
    let highlight: ViewerArtifactDocument["highlight"] = null;

    if (input.evidenceId !== undefined) {
      const evidence = this.readEvidence(workspaceId, requireNonEmpty(input.evidenceId, "evidenceId"));
      if (evidence.parsedArtifactId !== parsedArtifactId) {
        throw new Error("Evidence does not belong to the requested historical ParsedArtifact");
      }
      const read = this.evidenceRead.read({
        knowledgeWorkspaceId: workspaceId,
        evidence,
        mode: "context",
        contextBytes: Math.floor(Math.max(0, maxBytes - (evidence.endByte - evidence.startByte)) / 2),
        maxReadBytes: maxBytes,
      });
      windowStart = read.range.startByte;
      windowEnd = read.range.endByte;
      highlight = {
        evidenceId: evidence.id,
        startByte: evidence.startByte,
        endByte: evidence.endByte,
        startByteInDocument: read.evidenceRangeInRead.startByte,
        endByteInDocument: read.evidenceRangeInRead.endByte,
        exactQuote: evidence.exactQuote,
        quoteHash: evidence.quoteHash,
      };
    }

    const visibleBytes = artifact.canonicalBytes.slice(windowStart, windowEnd);
    return {
      source: {
        id: requireDbString(lineage, "source_id"),
        displayName: requireDbString(lineage, "display_name"),
        kind: requireDbString(lineage, "kind"),
      },
      sourceVersion: {
        id: sourceVersionId,
        contentSha256: requireDbString(lineage, "content_sha256"),
        byteLength: requireDbNonNegativeInteger(lineage, "byte_length"),
        createdAt: requireDbString(lineage, "source_version_created_at"),
      },
      parsedArtifact: {
        id: requireDbString(lineage, "parsed_artifact_id"),
        sourceVersionId,
        parserVersion: requireDbString(lineage, "parser_version"),
        canonicalTextSha256: requireDbString(lineage, "canonical_text_sha256"),
        createdAt: requireDbString(lineage, "parsed_artifact_created_at"),
      },
      text: new TextDecoder("utf-8", { fatal: true }).decode(visibleBytes),
      byteLength: artifact.canonicalBytes.byteLength,
      truncated: windowStart !== 0 || windowEnd !== artifact.canonicalBytes.byteLength,
      highlight,
    };
  }

  private readEvidence(knowledgeWorkspaceId: string, evidenceId: string): StableEvidence {
    const row = this.db.prepare(
      `SELECT id, knowledge_workspace_id, parsed_artifact_id, start_byte, end_byte,
              exact_quote, quote_hash, locator_snapshot, created_at
       FROM evidence
       WHERE id = ? AND knowledge_workspace_id = ?`,
    ).get(evidenceId, knowledgeWorkspaceId) as Record<string, unknown> | undefined;
    if (row === undefined) throw new Error("Evidence is not available in the requested Knowledge Workspace");

    const locatorText = requireDbString(row, "locator_snapshot");
    const locator: unknown = JSON.parse(locatorText);
    if (locator === null || Array.isArray(locator) || typeof locator !== "object") {
      throw new Error("Persisted Evidence locator_snapshot must be a JSON object");
    }
    return {
      id: requireDbString(row, "id"),
      knowledgeWorkspaceId: requireDbString(row, "knowledge_workspace_id"),
      parsedArtifactId: requireDbString(row, "parsed_artifact_id"),
      startByte: requireDbNonNegativeInteger(row, "start_byte"),
      endByte: requireDbNonNegativeInteger(row, "end_byte"),
      exactQuote: requireDbString(row, "exact_quote"),
      quoteHash: requireDbString(row, "quote_hash"),
      locatorSnapshot: locator as Record<string, unknown>,
      createdAt: requireDbString(row, "created_at"),
    };
  }
}

function mapArtifactSummary(row: unknown): ViewerParsedArtifactSummary {
  const value = row as Record<string, unknown>;
  return {
    id: requireDbString(value, "id"),
    sourceVersionId: requireDbString(value, "source_version_id"),
    parserVersion: requireDbString(value, "parser_version"),
    canonicalTextSha256: requireDbString(value, "canonical_text_sha256"),
    createdAt: requireDbString(value, "created_at"),
  };
}

function requireNonEmpty(value: string, name: string): string {
  const normalized = value.trim();
  if (normalized.length === 0) throw new TypeError(`${name} must be non-empty`);
  return normalized;
}

function boundedPositiveInteger(value: number, name: string, max: number): number {
  if (!Number.isSafeInteger(value) || value <= 0 || value > max) {
    throw new TypeError(`${name} must be a positive integer no greater than ${String(max)}`);
  }
  return value;
}

function requireDbString(row: Record<string, unknown>, key: string): string {
  const value = row[key];
  if (typeof value !== "string" || value.length === 0) throw new Error(`Database field ${key} must be a non-empty string`);
  return value;
}

function nullableDbString(row: Record<string, unknown>, key: string): string | null {
  const value = row[key];
  if (value === null) return null;
  if (typeof value !== "string" || value.length === 0) throw new Error(`Database field ${key} must be null or a non-empty string`);
  return value;
}

function requireDbNonNegativeInteger(row: Record<string, unknown>, key: string): number {
  const value = row[key];
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw new Error(`Database field ${key} must be a non-negative integer`);
  }
  return value;
}
