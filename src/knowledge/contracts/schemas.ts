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

export interface GroundedAskInput {
  scope: GroundedAskScopeInput;
  question: string;
}

export interface GroundedAnswerLookupInput {
  scope: GroundedAskScopeInput;
  answerId: string;
}

export interface GroundedAnswerListInput {
  scope: GroundedAskScopeInput;
}

export interface GroundedCitationLookupInput extends GroundedAnswerLookupInput {
  citationId: string;
}

export interface GroundedAskScopeInput {
  projectId: string;
  workspaceId: string;
  workspacePath: string;
  workspaceLabel?: string;
}

export interface KnowledgeImportSubmitInput {
  scope: GroundedAskScopeInput;
  relativePath: string;
  idempotencyKey: string;
  displayName?: string;
  sourceId?: string;
}

export interface KnowledgeImportStatusInput {
  scope: GroundedAskScopeInput;
  jobId: string;
}

export interface KnowledgePublishInput {
  scope: GroundedAskScopeInput;
  sourceIds: readonly string[];
  sourceVersionIds: readonly string[];
  retrievalConfigRevision?: string;
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

export function parseGroundedAskInput(value: unknown): GroundedAskInput {
  const record = requirePlainObject(value, "knowledge.ask input");
  requireAllowedKeys(record, ["scope", "question"], "knowledge.ask input");
  return {
    scope: parseGroundedAskScope(record["scope"], "knowledge.ask"),
    question: requireBoundedString(record["question"], "question", 32_768),
  };
}

export function parseKnowledgeImportSubmitInput(value: unknown): KnowledgeImportSubmitInput {
  const record = requirePlainObject(value, "knowledge.import.submit input");
  requireAllowedKeys(record, ["scope", "relativePath", "idempotencyKey", "displayName", "sourceId"], "knowledge.import.submit input");
  const displayName = record["displayName"] === undefined
    ? undefined
    : requireBoundedString(record["displayName"], "displayName", 512);
  const sourceId = record["sourceId"] === undefined
    ? undefined
    : requireBoundedString(record["sourceId"], "sourceId", 256);
  return {
    scope: parseGroundedAskScope(record["scope"], "knowledge.import.submit"),
    relativePath: requireBoundedString(record["relativePath"], "relativePath", 4096),
    idempotencyKey: requireBoundedString(record["idempotencyKey"], "idempotencyKey", 512),
    ...(displayName === undefined ? {} : { displayName }),
    ...(sourceId === undefined ? {} : { sourceId }),
  };
}

export function parseKnowledgeImportStatusInput(value: unknown): KnowledgeImportStatusInput {
  const record = requirePlainObject(value, "knowledge.import.status input");
  requireAllowedKeys(record, ["scope", "jobId"], "knowledge.import.status input");
  return {
    scope: parseGroundedAskScope(record["scope"], "knowledge.import.status"),
    jobId: requireBoundedString(record["jobId"], "jobId", 256),
  };
}

export function parseKnowledgePublishInput(value: unknown): KnowledgePublishInput {
  const record = requirePlainObject(value, "knowledge.publish input");
  requireAllowedKeys(record, ["scope", "sourceIds", "sourceVersionIds", "retrievalConfigRevision"], "knowledge.publish input");
  const sourceIds = requireStringArray(record["sourceIds"], "sourceIds", 1000);
  const sourceVersionIds = requireStringArray(record["sourceVersionIds"], "sourceVersionIds", 1000);
  const retrievalConfigRevision = record["retrievalConfigRevision"] === undefined
    ? undefined
    : requireBoundedString(record["retrievalConfigRevision"], "retrievalConfigRevision", 256);
  return {
    scope: parseGroundedAskScope(record["scope"], "knowledge.publish"),
    sourceIds,
    sourceVersionIds,
    ...(retrievalConfigRevision === undefined ? {} : { retrievalConfigRevision }),
  };
}

export function parseGroundedAnswerLookupInput(value: unknown): GroundedAnswerLookupInput {
  const record = requirePlainObject(value, "knowledge.answer.get input");
  requireAllowedKeys(record, ["scope", "answerId"], "knowledge.answer.get input");
  return {
    scope: parseGroundedAskScope(record["scope"], "knowledge.answer.get"),
    answerId: requireBoundedString(record["answerId"], "answerId", 256),
  };
}

export function parseGroundedAnswerListInput(value: unknown): GroundedAnswerListInput {
  const record = requirePlainObject(value, "knowledge.answers.list input");
  requireAllowedKeys(record, ["scope"], "knowledge.answers.list input");
  return { scope: parseGroundedAskScope(record["scope"], "knowledge.answers.list") };
}

export function parseGroundedCitationLookupInput(value: unknown): GroundedCitationLookupInput {
  const record = requirePlainObject(value, "knowledge.citation.open input");
  requireAllowedKeys(record, ["scope", "answerId", "citationId"], "knowledge.citation.open input");
  return {
    scope: parseGroundedAskScope(record["scope"], "knowledge.citation.open"),
    answerId: requireBoundedString(record["answerId"], "answerId", 256),
    citationId: requireBoundedString(record["citationId"], "citationId", 256),
  };
}

function parseGroundedAskScope(value: unknown, operation: string): GroundedAskScopeInput {
  const scope = requirePlainObject(value, `${operation} scope`);
  requireAllowedKeys(scope, ["projectId", "workspaceId", "workspacePath", "workspaceLabel"], `${operation} scope`);
  const workspaceLabel = scope["workspaceLabel"] === undefined
    ? undefined
    : requireBoundedString(scope["workspaceLabel"], "workspaceLabel", 512);
  return workspaceLabel === undefined
    ? {
        projectId: requireBoundedString(scope["projectId"], "projectId", 256),
        workspaceId: requireBoundedString(scope["workspaceId"], "workspaceId", 256),
        workspacePath: requireBoundedString(scope["workspacePath"], "workspacePath", 4096),
      }
    : {
        projectId: requireBoundedString(scope["projectId"], "projectId", 256),
        workspaceId: requireBoundedString(scope["workspaceId"], "workspaceId", 256),
        workspacePath: requireBoundedString(scope["workspacePath"], "workspacePath", 4096),
        workspaceLabel,
      };
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
    throw invalidRequest(`${field} must be a non-empty string of at most ${String(maxLength)} characters`);
  }
  return value;
}

function requireStringArray(value: unknown, field: string, maxItems: number): string[] {
  if (!Array.isArray(value) || value.length > maxItems) {
    throw invalidRequest(`${field} must be an array of at most ${String(maxItems)} strings`);
  }
  return value.map((item, index) => requireBoundedString(item, `${field}[${String(index)}]`, 256));
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
