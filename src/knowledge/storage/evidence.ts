import { randomUUID } from "node:crypto";

import {
  assertValidUtf8Range,
  extractExactQuote,
  hashUtf8Range,
  type Utf8ByteRange,
} from "./utf8Range.js";

export interface StableEvidence {
  id: string;
  knowledgeWorkspaceId: string;
  parsedArtifactId: string;
  startByte: number;
  endByte: number;
  exactQuote: string;
  quoteHash: string;
  locatorSnapshot: Readonly<Record<string, unknown>>;
  createdAt: string;
}

export interface CreateStableEvidenceInput {
  knowledgeWorkspaceId: string;
  parsedArtifactId: string;
  canonicalBytes: Uint8Array;
  range: Utf8ByteRange;
  locatorSnapshot: Readonly<Record<string, unknown>>;
  id?: string;
  createdAt?: string;
}

/**
 * Creates Evidence only from authoritative ParsedArtifact bytes.
 *
 * Callers provide an address, not authoritative quote text or quote hashes.
 * Those values are always derived server-side from the canonical bytes.
 */
export function createStableEvidence(input: CreateStableEvidenceInput): StableEvidence {
  if (input.knowledgeWorkspaceId.trim().length === 0) {
    throw new TypeError("knowledgeWorkspaceId must not be empty");
  }
  if (input.parsedArtifactId.trim().length === 0) {
    throw new TypeError("parsedArtifactId must not be empty");
  }

  assertValidUtf8Range(input.canonicalBytes, input.range);
  if (input.range.startByte === input.range.endByte) {
    throw new TypeError("Evidence range must address at least one UTF-8 byte");
  }

  const locatorSnapshot = cloneJsonObject(input.locatorSnapshot);
  const createdAt = input.createdAt ?? new Date().toISOString();
  if (!Number.isFinite(Date.parse(createdAt))) {
    throw new TypeError("createdAt must be an ISO-compatible timestamp");
  }

  return Object.freeze({
    id: input.id ?? randomUUID(),
    knowledgeWorkspaceId: input.knowledgeWorkspaceId,
    parsedArtifactId: input.parsedArtifactId,
    startByte: input.range.startByte,
    endByte: input.range.endByte,
    exactQuote: extractExactQuote(input.canonicalBytes, input.range),
    quoteHash: hashUtf8Range(input.canonicalBytes, input.range),
    locatorSnapshot,
    createdAt,
  });
}

/** Revalidates persisted Evidence against authoritative artifact bytes. */
export function assertEvidenceMatchesArtifact(evidence: StableEvidence, canonicalBytes: Uint8Array): void {
  assertValidUtf8Range(canonicalBytes, evidence);
  const exactQuote = extractExactQuote(canonicalBytes, evidence);
  const quoteHash = hashUtf8Range(canonicalBytes, evidence);

  if (exactQuote !== evidence.exactQuote || quoteHash !== evidence.quoteHash) {
    throw new Error("Evidence no longer matches authoritative ParsedArtifact bytes");
  }
}

function cloneJsonObject(value: Readonly<Record<string, unknown>>): Readonly<Record<string, unknown>> {
  let serialized: string;
  try {
    serialized = JSON.stringify(value);
  } catch (error) {
    throw new TypeError("locatorSnapshot must be JSON-serializable", { cause: error });
  }

  const parsed: unknown = JSON.parse(serialized);
  if (parsed === null || Array.isArray(parsed) || typeof parsed !== "object") {
    throw new TypeError("locatorSnapshot must be a JSON object");
  }
  return Object.freeze(Object.fromEntries(Object.entries(parsed)));
}
