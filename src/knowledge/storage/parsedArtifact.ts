import { createHash } from "node:crypto";

import type { ContentAddressedBlobStore } from "./blobStore.js";
import type { KnowledgeSourceVersion } from "./sourceDomain.js";

export const PARSER_FINGERPRINT = "md-txt-parser-v1";
export const NORMALIZATION_FINGERPRINT = "utf8-bom-strip+newline-lf-v1";

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
  canonicalText: string;
  canonicalBytes: Uint8Array;
  canonicalTextSha256: string;
  documentStructure: readonly DocumentNode[];
  sourceMap: readonly SourceMapSegment[];
  parserFingerprint: string;
  normalizationFingerprint: string;
  artifactHash: string;
}

export class ParsedArtifactCanonicalizer {
  constructor(private readonly blobs: ContentAddressedBlobStore) {}

  async fromSourceVersion(sourceVersion: KnowledgeSourceVersion, sourceKind: string): Promise<ParsedArtifactCanonical> {
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

    return canonicalizeParsedArtifact(sourceVersion.id, rawBytes, sourceKind);
  }
}

export function canonicalizeParsedArtifact(
  sourceVersionId: string,
  rawBytes: Uint8Array,
  sourceKind: "md" | "txt",
): ParsedArtifactCanonical {
  // Validate the complete source as UTF-8 before performing byte-preserving normalization.
  new TextDecoder("utf-8", { fatal: true }).decode(rawBytes);

  const { bytes, sourceMap } = normalizeUtf8Bytes(rawBytes);
  const canonicalText = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  const canonicalTextSha256 = sha256(bytes);
  const documentStructure = parseStructure(canonicalText, sourceKind);
  const artifactHash = sha256(
    Buffer.from(
      JSON.stringify({
        sourceVersionId,
        parserFingerprint: PARSER_FINGERPRINT,
        normalizationFingerprint: NORMALIZATION_FINGERPRINT,
        canonicalTextSha256,
        documentStructure,
        sourceMap,
      }),
      "utf8",
    ),
  );

  return {
    sourceVersionId,
    canonicalText,
    canonicalBytes: bytes,
    canonicalTextSha256,
    documentStructure,
    sourceMap,
    parserFingerprint: PARSER_FINGERPRINT,
    normalizationFingerprint: NORMALIZATION_FINGERPRINT,
    artifactHash,
  };
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
