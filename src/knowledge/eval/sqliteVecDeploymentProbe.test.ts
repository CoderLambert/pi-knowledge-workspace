import { describe, expect, it } from "vitest";

import {
  runSqliteVecDeploymentProbe,
  type SqliteVecProbeDatabase,
  type SqliteVecProbeStatement,
} from "./sqliteVecDeploymentProbe.js";

class FakeProbeDatabase implements SqliteVecProbeDatabase {
  loadedPath: string | undefined;
  readonly execLog: string[] = [];
  readonly prepareLog: string[] = [];
  readonly runLog: unknown[][] = [];
  versionRow: unknown = { version: "v0.1-probe" };
  knnRows: unknown[] = [
    { rowid: 1, distance: 0 },
    { rowid: 2, distance: 0.029857 },
  ];

  loadExtension(path: string): void {
    this.loadedPath = path;
  }

  exec(sql: string): void {
    this.execLog.push(sql);
  }

  prepare(sql: string): SqliteVecProbeStatement {
    this.prepareLog.push(sql);
    return {
      run: (...params: unknown[]) => {
        this.runLog.push(params);
        return {};
      },
      get: () => sql.includes("vec_version()") ? this.versionRow : undefined,
      all: () => sql.includes("FROM vec_p2_probe") ? this.knnRows : [],
    };
  }
}

describe("sqlite-vec deployment probe", () => {
  it("loads an explicit extension and proves scoped KNN behavior", () => {
    const db = new FakeProbeDatabase();
    const result = runSqliteVecDeploymentProbe(db, "/opt/sqlite-vec/vec0.so");

    expect(db.loadedPath).toBe("/opt/sqlite-vec/vec0.so");
    expect(result).toEqual({
      version: "v0.1-probe",
      scopedRowIds: [1, 2],
      distances: [0, 0.029857],
    });
    expect(db.runLog).toEqual([
      [1, "[1,0,0]", "scope-a"],
      [2, "[0.8,0.2,0]", "scope-a"],
      [3, "[1,0,0]", "scope-b"],
    ]);

    const knnSql = db.prepareLog.find((sql) => sql.includes("FROM vec_p2_probe"));
    expect(knnSql).toContain("embedding MATCH ?");
    expect(knnSql).toContain("scope = ?");
    expect(knnSql).toContain("k = ?");
    expect(db.execLog.at(-1)).toBe("DROP TABLE IF EXISTS vec_p2_probe;");
  });

  it("rejects non-absolute extension paths before touching SQLite", () => {
    const db = new FakeProbeDatabase();
    expect(() => {
      runSqliteVecDeploymentProbe(db, "./vec0.so");
    }).toThrow("absolute path");
    expect(db.loadedPath).toBeUndefined();
  });

  it("fails closed when scoped KNN leaks a row from another scope", () => {
    const db = new FakeProbeDatabase();
    db.knnRows = [
      { rowid: 1, distance: 0 },
      { rowid: 3, distance: 0 },
    ];

    expect(() => {
      runSqliteVecDeploymentProbe(db, "/opt/sqlite-vec/vec0.so");
    }).toThrow("did not enforce metadata scope before Top-K");
    expect(db.execLog.at(-1)).toBe("DROP TABLE IF EXISTS vec_p2_probe;");
  });

  it("fails closed on invalid extension version metadata", () => {
    const db = new FakeProbeDatabase();
    db.versionRow = { version: "" };
    expect(() => {
      runSqliteVecDeploymentProbe(db, "/opt/sqlite-vec/vec0.so");
    }).toThrow("invalid version");
  });
});
