import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import type { KnowledgeBackupManifest } from "./backup.js";
import type { KnowledgeDatabase, SqliteStatement } from "./database.js";
import { KnowledgeRestore } from "./restore.js";

const roots: string[] = [];

class SnapshotDatabase implements KnowledgeDatabase {
  constructor(
    private readonly blobs: unknown[] = [],
    private readonly artifacts: unknown[] = [],
    private readonly evidenceCount = 0,
  ) {}
  exec(): void { return; }
  close(): void { return; }
  pragma(source: string): unknown {
    if (source === "integrity_check") return "ok";
    if (source === "user_version") return 8;
    return undefined;
  }
  prepare(sql: string): SqliteStatement {
    return {
      run: () => ({ changes: 0, lastInsertRowid: 0 }),
      all: () => sql.includes("FROM source_versions") ? this.blobs : sql.includes("FROM parsed_artifacts") ? this.artifacts : [],
      get: () => sql.includes("FROM evidence") ? { count: this.evidenceCount } : undefined,
    };
  }
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

async function tempRoot(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "pi-knowledge-restore-test-"));
  roots.push(root);
  return root;
}

function sha(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

async function writeBackup(
  root: string,
  input: { blob?: Buffer; artifact?: Buffer; artifactId?: string } = {},
): Promise<{ backup: string; manifest: KnowledgeBackupManifest; blobHash?: string }> {
  const backup = path.join(root, "backup");
  await mkdir(backup, { recursive: true });
  const database = Buffer.from("sqlite snapshot bytes", "utf8");
  await writeFile(path.join(backup, "knowledge.sqlite"), database);

  let blobEntry: KnowledgeBackupManifest["blobs"][number] | undefined;
  let blobHash: string | undefined;
  if (input.blob !== undefined) {
    blobHash = sha(input.blob);
    const relative = `objects/blobs/sha256/${blobHash}`;
    await mkdir(path.join(backup, "objects/blobs/sha256"), { recursive: true });
    await writeFile(path.join(backup, ...relative.split("/")), input.blob);
    blobEntry = { path: relative, size: input.blob.byteLength, sha256: blobHash, contentSha256: blobHash };
  }

  const artifactId = input.artifactId ?? "artifact-1";
  let artifactEntry: KnowledgeBackupManifest["artifacts"][number] | undefined;
  if (input.artifact) {
    const artifactName = `${sha(Buffer.from(artifactId, "utf8"))}.bin`;
    const relative = `objects/artifacts/${artifactName}`;
    await mkdir(path.join(backup, "objects/artifacts"), { recursive: true });
    await writeFile(path.join(backup, ...relative.split("/")), input.artifact);
    artifactEntry = {
      path: relative,
      size: input.artifact.byteLength,
      sha256: sha(input.artifact),
      parsedArtifactId: artifactId,
      sourceVersionId: "sv-1",
      parserVersion: "parser-v1",
      canonicalTextSha256: "c".repeat(64),
    };
  }

  const manifest: KnowledgeBackupManifest = {
    formatVersion: 1,
    createdAt: "2026-09-09T08:00:00.000Z",
    schemaVersion: 8,
    database: { path: "knowledge.sqlite", size: database.byteLength, sha256: sha(database) },
    blobs: blobEntry ? [blobEntry] : [],
    artifacts: artifactEntry ? [artifactEntry] : [],
  };
  const manifestBytes = Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  await writeFile(path.join(backup, "manifest.json"), manifestBytes);
  await writeFile(path.join(backup, "manifest.sha256"), `${sha(manifestBytes)}  manifest.json\n`);
  return { backup, manifest, ...(blobHash !== undefined ? { blobHash } : {}) };
}

describe("KnowledgeRestore", () => {
  it("verifies the backup before atomically restoring DB and raw blobs into a new controlled target", async () => {
    const root = await tempRoot();
    const raw = Buffer.from("raw source bytes", "utf8");
    const fixture = await writeBackup(root, { blob: raw });
    const blobHash = fixture.blobHash;
    if (blobHash === undefined) throw new Error("expected backup blob hash");
    const snapshot = new SnapshotDatabase([
      { content_sha256: blobHash, blob_key: blobHash, byte_length: raw.byteLength },
    ]);
    const target = path.join(root, "restored");
    const restore = new KnowledgeRestore({ createId: () => "restore-1", openSnapshotDatabase: () => snapshot });

    const result = await restore.restore(fixture.backup, target);

    expect(result).toMatchObject({ schemaVersion: 8, blobCount: 1, artifactCount: 0, evidenceCount: 0 });
    expect(await readFile(path.join(target, "knowledge.sqlite"), "utf8")).toBe("sqlite snapshot bytes");
    expect(await readFile(path.join(target, "blobs/sha256", blobHash))).toEqual(raw);
    expect(JSON.parse(await readFile(path.join(target, "restore-source-manifest.json"), "utf8"))).toEqual(fixture.manifest);
  });

  it("rejects manifest tamper before creating the target", async () => {
    const root = await tempRoot();
    const fixture = await writeBackup(root);
    await writeFile(path.join(fixture.backup, "manifest.json"), "{}\n");
    const target = path.join(root, "restored");
    const restore = new KnowledgeRestore({ openSnapshotDatabase: () => new SnapshotDatabase() });

    await expect(restore.restore(fixture.backup, target)).rejects.toThrow(/manifest checksum/);
    await expect(stat(target)).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("fails closed when artifact materialization is required but no sink exists", async () => {
    const root = await tempRoot();
    const artifact = Buffer.from("artifact bundle", "utf8");
    const fixture = await writeBackup(root, { artifact });
    const snapshot = new SnapshotDatabase([], [
      { id: "artifact-1", source_version_id: "sv-1", parser_version: "parser-v1", canonical_text_sha256: "c".repeat(64) },
    ]);
    const restore = new KnowledgeRestore({ openSnapshotDatabase: () => snapshot });
    await expect(restore.restore(fixture.backup, path.join(root, "restored"))).rejects.toThrow(/ParsedArtifact sink/);
  });

  it("requires historical Evidence verification rather than treating SQLite-open as restore success", async () => {
    const root = await tempRoot();
    const fixture = await writeBackup(root);
    const restore = new KnowledgeRestore({ openSnapshotDatabase: () => new SnapshotDatabase([], [], 1) });
    await expect(restore.restore(fixture.backup, path.join(root, "restored"))).rejects.toThrow(/historical Evidence verification/);
  });

  it("allows a complete fixture restore only after artifact materialization and Evidence verification succeed", async () => {
    const root = await tempRoot();
    const artifact = Buffer.from("artifact bundle", "utf8");
    const fixture = await writeBackup(root, { artifact });
    const snapshot = new SnapshotDatabase([], [
      { id: "artifact-1", source_version_id: "sv-1", parser_version: "parser-v1", canonical_text_sha256: "c".repeat(64) },
    ], 1);
    let verified = false;
    const restore = new KnowledgeRestore({
      createId: () => "restore-2",
      openSnapshotDatabase: () => snapshot,
      artifactSink: {
        writeArtifactBundle: async (targetRoot, entry, bytes) => {
          await mkdir(path.join(targetRoot, "artifacts"), { recursive: true });
          await writeFile(path.join(targetRoot, "artifacts", `${entry.parsedArtifactId}.bin`), bytes);
        },
      },
      evidenceVerifier: {
        verifyRestoredEvidence: async ({ databasePath, dataRoot }) => {
          expect(databasePath).toContain(".pi-knowledge-restore-tmp-");
          expect(await readFile(path.join(dataRoot, "artifacts/artifact-1.bin"))).toEqual(artifact);
          verified = true;
        },
      },
    });

    const result = await restore.restore(fixture.backup, path.join(root, "restored"));
    expect(result.evidenceCount).toBe(1);
    expect(verified).toBe(true);
  });
});
