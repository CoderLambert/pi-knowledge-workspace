import { createHash } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import type { KnowledgeDatabase, SqliteStatement } from "./database.js";
import {
  MdTextImportJobs,
  type ImportSourceDomain,
} from "./importJobs.js";
import type { KnowledgeSource, KnowledgeSourceVersion } from "./sourceDomain.js";

interface JobRow {
  id: string;
  knowledge_workspace_id: string;
  kind: string;
  status: string;
  payload_json: string;
  created_at: string;
  updated_at: string;
  idempotency_key: string;
  cancel_requested: number;
  result_json: string | null;
}

interface AttemptRow {
  id: string;
  job_id: string;
  attempt: number;
  status: string;
  started_at: string;
  finished_at: string | null;
  error_json: string | null;
}

class ImportDatabase implements KnowledgeDatabase {
  readonly jobs: JobRow[] = [];
  readonly attempts: AttemptRow[] = [];
  readonly workspaces = new Map<string, string>();
  exec(): void {}
  close(): void {}
  pragma(): unknown { return undefined; }

  prepare(sql: string): SqliteStatement {
    return {
      run: (...params: unknown[]) => this.run(sql, params),
      get: (...params: unknown[]) => this.get(sql, params),
      all: (...params: unknown[]) => this.all(sql, params),
    };
  }

  private run(sql: string, p: unknown[]) {
    if (sql.includes("INSERT INTO jobs")) {
      if (this.jobs.some((job) => job.knowledge_workspace_id === p[1] && job.kind === p[2] && job.idempotency_key === p[7])) {
        throw new Error("UNIQUE constraint failed");
      }
      this.jobs.push({
        id: String(p[0]), knowledge_workspace_id: String(p[1]), kind: String(p[2]), status: String(p[3]),
        payload_json: String(p[4]), created_at: String(p[5]), updated_at: String(p[6]),
        idempotency_key: String(p[7]), cancel_requested: 0, result_json: null,
      });
      return changed();
    }
    if (sql.includes("SET cancel_requested = 1, status = ?")) {
      const job = this.jobs.find((row) => row.id === p[2] && row.kind === p[3]);
      if (!job) return unchanged();
      job.cancel_requested = 1; job.status = String(p[0]); job.updated_at = String(p[1]); return changed();
    }
    if (sql.includes("SET status = 'queued', cancel_requested = 0")) {
      const job = this.jobs.find((row) => row.id === p[1] && row.kind === p[2] && row.status === "failed");
      if (!job) return unchanged();
      job.status = "queued"; job.cancel_requested = 0; job.updated_at = String(p[0]); return changed();
    }
    if (sql.includes("SET status = 'running', updated_at = ?")) {
      const job = this.jobs.find((row) => row.id === p[1] && row.kind === p[2] && row.status === "queued" && row.cancel_requested === 0);
      if (!job) return unchanged();
      job.status = "running"; job.updated_at = String(p[0]); return changed();
    }
    if (sql.includes("INSERT INTO job_attempts")) {
      this.attempts.push({ id: String(p[0]), job_id: String(p[1]), attempt: Number(p[2]), status: "running", started_at: String(p[3]), finished_at: null, error_json: null });
      return changed();
    }
    if (sql.includes("job_attempts SET status = 'succeeded'")) {
      const row = this.attempts.find((a) => a.id === p[1] && a.job_id === p[2]);
      if (!row) return unchanged();
      row.status = "succeeded"; row.finished_at = String(p[0]); row.error_json = null; return changed();
    }
    if (sql.includes("SET status = 'succeeded', result_json = ?")) {
      const job = this.jobs.find((row) => row.id === p[2] && row.kind === p[3]);
      if (!job) return unchanged();
      job.status = "succeeded"; job.result_json = String(p[0]); job.updated_at = String(p[1]); return changed();
    }
    if (sql.includes("job_attempts SET status = 'failed'") && sql.includes("WHERE id = ? AND job_id = ?")) {
      const row = this.attempts.find((a) => a.id === p[2] && a.job_id === p[3]);
      if (!row) return unchanged();
      row.status = "failed"; row.finished_at = String(p[0]); row.error_json = String(p[1]); return changed();
    }
    if (sql.includes("UPDATE jobs SET status = 'failed'")) {
      const job = this.jobs.find((row) => row.id === p[1] && row.kind === p[2]);
      if (!job) return unchanged();
      job.status = "failed"; job.updated_at = String(p[0]); return changed();
    }
    if (sql.includes("job_attempts") && sql.includes("WHERE job_id = ? AND status = 'running'")) {
      const rows = this.attempts.filter((a) => a.job_id === p[2] && a.status === "running");
      for (const row of rows) { row.status = "failed"; row.finished_at = String(p[0]); row.error_json = String(p[1]); }
      return { changes: rows.length, lastInsertRowid: 0 };
    }
    if (sql.includes("UPDATE jobs SET status = 'queued', updated_at = ?")) {
      const job = this.jobs.find((row) => row.id === p[1] && row.kind === p[2] && row.status === "running");
      if (!job) return unchanged();
      job.status = "queued"; job.updated_at = String(p[0]); return changed();
    }
    if (sql.includes("job_attempts SET status = 'cancelled'")) {
      const row = this.attempts.find((a) => a.id === p[1] && a.job_id === p[2]);
      if (!row) return unchanged();
      row.status = "cancelled"; row.finished_at = String(p[0]); row.error_json = null; return changed();
    }
    if (sql.includes("UPDATE jobs SET status = 'cancelled'")) {
      const job = this.jobs.find((row) => row.id === p[1] && row.kind === p[2]);
      if (!job) return unchanged();
      job.status = "cancelled"; job.cancel_requested = 1; job.updated_at = String(p[0]); return changed();
    }
    throw new Error(`unexpected run SQL: ${sql}`);
  }

