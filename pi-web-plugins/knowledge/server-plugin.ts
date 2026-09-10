import type {
  JsonObject,
  JsonValue,
  PairedPluginBackendV1,
  PairedPluginRequestContext,
  PiWebServerPlugin,
  ServerPluginActivation,
  ServerPluginActivationContext,
  ServerPluginHealth,
} from "@jmfederico/pi-web/server-plugin-api";
import {
  createKnowledgeServiceClientFromEnvironment,
  KnowledgeServiceClientError,
  type KnowledgeServiceClient,
  type KnowledgeServiceOperation,
} from "./service-client.js";

const KNOWLEDGE_PLUGIN_ID = "knowledge";
export const KNOWLEDGE_STATUS_OPERATION = "knowledge.status";
export const KNOWLEDGE_SOURCES_LIST_OPERATION = "knowledge.viewer.sources.list";
export const KNOWLEDGE_SOURCE_GET_OPERATION = "knowledge.viewer.source.get";
export const KNOWLEDGE_ARTIFACT_OPEN_OPERATION = "knowledge.viewer.artifact.open";
export const KNOWLEDGE_IMPORT_OPERATION = "knowledge.import.submit";
export const KNOWLEDGE_IMPORT_STATUS_OPERATION = "knowledge.import.status";
export const KNOWLEDGE_PUBLISH_OPERATION = "knowledge.publish";
export const KNOWLEDGE_ASK_OPERATION = "knowledge.ask";
export const KNOWLEDGE_ANSWER_GET_OPERATION = "knowledge.answer.get";
export const KNOWLEDGE_ANSWERS_LIST_OPERATION = "knowledge.answers.list";
export const KNOWLEDGE_CITATION_OPEN_OPERATION = "knowledge.citation.open";

const plugin: PiWebServerPlugin = {
  apiVersion: 1,
  name: "Knowledge",
  activate(context) {
    return activateKnowledgePlugin(context);
  },
};

export default plugin;

function activateKnowledgePlugin(context: ServerPluginActivationContext): ServerPluginActivation {
  if (context.pluginId !== KNOWLEDGE_PLUGIN_ID) {
    throw new Error(
      `Knowledge server entry must activate as plugin id ${KNOWLEDGE_PLUGIN_ID}, received ${context.pluginId}`,
    );
  }

  const serviceClient = createKnowledgeServiceClientFromEnvironment();
  return Object.freeze({
    pairedBackend: createKnowledgeBackend(serviceClient),
    health: (signal: AbortSignal) => knowledgePluginHealth(serviceClient, signal),
  });
}

export function createKnowledgeBackend(
  serviceClient: KnowledgeServiceClient = createKnowledgeServiceClientFromEnvironment(),
): PairedPluginBackendV1 {
  return Object.freeze({
    version: 1,
    request: (context: PairedPluginRequestContext) => knowledgeRequest(serviceClient, context),
  });
}

