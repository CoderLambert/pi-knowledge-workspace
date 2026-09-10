import { createHash } from "node:crypto";

import type { ContentAddressedBlobStore } from "./blobStore.js";
import type { KnowledgeDatabase } from "./database.js";
import { withTransaction } from "./database.js";
import type { KnowledgeSourceVersion } from "./sourceDomain.js";

export const PARSER_FINGERPRINT = "md-txt-parser-v1";
export const NORMALIZATION_FINGERPRINT = "utf8-bom-strip+newline-lf-v1";
export const DOCUMENT_SCHEMA_VERSION = 1;
export const INTERPRETATION_CONFIG_REVISION = "md-txt-default-v1";

export interface ParsedArtifactInterpretation {
  parserFingerprint?: string;
  normalizationFingerprint?: string;
  documentSchemaVersion?: number;
  interpretationConfigRevision?: string;
}

export interface SourceMapSegment {
  canonicalStartByte: number;
  canonicalEndByte: number;
  sourceStartByte: number;
  sourceEndByte: number;
}

export type DocumentNodeKind = "heading" | "paragraph" | "list-item" | "code-block" | "table-row";

export interface DocumentNode {
  kind: DocumentNodeKind;
  startByte: number;
  endByte: number;
  level?: number;
}

export interface ParsedArtifactCanonical {
  sourceVersionId: string;
  sourceContentSha256: string;
  canonicalText: string;
  canonicalBytes: Uint8Array;
  canonicalTextSha256: string;
  documentStructure: readonly DocumentNode[];
  sourceMap: readonly SourceMapSegment[];
  parserFingerprint: string;
  normalizationFingerprint: string;
  documentSchemaVersion: number;
  interpretationConfigSha256: string;
  artifactHash: string;
}

export interface DurableParsedArtifact extends ParsedArtifactCanonical {
  knowledgeWorkspaceId: string;
  parsedArtifactId: string;
  createdAt: string;
}

export interface ParsedArtifactStoreOptions {
  now?: () => Date;
}

export class ParsedArtifactCanonicalizer {
  constructor(private readonly blobs: ContentAddressedBlobStore) {}

  async fromSourceVersion(
    sourceVersion: KnowledgeSourceVersion,
    sourceKind: string,
    interpretation: ParsedArtifactInterpretation = {},
  ): Promise<ParsedArtifactCanonical> {
    if (sourceKind !== "md" && sourceKind !== "txt") {
      throw new TypeError(`Unsupported parsed-artifact source kind: ${sourceKind}`);
    }
    if (sourceVersion.blobKey !== sourceVersion.contentSha256) {
      throw new Error("SourceVersion blob identity does not match its content SHA-256");
    }

    const rawBytes = await this.blobs.read(sourceVersion.blobKey);
    if (rawBytes.byteLength !== sourceVersion.byteLength) {
      throw new Error("SourceVersion byte length does not match immutable blob bytes");
    }

    return canonicalizeParsedArtifact(sourceVersion.id, rawBytes, sourceKind, interpretation);
  }
}

