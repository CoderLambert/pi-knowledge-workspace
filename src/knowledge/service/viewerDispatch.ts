import type { KnowledgeDatabase } from "../storage/database.js";
import type { ParsedArtifactReadStore } from "../storage/evidenceRead.js";
import { SourceEvidenceViewer } from "../storage/sourceEvidenceViewer.js";
import { resolveKnowledgeWorkspaceIdentity } from "../storage/workspaceIdentity.js";

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

/**
 * Resolves PI WEB's host-authoritative Workspace path into the separate durable
 * Knowledge Workspace identity before querying viewer data.
 */
export function createKnowledgeViewerDispatch(
  db: KnowledgeDatabase,
  artifacts: ParsedArtifactReadStore,
): KnowledgeViewerDispatch {
  const viewer = new SourceEvidenceViewer(db, artifacts);

  const resolveWorkspace = (scope: ViewerHostScope): string => resolveKnowledgeWorkspaceIdentity(db, {
    workspacePath: scope.workspacePath,
    externalBinding: JSON.stringify({ projectId: scope.projectId, workspaceId: scope.workspaceId }),
  }).knowledgeWorkspaceId;

  return Object.freeze({
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
      return {
        version: 1,
        document: viewer.openArtifact({
          knowledgeWorkspaceId,
          parsedArtifactId: input.parsedArtifactId,
          ...(input.evidenceId === undefined ? {} : { evidenceId: input.evidenceId }),
          ...(input.maxBytes === undefined ? {} : { maxBytes: input.maxBytes }),
        }),
      };
    },
  });
}
