import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";

import type { KnowledgeDatabase, SqliteStatement } from "./database.js";
import type { ParsedArtifactReadStore, ReadableParsedArtifact } from "./evidenceRead.js";
import { SourceEvidenceViewer } from "./sourceEvidenceViewer.js";

const encoder = new TextEncoder();

function sha256(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

function fakeDatabase(rows: {
  sources: Record<string, unknown>[];
  versions: Record<string, unknown>[];
  artifacts: Record<string, unknown>[];
  evidence: Record<string, unknown>[];
}): KnowledgeDatabase {
  return {
    exec() {},
    close() {},
    pragma() { return undefined; },
    prepare(sql: string): SqliteStatement {
      return {
        run() { return { changes: 0, lastInsertRowid: 0 }; },
        get(...params: unknown[]) {
          if (sql.includes("FROM sources") && sql.includes("knowledge_workspace_id = ?") && !sql.includes("JOIN")) {
            const [sourceId, workspaceId] = params;
            return rows.sources.find((row) => row["id"] === sourceId && row["knowledge_workspace_id"] === workspaceId);
          }
          if (sql.includes("FROM parsed_artifacts pa") && sql.includes("JOIN source_versions")) {
            const [artifactId, workspaceId] = params;
            const artifact = rows.artifacts.find((row) => row["id"] === artifactId);
            const version = rows.versions.find((row) => row["id"] === artifact?.["source_version_id"]);
            const source = rows.sources.find((row) => row["id"] === version?.["source_id"]);
            if (artifact === undefined || version === undefined || source?.["knowledge_workspace_id"] !== workspaceId) return undefined;
            return {
              source_id: source["id"],
              display_name: source["display_name"],
              kind: source["kind"],
              source_version_id: version["id"],
              content_sha256: version["content_sha256"],
              byte_length: version["byte_length"],
              source_version_created_at: version["created_at"],
              parsed_artifact_id: artifact["id"],
              parser_version: artifact["parser_version"],
              canonical_text_sha256: artifact["canonical_text_sha256"],
              parsed_artifact_created_at: artifact["created_at"],
            };
          }
          if (sql.includes("FROM evidence")) {
            const [evidenceId, workspaceId] = params;
            return rows.evidence.find((row) => row["id"] === evidenceId && row["knowledge_workspace_id"] === workspaceId);
          }
          return undefined;
        },
        all(...params: unknown[]) {
          if (sql.includes("COUNT(sv.id)")) {
            const [workspaceId] = params;
            return rows.sources
              .filter((source) => source["knowledge_workspace_id"] === workspaceId)
              .map((source) => {
                const versions = rows.versions.filter((version) => version["source_id"] === source["id"]);
                const latest = versions.at(-1);
                return {
                  id: source["id"], display_name: source["display_name"], kind: source["kind"],
                  archived_at: source["archived_at"], created_at: source["created_at"],
                  version_count: versions.length, latest_version_id: latest?.["id"] ?? null,
                  latest_version_created_at: latest?.["created_at"] ?? null,
                };
              });
          }
          if (sql.includes("FROM source_versions")) {
            const [sourceId] = params;
            return rows.versions.filter((version) => version["source_id"] === sourceId).reverse();
          }
          if (sql.includes("FROM parsed_artifacts") && !sql.includes("JOIN")) {
            const [versionId] = params;
            return rows.artifacts.filter((artifact) => artifact["source_version_id"] === versionId).reverse();
          }
          return [];
        },
      };
    },
  };
}

function fixture() {
  const oldText = "# Guide\n\nHistorical evidence lives here.\n";
  const newText = "# Guide\n\nLatest content no longer contains the old sentence.\n";
  const oldBytes = encoder.encode(oldText);
  const newBytes = encoder.encode(newText);
  const quote = "Historical evidence";
  const quoteStart = oldBytes.indexOf(encoder.encode(quote)[0]!);
  const quoteEnd = quoteStart + encoder.encode(quote).byteLength;

  const rows = {
    sources: [{
      id: "source-1", knowledge_workspace_id: "workspace-1", display_name: "guide.md",
      kind: "workspace-file", archived_at: null, created_at: "2026-09-01T00:00:00.000Z",
    }],
    versions: [
      {
        id: "version-old", source_id: "source-1", content_sha256: sha256(oldText),
        byte_length: oldBytes.byteLength, created_at: "2026-09-01T00:00:00.000Z",
      },
      {
        id: "version-new", source_id: "source-1", content_sha256: sha256(newText),
        byte_length: newBytes.byteLength, created_at: "2026-09-02T00:00:00.000Z",
      },
    ],
    artifacts: [
      {
        id: "artifact-old", source_version_id: "version-old", parser_version: "md-v1",
        canonical_text_sha256: sha256(oldText), created_at: "2026-09-01T00:00:01.000Z",
      },
      {
        id: "artifact-new", source_version_id: "version-new", parser_version: "md-v1",
        canonical_text_sha256: sha256(newText), created_at: "2026-09-02T00:00:01.000Z",
      },
    ],
    evidence: [{
      id: "evidence-old", knowledge_workspace_id: "workspace-1", parsed_artifact_id: "artifact-old",
      start_byte: quoteStart, end_byte: quoteEnd, exact_quote: quote, quote_hash: sha256(quote),
      locator_snapshot: JSON.stringify({ heading: "Guide" }), created_at: "2026-09-01T00:00:02.000Z",
    }],
  };
  const artifacts = new Map<string, ReadableParsedArtifact>([
    ["artifact-old", {
      knowledgeWorkspaceId: "workspace-1", parsedArtifactId: "artifact-old", sourceVersionId: "version-old",
      canonicalBytes: oldBytes,
      documentStructure: [{ kind: "heading", startByte: 0, endByte: 7, level: 1 }],
    }],
    ["artifact-new", {
      knowledgeWorkspaceId: "workspace-1", parsedArtifactId: "artifact-new", sourceVersionId: "version-new",
      canonicalBytes: newBytes,
      documentStructure: [{ kind: "heading", startByte: 0, endByte: 7, level: 1 }],
    }],
  ]);
  const store: ParsedArtifactReadStore = {
    read(workspaceId, artifactId) {
      const artifact = artifacts.get(artifactId);
      if (artifact === undefined || artifact.knowledgeWorkspaceId !== workspaceId) throw new Error("missing artifact");
      return artifact;
    },
  };
  return { viewer: new SourceEvidenceViewer(fakeDatabase(rows), store), oldText, newText };
}

describe("SourceEvidenceViewer", () => {
  it("lists Sources with explicit latest-version metadata without collapsing history", () => {
    const { viewer } = fixture();
    expect(viewer.listSources("workspace-1")).toEqual([
      expect.objectContaining({ id: "source-1", versionCount: 2, latestVersionId: "version-new" }),
    ]);
  });

  it("returns SourceVersion history and ParsedArtifact lineage", () => {
    const { viewer } = fixture();
    const source = viewer.getSource("workspace-1", "source-1");
    expect(source.versions.map((version) => version.id)).toEqual(["version-new", "version-old"]);
    expect(source.versions[1]?.parsedArtifacts[0]?.id).toBe("artifact-old");
  });

  it("opens historical Evidence against its historical ParsedArtifact rather than latest Source content", () => {
    const { viewer, oldText, newText } = fixture();
    const document = viewer.openArtifact({
      knowledgeWorkspaceId: "workspace-1",
      parsedArtifactId: "artifact-old",
      evidenceId: "evidence-old",
      maxBytes: 1024,
    });

    expect(document.sourceVersion.id).toBe("version-old");
    expect(document.parsedArtifact.id).toBe("artifact-old");
    expect(document.text).toContain("Historical evidence");
    expect(document.text).not.toBe(newText);
    expect(document.text).toBe(oldText);
    expect(document.highlight?.exactQuote).toBe("Historical evidence");
  });

  it("rejects cross-workspace Source and artifact access", () => {
    const { viewer } = fixture();
    expect(() => viewer.getSource("workspace-other", "source-1")).toThrow(/not available/);
    expect(() => viewer.openArtifact({ knowledgeWorkspaceId: "workspace-other", parsedArtifactId: "artifact-old" }))
      .toThrow(/not available/);
  });

  it("rejects Evidence when the requested artifact does not own it", () => {
    const { viewer } = fixture();
    expect(() => viewer.openArtifact({
      knowledgeWorkspaceId: "workspace-1",
      parsedArtifactId: "artifact-new",
      evidenceId: "evidence-old",
    })).toThrow(/does not belong/);
  });
});