export function canonicalizeParsedArtifact(
  sourceVersionId: string,
  rawBytes: Uint8Array,
  sourceKind: "md" | "txt",
  interpretation: ParsedArtifactInterpretation = {},
): ParsedArtifactCanonical {
  const parserFingerprint = nonEmpty(
    interpretation.parserFingerprint ?? PARSER_FINGERPRINT,
    "parserFingerprint",
  );
  const normalizationFingerprint = nonEmpty(
    interpretation.normalizationFingerprint ?? NORMALIZATION_FINGERPRINT,
    "normalizationFingerprint",
  );
  const documentSchemaVersion = positiveInteger(
    interpretation.documentSchemaVersion ?? DOCUMENT_SCHEMA_VERSION,
    "documentSchemaVersion",
  );
  const interpretationConfigRevision = nonEmpty(
    interpretation.interpretationConfigRevision ?? INTERPRETATION_CONFIG_REVISION,
    "interpretationConfigRevision",
  );
  const interpretationConfigSha256 = sha256(
    Buffer.from(JSON.stringify({ sourceKind, revision: interpretationConfigRevision }), "utf8"),
  );
  // Validate the complete source as UTF-8 before performing byte-preserving normalization.
  new TextDecoder("utf-8", { fatal: true }).decode(rawBytes);

  const { bytes, sourceMap } = normalizeUtf8Bytes(rawBytes);
  const sourceContentSha256 = sha256(rawBytes);
  const canonicalText = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  const canonicalTextSha256 = sha256(bytes);
  const documentStructure = parseStructure(canonicalText, sourceKind);
  const artifactHash = sha256(
    Buffer.from(
      JSON.stringify({
        sourceVersionId,
        sourceContentSha256,
        parserFingerprint,
        normalizationFingerprint,
        documentSchemaVersion,
        interpretationConfigSha256,
        canonicalTextSha256,
        documentStructure,
        sourceMap,
      }),
      "utf8",
    ),
  );

  return {
    sourceVersionId,
    sourceContentSha256,
    canonicalText,
    canonicalBytes: bytes,
    canonicalTextSha256,
    documentStructure,
    sourceMap,
    parserFingerprint,
    normalizationFingerprint,
    documentSchemaVersion,
    interpretationConfigSha256,
    artifactHash,
  };
}

/** Persists and reads immutable ParsedArtifact payloads without reopening mutable source files. */
export class SqliteParsedArtifactStore {
  private readonly now: () => Date;

  constructor(private readonly db: KnowledgeDatabase, options: ParsedArtifactStoreOptions = {}) {
    this.now = options.now ?? (() => new Date());
  }

  materialize(knowledgeWorkspaceId: string, artifact: ParsedArtifactCanonical): DurableParsedArtifact {
    const workspaceId = nonEmpty(knowledgeWorkspaceId, "knowledgeWorkspaceId");
    validateCanonicalArtifact(artifact);
    const authority = this.db.prepare(`
SELECT sv.id, sv.content_sha256
FROM source_versions sv
JOIN sources s ON s.id = sv.source_id
WHERE sv.id = ? AND s.knowledge_workspace_id = ?
`).get(artifact.sourceVersionId, workspaceId);
    if (authority === undefined) {
      throw new Error("SourceVersion is not available in the requested Knowledge Workspace");
    }
    const authorityRow = recordValue(authority, "SourceVersion authority row");
    if (shaField(authorityRow, "content_sha256") !== artifact.sourceContentSha256) {
      throw new Error("ParsedArtifact source bytes do not match the durable SourceVersion identity");
    }

    const parsedArtifactId = `artifact_${artifact.artifactHash}`;
    const createdAt = this.now().toISOString();
    const legacyParserIdentity = [
      artifact.parserFingerprint,
      artifact.normalizationFingerprint,
      `schema-${String(artifact.documentSchemaVersion)}`,
      artifact.interpretationConfigSha256,
    ].join("+");

    try {
      withTransaction(this.db, () => {
        this.db.prepare(`
INSERT INTO parsed_artifacts (
  id, source_version_id, parser_version, canonical_text_sha256, created_at,
  parser_fingerprint, normalization_fingerprint, document_schema_version,
  interpretation_config_sha256, artifact_hash, canonical_bytes,
  document_structure_json, source_map_json
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`).run(
          parsedArtifactId,
          artifact.sourceVersionId,
          legacyParserIdentity,
          artifact.canonicalTextSha256,
          createdAt,
          artifact.parserFingerprint,
          artifact.normalizationFingerprint,
          artifact.documentSchemaVersion,
          artifact.interpretationConfigSha256,
          artifact.artifactHash,
          Buffer.from(artifact.canonicalBytes),
          JSON.stringify(artifact.documentStructure),
          JSON.stringify(artifact.sourceMap),
        );
      });
    } catch (error) {
      const existing = this.findByArtifactHash(workspaceId, artifact.artifactHash);
      if (existing !== null) {
        assertSameArtifact(existing, artifact);
        return existing;
      }
      throw error;
    }
    return this.read(workspaceId, parsedArtifactId);
  }

