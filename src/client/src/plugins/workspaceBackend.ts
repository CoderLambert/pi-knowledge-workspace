import type { JsonValue, Workspace } from "../api";
import {
  openPairedPluginBackendChannel,
  requestPairedPluginBackend,
  requestPluginBackend,
  type PluginBackendChannel,
  type PluginBackendChannelOptions,
  type PluginBackendRequestOptions,
  type PluginBackendRequestTarget,
} from "../api/pluginBackends";
import type {
  PairedWorkspaceBackendRequestOptions,
  PairedWorkspaceBackendV1,
  WorkspaceBackend,
  WorkspacePluginBinding,
} from "./types";

export type PluginBackendRequester = (
  target: PluginBackendRequestTarget,
  operation: string,
  input: JsonValue,
  options?: PluginBackendRequestOptions,
) => Promise<JsonValue>;

export type PluginBackendChannelOpener = (
  target: PluginBackendRequestTarget,
  operation: string,
  input: JsonValue,
  options: PluginBackendChannelOptions,
) => Promise<PluginBackendChannel>;

/** Preserve the browser-v2 owner-backed helper independently of paired contributions. */
export function createPluginWorkspaceBackend(
  binding: WorkspacePluginBinding,
  workspace: Pick<Workspace, "id" | "projectId">,
  machineId: string,
  request: PluginBackendRequester = requestPluginBackend,
): WorkspaceBackend | undefined {
  const target = pluginBackendTarget(binding, workspace, machineId);
  if (target === undefined) return undefined;
  return {
    request: (operation, input) => request(target, operation, input),
  };
}

/** Expose only the capabilities contributed by this exact revision-paired package. */
export function createPairedPluginWorkspaceBackend(
  binding: WorkspacePluginBinding,
  workspace: Pick<Workspace, "id" | "projectId">,
  machineId: string,
  request: PluginBackendRequester = requestPairedPluginBackend,
  openChannel: PluginBackendChannelOpener = openPairedPluginBackendChannel,
): PairedWorkspaceBackendV1 | undefined {
  if (binding.pairedRequestVersion === undefined && binding.pairedChannelVersion === undefined) return undefined;
  const target = pluginBackendTarget(binding, workspace, machineId);
  if (target === undefined) return undefined;
  return {
    version: 1,
    ...(binding.pairedRequestVersion === undefined ? {} : {
      requestVersion: binding.pairedRequestVersion,
      request: (operation: string, input: JsonValue, options?: PairedWorkspaceBackendRequestOptions) => request(target, operation, input, options),
    }),
    ...(binding.pairedChannelVersion === undefined ? {} : {
      channelVersion: binding.pairedChannelVersion,
      openChannel: (operation, input, options) => openChannel(target, operation, input, options),
    }),
  };
}

function pluginBackendTarget(
  binding: WorkspacePluginBinding,
  workspace: Pick<Workspace, "id" | "projectId">,
  machineId: string,
): PluginBackendRequestTarget | undefined {
  const backendRevision = binding.backendRevision;
  if (backendRevision === undefined) return undefined;
  return {
    pluginId: binding.sourcePluginId,
    backendRevision,
    machineId,
    projectId: workspace.projectId,
    workspaceId: workspace.id,
  };
}
