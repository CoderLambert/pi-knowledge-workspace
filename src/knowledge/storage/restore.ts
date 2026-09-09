import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";

import { ContentAddressedBlobStore } from "./blobStore.js";
import {
  KNOWLEDGE_BACKUP_FORMAT_VERSION,
  type BackupManifestArtifact,
  type KnowledgeBackupManifest,
} from "./backup.js";
import { KNOWLEDGE_SCHEMA_VERSION, type KnowledgeDatabase } from "./database.js";

export interface RestoreArtifactSink {
  writeArtifactBundle(targetRoot: string, artifact: BackupManifestArtifact, bytes: Uint8Array): Promise<void>;
}

export interface RestoreEvidenceVerifier {
  verifyRestoredEvidence(input: { databasePath: string; dataRoot: string }): Promise<void>;
}

export interface KnowledgeRestoreOptions {
  createId?: () => string;
  openSnapshotDatabase: (filename: string) => KnowledgeDatabase;
  artifactSink?: RestoreArtifactSink;
  evidenceVerifier?: RestoreEvidenceVerifier;
}

export interface KnowledgeRestoreResult {
  targetDirectory: string;
  schemaVersion: number;
  blobCount: number;
  artifactCount: number;
  evidenceCount: number;
}

interface SnapshotClosure {
  blobs: Map<string, { byteLength: number }>;
  artifacts: Map<string, { sourceVersionId: string; parserVersion: string; canonicalTextSha256: string }>;
  evidenceCount: number;
}

export class KnowledgeRestore {
  private readonly createId: () => string;

  constructor(private readonly options: KnowledgeRestoreOptions) {
    this.createId = options.createId ?? randomUUID;
  }

  async restore(backupDirectory: string, targetDirectory: string): Promise<KnowledgeRestoreResult> {
    const backup = path.resolve(requireNonEmpty(backupDirectory, "backupDirectory"));
    const target = path.resolve(requireNonEmpty(targetDirectory, "targetDirectory"));
    if (backup === target || isInside(target, backup) || isInside(backup, target)) {
      throw new Error("Backup and restore target directories must be separate and non-nested");
    }
    await assertDirectoryExists(backup, "Backup directory");
    await assertDestinationAbsent(target);

    const manifestBytes = await readFile(path.join(backup, "manifest.json"));
    await verifyManifestChecksum(backup, manifestBytes);
    const manifest = parseManifest(manifestBytes);
    if (manifest.formatVersion !== KNOWLEDGE_BACKUP_FORMAT_VERSION) {
      throw new Error(`Unsupported Knowledge backup format: ${String(manifest.formatVersion)}`);
    }
    if (manifest.schemaVersion !== KNOWLEDGE_SCHEMA_VERSION) {
      throw new Error(
        `Backup schema ${String(manifest.schemaVersion)} does not match supported schema ${String(KNOWLEDGE_SCHEMA_VERSION)}`,
      );
    }

    assertSafeRelativePath(manifest.database.path);
    if (manifest.database.path !== "knowledge.sqlite") throw new Error("Backup database path is not canonical");
    const databaseSource = path.join(backup, manifest.database.path);
    const databaseBytes = await verifyFile(databaseSource, manifest.database.size, manifest.database.sha256, "database");

    const snapshot = this.options.openSnapshotDatabase(databaseSource);
    let closure: SnapshotClosure;
    try {
      const integrity = snapshot.pragma("integrity_check", { simple: true });
      if (integrity !== "ok") throw new Error(`Backup SQLite integrity_check failed: ${String(integrity)}`);
      const version = snapshot.pragma("user_version", { simple: true });
      if (version !== manifest.schemaVersion) throw new Error("Backup SQLite user_version does not match manifest");
      closure = readSnapshotClosure(snapshot);
    } finally {
      snapshot.close();
    }

    assertManifestClosure(manifest, closure);

    const verifiedBlobs = new Map<string, Buffer>();
    for (const entry of manifest.blobs) {
      const expectedPath = path.posix.join("objects", "blobs", "sha256", entry.contentSha256);
      if (entry.path !== expectedPath || entry.sha256 !== entry.contentSha256) {
        throw new Error(`Backup blob manifest path/hash is inconsistent: ${entry.contentSha256}`);
      }
      assertSafeRelativePath(entry.path);
      const bytes = await verifyFile(path.join(backup, ...entry.path.split("/")), entry.size, entry.sha256, `blob ${entry.contentSha256}`);
      verifiedBlobs.set(entry.contentSha256, bytes);
    }

    const verifiedArtifacts = new Map<string, Buffer>();
    if (manifest.artifacts.length > 0 && this.options.artifactSink === undefined) {
      throw new Error("Restore requires a durable ParsedArtifact sink; refusing an incomplete restore");
    }
    for (const entry of manifest.artifacts) {
      assertSafeRelativePath(entry.path);
      const expectedName = `${sha256(Buffer.from(entry.parsedArtifactId, "utf8"))}.bin`;
      const expectedPath = path.posix.join("objects", "artifacts", expectedName);
      if (entry.path !== expectedPath) throw new Error(`Backup artifact path is not canonical: ${entry.parsedArtifactId}`);
      const bytes = await verifyFile(path.join(backup, ...entry.path.split("/")), entry.size, entry.sha256, `artifact ${entry.parsedArtifactId}`);
      verifiedArtifacts.set(entry.parsedArtifactId, bytes);
    }

    if (closure.evidenceCount > 0 && this.options.evidenceVerifier === undefined) {
      throw new Error("Restore requires historical Evidence verification; refusing SQLite-only success");
    }

    const parent = path.dirname(target);
    const temp = path.join(parent, `.${path.basename(target)}.pi-knowledge-restore-tmp-${this.createId()}`);
    await mkdir(parent, { recursive: true });
    await rm(temp, { recursive: true, force: true });
    await mkdir(temp, { recursive: false, mode: 0o700 });

    try {
      const databasePath = path.join(temp, "knowledge.sqlite");
      await writeFile(databasePath, databaseBytes, { flag: "wx", mode: 0o600 });
      const blobStore = new ContentAddressedBlobStore(temp);
      for (const entry of manifest.blobs) {
        const bytes = verifiedBlobs.get(entry.contentSha256)!;
        const result = await blobStore.put(bytes);
        if (result.hash !== entry.contentSha256 || result.size !== entry.size) {
          throw new Error(`Restored blob identity mismatch: ${entry.contentSha256}`);
        }
      }
      for (const entry of manifest.artifacts) {
        await this.options.artifactSink!.writeArtifactBundle(temp, entry, verifiedArtifacts.get(entry.parsedArtifactId)!);
      }

      if (closure.evidenceCount > 0) {
        await this.options.evidenceVerifier!.verifyRestoredEvidence({ databasePath, dataRoot: temp });
      }

      // Preserve the exact source manifest for audit without making it runtime authority.
      await writeFile(path.join(temp, "restore-source-manifest.json"), manifestBytes, { flag: "wx", mode: 0o600 });
      await rename(temp, target);
      return {
        targetDirectory: target,
        schemaVersion: manifest.schemaVersion,
        blobCount: manifest.blobs.length,
        artifactCount: manifest.artifacts.length,
        evidenceCount: closure.evidenceCount,
      };
    } catch (error) {
      await rm(temp, { recursive: true, force: true });
      throw error;
    }
  }
}

