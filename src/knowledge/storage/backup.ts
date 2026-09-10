import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";

import type { KnowledgeDatabase } from "./database.js";
import { ContentAddressedBlobStore } from "./blobStore.js";

export const KNOWLEDGE_BACKUP_FORMAT_VERSION = 1;

export interface BackupCapableDatabase {
  backup(filename: string): Promise<unknown>;
}

export interface BackupArtifactProvider {
  /** Return a self-contained immutable artifact bundle for the exact ParsedArtifact id. */
  readArtifactBundle(parsedArtifactId: string): Promise<Uint8Array>;
}

export interface KnowledgeBackupCreatorOptions {
  now?: () => Date;
  createId?: () => string;
  openSnapshotDatabase: (filename: string) => KnowledgeDatabase;
  artifactProvider?: BackupArtifactProvider;
}

export interface KnowledgeBackupManifest {
  formatVersion: 1;
  createdAt: string;
  schemaVersion: number;
  database: BackupManifestFile;
  blobs: BackupManifestBlob[];
  artifacts: BackupManifestArtifact[];
}

export interface BackupManifestFile {
  path: string;
  size: number;
  sha256: string;
}

export interface BackupManifestBlob extends BackupManifestFile {
  contentSha256: string;
}

export interface BackupManifestArtifact extends BackupManifestFile {
  parsedArtifactId: string;
  sourceVersionId: string;
  parserVersion: string;
  canonicalTextSha256: string;
}

interface SourceVersionBlobRow {
  blob_key: string;
  content_sha256: string;
  byte_length: number;
}

interface ParsedArtifactRow {
  id: string;
  source_version_id: string;
  parser_version: string;
  canonical_text_sha256: string;
}

export class KnowledgeBackupCreator {
  private readonly now: () => Date;
  private readonly createId: () => string;

  constructor(
    private readonly liveDatabase: KnowledgeDatabase & BackupCapableDatabase,
    private readonly blobStore: ContentAddressedBlobStore,
    private readonly options: KnowledgeBackupCreatorOptions,
  ) {
    this.now = options.now ?? (() => new Date());
    this.createId = options.createId ?? randomUUID;
  }

