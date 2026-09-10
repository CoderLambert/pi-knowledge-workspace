import { mkdtemp, readFile, readdir, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildKnowledgePackage } from "./build-plugins.mjs";

let tempDir;

afterEach(async () => {
  if (tempDir !== undefined) await rm(tempDir, { recursive: true, force: true });
});

describe("Knowledge browser package build", () => {
  it("bundles Lit into the browser entry while retaining the paired server graph", { timeout: 30_000 }, async () => {
    tempDir = await mkdtemp(join(tmpdir(), "pi-web-build-knowledge-"));
    const source = resolve("pi-web-plugins/knowledge");
    const target = join(tempDir, "knowledge");

    await buildKnowledgePackage(source, target);

    const files = await recursiveFiles(target);
    expect(files).toContain("package.json");
    expect(files).toContain("server-plugin.js");
    expect(files).toContain("service-client.js");
    expect(files).toContain("browser/pi-web-plugin.js");
    expect(files.filter((path) => path.startsWith("browser/"))).toEqual(["browser/pi-web-plugin.js"]);
    expect(files.some((path) => /\.(?:ts|map)$/u.test(path))).toBe(false);

    const entry = await readFile(join(target, "browser/pi-web-plugin.js"), "utf8");
    expect(entry).not.toMatch(/(?:\bfrom\s*["']lit(?:\/[^"']+)?["']|\bimport\s*(?:\(\s*)?["']lit(?:\/[^"']+)?["'])/u);
    expect((await stat(join(target, "browser/pi-web-plugin.js"))).isFile()).toBe(true);
  });
});

async function recursiveFiles(root, prefix = "") {
  const result = [];
  for (const entry of await readdir(root, { withFileTypes: true })) {
    const relativePath = prefix.length === 0 ? entry.name : `${prefix}/${entry.name}`;
    if (entry.isDirectory()) result.push(...await recursiveFiles(join(root, entry.name), relativePath));
    else if (entry.isFile()) result.push(relativePath);
  }
  return result.sort();
}
