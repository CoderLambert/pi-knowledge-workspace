import type { ServerNoticeScope } from "./apiTypes.js";

/** Reserved host-derived attribution prefix for plugin-authored notices. */
export const SERVER_PLUGIN_NOTICE_SOURCE_PREFIX = "plugin:";
/** Maximum UTF-8 size of one plugin-authored notice message. */
export const SERVER_PLUGIN_NOTICE_MESSAGE_MAX_BYTES = 4 * 1024;
/** Maximum serialized UTF-8 size of plugin-authored detached metadata. */
export const SERVER_PLUGIN_NOTICE_CONTEXT_MAX_BYTES = 16 * 1024;
/** Maximum nesting below a plugin-authored notice context root. */
export const SERVER_PLUGIN_NOTICE_CONTEXT_MAX_DEPTH = 32;
/** Maximum length of each project, workspace, or session scope identifier. */
export const SERVER_NOTICE_SCOPE_ID_MAX_LENGTH = 512;
/** Maximum retained notices attributed to one plugin source. */
export const SERVER_PLUGIN_NOTICE_PER_SOURCE_LIMIT = 25;
/** Maximum retained plugin-authored notices across all plugin sources. */
export const SERVER_PLUGIN_NOTICE_GLOBAL_LIMIT = 100;

const SERVER_NOTICE_SCOPE_KEYS = ["projectId", "workspaceId", "sessionId"] as const;
type ServerNoticeScopeKey = typeof SERVER_NOTICE_SCOPE_KEYS[number];

/** Validate, detach, and freeze the visibility selectors carried by a notice. */
export function parseServerNoticeScope(value: unknown, label: string): ServerNoticeScope {
  if (!isPlainRecord(value)) throw new Error(`${label} must be an object`);
  const keys = Object.keys(value);
  const unsupportedKey = keys.find((key) => !isServerNoticeScopeKey(key));
  if (unsupportedKey !== undefined) throw new Error(`Unsupported ${label} field: ${unsupportedKey}`);
  if (keys.length === 0) {
    throw new Error(`${label} must contain at least one of projectId, workspaceId, or sessionId`);
  }

  const scope: Partial<Record<ServerNoticeScopeKey, string>> = {};
  for (const key of SERVER_NOTICE_SCOPE_KEYS) {
    if (!Object.hasOwn(value, key)) continue;
    const id = value[key];
    if (typeof id !== "string" || id.trim() === "" || id.length > SERVER_NOTICE_SCOPE_ID_MAX_LENGTH) {
      throw new Error(`${label} ${key} must be a non-empty string of at most ${String(SERVER_NOTICE_SCOPE_ID_MAX_LENGTH)} characters`);
    }
    scope[key] = id;
  }
  return Object.freeze(scope);
}

export function isPluginServerNoticeSource(source: string | undefined): source is `plugin:${string}` {
  return source?.startsWith(SERVER_PLUGIN_NOTICE_SOURCE_PREFIX) === true;
}

export function serverNoticeUtf8ByteLength(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

function isServerNoticeScopeKey(value: string): value is ServerNoticeScopeKey {
  return SERVER_NOTICE_SCOPE_KEYS.some((key) => key === value);
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const prototype: unknown = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}