function readSnapshotClosure(db: KnowledgeDatabase): SnapshotClosure {
  const blobs = new Map<string, { byteLength: number }>();
  for (const raw of db.prepare(`SELECT DISTINCT content_sha256, blob_key, byte_length FROM source_versions ORDER BY content_sha256`).all()) {
    const row = raw as Record<string, unknown>;
    const hash = shaField(row, "content_sha256");
    if (stringField(row, "blob_key") !== hash) throw new Error(`Backup snapshot blob identity mismatch: ${hash}`);
    blobs.set(hash, { byteLength: integerField(row, "byte_length") });
  }

  const artifacts = new Map<string, { sourceVersionId: string; parserVersion: string; canonicalTextSha256: string }>();
  for (const raw of db.prepare(`SELECT id, source_version_id, parser_version, canonical_text_sha256 FROM parsed_artifacts ORDER BY id`).all()) {
    const row = raw as Record<string, unknown>;
    artifacts.set(stringField(row, "id"), {
      sourceVersionId: stringField(row, "source_version_id"),
      parserVersion: stringField(row, "parser_version"),
      canonicalTextSha256: shaField(row, "canonical_text_sha256"),
    });
  }

  const countRow = db.prepare(`SELECT COUNT(*) AS count FROM evidence`).get() as { count?: unknown } | undefined;
  const evidenceCount = countRow?.count;
  if (typeof evidenceCount !== "number" || !Number.isSafeInteger(evidenceCount) || evidenceCount < 0) {
    throw new Error("Backup snapshot Evidence count is invalid");
  }
  return { blobs, artifacts, evidenceCount };
}

function assertManifestClosure(manifest: KnowledgeBackupManifest, closure: SnapshotClosure): void {
  if (manifest.blobs.length !== closure.blobs.size) throw new Error("Backup blob manifest does not match SQLite closure");
  const seenBlobs = new Set<string>();
  for (const entry of manifest.blobs) {
    if (seenBlobs.has(entry.contentSha256)) throw new Error(`Duplicate backup blob manifest entry: ${entry.contentSha256}`);
    seenBlobs.add(entry.contentSha256);
    const row = closure.blobs.get(entry.contentSha256);
    if (!row || row.byteLength !== entry.size) throw new Error(`Backup blob closure mismatch: ${entry.contentSha256}`);
  }

  if (manifest.artifacts.length !== closure.artifacts.size) throw new Error("Backup artifact manifest does not match SQLite closure");
  const seenArtifacts = new Set<string>();
  for (const entry of manifest.artifacts) {
    if (seenArtifacts.has(entry.parsedArtifactId)) throw new Error(`Duplicate backup artifact manifest entry: ${entry.parsedArtifactId}`);
    seenArtifacts.add(entry.parsedArtifactId);
    const row = closure.artifacts.get(entry.parsedArtifactId);
    if (
      !row || row.sourceVersionId !== entry.sourceVersionId || row.parserVersion !== entry.parserVersion
      || row.canonicalTextSha256 !== entry.canonicalTextSha256
    ) {
      throw new Error(`Backup artifact closure mismatch: ${entry.parsedArtifactId}`);
    }
  }
}

