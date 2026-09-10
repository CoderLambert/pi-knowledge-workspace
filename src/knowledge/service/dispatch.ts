import { KNOWLEDGE_ERROR_CODES, KnowledgeServiceError } from "../contracts/errors.js";
import {
  GROUNDED_ASK_OPERATIONS,
  KNOWLEDGE_IMPORT_OPERATIONS,
  KNOWLEDGE_PUBLISH_OPERATIONS,
  KNOWLEDGE_VIEWER_OPERATIONS,
  type KnowledgeOperation,
} from "../contracts/operations.js";
import {
  PI_KNOWLEDGE_PROTOCOL_VERSION,
  PI_KNOWLEDGE_SERVICE_NAME,
  PI_KNOWLEDGE_SERVICE_VERSION,
} from "../contracts/protocol.js";
import {
  parseGroundedAskInput,
  parseGroundedAnswerListInput,
  parseGroundedAnswerLookupInput,
  parseGroundedCitationLookupInput,
  parseKnowledgeImportStatusInput,
  parseKnowledgeImportSubmitInput,
  parseKnowledgePublishInput,
  parseWorkspaceEchoInput,
  requireEmptyOperationInput,
} from "../contracts/schemas.js";
import type { GroundedAskDispatch } from "./groundedAsk.js";
import type { KnowledgeImportDispatch, KnowledgePublishDispatch } from "./composition.js";
import type { KnowledgeViewerDispatch, ViewerHostScope } from "./viewerDispatch.js";

export interface KnowledgeDispatchLimits {
  maxRequestBytes: number;
  maxResponseBytes: number;
}

export interface KnowledgeDispatchDependencies {
  viewer?: KnowledgeViewerDispatch;
  groundedAsk?: GroundedAskDispatch;
  importJobs?: KnowledgeImportDispatch;
  publish?: KnowledgePublishDispatch;
}