  private get(sql: string, p: unknown[]): unknown {
    if (sql.includes("FROM jobs WHERE id = ? AND kind = ?")) return this.jobs.find((j) => j.id === p[0] && j.kind === p[1]);
    if (sql.includes("WHERE knowledge_workspace_id = ? AND kind = ? AND idempotency_key = ?")) {
      return this.jobs.find((j) => j.knowledge_workspace_id === p[0] && j.kind === p[1] && j.idempotency_key === p[2]);
    }
    if (sql.includes("MAX(attempt)")) {
      const values = this.attempts.filter((a) => a.job_id === p[0]).map((a) => a.attempt);
      return { max_attempt: values.length ? Math.max(...values) : 0 };
    }
    if (sql.includes("SELECT canonical_realpath FROM knowledge_workspaces")) {
      const root = this.workspaces.get(String(p[0]));
      return root ? { canonical_realpath: root } : undefined;
    }
    throw new Error(`unexpected get SQL: ${sql}`);
  }

  private all(sql: string, p: unknown[]): unknown[] {
    if (sql.includes("FROM jobs WHERE kind = ? AND status = 'running'")) {
      return this.jobs.filter((j) => j.kind === p[0] && j.status === "running").map((j) => ({ id: j.id }));
    }
    throw new Error(`unexpected all SQL: ${sql}`);
  }
}

class SourceStub implements ImportSourceDomain {
  readonly sources: KnowledgeSource[] = [];
  readonly versions: KnowledgeSourceVersion[] = [];
  captured: Buffer[] = [];
  failCaptures = 0;

  createSource(input: { knowledgeWorkspaceId: string; kind: string; displayName: string }): KnowledgeSource {
    const source: KnowledgeSource = { id: `source-${this.sources.length + 1}`, knowledgeWorkspaceId: input.knowledgeWorkspaceId, kind: input.kind, displayName: input.displayName, archivedAt: null, createdAt: "2026-09-09T00:00:00.000Z" };
    this.sources.push(source); return source;
  }

  async captureSourceVersion(sourceId: string, rawBytes: Uint8Array): Promise<KnowledgeSourceVersion> {
    if (this.failCaptures-- > 0) throw new Error("injected persistence failure");
    const bytes = Buffer.from(rawBytes); this.captured.push(bytes);
    const hash = createHash("sha256").update(bytes).digest("hex");
    const existing = this.versions.find((v) => v.sourceId === sourceId && v.contentSha256 === hash);
    if (existing) return existing;
    const version: KnowledgeSourceVersion = { id: `version-${this.versions.length + 1}`, sourceId, contentSha256: hash, blobKey: hash, byteLength: bytes.byteLength, createdAt: "2026-09-09T00:00:00.000Z" };
    this.versions.push(version); return version;
  }
}

function changed() { return { changes: 1, lastInsertRowid: 0 }; }
function unchanged() { return { changes: 0, lastInsertRowid: 0 }; }

const roots: string[] = [];
afterEach(async () => { await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))); });

async function fixture(options: ConstructorParameters<typeof MdTextImportJobs>[2] = {}) {
  const root = await mkdtemp(path.join(os.tmpdir(), "pi-knowledge-import-job-")); roots.push(root);
  const db = new ImportDatabase(); db.workspaces.set("workspace-1", root);
  const sources = new SourceStub(); let id = 0;
  const jobs = new MdTextImportJobs(db, sources, { createId: () => `id-${++id}`, now: () => new Date(`2026-09-09T00:00:${String(id).padStart(2, "0")}.000Z`), ...options });
  return { root, db, sources, jobs };
}

