import { KNOWLEDGE_OPERATIONS, type KnowledgeOperation } from "../contracts/operations.js";
import {
  PI_KNOWLEDGE_PROTOCOL_VERSION,
  PI_KNOWLEDGE_SERVICE_NAME,
  PI_KNOWLEDGE_SERVICE_VERSION,
} from "../contracts/protocol.js";
import { parseWorkspaceEchoInput, requireEmptyOperationInput } from "../contracts/schemas.js";
import type { KnowledgeViewerDispatch, ViewerHostScope } from "./viewerDispatch.js";

export interface KnowledgeDispatchLimits {
  maxRequestBytes: number;
  maxResponseBytes: number;
}

export interface KnowledgeDispatchDependencies {
  viewer?: KnowledgeViewerDispatch;
}

export function dispatchKnowledgeOperation(
  operation: KnowledgeOperation,
  input: unknown,
  limits: KnowledgeDispatchLimits,
  dependencies: KnowledgeDispatchDependencies = {},
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
    case "viewer.sources.list": {
      const request = parseViewerRequest(input, operation, []);
      return requireViewer(dependencies).listSources(request.scope);
    }
    case "viewer.source.get": {
      const request = parseViewerRequest(input, operation, ["sourceId"]);
      return requireViewer(dependencies).getSource(request.scope, requireString(request.body, "sourceId", operation));
    }
    case "viewer.artifact.open": {
      const request = parseViewerRequest(input, operation, ["parsedArtifactId"], ["evidenceId", "maxBytes"]);
      const evidenceId = optionalString(request.body, "evidenceId", operation);
      const maxBytes = optionalPositiveInteger(request.body, "maxBytes", operation);
      return requireViewer(dependencies).openArtifact(request.scope, {
        parsedArtifactId: requireString(request.body, "parsedArtifactId", operation),
        ...(evidenceId === undefined ? {} : { evidenceId }),
        ...(maxBytes === undefined ? {} : { maxBytes }),
      });
    }
  }
}

function requireViewer(dependencies: KnowledgeDispatchDependencies): KnowledgeViewerDispatch {
  if (dependencies.viewer === undefined) {
    throw new Error("Knowledge Source/Evidence viewer runtime is not configured");
  }
  return dependencies.viewer;
}

function parseViewerRequest(
  value: unknown,
  operation: string,
  requiredFields: readonly string[],
  optionalFields: readonly string[] = [],
): { scope: ViewerHostScope; body: Record<string, unknown> } {
  const body = requireRecord(value, `${operation} input`);
  const allowed = new Set(["scope", ...requiredFields, ...optionalFields]);
  for (const key of Object.keys(body)) {
    if (!allowed.has(key)) throw new TypeError(`${operation} input contains unsupported field: ${key}`);
  }
  for (const key of requiredFields) requireString(body, key, operation);

  const rawScope = requireRecord(body["scope"], `${operation} scope`);
  const allowedScope = new Set(["projectId", "workspaceId", "workspacePath", "workspaceLabel"]);
  for (const key of Object.keys(rawScope)) {
    if (!allowedScope.has(key)) throw new TypeError(`${operation} scope contains unsupported field: ${key}`);
  }
  const workspaceLabel = optionalString(rawScope, "workspaceLabel", operation);
  return {
    scope: {
      projectId: requireString(rawScope, "projectId", operation),
      workspaceId: requireString(rawScope, "workspaceId", operation),
      workspacePath: requireString(rawScope, "workspacePath", operation),
      ...(workspaceLabel === undefined ? {} : { workspaceLabel }),
    },
    body,
  };
}

function requireRecord(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object`);
  }
  return value as Record<string, unknown>;
}

function requireString(record: Record<string, unknown>, key: string, operation: string): string {
  const value = record[key];
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new TypeError(`${operation} ${key} must be a non-empty string`);
  }
  return value;
}

function optionalString(record: Record<string, unknown>, key: string, operation: string): string | undefined {
  const value = record[key];
  if (value === undefined) return undefined;
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new TypeError(`${operation} ${key} must be a non-empty string when supplied`);
  }
  return value;
}

function optionalPositiveInteger(record: Record<string, unknown>, key: string, operation: string): number | undefined {
  const value = record[key];
  if (value === undefined) return undefined;
  if (!Number.isSafeInteger(value) || (value as number) <= 0) {
    throw new TypeError(`${operation} ${key} must be a positive integer when supplied`);
  }
  return value as number;
}