export function dispatchKnowledgeOperation(
  operation: KnowledgeOperation,
  input: unknown,
  limits: KnowledgeDispatchLimits,
  dependencies: KnowledgeDispatchDependencies = {},
): Record<string, unknown> | Promise<Record<string, unknown>> {
  switch (operation) {
    case "capabilities.get":
      requireEmptyOperationInput(input, operation);
      return {
        service: PI_KNOWLEDGE_SERVICE_NAME,
        serviceVersion: PI_KNOWLEDGE_SERVICE_VERSION,
        protocolVersion: PI_KNOWLEDGE_PROTOCOL_VERSION,
        operations: [
          "capabilities.get",
          "workspace.echo",
          ...(dependencies.viewer === undefined ? [] : KNOWLEDGE_VIEWER_OPERATIONS),
          ...(dependencies.groundedAsk === undefined ? [] : GROUNDED_ASK_OPERATIONS),
          ...(dependencies.importJobs === undefined ? [] : KNOWLEDGE_IMPORT_OPERATIONS),
          ...(dependencies.publish === undefined ? [] : KNOWLEDGE_PUBLISH_OPERATIONS),
        ],
        limits: {
          maxRequestBytes: limits.maxRequestBytes,
          maxResponseBytes: limits.maxResponseBytes,
        },
      };
    case "workspace.echo": {
      const scope = parseWorkspaceEchoInput(input);
      return scope.workspaceLabel === undefined
        ? { projectId: scope.projectId, workspaceId: scope.workspaceId, workspacePath: scope.workspacePath }
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
    case "knowledge.ask": {
      const ask = requireGroundedAsk(dependencies);
      const request = parseGroundedAskInput(input);
      return ask.ask(request).then((result) => ({
        version: 1,
        ...result,
      }));
    }
    case "knowledge.answer.get": {
      const request = parseGroundedAnswerLookupInput(input);
      return { version: 1, answer: requireGroundedAsk(dependencies).getAnswer(request) };
    }
    case "knowledge.answers.list": {
      const request = parseGroundedAnswerListInput(input);
      return { version: 1, answers: requireGroundedAsk(dependencies).listAnswers(request) };
    }
    case "knowledge.citation.open": {
      const request = parseGroundedCitationLookupInput(input);
      return { version: 1, document: requireGroundedAsk(dependencies).openCitation(request) };
    }
    case "knowledge.import.submit": {
      const imports = requireImportJobs(dependencies);
      return Promise.resolve(imports.submit(parseKnowledgeImportSubmitInput(input))).then((job) => ({ version: 1, job }));
    }
    case "knowledge.import.status": {
      const imports = requireImportJobs(dependencies);
      return { version: 1, job: imports.status(parseKnowledgeImportStatusInput(input)) };
    }
    case "knowledge.publish": {
      const publish = requirePublish(dependencies);
      return Promise.resolve(publish.publish(parseKnowledgePublishInput(input))).then((result) => ({
        version: 1,
        publication: result,
      }));
    }
  }
}

function requireViewer(dependencies: KnowledgeDispatchDependencies): KnowledgeViewerDispatch {
  if (dependencies.viewer === undefined) {
    throw new KnowledgeServiceError(
      KNOWLEDGE_ERROR_CODES.unsupportedOperation,
      "Knowledge Source/Evidence viewer runtime is not configured",
      503,
    );
  }
  return dependencies.viewer;
}

function requireGroundedAsk(dependencies: KnowledgeDispatchDependencies): GroundedAskDispatch {
  if (dependencies.groundedAsk === undefined) {
    throw new KnowledgeServiceError(
      KNOWLEDGE_ERROR_CODES.unsupportedOperation,
      "Grounded Ask provider is not configured",
      503,
    );
  }
  return dependencies.groundedAsk;
}

function requireImportJobs(dependencies: KnowledgeDispatchDependencies): KnowledgeImportDispatch {
  if (dependencies.importJobs === undefined) {
    throw new KnowledgeServiceError(KNOWLEDGE_ERROR_CODES.unsupportedOperation, "Knowledge import runtime is not configured", 503);
  }
  return dependencies.importJobs;
}

function requirePublish(dependencies: KnowledgeDispatchDependencies): KnowledgePublishDispatch {
  if (dependencies.publish === undefined) {
    throw new KnowledgeServiceError(KNOWLEDGE_ERROR_CODES.unsupportedOperation, "Knowledge publication runtime is not configured", 503);
  }
  return dependencies.publish;
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
    if (!allowed.has(key)) throw invalid(`${operation} input contains unsupported field: ${key}`);
  }
  for (const key of requiredFields) requireString(body, key, operation);

  const rawScope = requireRecord(body["scope"], `${operation} scope`);
  const allowedScope = new Set(["projectId", "workspaceId", "workspacePath", "workspaceLabel"]);
  for (const key of Object.keys(rawScope)) {
    if (!allowedScope.has(key)) throw invalid(`${operation} scope contains unsupported field: ${key}`);
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
    throw invalid(`${label} must be an object`);
  }
  return Object.fromEntries(Object.entries(value));
}

function requireString(record: Record<string, unknown>, key: string, operation: string): string {
  const value = record[key];
  if (typeof value !== "string" || value.trim().length === 0) {
    throw invalid(`${operation} ${key} must be a non-empty string`);
  }
  return value;
}

function optionalString(record: Record<string, unknown>, key: string, operation: string): string | undefined {
  const value = record[key];
  if (value === undefined) return undefined;
  if (typeof value !== "string" || value.trim().length === 0) {
    throw invalid(`${operation} ${key} must be a non-empty string when supplied`);
  }
  return value;
}

function optionalPositiveInteger(record: Record<string, unknown>, key: string, operation: string): number | undefined {
  const value = record[key];
  if (value === undefined) return undefined;
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value <= 0) {
    throw invalid(`${operation} ${key} must be a positive integer when supplied`);
  }
  return value;
}

function invalid(message: string): KnowledgeServiceError {
  return new KnowledgeServiceError(KNOWLEDGE_ERROR_CODES.invalidRequest, message, 400);
}
