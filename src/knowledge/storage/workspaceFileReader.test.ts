import { createHash } from "node:crypto";
import {
  mkdtemp,
  mkdir,
  rename,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { captureWorkspaceFile } from "./workspaceFileReader.js";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

async function workspace(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "pi-knowledge-safe-reader-"));
  roots.push(root);
  return root;
}

async function expectCode(promise: Promise<unknown>, code: string): Promise<void> {
  await expect(promise).rejects.toMatchObject({ name: "WorkspaceFileReadError", code });
}

describe("captureWorkspaceFile", () => {
  it("captures an explicitly selected contained file and returns exact bytes/hash", async () => {
    const root = await workspace();
    await mkdir(path.join(root, "docs"));
    const bytes = Buffer.from("# Guide\n中文 👋\n", "utf8");
    await writeFile(path.join(root, "docs", "guide.md"), bytes);

    const captured = await captureWorkspaceFile(root, "docs/guide.md");

    expect(captured.relativePath).toBe(path.normalize("docs/guide.md"));
    expect(captured.bytes).toEqual(bytes);
    expect(captured.byteLength).toBe(bytes.byteLength);
    expect(captured.contentSha256).toBe(createHash("sha256").update(bytes).digest("hex"));
    expect(captured.canonicalPath.startsWith(root)).toBe(true);
  });

  it("rejects absolute paths and parent traversal", async () => {
    const root = await workspace();

    await expectCode(captureWorkspaceFile(root, "../outside.txt"), "INVALID_RELATIVE_PATH");
    await expectCode(captureWorkspaceFile(root, path.resolve(root, "file.txt")), "INVALID_RELATIVE_PATH");
  });

  it("rejects a symlink that escapes the canonical Workspace root", async () => {
    const root = await workspace();
    const outside = await workspace();
    await writeFile(path.join(outside, "secret.txt"), "secret");
    await symlink(path.join(outside, "secret.txt"), path.join(root, "escape.txt"));

    await expectCode(captureWorkspaceFile(root, "escape.txt"), "PATH_ESCAPE");
  });

  it("allows an in-Workspace symlink but still captures its canonical target", async () => {
    const root = await workspace();
    await mkdir(path.join(root, "docs"));
    await writeFile(path.join(root, "docs", "target.md"), "inside");
    await symlink(path.join(root, "docs", "target.md"), path.join(root, "alias.md"));

    const captured = await captureWorkspaceFile(root, "alias.md");
    expect(captured.bytes.toString("utf8")).toBe("inside");
    expect(captured.canonicalPath).toBe(path.join(root, "docs", "target.md"));
  });

  it("rejects sensitive dotenv, SSH and private-key patterns", async () => {
    const root = await workspace();
    await mkdir(path.join(root, ".ssh"));
    for (const name of [".env", ".env.local", "id_rsa", "client.pem", "client.key"]) {
      await writeFile(path.join(root, name), "secret");
    }
    await writeFile(path.join(root, ".ssh", "config"), "Host *");

    for (const relative of [".env", ".env.local", "id_rsa", "client.pem", "client.key", ".ssh/config"]) {
      await expectCode(captureWorkspaceFile(root, relative), "SENSITIVE_FILE");
    }
  });

  it("rejects oversized files before capture", async () => {
    const root = await workspace();
    await writeFile(path.join(root, "large.txt"), Buffer.alloc(17));

    await expectCode(captureWorkspaceFile(root, "large.txt", { maxBytes: 16 }), "FILE_TOO_LARGE");
  });

  it("detects replacement of the selected path during capture", async () => {
    const root = await workspace();
    const selected = path.join(root, "selected.txt");
    const replacement = path.join(root, "replacement.txt");
    await writeFile(selected, "version one");
    await writeFile(replacement, "version two");

    await expectCode(
      captureWorkspaceFile(root, "selected.txt", {
        afterReadBeforePathRecheckForTest: async () => {
          await rename(replacement, selected);
        },
      }),
      "FILE_CHANGED_DURING_CAPTURE",
    );
  });

  it("rejects non-regular files and invalid size configuration", async () => {
    const root = await workspace();
    await mkdir(path.join(root, "folder"));

    await expectCode(captureWorkspaceFile(root, "folder"), "NOT_REGULAR_FILE");
    await expect(captureWorkspaceFile(root, "folder", { maxBytes: 0 })).rejects.toBeInstanceOf(RangeError);
  });
});
