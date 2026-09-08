import { mkdtemp, mkdir, readFile, rm, utimes, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  BlobIntegrityError,
  ContentAddressedBlobStore,
} from "./blobStore.js";

const tempRoots: string[] = [];

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

async function createStore(): Promise<ContentAddressedBlobStore> {
  const root = await mkdtemp(path.join(os.tmpdir(), "pi-knowledge-blob-store-"));
  tempRoots.push(root);
  return new ContentAddressedBlobStore(root);
}

describe("ContentAddressedBlobStore", () => {
  it("stores bytes under blobs/sha256/<hash> and reads them with integrity verification", async () => {
    const store = await createStore();
    const bytes = Buffer.from("hello 中文 👋\n", "utf8");

    const result = await store.put(bytes);

    expect(result.hash).toBe(ContentAddressedBlobStore.sha256(bytes));
    expect(result.path).toBe(path.join(store.rootDir, "blobs", "sha256", result.hash));
    expect(result.deduplicated).toBe(false);
    expect(await readFile(result.path)).toEqual(bytes);
    expect(await store.read(result.hash)).toEqual(bytes);
    await expect(store.verify(result.hash)).resolves.toEqual({
      hash: result.hash,
      size: bytes.byteLength,
      valid: true,
    });
  });

  it("deduplicates repeated and concurrent writes without changing bytes", async () => {
    const store = await createStore();
    const bytes = Buffer.from("same immutable object");

    const first = await store.put(bytes);
    const repeated = await store.put(bytes);
    const concurrent = await Promise.all(Array.from({ length: 8 }, () => store.put(bytes)));

    expect(repeated.hash).toBe(first.hash);
    expect(repeated.deduplicated).toBe(true);
    expect(concurrent.every((result) => result.hash === first.hash)).toBe(true);
    expect(await store.read(first.hash)).toEqual(bytes);
  });

  it("fails closed when stored bytes no longer match their content hash", async () => {
    const store = await createStore();
    const result = await store.put(Buffer.from("original"));
    await writeFile(result.path, "tampered");

    await expect(store.read(result.hash)).rejects.toBeInstanceOf(BlobIntegrityError);
    await expect(store.verify(result.hash)).rejects.toBeInstanceOf(BlobIntegrityError);
    await expect(store.put(Buffer.from("original"))).rejects.toBeInstanceOf(BlobIntegrityError);
  });

  it("rejects invalid hashes instead of allowing path traversal", async () => {
    const store = await createStore();

    for (const hash of ["../escape", "A".repeat(64), "0".repeat(63), "0".repeat(65), "g".repeat(64)]) {
      expect(() => store.resolve(hash)).toThrow(TypeError);
      await expect(store.read(hash)).rejects.toThrow(TypeError);
    }
  });

  it("cleans only stale store-owned partial temp files", async () => {
    const store = await createStore();
    await mkdir(store.sha256Root, { recursive: true });
    const oldTemp = path.join(store.sha256Root, ".pi-knowledge-blob-tmp-old");
    const recentTemp = path.join(store.sha256Root, ".pi-knowledge-blob-tmp-recent");
    const unrelated = path.join(store.sha256Root, ".unrelated-temp");
    await Promise.all([
      writeFile(oldTemp, "old"),
      writeFile(recentTemp, "recent"),
      writeFile(unrelated, "keep"),
    ]);
    const nowMs = Date.now();
    const oldSeconds = (nowMs - 2 * 60 * 60 * 1000) / 1000;
    await utimes(oldTemp, oldSeconds, oldSeconds);

    await expect(store.cleanupPartialTemps({ olderThanMs: 60 * 60 * 1000, nowMs })).resolves.toEqual({
      removed: 1,
      kept: 1,
    });
    await expect(readFile(oldTemp)).rejects.toMatchObject({ code: "ENOENT" });
    await expect(readFile(recentTemp, "utf8")).resolves.toBe("recent");
    await expect(readFile(unrelated, "utf8")).resolves.toBe("keep");
  });

  it("validates cleanup age configuration", async () => {
    const store = await createStore();
    await expect(store.cleanupPartialTemps({ olderThanMs: -1 })).rejects.toBeInstanceOf(RangeError);
    await expect(store.cleanupPartialTemps({ olderThanMs: Number.NaN })).rejects.toBeInstanceOf(RangeError);
  });
});
