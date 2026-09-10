import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { ContentAddressedBlobStore } from "./blobStore.js";
import {
  NORMALIZATION_FINGERPRINT,
  PARSER_FINGERPRINT,
  ParsedArtifactCanonicalizer,
  canonicalizeParsedArtifact,
} from "./parsedArtifact.js";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("ParsedArtifact canonicalization", () => {
  it("normalizes BOM and LF/CRLF/CR into one deterministic UTF-8 artifact", () => {
    const lf = canonicalizeParsedArtifact("sv-1", Buffer.from("# 标题\n正文 😀\n", "utf8"), "md");
    const crlf = canonicalizeParsedArtifact(
      "sv-1",
      Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from("# 标题\r\n正文 😀\r", "utf8")]),
      "md",
    );

    expect(crlf.canonicalText).toBe("# 标题\n正文 😀\n");
    expect(crlf.canonicalText).toBe(lf.canonicalText);
    expect(crlf.canonicalTextSha256).toBe(lf.canonicalTextSha256);
    expect(crlf.parserFingerprint).toBe(PARSER_FINGERPRINT);
    expect(crlf.normalizationFingerprint).toBe(NORMALIZATION_FINGERPRINT);
    expect(crlf.sourceMap[0]).toMatchObject({ canonicalStartByte: 0, sourceStartByte: 3 });
  });

  it("preserves Chinese, emoji, combining characters, duplicated text and code bytes", () => {
    const input = "重复\n重复\ne\u0301 😀\n```ts\nconst 文本 = \"😀\";\n```\n";
    const artifact = canonicalizeParsedArtifact("sv-unicode", Buffer.from(input, "utf8"), "md");

    expect(artifact.canonicalText).toBe(input);
    expect(Buffer.from(artifact.canonicalBytes).equals(Buffer.from(input, "utf8"))).toBe(true);
    expect(artifact.documentStructure.some((node) => node.kind === "code-block")).toBe(true);
  });

  it("extracts deterministic Markdown structure for headings, lists and tables", () => {
    const artifact = canonicalizeParsedArtifact(
      "sv-structure",
      Buffer.from("# H1\n\nParagraph\ncontinues\n\n- one\n2. two\n\n| a | b |\n| - | - |\n", "utf8"),
      "md",
    );

    expect(artifact.documentStructure.map((node) => node.kind)).toEqual([
      "heading",
      "paragraph",
      "list-item",
      "list-item",
      "table-row",
      "table-row",
    ]);
    expect(artifact.documentStructure[0]).toMatchObject({ kind: "heading", level: 1, startByte: 0 });
  });

  it("treats TXT as paragraphs without interpreting Markdown syntax", () => {
    const artifact = canonicalizeParsedArtifact("sv-txt", Buffer.from("# not heading\n- not list\n", "utf8"), "txt");
    expect(artifact.documentStructure).toEqual([
      {
        kind: "paragraph",
        startByte: 0,
        endByte: Buffer.byteLength("# not heading\n- not list\n", "utf8"),
      },
    ]);
  });

  it("rejects invalid UTF-8 instead of silently replacing source bytes", () => {
    expect(() => canonicalizeParsedArtifact("sv-invalid", Uint8Array.from([0xc3, 0x28]), "txt")).toThrow();
  });

  it("derives artifact identity from source version, fingerprints, structure and canonical text", () => {
    const bytes = Buffer.from("same text\n", "utf8");
    const first = canonicalizeParsedArtifact("sv-a", bytes, "txt");
    const repeated = canonicalizeParsedArtifact("sv-a", bytes, "txt");
    const otherVersion = canonicalizeParsedArtifact("sv-b", bytes, "txt");

    expect(repeated.artifactHash).toBe(first.artifactHash);
    expect(otherVersion.canonicalTextSha256).toBe(first.canonicalTextSha256);
    expect(otherVersion.artifactHash).not.toBe(first.artifactHash);
  });

  it("changes immutable identity for every material interpretation input", () => {
    const bytes = Buffer.from("same interpretation input\n", "utf8");
    const baseline = canonicalizeParsedArtifact("sv-a", bytes, "txt");
    const parser = canonicalizeParsedArtifact("sv-a", bytes, "txt", { parserFingerprint: "parser-v2" });
    const normalization = canonicalizeParsedArtifact("sv-a", bytes, "txt", {
      normalizationFingerprint: "normalization-v2",
    });
    const schema = canonicalizeParsedArtifact("sv-a", bytes, "txt", { documentSchemaVersion: 2 });
    const config = canonicalizeParsedArtifact("sv-a", bytes, "txt", {
      interpretationConfigRevision: "config-v2",
    });

    expect(new Set([baseline, parser, normalization, schema, config].map((artifact) => artifact.artifactHash)).size).toBe(5);
    expect(config.canonicalTextSha256).toBe(baseline.canonicalTextSha256);
    expect(config.interpretationConfigSha256).not.toBe(baseline.interpretationConfigSha256);
  });

  it("reads only the immutable SourceVersion blob and verifies its identity", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "pi-knowledge-parsed-artifact-"));
    tempDirs.push(root);
    const blobs = new ContentAddressedBlobStore(root);
    const raw = Buffer.from("# immutable\r\n正文\r\n", "utf8");
    const stored = await blobs.put(raw);
    const canonicalizer = new ParsedArtifactCanonicalizer(blobs);

    const artifact = await canonicalizer.fromSourceVersion(
      {
        id: "sv-blob",
        sourceId: "source-1",
        contentSha256: stored.hash,
        blobKey: stored.hash,
        byteLength: stored.size,
        createdAt: "2026-09-09T00:00:00.000Z",
      },
      "md",
    );

    expect(artifact.canonicalText).toBe("# immutable\n正文\n");
    await expect(
      canonicalizer.fromSourceVersion(
        {
          id: "sv-bad-key",
          sourceId: "source-1",
          contentSha256: stored.hash,
          blobKey: "0".repeat(64),
          byteLength: stored.size,
          createdAt: "2026-09-09T00:00:00.000Z",
        },
        "md",
      ),
    ).rejects.toThrow("blob identity");
  });
});
