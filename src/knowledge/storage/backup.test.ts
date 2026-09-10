import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { ContentAddressedBlobStore } from "./blobStore.js";
import { KnowledgeBackupCreator, type BackupCapableDatabase } from "./backup.js";
import type { KnowledgeDatabase, SqliteStatement } from "./database.js";

const roots: string[] = [];
const HASH_A = "a".repeat(64);
const HASH_B = "b".repeat(64);

class SnapshotDatabase implements KnowledgeDatabase {
  closed = false;
  constructor(
    private readonly blobRows: unknown[],
    private readonly artifactRows: unknown[],
    private readonly schemaVersion = 7,
  ) {}
  exec(): void { return; }
  close(): void { this.closed = true; }
  pragma(source: string): unknown { return source === "user_version" ? this.schemaVersion : undefined; }
  prepare(sql: string): SqliteStatement {
    return {
      run: () => ({ changes: 0, lastInsertRowid: 0 }),
      get: () => undefined,
      all: () => sql.includes("FROM source_versions") ? this.blobRows : sql.includes("FROM parsed_artifacts") ? this.artifactRows : [],
    };
  }
}

class LiveBackupDatabase extends SnapshotDatabase implements BackupCapableDatabase {
  async backup(filename: string): Promise<void> {
    await writeFile(filename, Buffer.from("sqlite-consistent-snapshot", "utf8"));
  }
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

async function root(): Promise<string> {
  const value = await mkdtemp(path.join(os.tmpdir(), "pi-knowledge-backup-test-"));
  roots.push(value);
  return value;
}

describe("KnowledgeBackupCreator", () => {
  it("publishes a hashed manifest over a consistent DB snapshot, referenced blobs and artifact bundles", async () => {
    const base = await root();
    const dataDir = path.join(base, "data");
    const output = path.join(base, "backup");
    const store = new ContentAddressedBlobStore(dataDir);
    const raw = Buffer.from("source bytes", "utf8");
    const written = await store.put(raw);
    const artifactBundle = Buffer.from("immutable parsed artifact bundle", "utf8");
    const snapshot = new SnapshotDatabase(
      [{ blob_key: written.hash, content_sha256: written.hash, byte_length: raw.byteLength }],
      [{ id: "artifact-1", source_version_id: "sv-1", parser_version: "parser-v1", canonical_text_sha256: HASH_A }],
    );
    const live = new LiveBackupDatabase([], []);
    const creator = new KnowledgeBackupCreator(live, store, {
      now: () => new Date("2026-09-09T07:00:00.000Z"),
      createId: () => "backup-1",
      openSnapshotDatabase: () => snapshot,
      artifactProvider: { readArtifactBundle: () => Promise.resolve(artifactBundle) },
    });

    const manifest = await creator.create(output);

    expect(manifest.formatVersion).toBe(1);
    expect(manifest.schemaVersion).toBe(7);
    expect(manifest.blobs).toHaveLength(1);
    expect(manifest.blobs[0]?.contentSha256).toBe(written.hash);
    expect(manifest.artifacts[0]).toMatchObject({ parsedArtifactId: "artifact-1", sourceVersionId: "sv-1", canonicalTextSha256: HASH_A });
    expect(snapshot.closed).toBe(true);
    const manifestBlob = manifest.blobs[0];
    const manifestArtifact = manifest.artifacts[0];
    if (manifestBlob === undefined || manifestArtifact === undefined) throw new Error("Expected backup manifest fixtures");
    expect(await readFile(path.join(output, manifestBlob.path))).toEqual(raw);
    expect(await readFile(path.join(output, manifestArtifact.path))).toEqual(artifactBundle);
    expect((await readFile(path.join(output, "manifest.sha256"), "utf8"))).toMatch(/^[0-9a-f]{64} {2}manifest\.json\n$/);
  });

  it("refuses to publish an incomplete backup when ParsedArtifacts exist without a provider", async () => {
    const base = await root();
    const output = path.join(base, "backup");
    const store = new ContentAddressedBlobStore(path.join(base, "data"));
    const snapshot = new SnapshotDatabase([], [
      { id: "artifact-1", source_version_id: "sv-1", parser_version: "parser-v1", canonical_text_sha256: HASH_A },
    ]);
    const creator = new KnowledgeBackupCreator(new LiveBackupDatabase([], []), store, {
      createId: () => "backup-2",
      openSnapshotDatabase: () => snapshot,
    });

    await expect(creator.create(output)).rejects.toThrow(/durable ParsedArtifact provider/);
    await expect(readFile(path.join(output, "manifest.json"))).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("rejects SourceVersion blob identity/length mismatches before publication", async () => {
    const base = await root();
    const store = new ContentAddressedBlobStore(path.join(base, "data"));
    const raw = Buffer.from("bytes", "utf8");
    const written = await store.put(raw);

    const identitySnapshot = new SnapshotDatabase([
      { blob_key: written.hash, content_sha256: HASH_B, byte_length: raw.byteLength },
    ], []);
    const identityCreator = new KnowledgeBackupCreator(new LiveBackupDatabase([], []), store, {
      createId: () => "backup-3", openSnapshotDatabase: () => identitySnapshot,
    });
    await expect(identityCreator.create(path.join(base, "identity"))).rejects.toThrow(/blob identity mismatch/);

    const lengthSnapshot = new SnapshotDatabase([
      { blob_key: written.hash, content_sha256: written.hash, byte_length: raw.byteLength + 1 },
    ], []);
    const lengthCreator = new KnowledgeBackupCreator(new LiveBackupDatabase([], []), store, {
      createId: () => "backup-4", openSnapshotDatabase: () => lengthSnapshot,
    });
    await expect(lengthCreator.create(path.join(base, "length"))).rejects.toThrow(/byte length mismatch/);
  });

  it("never overwrites an existing backup destination", async () => {
    const base = await root();
    const output = path.join(base, "backup");
    await writeFile(output, "existing");
    const creator = new KnowledgeBackupCreator(
      new LiveBackupDatabase([], []),
      new ContentAddressedBlobStore(path.join(base, "data")),
      { createId: () => "backup-5", openSnapshotDatabase: () => new SnapshotDatabase([], []) },
    );
    await expect(creator.create(output)).rejects.toThrow(/destination already exists/);
    expect(await readFile(output, "utf8")).toBe("existing");
  });
});
