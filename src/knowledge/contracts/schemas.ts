import { KNOWLEDGE_ERROR_CODES, KnowledgeServiceError, type KnowledgeErrorDetails } from "./errors.js";
import { PI_KNOWLEDGE_MAX_REQUEST_ID_LENGTH, PI_KNOWLEDGE_PROTOCOL_VERSION } from "./protocol.js";

export interface KnowledgeDispatchRequest {
  protocolVersion: number;
  requestId: string;
  operation: string;
  input: unknown;
}

export interface WorkspaceEchoInput {
  projectId: string;
  workspaceId: string;
  workspacePath: string;
  workspaceLabel?: string;
}

export interface KnowledgeErrorEnvelope {
  ok: false;
  protocolVersion: typeof PI_KNOWLEDGE_PROTOCOL_VERSION;
  requestId: string;
  error: {
    code: string;
    message: string;
    details?: KnowledgeErrorDetails;
  };
}

const REQUEST_ID_PATTERN = /^[A-Za-z0-9._:-]+$/;

export function parseKnowledgeDispatchRequest(value: unknown): KnowledgeDispatchRequest {
  const record = requirePlainObject(value, "dispatch request");
  requireExactKeys(record, ["protocolVersion", "requestId", "operation", "input"], "dispatch request");

  const protocolVersion = record["protocolVersion"];
  if (typeof protocolVersion !== "number" || !Number.isInteger(protocolVersion) || protocolVersion < 0) {
    throw invalidRequest("protocolVersion must be a non-negative integer");
  }

  const requestId = record["requestId"];
  if (
    typeof requestId !== "string"
    || requestId.length === 0
    || requestId.length > PI_KNOWLEDGE_MAX_REQUEST_ID_LENGTH
    || !REQUEST_ID_PATTERN.test(requestId)
  ) {
    throw invalidRequest("requestId must be a non-empty token of at most 128 characters");
  }

  const operation = record["operation"];
  if (typeof operation !== "string" || operation.length === 0 || operation.length > 128) {
    throw invalidRequest("operation must be a non-empty string of at most 128 characters");
  }

  return { protocolVersion, requestId, operation, input: record["input"] };
}

export function requireEmptyOperationInput(value: unknown, operation: string): void {
  if (value === null) return;
  if (isPlainObject(value) && Object.keys(value).length === 0) return;
  throw invalidRequest(`${operation} input must be null or an empty object`);
}

export function parseWorkspaceEchoInput(value: unknown): WorkspaceEchoInput {
  const record = requirePlainObject(value, "workspace.echo input");
  requireAllowedKeys(record, ["projectId", "workspaceId", "workspacePath", "workspaceLabel"], "workspace.echo input");

  const projectId = requireBoundedString(record["projectId"], "projectId", 256);
  const workspaceId = requireBoundedString(record["workspaceId"], "workspaceId", 256);
  const workspacePath = requireBoundedString(record["workspacePath"], "workspacePath", 4096);
  const workspaceLabelValue = record["workspaceLabel"];
  const workspaceLabel = workspaceLabelValue === undefined
    ? undefined
    : requireBoundedString(workspaceLabelValue, "workspaceLabel", 512);

  return workspaceLabel === undefined
    ? { projectId, workspaceId, workspacePath }
    : { projectId, workspaceId, workspacePath, workspaceLabel };
}

export function createKnowledgeErrorEnvelope(
  requestId: string,
  error: KnowledgeServiceError,
): KnowledgeErrorEnvelope {
  return error.details === undefined
    ? {
        ok: false,
        protocolVersion: PI_KNOWLEDGE_PROTOCOL_VERSION,
        requestId,
        error: { code: error.code, message: error.message },
      }
    : {
        ok: false,
        protocolVersion: PI_KNOWLEDGE_PROTOCOL_VERSION,
        requestId,
        error: { code: error.code, message: error.message, details: error.details },
      };
}

export function invalidRequest(message: string): KnowledgeServiceError {
  return new KnowledgeServiceError(KNOWLEDGE_ERROR_CODES.invalidRequest, message, 400);
}

function requireBoundedString(value: unknown, field: string, maxLength: number): string {
  if (typeof value !== "string" || value.length === 0 || value.length > maxLength) {
    throw invalidRequest(`${field} must be a non-empty string of at most ${maxLength} characters`);
  }
  return value;
}

function requirePlainObject(value: unknown, label: string): Record<string, unknown> {
  if (!isPlainObject(value)) throw invalidRequest(`${label} must be a JSON object`);
  return value;
}

function requireExactKeys(record: Record<string, unknown>, keys: readonly string[], label: string): void {
  const actualKeys = Object.keys(record);
  if (actualKeys.length !== keys.length || actualKeys.some((key) => !keys.includes(key))) {
    throw invalidRequest(`${label} contains missing or unsupported fields`);
  }
}

function requireAllowedKeys(record: Record<string, unknown>, keys: readonly string[], label: string): void {
  const unsupported = Object.keys(record).find((key) => !keys.includes(key));
  if (unsupported !== undefined) throw invalidRequest(`${label} contains unsupported field: ${unsupported}`);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
