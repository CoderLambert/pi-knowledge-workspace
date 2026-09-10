import { describe, expect, it } from "vitest";

import { createStableEvidence } from "./evidence.js";
import { EvidenceReadApi, type ParsedArtifactReadStore, type ReadableParsedArtifact } from "./evidenceRead.js";
import type { DocumentNode } from "./parsedArtifact.js";

function rangeOf(text: string, needle: string): { startByte: number; endByte: number } {
  const startByte = Buffer.from(text.slice(0, text.indexOf(needle)), "utf8").byteLength;
  return { startByte, endByte: startByte + Buffer.from(needle, "utf8").byteLength };
}

function artifactFixture(text: string, structure: readonly DocumentNode[]): ReadableParsedArtifact {
  return {
    knowledgeWorkspaceId: "workspace-1",
    parsedArtifactId: "artifact-1",
    sourceVersionId: "version-1",
    canonicalBytes: Buffer.from(text, "utf8"),
    documentStructure: structure,
  };
}

function apiFor(artifact: ReadableParsedArtifact): EvidenceReadApi {
  const store: ParsedArtifactReadStore = {
    read: () => artifact,
  };
  return new EvidenceReadApi(store);
}

function evidenceFor(artifact: ReadableParsedArtifact, quote: string) {
  return createStableEvidence({
    id: "evidence-1",
    createdAt: "2026-09-09T00:00:00.000Z",
    knowledgeWorkspaceId: artifact.knowledgeWorkspaceId,
    parsedArtifactId: artifact.parsedArtifactId,
    canonicalBytes: artifact.canonicalBytes,
    range: rangeOf(Buffer.from(artifact.canonicalBytes).toString("utf8"), quote),
    locatorSnapshot: { heading: "Section A" },
  });
}

describe("Evidence read API", () => {
  it("reads exact Evidence from authoritative ParsedArtifact bytes", () => {
    const text = "前言\nexact 引用🙂\n尾部";
    const artifact = artifactFixture(text, []);
    const evidence = evidenceFor(artifact, "exact 引用🙂");

    const result = apiFor(artifact).read({ knowledgeWorkspaceId: "workspace-1", evidence });

    expect(result.mode).toBe("exact");
    expect(result.text).toBe("exact 引用🙂");
    expect(result.range).toEqual({ startByte: evidence.startByte, endByte: evidence.endByte });
    expect(result.evidenceRangeInRead).toEqual({ startByte: 0, endByte: evidence.endByte - evidence.startByte });
    expect(result.truncatedBefore).toBe(false);
    expect(result.truncatedAfter).toBe(false);
  });

  it("expands nearby context without splitting UTF-8 code points and stays inside maxReadBytes", () => {
    const text = "甲乙丙丁🙂ABCDE证据FGHIJ🙂戊己庚辛";
    const artifact = artifactFixture(text, []);
    const evidence = evidenceFor(artifact, "证据");

    const result = apiFor(artifact).read({
      knowledgeWorkspaceId: "workspace-1",
      evidence,
      mode: "context",
      contextBytes: 11,
      maxReadBytes: 24,
    });

    expect(Buffer.byteLength(result.text, "utf8")).toBeLessThanOrEqual(24);
    expect(result.text).toContain("证据");
    expect(result.evidenceRangeInRead.startByte).toBeGreaterThanOrEqual(0);
    expect(result.evidenceRangeInRead.endByte).toBeLessThanOrEqual(Buffer.byteLength(result.text, "utf8"));
  });

  it("returns the containing Markdown heading section and never crosses into the next peer section", () => {
    const text = "# A\nalpha\nneedle\n## child\nchild text\n# B\nbeta";
    const hA = rangeOf(text, "# A");
    const child = rangeOf(text, "## child");
    const hB = rangeOf(text, "# B");
    const structure: DocumentNode[] = [
      { kind: "heading", ...hA, level: 1 },
      { kind: "heading", ...child, level: 2 },
      { kind: "heading", ...hB, level: 1 },
    ];
    const artifact = artifactFixture(text, structure);
    const evidence = evidenceFor(artifact, "needle");

    const result = apiFor(artifact).read({
      knowledgeWorkspaceId: "workspace-1",
      evidence,
      mode: "section",
    });

    expect(result.containerRange).toEqual({ startByte: hA.startByte, endByte: hB.startByte });
    expect(result.text).toContain("# A");
    expect(result.text).toContain("## child");
    expect(result.text).not.toContain("# B");
  });

  it("bounds an oversized containing section around Evidence and reports truncation", () => {
    const before = "a".repeat(80);
    const after = "b".repeat(80);
    const text = `# A\n${before}needle${after}\n# B`;
    const hA = rangeOf(text, "# A");
    const hB = rangeOf(text, "# B");
    const artifact = artifactFixture(text, [
      { kind: "heading", ...hA, level: 1 },
      { kind: "heading", ...hB, level: 1 },
    ]);
    const evidence = evidenceFor(artifact, "needle");

    const result = apiFor(artifact).read({
      knowledgeWorkspaceId: "workspace-1",
      evidence,
      mode: "section",
      maxReadBytes: 40,
    });

    expect(Buffer.byteLength(result.text, "utf8")).toBeLessThanOrEqual(40);
    expect(result.text).toContain("needle");
    expect(result.containerRange).toEqual({ startByte: hA.startByte, endByte: hB.startByte });
    expect(result.truncatedBefore).toBe(true);
    expect(result.truncatedAfter).toBe(true);
  });

  it("fails closed on Workspace/artifact authority mismatch or tampered authoritative bytes", () => {
    const artifact = artifactFixture("alpha needle omega", []);
    const evidence = evidenceFor(artifact, "needle");
    const api = apiFor(artifact);

    expect(() => api.read({ knowledgeWorkspaceId: "workspace-2", evidence })).toThrow(/does not belong/);

    const wrongArtifact = { ...artifact, parsedArtifactId: "artifact-2" };
    expect(() => apiFor(wrongArtifact).read({ knowledgeWorkspaceId: "workspace-1", evidence })).toThrow(/authority mismatch/);

    const tampered = { ...artifact, canonicalBytes: Buffer.from("alpha xxxxxx omega", "utf8") };
    expect(() => apiFor(tampered).read({ knowledgeWorkspaceId: "workspace-1", evidence })).toThrow(
      /Evidence no longer matches/,
    );
  });

  it("rejects unsafe bounds and malformed document structure before returning expanded text", () => {
    const text = "# A\nneedle";
    const artifact = artifactFixture(text, []);
    const evidence = evidenceFor(artifact, "needle");

    expect(() =>
      apiFor(artifact).read({ knowledgeWorkspaceId: "workspace-1", evidence, mode: "context", contextBytes: 32769 }),
    ).toThrow(/contextBytes/);
    expect(() =>
      apiFor(artifact).read({ knowledgeWorkspaceId: "workspace-1", evidence, maxReadBytes: 2 }),
    ).toThrow(/smaller than the exact Evidence range/);

    const malformed = artifactFixture(text, [{ kind: "heading", startByte: 0, endByte: 3, level: 9 }]);
    expect(() => apiFor(malformed).read({ knowledgeWorkspaceId: "workspace-1", evidence, mode: "section" })).toThrow(
      /invalid level/,
    );
  });
});