async function verifyManifestChecksum(backup: string, manifestBytes: Buffer): Promise<void> {
  const checksum = await readFile(path.join(backup, "manifest.sha256"), "utf8");
  const match = /^([0-9a-f]{64})  manifest\.json\n$/.exec(checksum);
  if (!match || match[1] !== sha256(manifestBytes)) throw new Error("Backup manifest checksum verification failed");
}

function parseManifest(bytes: Uint8Array): KnowledgeBackupManifest {
  let value: unknown;
  try { value = JSON.parse(Buffer.from(bytes).toString("utf8")); } catch { throw new Error("Backup manifest is not valid JSON"); }
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error("Backup manifest root is invalid");
  const manifest = value as Partial<KnowledgeBackupManifest>;
  if (manifest.formatVersion !== 1 || typeof manifest.createdAt !== "string" || !manifest.createdAt) throw new Error("Backup manifest metadata is invalid");
  if (!Number.isSafeInteger(manifest.schemaVersion) || !manifest.database || !Array.isArray(manifest.blobs) || !Array.isArray(manifest.artifacts)) {
    throw new Error("Backup manifest structure is invalid");
  }
  validateFileEntry(manifest.database, "database");
  for (const blob of manifest.blobs) {
    validateFileEntry(blob, "blob");
    if (typeof blob.contentSha256 !== "string" || !/^[0-9a-f]{64}$/.test(blob.contentSha256)) throw new Error("Backup blob content hash is invalid");
  }
  for (const artifact of manifest.artifacts) {
    validateFileEntry(artifact, "artifact");
    if (!artifact.parsedArtifactId || !artifact.sourceVersionId || !artifact.parserVersion || !/^[0-9a-f]{64}$/.test(artifact.canonicalTextSha256)) {
      throw new Error("Backup artifact metadata is invalid");
    }
  }
  return manifest as KnowledgeBackupManifest;
}

function validateFileEntry(entry: { path?: unknown; size?: unknown; sha256?: unknown }, label: string): void {
  if (typeof entry.path !== "string" || !entry.path || typeof entry.size !== "number" || !Number.isSafeInteger(entry.size) || entry.size < 0 || typeof entry.sha256 !== "string" || !/^[0-9a-f]{64}$/.test(entry.sha256)) {
    throw new Error(`Backup ${label} file metadata is invalid`);
  }
}

async function verifyFile(filename: string, size: number, hash: string, label: string): Promise<Buffer> {
  const bytes = await readFile(filename);
  if (bytes.byteLength !== size || sha256(bytes) !== hash) throw new Error(`Backup ${label} integrity verification failed`);
  return bytes;
}

function assertSafeRelativePath(value: string): void {
  if (path.posix.isAbsolute(value) || value.includes("\\") || value.split("/").some((part) => !part || part === "." || part === "..")) {
    throw new Error(`Backup manifest contains unsafe path: ${value}`);
  }
}

async function assertDestinationAbsent(destination: string): Promise<void> {
  try { await stat(destination); throw new Error(`Restore target already exists: ${destination}`); }
  catch (error) { if (isNodeError(error, "ENOENT")) return; throw error; }
}

async function assertDirectoryExists(directory: string, label: string): Promise<void> {
  const info = await stat(directory);
  if (!info.isDirectory()) throw new Error(`${label} is not a directory: ${directory}`);
}

function isInside(parent: string, child: string): boolean {
  const relative = path.relative(parent, child);
  return relative !== "" && !relative.startsWith("..") && !path.isAbsolute(relative);
}
function requireNonEmpty(value: string, name: string): string { const v = value.trim(); if (!v) throw new TypeError(`${name} must be non-empty`); return v; }
function stringField(row: Record<string, unknown>, key: string): string { const v = row[key]; if (typeof v !== "string" || !v) throw new Error(`Backup snapshot ${key} is invalid`); return v; }
function shaField(row: Record<string, unknown>, key: string): string { const v = stringField(row, key); if (!/^[0-9a-f]{64}$/.test(v)) throw new Error(`Backup snapshot ${key} is not a SHA-256 hash`); return v; }
function integerField(row: Record<string, unknown>, key: string): number { const v = row[key]; if (typeof v !== "number" || !Number.isSafeInteger(v) || v < 0) throw new Error(`Backup snapshot ${key} is invalid`); return v; }
function sha256(bytes: Uint8Array): string { return createHash("sha256").update(bytes).digest("hex"); }
function isNodeError(error: unknown, code: string): error is NodeJS.ErrnoException { return error instanceof Error && "code" in error && (error as NodeJS.ErrnoException).code === code; }
