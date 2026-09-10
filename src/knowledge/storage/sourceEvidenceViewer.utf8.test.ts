import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";

import type { KnowledgeDatabase, SqliteStatement } from "./database.js";
import type { ParsedArtifactReadStore } from "./evidenceRead.js";
import { SourceEvidenceViewer } from "./sourceEvidenceViewer.js";

function sha256(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

describe("SourceEvidenceViewer UTF-8 preview", () => {
  it("moves a byte-budget cut backward to a UTF-8 boundary", () => {
    const text = "# 指南\n正文";
    const bytes = new TextEncoder().encode(text);
    const db = {
      exec() { return undefined; },
      close() { return undefined; },
      pragma() { return undefined; },
      prepare(sql: string): SqliteStatement {
        return {
          run() { return { changes: 0, lastInsertRowid: 0 }; },
          all() { return []; },
          get() {
            if (!sql.includes("FROM parsed_artifacts pa")) return undefined;
            return {
              source_id: "source-1",
              display_name: "guide.md",
              kind: "workspace-file",
              source_version_id: "version-1",
              content_sha256: sha256(text),
              byte_length: bytes.byteLength,
              source_version_created_at: "2026-09-09T00:00:00.000Z",
              parsed_artifact_id: "artifact-1",
              parser_version: "md-v1",
              canonical_text_sha256: sha256(text),
              parsed_artifact_created_at: "2026-09-09T00:00:01.000Z",
            };
          },
        };
      },
    } satisfies KnowledgeDatabase;
    const artifacts: ParsedArtifactReadStore = {
      read() {
        return {
          knowledgeWorkspaceId: "workspace-1",
          parsedArtifactId: "artifact-1",
          sourceVersionId: "version-1",
          canonicalBytes: bytes,
          documentStructure: [],
        };
      },
    };

    // 4 bytes lands between the three bytes of 指: "# " is 2 bytes, 指 occupies bytes 2..5.
    const document = new SourceEvidenceViewer(db, artifacts).openArtifact({
      knowledgeWorkspaceId: "workspace-1",
      parsedArtifactId: "artifact-1",
      maxBytes: 4,
    });

    expect(document.text).toBe("# ");
    expect(document.truncated).toBe(true);
    expect(document.text).not.toContain("�");
  });
});
