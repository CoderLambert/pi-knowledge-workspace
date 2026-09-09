import { ContentAddressedBlobStore } from "../storage/blobStore.js";
import {
  KnowledgeBackupCreator,
  type BackupCapableDatabase,
  type KnowledgeBackupManifest,
} from "../storage/backup.js";
import {
  openKnowledgeDatabase,
  openKnowledgeDatabaseReadOnly,
  type KnowledgeDatabase,
} from "../storage/database.js";

export interface BackupCliOptions {
  dbPath: string;
  dataDir: string;
  outputDirectory: string;
}

export async function runBackupCli(argv: readonly string[]): Promise<KnowledgeBackupManifest> {
  const options = parseBackupArgs(argv);
  const db = openKnowledgeDatabase(options.dbPath);
  try {
    const backup = asBackupCapable(db);
    const creator = new KnowledgeBackupCreator(
      backup,
      new ContentAddressedBlobStore(options.dataDir),
      {
        openSnapshotDatabase: openKnowledgeDatabaseReadOnly,
        // P1-T08/T15 have not yet provided a production durable ParsedArtifact
        // materialization store. The creator therefore refuses any snapshot that
        // contains ParsedArtifacts instead of emitting an incomplete backup.
      },
    );
    return await creator.create(options.outputDirectory);
  } finally {
    db.close();
  }
}

export function parseBackupArgs(argv: readonly string[]): BackupCliOptions {
  const values = new Map<string, string>();
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index]!;
    if (flag !== "--db" && flag !== "--data-dir" && flag !== "--output") {
      throw new Error(`Unknown backup argument: ${flag}`);
    }
    const value = argv[index + 1];
    if (value === undefined || value.startsWith("--")) throw new Error(`Missing value for ${flag}`);
    if (values.has(flag)) throw new Error(`Duplicate backup argument: ${flag}`);
    values.set(flag, value);
    index += 1;
  }

  return {
    dbPath: required(values, "--db"),
    dataDir: required(values, "--data-dir"),
    outputDirectory: required(values, "--output"),
  };
}

function asBackupCapable(db: KnowledgeDatabase): KnowledgeDatabase & BackupCapableDatabase {
  const candidate = db as KnowledgeDatabase & Partial<BackupCapableDatabase>;
  if (typeof candidate.backup !== "function") {
    throw new Error("Selected SQLite driver does not expose the required online backup API");
  }
  return candidate as KnowledgeDatabase & BackupCapableDatabase;
}

function required(values: ReadonlyMap<string, string>, flag: string): string {
  const value = values.get(flag)?.trim();
  if (!value) throw new Error(`pi-knowledge backup requires ${flag} <path>`);
  return value;
}
