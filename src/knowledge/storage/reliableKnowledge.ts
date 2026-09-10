import { chunkParsedArtifact, type ChunkerOptions } from "./chunker.js";
import { Fts5BaselineIndex } from "./fts5Index.js";
import { IndexBuildPublisher, type IndexBuildRecord } from "./indexBuildPublication.js";
import {
  ParsedArtifactCanonicalizer,
  SqliteParsedArtifactStore,
  type DurableParsedArtifact,
  type ParsedArtifactInterpretation,
} from "./parsedArtifact.js";
import type { KnowledgeSourceVersion } from "./sourceDomain.js";

export interface ReliableKnowledgeCandidateSource {
  sourceVersion: KnowledgeSourceVersion;
  sourceKind: "md" | "txt";
  interpretation?: ParsedArtifactInterpretation;
}

export interface PublishReliableKnowledgeInput {
  knowledgeWorkspaceId: string;
  /** Complete replacement selection, including unchanged Sources; never an incremental patch. */
  sources: readonly ReliableKnowledgeCandidateSource[];
  retrievalConfigRevision: string;
  strategy?: string;
  chunking?: ChunkerOptions;
  expectedBase?: {
    generation: number;
    publicationId: string | null;
  };
}

export interface ReliableKnowledgePublicationResult {
  indexBuild: IndexBuildRecord;
  parsedArtifacts: readonly DurableParsedArtifact[];
}

/** Orchestrates one complete immutable ParsedArtifact -> IndexBuild -> publication candidate. */
export class ReliableKnowledgePublisher {
  constructor(
    private readonly canonicalizer: ParsedArtifactCanonicalizer,
    private readonly artifacts: SqliteParsedArtifactStore,
    private readonly index: Fts5BaselineIndex,
    private readonly builds: IndexBuildPublisher,
  ) {}

  async publish(input: PublishReliableKnowledgeInput): Promise<ReliableKnowledgePublicationResult> {
    const workspaceId = nonEmpty(input.knowledgeWorkspaceId, "knowledgeWorkspaceId");
    const retrievalConfigRevision = nonEmpty(input.retrievalConfigRevision, "retrievalConfigRevision");
    if (input.sources.length === 0) throw new TypeError("Reliable Knowledge candidate must select at least one Source");
    assertUniqueSources(input.sources);

    // Parse every input before creating a candidate build. A parse failure therefore
    // cannot affect the currently published selection or retrieval projection.
    const parsedArtifacts: DurableParsedArtifact[] = [];
    for (const source of input.sources) {
      const canonical = await this.canonicalizer.fromSourceVersion(
        source.sourceVersion,
        source.sourceKind,
        source.interpretation,
      );
      parsedArtifacts.push(this.artifacts.materialize(workspaceId, canonical));
    }

    const build = this.builds.createStaging(workspaceId, input.strategy ?? "fts5", {
      retrievalConfigRevision,
      ...(input.expectedBase === undefined ? {} : { expectedBase: input.expectedBase }),
    });
    for (const artifact of parsedArtifacts) {
      this.index.replaceArtifactChunks({
        knowledgeWorkspaceId: workspaceId,
        indexBuildId: build.id,
        sourceVersionId: artifact.sourceVersionId,
        parsedArtifactId: artifact.parsedArtifactId,
        chunks: chunkParsedArtifact(artifact, input.chunking),
      });
    }
    this.builds.markValidated(build.id);
    return {
      indexBuild: this.builds.publish(build.id),
      parsedArtifacts: Object.freeze(parsedArtifacts),
    };
  }
}

function assertUniqueSources(sources: readonly ReliableKnowledgeCandidateSource[]): void {
  const sourceIds = new Set(sources.map((source) => source.sourceVersion.sourceId));
  if (sourceIds.size !== sources.length) {
    throw new Error("Reliable Knowledge candidate contains multiple selections for one Source");
  }
}

function nonEmpty(value: string, name: string): string {
  const normalized = value.trim();
  if (normalized.length === 0) throw new TypeError(`${name} must be non-empty`);
  return normalized;
}
