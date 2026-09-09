import type { DocumentNode, DocumentNodeKind, ParsedArtifactCanonical } from "./parsedArtifact.js";

export const DEFAULT_CHUNK_TARGET_BYTES = 2400;

export interface StructureAwareChunk {
  ordinal: number;
  startByte: number;
  endByte: number;
  text: string;
  nodeKinds: readonly DocumentNodeKind[];
}

export interface ChunkerOptions {
  /** Experimental implementation budget, not a persisted retrieval contract. */
  targetBytes?: number;
}

/**
 * Chunks canonical ParsedArtifact bytes without rewriting text.
 *
 * Heading-delimited sections are kept intact when they fit the budget. Oversized
 * sections split at structural-node boundaries; only an individually oversized
 * node is split inside the node, always on a UTF-8 code-point boundary.
 */
export function chunkParsedArtifact(
  artifact: ParsedArtifactCanonical,
  options: ChunkerOptions = {},
): StructureAwareChunk[] {
  const targetBytes = options.targetBytes ?? DEFAULT_CHUNK_TARGET_BYTES;
  if (!Number.isSafeInteger(targetBytes) || targetBytes <= 0) {
    throw new TypeError("targetBytes must be a positive safe integer");
  }

  const bytes = artifact.canonicalBytes;
  new TextDecoder("utf-8", { fatal: true }).decode(bytes);

  if (bytes.byteLength === 0) return [];
  if (artifact.documentStructure.length === 0) {
    return materializeRanges(bytes, splitUtf8Range(bytes, 0, bytes.byteLength, targetBytes), []);
  }

  assertStructureIsValid(bytes, artifact.documentStructure);

  const ranges: Array<{ startByte: number; endByte: number; nodeKinds: DocumentNodeKind[] }> = [];
  for (const section of buildSections(artifact.documentStructure)) {
    const sectionStart = section.nodes[0]!.startByte;
    const sectionEnd = section.nodes.at(-1)!.endByte;

    if (sectionEnd - sectionStart <= targetBytes) {
      ranges.push({
        startByte: sectionStart,
        endByte: sectionEnd,
        nodeKinds: uniqueKinds(section.nodes),
      });
      continue;
    }

    let current: { startByte: number; endByte: number; nodes: DocumentNode[] } | undefined;
    const flush = (): void => {
      if (!current) return;
      ranges.push({
        startByte: current.startByte,
        endByte: current.endByte,
        nodeKinds: uniqueKinds(current.nodes),
      });
      current = undefined;
    };

    for (const node of section.nodes) {
      const nodeLength = node.endByte - node.startByte;
      if (nodeLength > targetBytes) {
        flush();
        for (const part of splitUtf8Range(bytes, node.startByte, node.endByte, targetBytes)) {
          ranges.push({ ...part, nodeKinds: [node.kind] });
        }
        continue;
      }

      if (!current) {
        current = { startByte: node.startByte, endByte: node.endByte, nodes: [node] };
        continue;
      }

      if (node.endByte - current.startByte <= targetBytes) {
        current.endByte = node.endByte;
        current.nodes.push(node);
      } else {
        flush();
        current = { startByte: node.startByte, endByte: node.endByte, nodes: [node] };
      }
    }
    flush();
  }

  return ranges.map((range, ordinal) => ({
    ordinal,
    startByte: range.startByte,
    endByte: range.endByte,
    text: decodeRange(bytes, range.startByte, range.endByte),
    nodeKinds: Object.freeze([...range.nodeKinds]),
  }));
}

function buildSections(nodes: readonly DocumentNode[]): Array<{ nodes: DocumentNode[] }> {
  const sections: Array<{ nodes: DocumentNode[] }> = [];
  let current: DocumentNode[] = [];

  for (const node of nodes) {
    if (node.kind === "heading" && current.length > 0) {
      sections.push({ nodes: current });
      current = [];
    }
    current.push(node);
  }
  if (current.length > 0) sections.push({ nodes: current });
  return sections;
}

function splitUtf8Range(
  bytes: Uint8Array,
  startByte: number,
  endByte: number,
  targetBytes: number,
): Array<{ startByte: number; endByte: number }> {
  const ranges: Array<{ startByte: number; endByte: number }> = [];
  let start = startByte;

  while (start < endByte) {
    let end = Math.min(start + targetBytes, endByte);
    while (end > start && end < endByte && isContinuationByte(bytes[end]!)) end -= 1;
    if (end === start) {
      end = Math.min(start + 1, endByte);
      while (end < endByte && isContinuationByte(bytes[end]!)) end += 1;
    }
    ranges.push({ startByte: start, endByte: end });
    start = end;
  }
  return ranges;
}

function assertStructureIsValid(bytes: Uint8Array, nodes: readonly DocumentNode[]): void {
  let previousEnd = 0;
  for (const node of nodes) {
    if (
      !Number.isSafeInteger(node.startByte) ||
      !Number.isSafeInteger(node.endByte) ||
      node.startByte < 0 ||
      node.endByte <= node.startByte ||
      node.endByte > bytes.byteLength ||
      node.startByte < previousEnd ||
      !isUtf8Boundary(bytes, node.startByte) ||
      !isUtf8Boundary(bytes, node.endByte)
    ) {
      throw new Error("ParsedArtifact document structure contains an invalid canonical UTF-8 byte range");
    }
    previousEnd = node.endByte;
  }
}

function materializeRanges(
  bytes: Uint8Array,
  ranges: readonly { startByte: number; endByte: number }[],
  nodeKinds: readonly DocumentNodeKind[],
): StructureAwareChunk[] {
  return ranges.map((range, ordinal) => ({
    ordinal,
    ...range,
    text: decodeRange(bytes, range.startByte, range.endByte),
    nodeKinds,
  }));
}

function decodeRange(bytes: Uint8Array, startByte: number, endByte: number): string {
  return new TextDecoder("utf-8", { fatal: true }).decode(bytes.slice(startByte, endByte));
}

function uniqueKinds(nodes: readonly DocumentNode[]): DocumentNodeKind[] {
  return [...new Set(nodes.map((node) => node.kind))];
}

function isUtf8Boundary(bytes: Uint8Array, offset: number): boolean {
  return offset === 0 || offset === bytes.byteLength || !isContinuationByte(bytes[offset]!);
}

function isContinuationByte(byte: number): boolean {
  return (byte & 0xc0) === 0x80;
}
