import type { KnowledgeDatabase } from "../storage/database.js";
import type { ParsedArtifactReadStore } from "../storage/evidenceRead.js";
import { SourceEvidenceViewer } from "../storage/sourceEvidenceViewer.js";
import { resolveKnowledgeWorkspaceIdentity } from "../storage/workspaceIdentity.js";
import type { GroundedAskHostScope, GroundedAskScopeResolver } from "./groundedAsk.js";

export interface ViewerHostScope {
  projectId: string;
  workspaceId: string;
  workspacePath: string;
  workspaceLabel?: string;
}

export interface KnowledgeViewerDispatch {
  listSources(scope: ViewerHostScope): Record<string, unknown>;
  getSource(scope: ViewerHostScope, sourceId: string): Record<string, unknown>;
  openArtifact(
    scope: ViewerHostScope,
    input: { parsedArtifactId: string; evidenceId?: string; maxBytes?: number },
  ): Record<string, unknown>;
}

/** Reuses the same host-authoritative Workspace → Knowledge identity mapping as the viewer. */
export function createKnowledgeWorkspaceScopeResolver(db: KnowledgeDatabase): GroundedAskScopeResolver {
  return Object.freeze({
    resolveKnowledgeWorkspaceId(scope: GroundedAskHostScope): string {
      return resolveKnowledgeWorkspaceIdentity(db, {
        workspacePath: scope.workspacePath,
        externalBinding: JSON.stringify({ projectId: scope.projectId, workspaceId: scope.workspaceId }),
      }).knowledgeWorkspaceId;
    },
  });
}

const DEFAULT_VIEWER_ARTIFACT_BYTES = 40 * 1024;
const MAX_VIEWER_ARTIFACT_BYTES = 48 * 1024;

/**
 * Resolves PI WEB's host-authoritative Workspace path into the separate durable
 * Knowledge Workspace identity before querying viewer data.
 */
export function createKnowledgeViewerDispatch(
  db: KnowledgeDatabase,
  artifacts: ParsedArtifactReadStore,
): KnowledgeViewerDispatch {
  const viewer = new SourceEvidenceViewer(db, artifacts);

  const scopeResolver = createKnowledgeWorkspaceScopeResolver(db);
  const resolveWorkspace = (scope: ViewerHostScope): string => scopeResolver.resolveKnowledgeWorkspaceId(scope);

  const dispatch: KnowledgeViewerDispatch = {
    listSources(scope) {
      const knowledgeWorkspaceId = resolveWorkspace(scope);
      return {
        version: 1,
        knowledgeWorkspaceId,
        sources: viewer.listSources(knowledgeWorkspaceId),
      };
    },

    getSource(scope, sourceId) {
      const knowledgeWorkspaceId = resolveWorkspace(scope);
      return {
        version: 1,
        source: viewer.getSource(knowledgeWorkspaceId, sourceId),
      };
    },

    openArtifact(scope, input) {
      const knowledgeWorkspaceId = resolveWorkspace(scope);
      const maxBytes = input.maxBytes ?? DEFAULT_VIEWER_ARTIFACT_BYTES;
      if (!Number.isSafeInteger(maxBytes) || maxBytes <= 0 || maxBytes > MAX_VIEWER_ARTIFACT_BYTES) {
        throw new TypeError(`viewer artifact maxBytes must be between 1 and ${String(MAX_VIEWER_ARTIFACT_BYTES)}`);
      }
      return {
        version: 1,
        document: viewer.openArtifact({
          knowledgeWorkspaceId,
          parsedArtifactId: input.parsedArtifactId,
          ...(input.evidenceId === undefined ? {} : { evidenceId: input.evidenceId }),
          maxBytes,
        }),
      };
    },
  };

  return Object.freeze(dispatch);
}
