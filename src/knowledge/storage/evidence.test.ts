import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import { assertEvidenceMatchesArtifact, createStableEvidence } from "./evidence.js";

function bytes(text: string): Uint8Array {
  return Buffer.from(text, "utf8");
}

const WORKSPACE_ID = "workspace-1";

describe("Stable Evidence entity", () => {
  it("derives exact quote and quote hash from authoritative artifact bytes", () => {
    const canonicalBytes = bytes("前言\nEvidence 😀 quote\n后记");
    const startByte = Buffer.byteLength("前言\n", "utf8");
    const endByte = startByte + Buffer.byteLength("Evidence 😀 quote", "utf8");

    const evidence = createStableEvidence({
      knowledgeWorkspaceId: WORKSPACE_ID,
      parsedArtifactId: "artifact-1",
      canonicalBytes,
      range: { startByte, endByte },
      locatorSnapshot: { heading: "Intro", ordinal: 2 },
      id: "evidence-1",
      createdAt: "2026-09-09T00:00:00.000Z",
    });

    expect(evidence).toMatchObject({
      id: "evidence-1",
      knowledgeWorkspaceId: WORKSPACE_ID,
      parsedArtifactId: "artifact-1",
      startByte,
      endByte,
      exactQuote: "Evidence 😀 quote",
      locatorSnapshot: { heading: "Intro", ordinal: 2 },
    });
    expect(evidence.quoteHash).toBe(
      createHash("sha256").update(Buffer.from("Evidence 😀 quote", "utf8")).digest("hex"),
    );
    expect(() => assertEvidenceMatchesArtifact(evidence, canonicalBytes)).not.toThrow();
  });

  it("uses byte range rather than quote text to distinguish duplicated passages", () => {
    const canonicalBytes = bytes("same / same / same");
    const first = createStableEvidence({
      knowledgeWorkspaceId: WORKSPACE_ID,
      parsedArtifactId: "artifact-1",
      canonicalBytes,
      range: { startByte: 0, endByte: 4 },
      locatorSnapshot: { occurrence: 1 },
    });
    const second = createStableEvidence({
      knowledgeWorkspaceId: WORKSPACE_ID,
      parsedArtifactId: "artifact-1",
      canonicalBytes,
      range: { startByte: 7, endByte: 11 },
      locatorSnapshot: { occurrence: 2 },
    });

    expect(first.exactQuote).toBe("same");
    expect(second.exactQuote).toBe("same");
    expect(first.quoteHash).toBe(second.quoteHash);
    expect(first.startByte).not.toBe(second.startByte);
  });

  it("does not accept caller-supplied authoritative quote or quote hash fields", () => {
    const canonicalBytes = bytes("server truth");
    const forgedInput = {
      knowledgeWorkspaceId: WORKSPACE_ID,
      parsedArtifactId: "artifact-1",
      canonicalBytes,
      range: { startByte: 0, endByte: 6 },
      locatorSnapshot: {},
      exactQuote: "forged",
      quoteHash: "0".repeat(64),
      id: "evidence-1",
    };

    const evidence = createStableEvidence(forgedInput);
    expect(evidence.exactQuote).toBe("server");
    expect(evidence.quoteHash).not.toBe("0".repeat(64));
  });

  it("fails closed when persisted evidence is checked against changed authoritative bytes", () => {
    const evidence = createStableEvidence({
      knowledgeWorkspaceId: WORKSPACE_ID,
      parsedArtifactId: "artifact-1",
      canonicalBytes: bytes("stable quote"),
      range: { startByte: 0, endByte: 6 },
      locatorSnapshot: {},
    });

    expect(() => assertEvidenceMatchesArtifact(evidence, bytes("staple quote"))).toThrow(
      "Evidence no longer matches authoritative ParsedArtifact bytes",
    );
  });

  it("rejects empty, mid-code-point and out-of-bounds Evidence ranges", () => {
    const canonicalBytes = bytes("A😀B");

    expect(() =>
      createStableEvidence({
        knowledgeWorkspaceId: WORKSPACE_ID,
        parsedArtifactId: "artifact-1",
        canonicalBytes,
        range: { startByte: 1, endByte: 1 },
        locatorSnapshot: {},
      }),
    ).toThrow("Evidence range must address at least one UTF-8 byte");
    expect(() =>
      createStableEvidence({
        knowledgeWorkspaceId: WORKSPACE_ID,
        parsedArtifactId: "artifact-1",
        canonicalBytes,
        range: { startByte: 2, endByte: 5 },
        locatorSnapshot: {},
      }),
    ).toThrow();
    expect(() =>
      createStableEvidence({
        knowledgeWorkspaceId: WORKSPACE_ID,
        parsedArtifactId: "artifact-1",
        canonicalBytes,
        range: { startByte: 1, endByte: 99 },
        locatorSnapshot: {},
      }),
    ).toThrow();
  });

  it("snapshots locator metadata instead of retaining the caller's mutable object", () => {
    const locator: Record<string, unknown> = { heading: "Before", nested: { ordinal: 1 } };
    const evidence = createStableEvidence({
      knowledgeWorkspaceId: WORKSPACE_ID,
      parsedArtifactId: "artifact-1",
      canonicalBytes: bytes("quote"),
      range: { startByte: 0, endByte: 5 },
      locatorSnapshot: locator,
    });

    locator["heading"] = "After";
    (locator["nested"] as { ordinal: number }).ordinal = 9;
    expect(evidence.locatorSnapshot).toEqual({ heading: "Before", nested: { ordinal: 1 } });
  });
});
