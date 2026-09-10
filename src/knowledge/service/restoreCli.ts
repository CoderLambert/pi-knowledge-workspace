import { KnowledgeRestore, type KnowledgeRestoreResult } from "../storage/restore.js";
import { openKnowledgeDatabaseReadOnly } from "../storage/database.js";

export interface RestoreCliOptions {
  backupDirectory: string;
  targetDirectory: string;
}

export async function runRestoreCli(argv: readonly string[]): Promise<KnowledgeRestoreResult> {
  const options = parseRestoreArgs(argv);
  const restore = new KnowledgeRestore({
    openSnapshotDatabase: openKnowledgeDatabaseReadOnly,
    // P1-T08/T15 still lack production artifact materialization and historical
    // Evidence verification. KnowledgeRestore fails closed when the backup
    // requires either dependency instead of reporting SQLite-only success.
  });
  return restore.restore(options.backupDirectory, options.targetDirectory);
}

export function parseRestoreArgs(argv: readonly string[]): RestoreCliOptions {
  const values = new Map<string, string>();
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    if (flag === undefined) throw new Error("Missing restore argument");
    if (flag !== "--backup" && flag !== "--target") throw new Error(`Unknown restore argument: ${flag}`);
    const value = argv[index + 1];
    if (value === undefined || value.startsWith("--")) throw new Error(`Missing value for ${flag}`);
    if (values.has(flag)) throw new Error(`Duplicate restore argument: ${flag}`);
    values.set(flag, value);
    index += 1;
  }
  return {
    backupDirectory: required(values, "--backup"),
    targetDirectory: required(values, "--target"),
  };
}

function required(values: ReadonlyMap<string, string>, flag: string): string {
  const value = values.get(flag)?.trim();
  if (value === undefined || value.length === 0) throw new Error(`pi-knowledge restore requires ${flag} <path>`);
  return value;
}