describe("MdTextImportJobs", () => {
  it("submits idempotently and permits only Markdown/TXT inputs", async () => {
    const { jobs, sources } = await fixture();
    const first = jobs.submit({ knowledgeWorkspaceId: "workspace-1", relativePath: "docs/a.md", idempotencyKey: "import:a" });
    const same = jobs.submit({ knowledgeWorkspaceId: "workspace-1", relativePath: "docs/a.md", idempotencyKey: "import:a" });
    expect(same.id).toBe(first.id); expect(sources.sources).toHaveLength(1);
    expect(() => jobs.submit({ knowledgeWorkspaceId: "workspace-1", relativePath: "image.png", idempotencyKey: "import:png" })).toThrow(/Markdown and TXT/);
  });

  it("captures the authoritative Workspace file once and persists a SourceVersion result", async () => {
    const { root, jobs, sources } = await fixture();
    const bytes = Buffer.from("# hello\n中文 👋\n"); await writeFile(path.join(root, "note.md"), bytes);
    const job = jobs.submit({ knowledgeWorkspaceId: "workspace-1", relativePath: "note.md", idempotencyKey: "note:v1" });
    const done = await jobs.run(job.id);
    expect(done.status).toBe("succeeded"); expect(done.result?.contentSha256).toBe(createHash("sha256").update(bytes).digest("hex"));
    expect(sources.captured).toEqual([bytes]); expect(sources.versions).toHaveLength(1);
  });

  it("records failure, retries explicitly, and converges on one durable SourceVersion", async () => {
    const { root, jobs, sources, db } = await fixture(); await writeFile(path.join(root, "retry.txt"), "retry me");
    sources.failCaptures = 1;
    const job = jobs.submit({ knowledgeWorkspaceId: "workspace-1", relativePath: "retry.txt", idempotencyKey: "retry" });
    await expect(jobs.run(job.id)).rejects.toThrow("injected persistence failure");
    expect(jobs.get(job.id).status).toBe("failed");
    expect(jobs.retry(job.id).status).toBe("queued");
    expect((await jobs.run(job.id)).status).toBe("succeeded");
    expect(db.attempts.map((a) => a.status)).toEqual(["failed", "succeeded"]); expect(sources.versions).toHaveLength(1);
  });

  it("cancels a queued job without reading or persisting bytes", async () => {
    let captures = 0; const { jobs, sources } = await fixture({ captureFile: async () => { captures += 1; throw new Error("should not run"); } });
    const job = jobs.submit({ knowledgeWorkspaceId: "workspace-1", relativePath: "cancel.md", idempotencyKey: "cancel" });
    expect(jobs.requestCancel(job.id).status).toBe("cancelled");
    expect((await jobs.run(job.id)).status).toBe("cancelled"); expect(captures).toBe(0); expect(sources.versions).toHaveLength(0);
  });

  it("observes in-flight cancellation after safe capture and before SourceVersion persistence", async () => {
    const bytes = Buffer.from("captured but cancelled"); let jobs!: MdTextImportJobs; let submittedId = "";
    const fx = await fixture({ captureFile: async (_root, relativePath) => {
      jobs.requestCancel(submittedId);
      return { relativePath, canonicalPath: `/fake/${relativePath}`, bytes, byteLength: bytes.byteLength, contentSha256: createHash("sha256").update(bytes).digest("hex") };
    }});
    jobs = fx.jobs;
    const submitted = jobs.submit({ knowledgeWorkspaceId: "workspace-1", relativePath: "cancel.txt", idempotencyKey: "cancel-running" }); submittedId = submitted.id;
    const done = await jobs.run(submitted.id);
    expect(done.status).toBe("cancelled"); expect(fx.sources.versions).toHaveLength(0); expect(fx.db.attempts[0]?.status).toBe("cancelled");
  });

  it("recovers interrupted running imports to queued state for restart-safe replay", async () => {
    const { jobs, db } = await fixture();
    const job = jobs.submit({ knowledgeWorkspaceId: "workspace-1", relativePath: "restart.md", idempotencyKey: "restart" });
    const row = db.jobs.find((j) => j.id === job.id)!; row.status = "running";
    db.attempts.push({ id: "attempt-crashed", job_id: job.id, attempt: 1, status: "running", started_at: "2026-09-09T00:00:00.000Z", finished_at: null, error_json: null });
    expect(jobs.recoverInterrupted()).toBe(1); expect(jobs.get(job.id).status).toBe("queued"); expect(db.attempts[0]?.status).toBe("failed");
  });
});