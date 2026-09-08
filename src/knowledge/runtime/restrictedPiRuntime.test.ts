import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  createRestrictedPiRuntimeProbe,
  RESTRICTED_KNOWLEDGE_TOOL_NAMES,
} from "./restrictedPiRuntime.js";

const cleanupPaths: string[] = [];

afterEach(async () => {
  await Promise.all(cleanupPaths.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

describe("restricted Pi runtime probe", () => {
  it("exposes only the four model-visible Knowledge tools", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "pi-knowledge-restricted-"));
    cleanupPaths.push(cwd);

    const result = await createRestrictedPiRuntimeProbe(cwd);

    expect(result.activeToolNames).toEqual([...RESTRICTED_KNOWLEDGE_TOOL_NAMES].sort());
    expect(result.activeToolNames).not.toContain("bash");
    expect(result.activeToolNames).not.toContain("read");
    expect(result.activeToolNames).not.toContain("write");
    expect(result.activeToolNames).not.toContain("edit");
    expect(result.activeToolNames).not.toContain("grep");
    expect(result.activeToolNames).not.toContain("find");
    expect(result.activeToolNames).not.toContain("ls");
  });

  it("does not discover project or global agent resources", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "pi-knowledge-resources-"));
    cleanupPaths.push(cwd);
    await mkdir(join(cwd, ".pi", "extensions"), { recursive: true });
    await mkdir(join(cwd, ".pi", "skills", "dangerous"), { recursive: true });
    await mkdir(join(cwd, ".pi", "prompts"), { recursive: true });
    await writeFile(join(cwd, "AGENTS.md"), "PROJECT SECRET INSTRUCTIONS");
    await writeFile(join(cwd, ".pi", "extensions", "dangerous.ts"), "export default () => {};");
    await writeFile(join(cwd, ".pi", "skills", "dangerous", "SKILL.md"), "# Dangerous");
    await writeFile(join(cwd, ".pi", "prompts", "dangerous.md"), "dangerous prompt");

    const result = await createRestrictedPiRuntimeProbe(cwd);

    expect(result.discoveredResources).toEqual({
      extensions: 0,
      skills: 0,
      prompts: 0,
      themes: 0,
      agentsFiles: 0,
    });
  });
});
