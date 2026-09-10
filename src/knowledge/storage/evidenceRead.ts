import type { DocumentNode } from "./parsedArtifact.js";
import { assertEvidenceMatchesArtifact, type StableEvidence } from "./evidence.js";
import { extractExactQuote, type Utf8ByteRange } from "./utf8Range.js";

export type EvidenceReadMode = "exact" | "context" | "section";

export interface ReadableParsedArtifact {
  knowledgeWorkspaceId: string;
  parsedArtifactId: string;
  sourceVersionId: string;
  canonicalBytes: Uint8Array;
  documentStructure: readonly DocumentNode[];
}

export interface ParsedArtifactReadStore {
  read(knowledgeWorkspaceId: string, parsedArtifactId: string): ReadableParsedArtifact;
}

export interface EvidenceReadInput {
  knowledgeWorkspaceId: string;
  evidence: StableEvidence;
  mode?: EvidenceReadMode;
  contextBytes?: number;
  maxReadBytes?: number;
}

export interface EvidenceReadResult {
  evidenceId: string;
  parsedArtifactId: string;
  sourceVersionId: string;
  mode: EvidenceReadMode;
  range: Utf8ByteRange;
  containerRange: Utf8ByteRange;
  text: string;
  evidenceRangeInRead: Utf8ByteRange;
  truncatedBefore: boolean;
  truncatedAfter: boolean;
}

const DEFAULT_CONTEXT_BYTES = 512;
const DEFAULT_MAX_READ_BYTES = 64 * 1024;
const MAX_CONTEXT_BYTES = 32 * 1024;
const MAX_READ_BYTES = 256 * 1024;

/**
 * Reads exact Evidence or bounded context from the same immutable ParsedArtifact.
 * The store is intentionally narrow because durable canonical-artifact materialization
 * is still an open dependency from P1-T08.
 */
export class EvidenceReadApi {
  constructor(private readonly artifacts: ParsedArtifactReadStore) {}

  read(input: EvidenceReadInput): EvidenceReadResult {
    const workspaceId = requireNonEmpty(input.knowledgeWorkspaceId, "knowledgeWorkspaceId");
    if (input.evidence.knowledgeWorkspaceId !== workspaceId) {
      throw new Error("Evidence does not belong to the requested Knowledge Workspace");
    }

    const mode = normalizeEvidenceReadMode(input.mode ?? "exact");
    const contextBytes = validateBoundedInteger(
      input.contextBytes ?? DEFAULT_CONTEXT_BYTES,
      "contextBytes",
      0,
      MAX_CONTEXT_BYTES,
    );
    const maxReadBytes = validateBoundedInteger(
      input.maxReadBytes ?? DEFAULT_MAX_READ_BYTES,
      "maxReadBytes",
      1,
      MAX_READ_BYTES,
    );

    const artifact = this.artifacts.read(workspaceId, input.evidence.parsedArtifactId);
    if (
      artifact.knowledgeWorkspaceId !== workspaceId ||
      artifact.parsedArtifactId !== input.evidence.parsedArtifactId ||
      artifact.sourceVersionId.trim().length === 0
    ) {
      throw new Error("ParsedArtifact store returned an authority mismatch");
    }

    assertEvidenceMatchesArtifact(input.evidence, artifact.canonicalBytes);
    validateDocumentStructure(artifact.documentStructure, artifact.canonicalBytes.byteLength);

    const evidenceRange = {
      startByte: input.evidence.startByte,
      endByte: input.evidence.endByte,
    } satisfies Utf8ByteRange;
    const evidenceLength = evidenceRange.endByte - evidenceRange.startByte;
    if (evidenceLength > maxReadBytes) {
      throw new RangeError("maxReadBytes is smaller than the exact Evidence range");
    }

    let containerRange: Utf8ByteRange;
    let desiredRange: Utf8ByteRange;

    if (mode === "exact") {
      containerRange = evidenceRange;
      desiredRange = evidenceRange;
    } else if (mode === "context") {
      containerRange = { startByte: 0, endByte: artifact.canonicalBytes.byteLength };
      desiredRange = {
        startByte: Math.max(containerRange.startByte, evidenceRange.startByte - contextBytes),
        endByte: Math.min(containerRange.endByte, evidenceRange.endByte + contextBytes),
      };
    } else {
      containerRange = findContainingSection(
        artifact.documentStructure,
        evidenceRange,
        artifact.canonicalBytes.byteLength,
      );
      desiredRange = containerRange;
    }

    const range = mode === "exact"
      ? evidenceRange
      : boundedUtf8Window(
          artifact.canonicalBytes,
          evidenceRange,
          desiredRange,
          maxReadBytes,
        );

    return {
      evidenceId: input.evidence.id,
      parsedArtifactId: artifact.parsedArtifactId,
      sourceVersionId: artifact.sourceVersionId,
      mode,
      range,
      containerRange,
      text: extractExactQuote(artifact.canonicalBytes, range),
      evidenceRangeInRead: {
        startByte: evidenceRange.startByte - range.startByte,
        endByte: evidenceRange.endByte - range.startByte,
      },
      truncatedBefore: range.startByte > containerRange.startByte,
      truncatedAfter: range.endByte < containerRange.endByte,
    };
  }
}

