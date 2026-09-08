import type {
  JsonObject,
  JsonValue,
  PairedPluginBackendV1,
  PairedPluginRequestContext,
  PiWebServerPlugin,
  ServerPluginActivation,
  ServerPluginActivationContext,
} from "@jmfederico/pi-web/server-plugin-api";

export const KNOWLEDGE_PLUGIN_ID = "knowledge";
export const KNOWLEDGE_STATUS_OPERATION = "knowledge.status";

const plugin: PiWebServerPlugin = {
  apiVersion: 1,
  name: "Knowledge",
  activate(context) {
    return activateKnowledgePlugin(context);
  },
};

export default plugin;

export function activateKnowledgePlugin(context: ServerPluginActivationContext): ServerPluginActivation {
  if (context.pluginId !== KNOWLEDGE_PLUGIN_ID) {
    throw new Error(
      `Knowledge server entry must activate as plugin id ${KNOWLEDGE_PLUGIN_ID}, received ${context.pluginId}`,
    );
  }

  return Object.freeze({
    pairedBackend: createKnowledgeBackend(),
    health: () => Object.freeze({ status: "healthy" as const }),
  });
}

export function createKnowledgeBackend(): PairedPluginBackendV1 {
  return Object.freeze({
    version: 1,
    request: (context: PairedPluginRequestContext) => knowledgeRequest(context),
  });
}

function knowledgeRequest(context: PairedPluginRequestContext): JsonValue {
  throwIfAborted(context.signal);

  if (context.operation !== KNOWLEDGE_STATUS_OPERATION) {
    throw new Error(`Unsupported Knowledge operation: ${context.operation}`);
  }

  requireEmptyInput(context.input, context.operation);

  return {
    version: 1,
    status: "ready",
    scope: knowledgeScope(context),
  };
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

function requireEmptyInput(value: JsonValue, operation: string): void {
  if (value === null) return;
  if (typeof value === "object" && !Array.isArray(value) && Object.keys(value).length === 0) return;
  throw new Error(`${operation} input must be null or an empty object`);
}

function throwIfAborted(signal: AbortSignal): void {
  if (!signal.aborted) return;
  const reason: unknown = signal.reason;
  throw reason instanceof Error
    ? reason
    : new Error("Knowledge operation was cancelled", { cause: reason });
}
