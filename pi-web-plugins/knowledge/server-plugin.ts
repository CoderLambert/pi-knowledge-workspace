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

  throw new Error(`Unsupported Knowledge operation: ${context.operation}`);
}

async function dispatchViewer(
  serviceClient: KnowledgeServiceClient,
  operation: "viewer.sources.list" | "viewer.source.get" | "viewer.artifact.open",
  input: JsonObject,
  signal: AbortSignal,
): Promise<JsonObject> {
  // KnowledgeServiceOperation predates P1 viewer operations; the wire client itself
  // carries arbitrary operation strings and the standalone service owns the allowlist.
  return await serviceClient.dispatch(operation as KnowledgeServiceOperation, input, signal);
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
  const record = value as Record<string, JsonValue>;
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