function normalizeEvidenceReadMode(value: unknown): EvidenceReadMode {
  if (value === "exact" || value === "context" || value === "section") return value;
  throw new TypeError(`Unsupported Evidence read mode: ${String(value)}`);
}

function findContainingSection(
  nodes: readonly DocumentNode[],
  evidence: Utf8ByteRange,
  artifactLength: number,
): Utf8ByteRange {
  const headings = nodes.filter((node) => node.kind === "heading" && node.startByte <= evidence.startByte);
  const heading = headings.at(-1);

  if (!heading) {
    const nextHeading = nodes.find((node) => node.kind === "heading" && node.startByte >= evidence.endByte);
    return { startByte: 0, endByte: nextHeading?.startByte ?? artifactLength };
  }

  const level = heading.level;
  if (level === undefined) throw new Error("Heading node is missing its level");
  const nextPeerOrAncestor = nodes.find(
    (node) =>
      node.kind === "heading" &&
      node.startByte > heading.startByte &&
      node.level !== undefined &&
      node.level <= level,
  );
  return {
    startByte: heading.startByte,
    endByte: nextPeerOrAncestor?.startByte ?? artifactLength,
  };
}

function boundedUtf8Window(
  bytes: Uint8Array,
  evidence: Utf8ByteRange,
  desired: Utf8ByteRange,
  maxBytes: number,
): Utf8ByteRange {
  const desiredStart = Math.min(desired.startByte, evidence.startByte);
  const desiredEnd = Math.max(desired.endByte, evidence.endByte);
  if (desiredEnd - desiredStart <= maxBytes) {
    return {
      startByte: moveToBoundary(bytes, desiredStart, 1),
      endByte: moveToBoundary(bytes, desiredEnd, -1),
    };
  }

  const evidenceLength = evidence.endByte - evidence.startByte;
  const extraBudget = maxBytes - evidenceLength;
  const availableBefore = evidence.startByte - desiredStart;
  const availableAfter = desiredEnd - evidence.endByte;
  let before = Math.min(availableBefore, Math.floor(extraBudget / 2));
  let after = Math.min(availableAfter, extraBudget - before);

  let unused = extraBudget - before - after;
  if (unused > 0) {
    const addBefore = Math.min(availableBefore - before, unused);
    before += addBefore;
    unused -= addBefore;
  }
  if (unused > 0) after += Math.min(availableAfter - after, unused);

  const startByte = moveToBoundary(bytes, evidence.startByte - before, 1);
  const endByte = moveToBoundary(bytes, evidence.endByte + after, -1);
  return { startByte, endByte };
}

function moveToBoundary(bytes: Uint8Array, offset: number, direction: 1 | -1): number {
  let cursor = Math.max(0, Math.min(bytes.byteLength, offset));
  while (cursor > 0 && cursor < bytes.byteLength) {
    const byte = bytes[cursor];
    if (byte === undefined) throw new RangeError("UTF-8 boundary lookup exceeded artifact bytes");
    if (!isContinuationByte(byte)) break;
    cursor += direction;
  }
  return cursor;
}

function isContinuationByte(byte: number): boolean {
  return (byte & 0xc0) === 0x80;
}

function validateDocumentStructure(nodes: readonly DocumentNode[], byteLength: number): void {
  let previousStart = -1;
  for (const node of nodes) {
    if (
      !Number.isSafeInteger(node.startByte) ||
      !Number.isSafeInteger(node.endByte) ||
      node.startByte < 0 ||
      node.endByte <= node.startByte ||
      node.endByte > byteLength ||
      node.startByte < previousStart
    ) {
      throw new Error("ParsedArtifact document structure contains an invalid byte range");
    }
    if (node.kind === "heading") {
      const level = node.level;
      if (typeof level !== "number" || !Number.isSafeInteger(level) || level < 1 || level > 6) {
        throw new Error("ParsedArtifact heading contains an invalid level");
      }
    }
    previousStart = node.startByte;
  }
}

function requireNonEmpty(value: string, name: string): string {
  const normalized = value.trim();
  if (!normalized) throw new TypeError(`${name} must be non-empty`);
  return normalized;
}

function validateBoundedInteger(value: number, name: string, min: number, max: number): number {
  if (!Number.isSafeInteger(value) || value < min || value > max) {
    throw new TypeError(`${name} must be an integer between ${String(min)} and ${String(max)}`);
  }
  return value;
}