  read(knowledgeWorkspaceId: string, parsedArtifactId: string): DurableParsedArtifact {
    const workspaceId = nonEmpty(knowledgeWorkspaceId, "knowledgeWorkspaceId");
    const id = nonEmpty(parsedArtifactId, "parsedArtifactId");
    const row = this.db.prepare(`
SELECT
  pa.id, pa.source_version_id, pa.canonical_text_sha256, pa.created_at,
  pa.parser_fingerprint, pa.normalization_fingerprint, pa.document_schema_version,
  pa.interpretation_config_sha256, pa.artifact_hash, pa.canonical_bytes,
  pa.document_structure_json, pa.source_map_json,
  sv.content_sha256 AS source_content_sha256
FROM parsed_artifacts pa
JOIN source_versions sv ON sv.id = pa.source_version_id
JOIN sources s ON s.id = sv.source_id
WHERE pa.id = ? AND s.knowledge_workspace_id = ?
`).get(id, workspaceId);
    if (row === undefined) {
      throw new Error("ParsedArtifact is not available in the requested Knowledge Workspace");
    }
    return mapDurableArtifact(workspaceId, row);
  }

  private findByArtifactHash(knowledgeWorkspaceId: string, artifactHash: string): DurableParsedArtifact | null {
    const row = this.db.prepare(`
SELECT pa.id
FROM parsed_artifacts pa
JOIN source_versions sv ON sv.id = pa.source_version_id
JOIN sources s ON s.id = sv.source_id
WHERE pa.artifact_hash = ? AND s.knowledge_workspace_id = ?
`).get(artifactHash, knowledgeWorkspaceId);
    if (row === undefined) return null;
    return this.read(knowledgeWorkspaceId, stringField(recordValue(row, "ParsedArtifact identity row"), "id"));
  }
}

function normalizeUtf8Bytes(rawInput: Uint8Array): { bytes: Uint8Array; sourceMap: SourceMapSegment[] } {
  const raw = Buffer.from(rawInput);
  const output: number[] = [];
  const sourceMap: SourceMapSegment[] = [];
  let sourceOffset = hasUtf8Bom(raw) ? 3 : 0;

  while (sourceOffset < raw.byteLength) {
    const canonicalStartByte = output.length;
    const sourceStartByte = sourceOffset;

    if (raw[sourceOffset] === 0x0d) {
      output.push(0x0a);
      sourceOffset += raw[sourceOffset + 1] === 0x0a ? 2 : 1;
    } else {
      const nextCr = raw.indexOf(0x0d, sourceOffset);
      const end = nextCr === -1 ? raw.byteLength : nextCr;
      for (let index = sourceOffset; index < end; index += 1) {
        const byte = raw[index];
        if (byte === undefined) throw new RangeError("Source byte lookup exceeded normalized input");
        output.push(byte);
      }
      sourceOffset = end;
    }

    if (output.length > canonicalStartByte) {
      sourceMap.push({
        canonicalStartByte,
        canonicalEndByte: output.length,
        sourceStartByte,
        sourceEndByte: sourceOffset,
      });
    }
  }

  return { bytes: Uint8Array.from(output), sourceMap };
}

