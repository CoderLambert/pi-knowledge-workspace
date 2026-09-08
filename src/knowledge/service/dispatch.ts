import { KNOWLEDGE_OPERATIONS, type KnowledgeOperation } from "../contracts/operations.js";
import {
  PI_KNOWLEDGE_PROTOCOL_VERSION,
  PI_KNOWLEDGE_SERVICE_NAME,
  PI_KNOWLEDGE_SERVICE_VERSION,
} from "../contracts/protocol.js";
import { parseWorkspaceEchoInput, requireEmptyOperationInput } from "../contracts/schemas.js";

export interface KnowledgeDispatchLimits {
  maxRequestBytes: number;
  maxResponseBytes: number;
}

export function dispatchKnowledgeOperation(
  operation: KnowledgeOperation,
  input: unknown,
  limits: KnowledgeDispatchLimits,
): Record<string, unknown> {
  switch (operation) {
    case "capabilities.get":
      requireEmptyOperationInput(input, operation);
      return {
        service: PI_KNOWLEDGE_SERVICE_NAME,
        serviceVersion: PI_KNOWLEDGE_SERVICE_VERSION,
        protocolVersion: PI_KNOWLEDGE_PROTOCOL_VERSION,
        operations: [...KNOWLEDGE_OPERATIONS],
        limits: {
          maxRequestBytes: limits.maxRequestBytes,
          maxResponseBytes: limits.maxResponseBytes,
        },
      };
    case "workspace.echo": {
      const scope = parseWorkspaceEchoInput(input);
      return scope.workspaceLabel === undefined
        ? {
            projectId: scope.projectId,
            workspaceId: scope.workspaceId,
            workspacePath: scope.workspacePath,
          }
        : {
            projectId: scope.projectId,
            workspaceId: scope.workspaceId,
            workspacePath: scope.workspacePath,
            workspaceLabel: scope.workspaceLabel,
          };
    }
  }
}