async function knowledgeRequest(
  serviceClient: KnowledgeServiceClient,
  context: PairedPluginRequestContext,
): Promise<JsonValue> {
  throwIfAborted(context.signal);
  const scope = knowledgeScope(context);

  if (context.operation === KNOWLEDGE_STATUS_OPERATION) {
    requireEmptyInput(context.input, context.operation);
    const echoedScope = await serviceClient.dispatch("workspace.echo", scope, context.signal);
    requireMatchingServiceScope(echoedScope, scope);
    return { version: 1, status: "ready", scope };
  }

  if (context.operation === KNOWLEDGE_SOURCES_LIST_OPERATION) {
    requireEmptyInput(context.input, context.operation);
    return await dispatchViewer(serviceClient, "viewer.sources.list", { scope }, context.signal);
  }

  if (context.operation === KNOWLEDGE_SOURCE_GET_OPERATION) {
    const input = requireViewerInput(context.input, context.operation, ["sourceId"]);
    return await dispatchViewer(serviceClient, "viewer.source.get", {
      scope,
      sourceId: requireNonEmptyString(input, "sourceId", context.operation),
    }, context.signal);
  }

  if (context.operation === KNOWLEDGE_ARTIFACT_OPEN_OPERATION) {
    const input = requireViewerInput(context.input, context.operation, ["parsedArtifactId"], ["evidenceId", "maxBytes"]);
    const evidenceId = optionalNonEmptyString(input, "evidenceId", context.operation);
    const maxBytes = optionalPositiveInteger(input, "maxBytes", context.operation);
    return await dispatchViewer(serviceClient, "viewer.artifact.open", {
      scope,
      parsedArtifactId: requireNonEmptyString(input, "parsedArtifactId", context.operation),
      ...(evidenceId === undefined ? {} : { evidenceId }),
      ...(maxBytes === undefined ? {} : { maxBytes }),
    }, context.signal);
  }

  if (context.operation === KNOWLEDGE_IMPORT_OPERATION) {
    const input = requireViewerInput(context.input, context.operation, ["relativePath", "idempotencyKey"], ["displayName", "sourceId"]);
    const displayName = optionalNonEmptyString(input, "displayName", context.operation);
    const sourceId = optionalNonEmptyString(input, "sourceId", context.operation);
    return await dispatchKnowledge(serviceClient, "knowledge.import.submit", {
      scope,
      relativePath: requireNonEmptyString(input, "relativePath", context.operation),
      idempotencyKey: requireNonEmptyString(input, "idempotencyKey", context.operation),
      ...(displayName === undefined ? {} : { displayName }),
      ...(sourceId === undefined ? {} : { sourceId }),
    }, context.signal);
  }

  if (context.operation === KNOWLEDGE_IMPORT_STATUS_OPERATION) {
    const input = requireViewerInput(context.input, context.operation, ["jobId"]);
    return await dispatchKnowledge(serviceClient, "knowledge.import.status", {
      scope,
      jobId: requireNonEmptyString(input, "jobId", context.operation),
    }, context.signal);
  }

  if (context.operation === KNOWLEDGE_PUBLISH_OPERATION) {
    const input = requireViewerInput(context.input, context.operation, [], ["sourceIds", "sourceVersionIds"]);
    return await dispatchKnowledge(serviceClient, "knowledge.publish", {
      scope,
      sourceIds: requireStringArray(input, "sourceIds", context.operation),
      sourceVersionIds: requireStringArray(input, "sourceVersionIds", context.operation),
    }, context.signal);
  }

  if (context.operation === KNOWLEDGE_ASK_OPERATION) {
    const input = requireViewerInput(context.input, context.operation, ["question"]);
    return await dispatchKnowledge(serviceClient, "knowledge.ask", {
      scope,
      question: requireNonEmptyString(input, "question", context.operation),
    }, context.signal);
  }

  if (context.operation === KNOWLEDGE_ANSWER_GET_OPERATION) {
    const input = requireViewerInput(context.input, context.operation, ["answerId"]);
    return await dispatchKnowledge(serviceClient, "knowledge.answer.get", {
      scope,
      answerId: requireNonEmptyString(input, "answerId", context.operation),
    }, context.signal);
  }

  if (context.operation === KNOWLEDGE_ANSWERS_LIST_OPERATION) {
    requireEmptyInput(context.input, context.operation);
    return await dispatchKnowledge(serviceClient, "knowledge.answers.list", { scope }, context.signal);
  }

  if (context.operation === KNOWLEDGE_CITATION_OPEN_OPERATION) {
    const input = requireViewerInput(context.input, context.operation, ["answerId", "citationId"]);
    return await dispatchKnowledge(serviceClient, "knowledge.citation.open", {
      scope,
      answerId: requireNonEmptyString(input, "answerId", context.operation),
      citationId: requireNonEmptyString(input, "citationId", context.operation),
    }, context.signal);
  }

  throw new Error(`Unsupported Knowledge operation: ${context.operation}`);
}

async function dispatchViewer(
  serviceClient: KnowledgeServiceClient,
  operation: "viewer.sources.list" | "viewer.source.get" | "viewer.artifact.open",
  input: JsonObject,
  signal: AbortSignal,
): Promise<JsonObject> {
  return toJsonObject(await serviceClient.dispatch(operation, input, signal));
}

async function dispatchKnowledge(
  serviceClient: KnowledgeServiceClient,
  operation: Extract<KnowledgeServiceOperation, `knowledge.${string}`>,
  input: JsonObject,
  signal: AbortSignal,
): Promise<JsonObject> {
  return toJsonObject(await serviceClient.dispatch(operation, input, signal));
}

async function knowledgePluginHealth(
  serviceClient: KnowledgeServiceClient,
  signal: AbortSignal,
): Promise<ServerPluginHealth> {
  try {
    await serviceClient.health(signal);
    return { status: "healthy" };
  } catch (error) {
    if (signal.aborted) throw abortReason(signal);
    return {
      status: "unhealthy",
      message: healthErrorMessage(error),
      details: error instanceof KnowledgeServiceClientError
        ? { adapterErrorCode: error.code, remoteCode: error.remoteCode ?? null }
        : { adapterErrorCode: "UNKNOWN" },
    };
  }
}

