import { describe, expect, it } from "vitest";

import { parseRestoreArgs } from "./restoreCli.js";

describe("pi-knowledge restore CLI", () => {
  it("requires explicit backup and controlled target directories", () => {
    expect(parseRestoreArgs([
      "--backup", "/backups/knowledge-1",
      "--target", "/restore/knowledge-1",
    ])).toEqual({
      backupDirectory: "/backups/knowledge-1",
      targetDirectory: "/restore/knowledge-1",
    });
  });

  it("rejects missing, duplicate and unknown arguments", () => {
    expect(() => parseRestoreArgs(["--backup", "/b"])).toThrow(/--target/);
    expect(() => parseRestoreArgs(["--backup"])).toThrow(/Missing value/);
    expect(() => parseRestoreArgs(["--backup", "/a", "--backup", "/b", "--target", "/t"])).toThrow(/Duplicate/);
    expect(() => parseRestoreArgs(["--backup", "/b", "--target", "/t", "--force"])).toThrow(/Unknown/);
  });
});
