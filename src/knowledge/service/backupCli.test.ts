import { describe, expect, it } from "vitest";

import { parseBackupArgs } from "./backupCli.js";

describe("pi-knowledge backup CLI", () => {
  it("requires explicit database, data-root and output paths", () => {
    expect(parseBackupArgs([
      "--db", "/data/knowledge.sqlite",
      "--data-dir", "/data/pi-knowledge",
      "--output", "/backup/snapshot-1",
    ])).toEqual({
      dbPath: "/data/knowledge.sqlite",
      dataDir: "/data/pi-knowledge",
      outputDirectory: "/backup/snapshot-1",
    });
  });

  it("rejects missing, duplicate and unknown arguments", () => {
    expect(() => parseBackupArgs(["--db", "/db"])).toThrow(/--data-dir/);
    expect(() => parseBackupArgs(["--db"])).toThrow(/Missing value/);
    expect(() => parseBackupArgs(["--db", "/a", "--db", "/b", "--data-dir", "/d", "--output", "/o"])).toThrow(/Duplicate/);
    expect(() => parseBackupArgs(["--db", "/a", "--data-dir", "/d", "--output", "/o", "--force"])).toThrow(/Unknown/);
  });
});