function knowledgeScope(
  context: Pick<PairedPluginRequestContext, "project" | "workspace">,
): JsonObject {
  if (context.workspace.projectId !== context.project.id) {
    throw new Error("Knowledge workspace project scope does not match the host project");
  }

  return {
    projectId: context.project.id,
    workspaceId: context.workspace.id,
    workspacePath: context.workspace.path,
    workspaceLabel: context.workspace.label,
  };
}

function requireMatchingServiceScope(actual: Record<string, unknown>, expected: JsonObject): void {
  if (
    actual["projectId"] !== expected["projectId"]
    || actual["workspaceId"] !== expected["workspaceId"]
    || actual["workspacePath"] !== expected["workspacePath"]
    || actual["workspaceLabel"] !== expected["workspaceLabel"]
    || Object.keys(actual).some((key) => ![
      "projectId", "workspaceId", "workspacePath", "workspaceLabel",
    ].includes(key))
  ) {
    throw new Error("pi-knowledge returned workspace scope that does not match the host-authoritative scope");
  }
}

function requireEmptyInput(value: JsonValue, operation: string): void {
  if (value === null) return;
  if (typeof value === "object" && !Array.isArray(value) && Object.keys(value).length === 0) return;
  throw new Error(`${operation} input must be null or an empty object`);
}

function requireViewerInput(
  value: JsonValue,
  operation: string,
  requiredFields: readonly string[],
  optionalFields: readonly string[] = [],
): Record<string, JsonValue> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${operation} input must be an object`);
  }
  if (!isJsonRecord(value)) throw new Error(`${operation} input must be an object`);
  const record = value;
  const allowed = new Set([...requiredFields, ...optionalFields]);
  for (const key of Object.keys(record)) {
    if (!allowed.has(key)) throw new Error(`${operation} input contains unsupported field: ${key}`);
  }
  for (const key of requiredFields) requireNonEmptyString(record, key, operation);
  return record;
}

function requireNonEmptyString(record: Record<string, JsonValue>, key: string, operation: string): string {
  const value = record[key];
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${operation} ${key} must be a non-empty string`);
  }
  return value;
}

function optionalNonEmptyString(record: Record<string, JsonValue>, key: string, operation: string): string | undefined {
  const value = record[key];
  if (value === undefined) return undefined;
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${operation} ${key} must be a non-empty string when supplied`);
  }
  return value;
}

function optionalPositiveInteger(record: Record<string, JsonValue>, key: string, operation: string): number | undefined {
  const value = record[key];
  if (value === undefined) return undefined;
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${operation} ${key} must be a positive integer when supplied`);
  }
  return value;
}

function requireStringArray(record: Record<string, JsonValue>, key: string, operation: string): JsonValue[] {
  const value = record[key];
  if (!isNonEmptyStringArray(value)) {
    throw new Error(`${operation} ${key} must be a non-empty string array`);
  }
  return value;
}

function isJsonRecord(value: JsonValue): value is Record<string, JsonValue> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toJsonObject(value: Record<string, unknown>): JsonObject {
  const result: Record<string, JsonValue> = {};
  for (const [key, item] of Object.entries(value)) {
    if (!isJsonValue(item)) throw new Error("pi-knowledge returned a non-JSON object");
    result[key] = item;
  }
  return result;
}

function isJsonValue(value: unknown): value is JsonValue {
  if (value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") return true;
  if (Array.isArray(value)) return value.every((item) => isJsonValue(item));
  if (typeof value !== "object") return false;
  return Object.values(value).every((item) => isJsonValue(item));
}

function isNonEmptyStringArray(value: JsonValue | undefined): value is string[] {
  return value !== undefined && Array.isArray(value)
    && value.length > 0
    && value.every((item) => typeof item === "string" && item.trim().length > 0);
}

function healthErrorMessage(error: unknown): string {
  if (!(error instanceof KnowledgeServiceClientError)) return "pi-knowledge health check failed";
  switch (error.code) {
    case "CONFIG_INVALID": return "pi-knowledge adapter configuration is invalid";
    case "SERVICE_UNAVAILABLE": return "pi-knowledge service is unavailable";
    case "SERVICE_TIMEOUT": return "pi-knowledge service health check timed out";
    case "SERVICE_REJECTED": return "pi-knowledge service rejected the health check";
    case "REQUEST_TOO_LARGE":
    case "RESPONSE_TOO_LARGE":
    case "PROTOCOL_INVALID": return "pi-knowledge service health response is invalid";
  }
}

function throwIfAborted(signal: AbortSignal): void {
  if (!signal.aborted) return;
  throw abortReason(signal);
}

function abortReason(signal: AbortSignal): Error {
  const reason: unknown = signal.reason;
  return reason instanceof Error ? reason : new Error("Knowledge operation was cancelled", { cause: reason });
}
