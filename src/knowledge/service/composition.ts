import type {
  GroundedAskDispatch,
  GroundedAskModelIdentity,
  GroundedAskScopeResolver,
  GroundedAskService,
} from "./groundedAsk.js";
import { createGroundedAskDispatch } from "./groundedAsk.js";
import type { MdTextImportJobs } from "../storage/importJobs.js";
import type { KnowledgeDatabase } from "../storage/database.js";
import type { ReliableKnowledgePublisher } from "../storage/reliableKnowledge.js";
import type { SourceDomain } from "../storage/sourceDomain.js";

export interface KnowledgeImportPort {
  submit(input: {
    knowledgeWorkspaceId: string;
    relativePath: string;
    idempotencyKey: string;
    displayName?: string;
    sourceId?: string;
  }): object | Promise<object>;
  status(knowledgeWorkspaceId: string, jobId: string): object;
}

export interface KnowledgePublishPort {
  publish(input: {
    knowledgeWorkspaceId: string;
    sourceIds: readonly string[];
    sourceVersionIds: readonly string[];
    retrievalConfigRevision?: string;
  }): object | Promise<object>;
}

export interface KnowledgeImportDispatch {
  submit(input: KnowledgeImportTransportInput): object | Promise<object>;
  status(input: KnowledgeImportStatusTransportInput): object;
}

export interface KnowledgePublishDispatch {
  publish(input: KnowledgePublishTransportInput): object | Promise<object>;
}

export interface KnowledgeImportTransportScope {
  projectId: string;
  workspaceId: string;
  workspacePath: string;
  workspaceLabel?: string;
}

export interface KnowledgeImportTransportInput {
  scope: KnowledgeImportTransportScope;
  relativePath: string;
  idempotencyKey: string;
  displayName?: string;
  sourceId?: string;
}

export interface KnowledgeImportStatusTransportInput {
  scope: KnowledgeImportTransportScope;
  jobId: string;
}

export interface KnowledgePublishTransportInput {
  scope: KnowledgeImportTransportScope;
  sourceIds: readonly string[];
  sourceVersionIds: readonly string[];
  retrievalConfigRevision?: string;
}

export interface KnowledgeServiceComposition {
  groundedAsk?: GroundedAskDispatch;
  importJobs: KnowledgeImportDispatch;
  publish: KnowledgePublishDispatch;
}

/** Adapts the durable import job implementation without exposing SQLite to HTTP. */
export function createKnowledgeImportPort(jobs: MdTextImportJobs): KnowledgeImportPort {
  return Object.freeze({
    submit: async (input: {
      knowledgeWorkspaceId: string;
      relativePath: string;
      idempotencyKey: string;
      displayName?: string;
      sourceId?: string;
    }) => {
      const job = jobs.submit(input);
      return await jobs.run(job.id);
    },
    status: (knowledgeWorkspaceId: string, jobId: string) => {
      const job = jobs.get(jobId);
      if (job.knowledgeWorkspaceId !== knowledgeWorkspaceId) {
        throw new Error("Import job does not belong to the requested Knowledge Workspace");
      }
      return job;
    },
  });
}

/**
 * Adapts ReliableKnowledgePublisher to the preview's partial selection input.
 * An update replaces only the named SourceVersion; all other selections from
 * the current publication remain part of the next candidate.
 */
export function createReliableKnowledgePublishPort(
  db: KnowledgeDatabase,
  sources: SourceDomain,
  publisher: ReliableKnowledgePublisher,
): KnowledgePublishPort {
  return Object.freeze({
    async publish(input: Parameters<KnowledgePublishPort["publish"]>[0]) {
      if (input.sourceIds.length !== input.sourceVersionIds.length) {
        throw new Error("sourceIds and sourceVersionIds must have equal lengths");
      }
      const current = currentSelections(db, input.knowledgeWorkspaceId);
      const selected = current.selected;
      for (let index = 0; index < input.sourceIds.length; index += 1) {
        const sourceId = input.sourceIds[index];
        const sourceVersionId = input.sourceVersionIds[index];
        if (sourceId === undefined || sourceVersionId === undefined) throw new Error("Publication selection is incomplete");
        selected.set(sourceId, sourceVersionId);
      }
      if (selected.size === 0) throw new Error("Knowledge publication requires at least one Source");
      const candidates = [...selected.entries()].map(([sourceId, sourceVersionId]) => {
        const source = sources.getSource(sourceId);
        if (source.knowledgeWorkspaceId !== input.knowledgeWorkspaceId) throw new Error("Source is outside the requested Knowledge Workspace");
        const version = sources.listSourceVersions(sourceId).find((candidate) => candidate.id === sourceVersionId);
        if (version === undefined) throw new Error(`Unknown SourceVersion: ${sourceVersionId}`);
        const sourceKind = sourceKindForPublication(
          db,
          input.knowledgeWorkspaceId,
          source.id,
          source.displayName,
        );
        return { sourceVersion: version, sourceKind };
      });
      const result = await publisher.publish({
        knowledgeWorkspaceId: input.knowledgeWorkspaceId,
        sources: candidates,
        retrievalConfigRevision: input.retrievalConfigRevision ?? "fts5-baseline-v1",
        expectedBase: current.expectedBase,
      });
      const published = db.prepare(
        `SELECT active_knowledge_publication_id, index_generation
         FROM knowledge_workspaces
         WHERE id=? AND active_index_build_id=?`,
      ).get(input.knowledgeWorkspaceId, result.indexBuild.id);
      if (
        !isRecord(published)
        || typeof published["active_knowledge_publication_id"] !== "string"
        || typeof published["index_generation"] !== "number"
        || !Number.isSafeInteger(published["index_generation"])
      ) {
        throw new Error("Published Knowledge identity is unavailable after publication");
      }
      return {
        id: published["active_knowledge_publication_id"],
        generation: published["index_generation"],
        indexBuildId: result.indexBuild.id,
        parsedArtifactIds: result.parsedArtifacts.map((artifact) => artifact.parsedArtifactId),
      };
    },
  });
}

