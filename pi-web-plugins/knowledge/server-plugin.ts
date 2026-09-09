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
} from "./service-client.js";

const KNOWLEDGE_PLUGIN_ID = "knowledge";
export const KNOWLEDGE_STATUS_OPERATION = "knowledge.status";

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

  if (context.operation !== KNOWLEDGE_STATUS_OPERATION) {
    throw new Error(`Unsupported Knowledge operation: ${context.operation}`);
  }

  requireEmptyInput(context.input, context.operation);
  const scope = knowledgeScope(context);
  const echoedScope = await serviceClient.dispatch("workspace.echo", scope, context.signal);
  requireMatchingServiceScope(echoedScope, scope);

  return {
    version: 1,
    status: "ready",
    scope,
  };
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

function requireMatchingServiceScope(
  actual: Record<string, unknown>,
  expected: JsonObject,
): void {
  if (
    actual["projectId"] !== expected["projectId"]
    || actual["workspaceId"] !== expected["workspaceId"]
    || actual["workspacePath"] !== expected["workspacePath"]
    || actual["workspaceLabel"] !== expected["workspaceLabel"]
    || Object.keys(actual).some((key) => ![
      "projectId",
      "workspaceId",
      "workspacePath",
      "workspaceLabel",
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

function healthErrorMessage(error: unknown): string {
  if (!(error instanceof KnowledgeServiceClientError)) return "pi-knowledge health check failed";
  switch (error.code) {
    case "CONFIG_INVALID":
      return "pi-knowledge adapter configuration is invalid";
    case "SERVICE_UNAVAILABLE":
      return "pi-knowledge service is unavailable";
    case "SERVICE_TIMEOUT":
      return "pi-knowledge service health check timed out";
    case "SERVICE_REJECTED":
      return "pi-knowledge service rejected the health check";
    case "REQUEST_TOO_LARGE":
    case "RESPONSE_TOO_LARGE":
    case "PROTOCOL_INVALID":
      return "pi-knowledge service health response is invalid";
  }
}

function throwIfAborted(signal: AbortSignal): void {
  if (!signal.aborted) return;
  throw abortReason(signal);
}

function abortReason(signal: AbortSignal): Error {
  const reason: unknown = signal.reason;
  return reason instanceof Error
    ? reason
    : new Error("Knowledge operation was cancelled", { cause: reason });
}
