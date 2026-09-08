export const KNOWLEDGE_ERROR_CODES = {
  authRequired: "AUTH_REQUIRED",
  authInvalid: "AUTH_INVALID",
  malformedJson: "MALFORMED_JSON",
  invalidRequest: "INVALID_REQUEST",
  unsupportedOperation: "UNSUPPORTED_OPERATION",
  incompatibleProtocol: "INCOMPATIBLE_PROTOCOL_VERSION",
  requestTooLarge: "REQUEST_TOO_LARGE",
  responseTooLarge: "RESPONSE_TOO_LARGE",
  notFound: "NOT_FOUND",
  internal: "INTERNAL_ERROR",
} as const;

export type KnowledgeErrorCode = (typeof KNOWLEDGE_ERROR_CODES)[keyof typeof KNOWLEDGE_ERROR_CODES];
export type KnowledgeErrorDetails = Record<string, string | number | boolean | null>;

export class KnowledgeServiceError extends Error {
  readonly code: KnowledgeErrorCode;
  readonly statusCode: number;
  readonly details?: KnowledgeErrorDetails;

  constructor(code: KnowledgeErrorCode, message: string, statusCode: number, details?: KnowledgeErrorDetails) {
    super(message);
    this.name = "KnowledgeServiceError";
    this.code = code;
    this.statusCode = statusCode;
    if (details !== undefined) this.details = details;
  }
}