function currentSelections(db: KnowledgeDatabase, workspaceId: string): {
  selected: Map<string, string>;
  expectedBase: { generation: number; publicationId: string | null };
} {
  const workspace = db.prepare(
    "SELECT index_generation, active_knowledge_publication_id FROM knowledge_workspaces WHERE id=?",
  ).get(workspaceId);
  if (!isRecord(workspace)) throw new Error("Unknown Knowledge Workspace");
  const generation = workspace["index_generation"];
  const publicationId = workspace["active_knowledge_publication_id"];
  if (
    typeof generation !== "number"
    || !Number.isSafeInteger(generation)
    || generation < 0
    || (publicationId !== null && typeof publicationId !== "string")
  ) {
    throw new Error("Invalid Knowledge publication state");
  }
  const rows = db.prepare(`SELECT selection.source_id, selection.source_version_id
    FROM knowledge_publication_selections selection
    JOIN knowledge_workspaces workspace ON workspace.active_knowledge_publication_id=selection.publication_id
    WHERE workspace.id=?`).all(workspaceId);
  const selected = new Map<string, string>();
  for (const row of rows) {
    if (!isRecord(row)) throw new Error("Invalid publication selection row");
    const sourceId = row["source_id"];
    const sourceVersionId = row["source_version_id"];
    if (typeof sourceId !== "string" || typeof sourceVersionId !== "string") throw new Error("Invalid publication selection identity");
    selected.set(sourceId, sourceVersionId);
  }
  return { selected, expectedBase: { generation, publicationId } };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function sourceKindForPublication(
  db: KnowledgeDatabase,
  knowledgeWorkspaceId: string,
  sourceId: string,
  displayName: string,
): "md" | "txt" {
  const imported = db.prepare(`SELECT payload_json FROM jobs
    WHERE knowledge_workspace_id=? AND kind='workspace-file-import' AND status='succeeded'
      AND json_extract(payload_json, '$.sourceId')=?
    ORDER BY updated_at DESC, id DESC LIMIT 1`).get(knowledgeWorkspaceId, sourceId);
  const candidate = isRecord(imported) && typeof imported["payload_json"] === "string"
    ? importRelativePath(imported["payload_json"])
    : displayName;
  if (/\.txt$/iu.test(candidate)) return "txt";
  if (/\.(?:md|markdown)$/iu.test(candidate)) return "md";
  throw new Error("Reliable Knowledge publication supports only Markdown and TXT Sources");
}

function importRelativePath(payloadJson: string): string {
  const payload: unknown = JSON.parse(payloadJson);
  if (!isRecord(payload) || typeof payload["relativePath"] !== "string") {
    throw new Error("Imported Source is missing its durable relative path");
  }
  return payload["relativePath"];
}

/**
 * Composition root for the standalone service. Storage adapters and the model
 * callback are supplied by the process owner; this factory adds host scope
 * resolution once and keeps import/publish/ask in one service boundary.
 */
export function createKnowledgeServiceComposition(options: {
  groundedAsk?: GroundedAskService;
  importJobs: KnowledgeImportPort;
  publish: KnowledgePublishPort;
  scopeResolver: GroundedAskScopeResolver;
  modelIdentity?: GroundedAskModelIdentity;
}): KnowledgeServiceComposition {
  const { scopeResolver } = options;
  if ((options.groundedAsk === undefined) !== (options.modelIdentity === undefined)) {
    throw new Error("Grounded Ask service and model identity must be configured together");
  }
  const groundedAsk = options.groundedAsk === undefined || options.modelIdentity === undefined
    ? undefined
    : createGroundedAskDispatch(options.groundedAsk, scopeResolver, options.modelIdentity);
  return Object.freeze({
    ...(groundedAsk === undefined ? {} : { groundedAsk }),
    importJobs: Object.freeze({
      submit(input: KnowledgeImportTransportInput) {
        return options.importJobs.submit({
          knowledgeWorkspaceId: scopeResolver.resolveKnowledgeWorkspaceId(input.scope),
          relativePath: input.relativePath,
          idempotencyKey: input.idempotencyKey,
          ...(input.displayName === undefined ? {} : { displayName: input.displayName }),
          ...(input.sourceId === undefined ? {} : { sourceId: input.sourceId }),
        });
      },
      status(input: KnowledgeImportStatusTransportInput) {
        return options.importJobs.status(
          scopeResolver.resolveKnowledgeWorkspaceId(input.scope),
          input.jobId,
        );
      },
    }),
    publish: Object.freeze({
      publish(input: KnowledgePublishTransportInput) {
        return options.publish.publish({
          knowledgeWorkspaceId: scopeResolver.resolveKnowledgeWorkspaceId(input.scope),
          sourceIds: input.sourceIds,
          sourceVersionIds: input.sourceVersionIds,
          ...(input.retrievalConfigRevision === undefined
            ? {}
            : { retrievalConfigRevision: input.retrievalConfigRevision }),
        });
      },
    }),
  });
}