function parseStructure(text: string, sourceKind: "md" | "txt"): DocumentNode[] {
  const lines = text.split("\n");
  const encoder = new TextEncoder();
  const nodes: DocumentNode[] = [];
  let byteOffset = 0;
  let inCodeBlock = false;
  let codeStart = 0;
  let paragraphStart: number | null = null;

  const closeParagraph = (endByte: number): void => {
    if (paragraphStart === null) return;
    nodes.push({ kind: "paragraph", startByte: paragraphStart, endByte });
    paragraphStart = null;
  };

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (line === undefined) throw new RangeError("ParsedArtifact line lookup exceeded normalized text");
    const lineBytes = encoder.encode(line).byteLength;
    const lineStart = byteOffset;
    const lineEnd = lineStart + lineBytes;
    const nextByteOffset = lineEnd + (index < lines.length - 1 ? 1 : 0);

    if (sourceKind === "md" && /^\s*```/.test(line)) {
      closeParagraph(lineStart);
      if (!inCodeBlock) {
        inCodeBlock = true;
        codeStart = lineStart;
      } else {
        nodes.push({ kind: "code-block", startByte: codeStart, endByte: lineEnd });
        inCodeBlock = false;
      }
      byteOffset = nextByteOffset;
      continue;
    }

    if (inCodeBlock) {
      byteOffset = nextByteOffset;
      continue;
    }

    if (!line.trim()) {
      closeParagraph(lineStart);
      byteOffset = nextByteOffset;
      continue;
    }

    if (sourceKind === "md") {
      const heading = /^(#{1,6})\s+/.exec(line);
      if (heading) {
        const marker = heading[1];
        if (marker === undefined) throw new Error("Markdown heading match is missing its marker");
        closeParagraph(lineStart);
        nodes.push({ kind: "heading", startByte: lineStart, endByte: lineEnd, level: marker.length });
        byteOffset = nextByteOffset;
        continue;
      }
      if (/^\s*(?:[-+*]|\d+\.)\s+/.test(line)) {
        closeParagraph(lineStart);
        nodes.push({ kind: "list-item", startByte: lineStart, endByte: lineEnd });
        byteOffset = nextByteOffset;
        continue;
      }
      if (/^\s*\|.*\|\s*$/.test(line)) {
        closeParagraph(lineStart);
        nodes.push({ kind: "table-row", startByte: lineStart, endByte: lineEnd });
        byteOffset = nextByteOffset;
        continue;
      }
    }

    paragraphStart ??= lineStart;
    byteOffset = nextByteOffset;
  }

  if (inCodeBlock) nodes.push({ kind: "code-block", startByte: codeStart, endByte: encoder.encode(text).byteLength });
  closeParagraph(encoder.encode(text).byteLength);
  return nodes;
}

function hasUtf8Bom(bytes: Uint8Array): boolean {
  return bytes.byteLength >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf;
}

function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function validateCanonicalArtifact(artifact: ParsedArtifactCanonical): void {
  if (artifact.canonicalText !== new TextDecoder("utf-8", { fatal: true }).decode(artifact.canonicalBytes)) {
    throw new Error("ParsedArtifact canonical text does not match its immutable bytes");
  }
  if (sha256(artifact.canonicalBytes) !== artifact.canonicalTextSha256) {
    throw new Error("ParsedArtifact canonical bytes do not match their SHA-256 identity");
  }
  const expectedHash = artifactIdentityHash(artifact);
  if (expectedHash !== artifact.artifactHash) {
    throw new Error("ParsedArtifact interpretation identity does not match its immutable payload");
  }
}

function artifactIdentityHash(artifact: Omit<ParsedArtifactCanonical, "artifactHash" | "canonicalText">): string {
  return sha256(
    Buffer.from(
      JSON.stringify({
        sourceVersionId: artifact.sourceVersionId,
        sourceContentSha256: artifact.sourceContentSha256,
        parserFingerprint: artifact.parserFingerprint,
        normalizationFingerprint: artifact.normalizationFingerprint,
        documentSchemaVersion: artifact.documentSchemaVersion,
        interpretationConfigSha256: artifact.interpretationConfigSha256,
        canonicalTextSha256: artifact.canonicalTextSha256,
        documentStructure: artifact.documentStructure,
        sourceMap: artifact.sourceMap,
      }),
      "utf8",
    ),
  );
}

function mapDurableArtifact(knowledgeWorkspaceId: string, raw: unknown): DurableParsedArtifact {
  const row = recordValue(raw, "ParsedArtifact row");
  const canonicalBytesValue = row["canonical_bytes"];
  if (!(canonicalBytesValue instanceof Uint8Array)) {
    throw new Error("Historical ParsedArtifact has no durable canonical payload; rebuild is required before publication");
  }
  const canonicalBytes = Uint8Array.from(canonicalBytesValue);
  const artifact: DurableParsedArtifact = {
    knowledgeWorkspaceId,
    parsedArtifactId: stringField(row, "id"),
    sourceVersionId: stringField(row, "source_version_id"),
    sourceContentSha256: shaField(row, "source_content_sha256"),
    canonicalText: new TextDecoder("utf-8", { fatal: true }).decode(canonicalBytes),
    canonicalBytes,
    canonicalTextSha256: shaField(row, "canonical_text_sha256"),
    documentStructure: documentNodesField(row, "document_structure_json"),
    sourceMap: sourceMapField(row, "source_map_json"),
    parserFingerprint: stringField(row, "parser_fingerprint"),
    normalizationFingerprint: stringField(row, "normalization_fingerprint"),
    documentSchemaVersion: positiveIntegerField(row, "document_schema_version"),
    interpretationConfigSha256: shaField(row, "interpretation_config_sha256"),
    artifactHash: shaField(row, "artifact_hash"),
    createdAt: stringField(row, "created_at"),
  };
  validateCanonicalArtifact(artifact);
  if (artifact.parsedArtifactId !== `artifact_${artifact.artifactHash}`) {
    throw new Error("ParsedArtifact durable id does not match its immutable interpretation identity");
  }
  return artifact;
}

function assertSameArtifact(existing: DurableParsedArtifact, candidate: ParsedArtifactCanonical): void {
  if (
    existing.sourceVersionId !== candidate.sourceVersionId
    || existing.sourceContentSha256 !== candidate.sourceContentSha256
    || existing.artifactHash !== candidate.artifactHash
    || existing.canonicalTextSha256 !== candidate.canonicalTextSha256
    || !Buffer.from(existing.canonicalBytes).equals(Buffer.from(candidate.canonicalBytes))
  ) {
    throw new Error("ParsedArtifact identity collision does not match the immutable payload");
  }
}

function documentNodesField(row: Record<string, unknown>, key: string): readonly DocumentNode[] {
  const value = jsonArrayField(row, key);
  return value.map((raw) => {
    const node = recordValue(raw, "ParsedArtifact document node");
    const kind = stringField(node, "kind");
    if (kind !== "heading" && kind !== "paragraph" && kind !== "list-item" && kind !== "code-block" && kind !== "table-row") {
      throw new Error("ParsedArtifact document node kind is invalid");
    }
    const startByte = nonNegativeIntegerField(node, "startByte");
    const endByte = positiveIntegerField(node, "endByte");
    const levelValue = node["level"];
    return levelValue === undefined
      ? { kind, startByte, endByte }
      : { kind, startByte, endByte, level: positiveIntegerField(node, "level") };
  });
}

function sourceMapField(row: Record<string, unknown>, key: string): readonly SourceMapSegment[] {
  return jsonArrayField(row, key).map((raw) => {
    const segment = recordValue(raw, "ParsedArtifact source-map segment");
    return {
      canonicalStartByte: nonNegativeIntegerField(segment, "canonicalStartByte"),
      canonicalEndByte: nonNegativeIntegerField(segment, "canonicalEndByte"),
      sourceStartByte: nonNegativeIntegerField(segment, "sourceStartByte"),
      sourceEndByte: nonNegativeIntegerField(segment, "sourceEndByte"),
    };
  });
}

function jsonArrayField(row: Record<string, unknown>, key: string): unknown[] {
  const encoded = stringField(row, key);
  const value: unknown = JSON.parse(encoded);
  if (!Array.isArray(value)) throw new Error(`${key} must contain a JSON array`);
  return value;
}

function recordValue(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be an object record`);
  }
  return Object.fromEntries(Object.entries(value));
}

function stringField(row: Record<string, unknown>, key: string): string {
  const value = row[key];
  if (typeof value !== "string" || value.length === 0) throw new Error(`${key} must be a non-empty string`);
  return value;
}

function shaField(row: Record<string, unknown>, key: string): string {
  const value = stringField(row, key);
  if (!/^[0-9a-f]{64}$/.test(value)) throw new Error(`${key} must be a SHA-256 hash`);
  return value;
}

function positiveIntegerField(row: Record<string, unknown>, key: string): number {
  return positiveInteger(row[key], key);
}

function nonNegativeIntegerField(row: Record<string, unknown>, key: string): number {
  const value = row[key];
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${key} must be a non-negative integer`);
  }
  return value;
}

function positiveInteger(value: unknown, name: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value <= 0) {
    throw new TypeError(`${name} must be a positive integer`);
  }
  return value;
}

function nonEmpty(value: string, name: string): string {
  const normalized = value.trim();
  if (normalized.length === 0) throw new TypeError(`${name} must be non-empty`);
  return normalized;
}
