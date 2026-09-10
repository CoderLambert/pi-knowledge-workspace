import { createHash, randomUUID } from "node:crypto";
import { constants } from "node:fs";
import {
  access,
  link,
  mkdir,
  open,
  readFile,
  readdir,
  stat,
  unlink,
} from "node:fs/promises";
import path from "node:path";

const SHA256_HEX_RE = /^[a-f0-9]{64}$/;
const TEMP_PREFIX = ".pi-knowledge-blob-tmp-";

export interface BlobWriteResult {
  hash: string;
  size: number;
  path: string;
  deduplicated: boolean;
}

export interface BlobVerificationResult {
  hash: string;
  size: number;
  valid: boolean;
}

export interface BlobTempCleanupResult {
  removed: number;
  kept: number;
}

export class BlobIntegrityError extends Error {
  constructor(
    readonly expectedHash: string,
    readonly actualHash: string,
  ) {
    super(`Blob integrity check failed: expected ${expectedHash}, got ${actualHash}`);
    this.name = "BlobIntegrityError";
  }
}

export class ContentAddressedBlobStore {
  readonly sha256Root: string;

  constructor(readonly rootDir: string) {
    this.sha256Root = path.join(rootDir, "blobs", "sha256");
  }

  static sha256(bytes: Uint8Array): string {
    return createHash("sha256").update(bytes).digest("hex");
  }

  resolve(hash: string): string {
    assertHash(hash);
    return path.join(this.sha256Root, hash);
  }

  async has(hash: string): Promise<boolean> {
    const blobPath = this.resolve(hash);
    try {
      await access(blobPath, constants.R_OK);
      return true;
    } catch (error) {
      if (isNodeError(error, "ENOENT")) return false;
      throw error;
    }
  }

  async put(bytes: Uint8Array): Promise<BlobWriteResult> {
    const data = Buffer.from(bytes);
    const hash = ContentAddressedBlobStore.sha256(data);
    const blobPath = this.resolve(hash);
    await mkdir(this.sha256Root, { recursive: true });

    if (await this.has(hash)) {
      await this.verify(hash);
      return { hash, size: data.byteLength, path: blobPath, deduplicated: true };
    }

    const tempPath = path.join(
      this.sha256Root,
      `${TEMP_PREFIX}${process.pid}-${randomUUID()}`,
    );
    const handle = await open(tempPath, "wx", 0o600);

    try {
      await handle.writeFile(data);
      await handle.sync();
    } finally {
      await handle.close();
    }

    try {
      // Hard-link publication is atomic and never overwrites an existing blob.
      // Concurrent writers of identical bytes therefore converge on one object.
      await link(tempPath, blobPath);
      return { hash, size: data.byteLength, path: blobPath, deduplicated: false };
    } catch (error) {
      if (!isNodeError(error, "EEXIST")) throw error;
      await this.verify(hash);
      return { hash, size: data.byteLength, path: blobPath, deduplicated: true };
    } finally {
      await unlink(tempPath).catch((error: unknown) => {
        if (!isNodeError(error, "ENOENT")) throw error;
      });
    }
  }

  async read(hash: string): Promise<Buffer> {
    const bytes = await readFile(this.resolve(hash));
    const actualHash = ContentAddressedBlobStore.sha256(bytes);
    if (actualHash !== hash) throw new BlobIntegrityError(hash, actualHash);
    return bytes;
  }

  async verify(hash: string): Promise<BlobVerificationResult> {
    const bytes = await readFile(this.resolve(hash));
    const actualHash = ContentAddressedBlobStore.sha256(bytes);
    if (actualHash !== hash) throw new BlobIntegrityError(hash, actualHash);
    return { hash, size: bytes.byteLength, valid: true };
  }

  async cleanupPartialTemps(options: { olderThanMs?: number; nowMs?: number } = {}): Promise<BlobTempCleanupResult> {
    const olderThanMs = options.olderThanMs ?? 60 * 60 * 1000;
    const nowMs = options.nowMs ?? Date.now();
    if (!Number.isFinite(olderThanMs) || olderThanMs < 0) {
      throw new RangeError("olderThanMs must be a finite non-negative number");
    }

    await mkdir(this.sha256Root, { recursive: true });
    const entries = await readdir(this.sha256Root, { withFileTypes: true });
    let removed = 0;
    let kept = 0;

    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.startsWith(TEMP_PREFIX)) continue;
      const tempPath = path.join(this.sha256Root, entry.name);
      const info = await stat(tempPath);
      if (nowMs - info.mtimeMs < olderThanMs) {
        kept += 1;
        continue;
      }
      await unlink(tempPath);
      removed += 1;
    }

    return { removed, kept };
  }
}

function assertHash(hash: string): void {
  if (!SHA256_HEX_RE.test(hash)) {
    throw new TypeError("Blob hash must be a lowercase 64-character SHA-256 hex string");
  }
}

function isNodeError(error: unknown, code: string): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error && (error as NodeJS.ErrnoException).code === code;
}