  async create(outputDirectory: string): Promise<KnowledgeBackupManifest> {
    const output = path.resolve(requireNonEmpty(outputDirectory, "outputDirectory"));
    const parent = path.dirname(output);
    const temp = path.join(parent, `.${path.basename(output)}.pi-knowledge-backup-tmp-${this.createId()}`);
    await mkdir(parent, { recursive: true });
    await assertDestinationAbsent(output);
    await rm(temp, { recursive: true, force: true });
    await mkdir(temp, { recursive: false, mode: 0o700 });

    let snapshot: KnowledgeDatabase | undefined;
    try {
      const databaseRelativePath = "knowledge.sqlite";
      const databasePath = path.join(temp, databaseRelativePath);
      await this.liveDatabase.backup(databasePath);

      snapshot = this.options.openSnapshotDatabase(databasePath);
      const schemaVersion = readSchemaVersion(snapshot);
      const blobRows = readBlobClosure(snapshot);
      const artifactRows = readArtifactClosure(snapshot);

      const blobs: BackupManifestBlob[] = [];
      for (const row of blobRows) {
        if (row.blob_key !== row.content_sha256) {
          throw new Error(`SourceVersion blob identity mismatch for ${row.content_sha256}`);
        }
        const bytes = await this.blobStore.read(row.blob_key);
        if (bytes.byteLength !== row.byte_length) {
          throw new Error(`SourceVersion blob byte length mismatch for ${row.content_sha256}`);
        }
        const relativePath = path.posix.join("objects", "blobs", "sha256", row.content_sha256);
        await writeObject(temp, relativePath, bytes);
        blobs.push({
          path: relativePath,
          size: bytes.byteLength,
          sha256: sha256(bytes),
          contentSha256: row.content_sha256,
        });
      }

      const artifacts: BackupManifestArtifact[] = [];
      const artifactProvider = this.options.artifactProvider;
      if (artifactRows.length > 0 && artifactProvider === undefined) {
        throw new Error(
          "Backup requires a durable ParsedArtifact provider; refusing to create an incomplete backup",
        );
      }
      if (artifactProvider !== undefined) {
        for (const row of artifactRows) {
          const bytes = Buffer.from(await artifactProvider.readArtifactBundle(row.id));
          if (bytes.byteLength === 0) throw new Error(`ParsedArtifact bundle is empty: ${row.id}`);
          const safeName = `${sha256(Buffer.from(row.id, "utf8"))}.bin`;
          const relativePath = path.posix.join("objects", "artifacts", safeName);
          await writeObject(temp, relativePath, bytes);
          artifacts.push({
            path: relativePath,
            size: bytes.byteLength,
            sha256: sha256(bytes),
            parsedArtifactId: row.id,
            sourceVersionId: row.source_version_id,
            parserVersion: row.parser_version,
            canonicalTextSha256: row.canonical_text_sha256,
          });
        }
      }

      snapshot.close();
      snapshot = undefined;

      const databaseBytes = await readFile(databasePath);
      const manifest: KnowledgeBackupManifest = {
        formatVersion: KNOWLEDGE_BACKUP_FORMAT_VERSION,
        createdAt: this.now().toISOString(),
        schemaVersion,
        database: {
          path: databaseRelativePath,
          size: databaseBytes.byteLength,
          sha256: sha256(databaseBytes),
        },
        blobs: blobs.sort((a, b) => a.contentSha256.localeCompare(b.contentSha256)),
        artifacts: artifacts.sort((a, b) => a.parsedArtifactId.localeCompare(b.parsedArtifactId)),
      };

      const manifestBytes = Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`, "utf8");
      await writeFile(path.join(temp, "manifest.json"), manifestBytes, { mode: 0o600, flag: "wx" });
      await writeFile(path.join(temp, "manifest.sha256"), `${sha256(manifestBytes)}  manifest.json\n`, {
        mode: 0o600,
        flag: "wx",
      });

      await rename(temp, output);
      return manifest;
    } catch (error) {
      snapshot?.close();
      await rm(temp, { recursive: true, force: true });
      throw error;
    }
  }
}

function readSchemaVersion(db: KnowledgeDatabase): number {
  const value = db.pragma("user_version", { simple: true });
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw new Error("Backup snapshot has an invalid schema version");
  }
  return value;
}

function readBlobClosure(db: KnowledgeDatabase): SourceVersionBlobRow[] {
  const rows = db.prepare(
    `SELECT DISTINCT blob_key, content_sha256, byte_length
     FROM source_versions ORDER BY content_sha256 ASC`,
  ).all();
  return rows.map((row) => {
    const value = recordValue(row, "SourceVersion row");
    const blobKey = stringField(value, "blob_key");
    const contentSha256 = shaField(value, "content_sha256");
    const byteLength = integerField(value, "byte_length");
    return { blob_key: blobKey, content_sha256: contentSha256, byte_length: byteLength };
  });
}

function readArtifactClosure(db: KnowledgeDatabase): ParsedArtifactRow[] {
  const rows = db.prepare(
    `SELECT id, source_version_id, parser_version, canonical_text_sha256
     FROM parsed_artifacts ORDER BY id ASC`,
  ).all();
  return rows.map((row) => {
    const value = recordValue(row, "ParsedArtifact row");
    return {
      id: stringField(value, "id"),
      source_version_id: stringField(value, "source_version_id"),
      parser_version: stringField(value, "parser_version"),
      canonical_text_sha256: shaField(value, "canonical_text_sha256"),
    };
  });
}

async function writeObject(root: string, relativePath: string, bytes: Uint8Array): Promise<void> {
  const destination = path.join(root, ...relativePath.split("/"));
  await mkdir(path.dirname(destination), { recursive: true });
  await writeFile(destination, bytes, { flag: "wx", mode: 0o600 });
}

async function assertDestinationAbsent(destination: string): Promise<void> {
  try {
    await stat(destination);
    throw new Error(`Backup destination already exists: ${destination}`);
  } catch (error) {
    if (isNodeError(error, "ENOENT")) return;
    throw error;
  }
}

function requireNonEmpty(value: string, name: string): string {
  const normalized = value.trim();
  if (normalized.length === 0) throw new TypeError(`${name} must be non-empty`);
  return normalized;
}

function recordValue(value: unknown, label: string): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new Error(`Backup snapshot ${label} is invalid`);
  }
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringField(row: Record<string, unknown>, key: string): string {
  const value = row[key];
  if (typeof value !== "string" || value.length === 0) throw new Error(`Backup snapshot ${key} is invalid`);
  return value;
}

function shaField(row: Record<string, unknown>, key: string): string {
  const value = stringField(row, key);
  if (!/^[0-9a-f]{64}$/.test(value)) throw new Error(`Backup snapshot ${key} is not a SHA-256 hash`);
  return value;
}

function integerField(row: Record<string, unknown>, key: string): number {
  const value = row[key];
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw new Error(`Backup snapshot ${key} is invalid`);
  }
  return value;
}

function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function isNodeError(error: unknown, code: string): error is Error & { code: unknown } {
  return error instanceof Error && "code" in error && error.code === code;
}
