import { Buffer } from "node:buffer";
import { randomUUID } from "node:crypto";

export const KNOWLEDGE_SERVICE_PROTOCOL_VERSION = 1;
export const KNOWLEDGE_SERVICE_DEFAULT_HOST = "127.0.0.1";
export const KNOWLEDGE_SERVICE_DEFAULT_PORT = 8515;
export const KNOWLEDGE_SERVICE_DEFAULT_TIMEOUT_MS = 5_000;
export const KNOWLEDGE_SERVICE_DEFAULT_MAX_REQUEST_BYTES = 64 * 1024;
export const KNOWLEDGE_SERVICE_DEFAULT_MAX_RESPONSE_BYTES = 64 * 1024;

const KNOWLEDGE_SERVICE_TOKEN_MIN_LENGTH = 16;
const KNOWLEDGE_SERVICE_REQUEST_ID_HEADER = "x-request-id";
const KNOWLEDGE_SERVICE_MAX_REQUEST_ID_LENGTH = 128;

type FetchLike = typeof fetch;

export type KnowledgeServiceOperation = "capabilities.get" | "workspace.echo";

export interface KnowledgeServiceClient {
  dispatch(operation: KnowledgeServiceOperation, input: unknown, signal: AbortSignal): Promise<Record<string, unknown>>;
  health(signal: AbortSignal): Promise<Record<string, unknown>>;
}

export interface KnowledgeServiceClientOptions {
  host: string;
  port: number;
  token: string;
  timeoutMs?: number;
  maxRequestBytes?: number;
  maxResponseBytes?: number;
  fetchImpl?: FetchLike;
}

export type KnowledgeServiceClientErrorCode =
  | "CONFIG_INVALID"
  | "REQUEST_TOO_LARGE"
  | "RESPONSE_TOO_LARGE"
  | "SERVICE_UNAVAILABLE"
  | "SERVICE_TIMEOUT"
  | "SERVICE_REJECTED"
  | "PROTOCOL_INVALID";

export class KnowledgeServiceClientError extends Error {
  readonly code: KnowledgeServiceClientErrorCode;
  readonly remoteCode: string | undefined;

  constructor(
    code: KnowledgeServiceClientErrorCode,
    message: string,
    options?: { cause?: unknown; remoteCode?: string },
  ) {
    super(message, options?.cause === undefined ? undefined : { cause: options.cause });
    this.name = "KnowledgeServiceClientError";
    this.code = code;
    this.remoteCode = options?.remoteCode;
  }
}

export function createKnowledgeServiceClientFromEnvironment(
  env: Readonly<Record<string, string | undefined>> = process.env,
): KnowledgeServiceClient {
  const host = env["PI_KNOWLEDGE_HOST"] ?? KNOWLEDGE_SERVICE_DEFAULT_HOST;
  if (!isLoopbackHost(host)) {
    throw new KnowledgeServiceClientError(
      "CONFIG_INVALID",
      "PI_KNOWLEDGE_HOST must be 127.0.0.1 or ::1",
    );
  }

  const port = parsePort(env["PI_KNOWLEDGE_PORT"]);
  const token = env["PI_KNOWLEDGE_TOKEN"];
  if (token === undefined || token.length < KNOWLEDGE_SERVICE_TOKEN_MIN_LENGTH) {
    throw new KnowledgeServiceClientError(
      "CONFIG_INVALID",
      `PI_KNOWLEDGE_TOKEN must contain at least ${String(KNOWLEDGE_SERVICE_TOKEN_MIN_LENGTH)} characters`,
    );
  }

  return createKnowledgeServiceClient({ host, port, token });
}

export function createKnowledgeServiceClient(options: KnowledgeServiceClientOptions): KnowledgeServiceClient {
  const host = validateHost(options.host);
  const port = validatePort(options.port);
  const token = validateToken(options.token);
  const timeoutMs = validatePositiveInteger(
    options.timeoutMs ?? KNOWLEDGE_SERVICE_DEFAULT_TIMEOUT_MS,
    "timeoutMs",
  );
  const maxRequestBytes = validatePositiveInteger(
    options.maxRequestBytes ?? KNOWLEDGE_SERVICE_DEFAULT_MAX_REQUEST_BYTES,
    "maxRequestBytes",
  );
  const maxResponseBytes = validatePositiveInteger(
    options.maxResponseBytes ?? KNOWLEDGE_SERVICE_DEFAULT_MAX_RESPONSE_BYTES,
    "maxResponseBytes",
  );
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const baseUrl = `http://${formatHost(host)}:${String(port)}`;

  return Object.freeze({
    dispatch(
      operation: KnowledgeServiceOperation,
      input: unknown,
      signal: AbortSignal,
    ): Promise<Record<string, unknown>> {
      throwIfAborted(signal);
      const requestId = randomUUID();
      const body = JSON.stringify({
        protocolVersion: KNOWLEDGE_SERVICE_PROTOCOL_VERSION,
        requestId,
        operation,
        input,
      });
      if (Buffer.byteLength(body, "utf8") > maxRequestBytes) {
        throw new KnowledgeServiceClientError(
          "REQUEST_TOO_LARGE",
          `pi-knowledge request exceeds the ${String(maxRequestBytes)} byte adapter limit`,
        );
      }

      return withRequestDeadline(signal, timeoutMs, async (deadlineSignal) => {
        const response = await performFetch(
          fetchImpl,
          `${baseUrl}/v1/dispatch`,
          {
            method: "POST",
            headers: {
              authorization: `Bearer ${token}`,
              "content-type": "application/json",
            },
            body,
          },
          deadlineSignal,
        );
        const responseBody = await readBoundedJsonBody(response, maxResponseBytes);
        requireCorrelatedRequestId(response, requestId);
        const envelope = requireRecord(responseBody, "pi-knowledge dispatch response");
        requireProtocolVersion(envelope);
        if (envelope["requestId"] !== requestId) {
          throw new KnowledgeServiceClientError(
            "PROTOCOL_INVALID",
            "pi-knowledge response requestId does not match the request",
          );
        }

        if (envelope["ok"] === false) throwRemoteError(envelope);
        if (!response.ok) {
          throw new KnowledgeServiceClientError(
            "PROTOCOL_INVALID",
            `pi-knowledge returned HTTP ${String(response.status)} without a structured error`,
          );
        }
        if (envelope["ok"] !== true) {
          throw new KnowledgeServiceClientError("PROTOCOL_INVALID", "pi-knowledge response is missing ok=true");
        }
        if (envelope["operation"] !== operation) {
          throw new KnowledgeServiceClientError(
            "PROTOCOL_INVALID",
            "pi-knowledge response operation does not match the request",
          );
        }

        return requireRecord(envelope["result"], "pi-knowledge dispatch result");
      });
    },

    health(signal: AbortSignal): Promise<Record<string, unknown>> {
      throwIfAborted(signal);
      return withRequestDeadline(signal, timeoutMs, async (deadlineSignal) => {
        const response = await performFetch(
          fetchImpl,
          `${baseUrl}/v1/health`,
          {
            method: "GET",
            headers: { authorization: `Bearer ${token}` },
          },
          deadlineSignal,
        );
        const responseBody = await readBoundedJsonBody(response, maxResponseBytes);
        const envelope = requireRecord(responseBody, "pi-knowledge health response");
        requireProtocolVersion(envelope);
        const requestId = requireBoundedRequestId(envelope["requestId"]);
        requireCorrelatedRequestId(response, requestId);

        if (envelope["ok"] === false) throwRemoteError(envelope);
        if (!response.ok) {
          throw new KnowledgeServiceClientError(
            "PROTOCOL_INVALID",
            `pi-knowledge health returned HTTP ${String(response.status)} without a structured error`,
          );
        }
        if (envelope["ok"] !== true) {
          throw new KnowledgeServiceClientError(
            "PROTOCOL_INVALID",
            "pi-knowledge health response is missing ok=true",
          );
        }
        if (envelope["service"] !== "pi-knowledge" || envelope["status"] !== "healthy") {
          throw new KnowledgeServiceClientError("PROTOCOL_INVALID", "pi-knowledge health payload is invalid");
        }

        return envelope;
      });
    },
  });
}

async function withRequestDeadline<T>(
  callerSignal: AbortSignal,
  timeoutMs: number,
  operation: (signal: AbortSignal) => Promise<T>,
): Promise<T> {
  throwIfAborted(callerSignal);
  const timeoutController = new AbortController();
  const timeout = setTimeout(() => {
    timeoutController.abort(new Error("pi-knowledge request timed out"));
  }, timeoutMs);
  const signal = AbortSignal.any([callerSignal, timeoutController.signal]);

  try {
    return await operation(signal);
  } catch (error) {
    if (callerSignal.aborted) throw abortReason(callerSignal);
    if (timeoutController.signal.aborted) {
      throw new KnowledgeServiceClientError(
        "SERVICE_TIMEOUT",
        `pi-knowledge request exceeded the ${String(timeoutMs)} ms adapter deadline`,
        { cause: error },
      );
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function performFetch(
  fetchImpl: FetchLike,
  url: string,
  init: RequestInit,
  signal: AbortSignal,
): Promise<Response> {
  try {
    return await fetchImpl(url, { ...init, signal });
  } catch (error) {
    throw new KnowledgeServiceClientError(
      "SERVICE_UNAVAILABLE",
      "pi-knowledge service is unavailable",
      { cause: error },
    );
  }
}

async function readBoundedJsonBody(response: Response, maxBytes: number): Promise<unknown> {
  const contentLength = response.headers.get("content-length");
  if (contentLength !== null) {
    const parsedLength = Number(contentLength);
    if (Number.isFinite(parsedLength) && parsedLength > maxBytes) {
      await cancelBody(response);
      throw new KnowledgeServiceClientError(
        "RESPONSE_TOO_LARGE",
        `pi-knowledge response exceeds the ${String(maxBytes)} byte adapter limit`,
      );
    }
  }

  const body = response.body;
  if (body === null) {
    throw new KnowledgeServiceClientError("PROTOCOL_INVALID", "pi-knowledge response body is missing");
  }

  const reader = body.getReader();
  const chunks: Buffer[] = [];
  let totalBytes = 0;
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      totalBytes += chunk.value.byteLength;
      if (totalBytes > maxBytes) {
        await reader.cancel().catch(() => undefined);
        throw new KnowledgeServiceClientError(
          "RESPONSE_TOO_LARGE",
          `pi-knowledge response exceeds the ${String(maxBytes)} byte adapter limit`,
        );
      }
      chunks.push(Buffer.from(chunk.value));
    }
  } catch (error) {
    if (error instanceof KnowledgeServiceClientError) throw error;
    throw new KnowledgeServiceClientError(
      "SERVICE_UNAVAILABLE",
      "pi-knowledge response stream failed",
      { cause: error },
    );
  } finally {
    reader.releaseLock();
  }

  const text = Buffer.concat(chunks, totalBytes).toString("utf8");
  try {
    const parsed: unknown = JSON.parse(text);
    return parsed;
  } catch (error) {
    throw new KnowledgeServiceClientError(
      "PROTOCOL_INVALID",
      "pi-knowledge response body is not valid JSON",
      { cause: error },
    );
  }
}

async function cancelBody(response: Response): Promise<void> {
  if (response.body === null) return;
  await response.body.cancel().catch(() => undefined);
}

function requireProtocolVersion(record: Record<string, unknown>): void {
  if (record["protocolVersion"] !== KNOWLEDGE_SERVICE_PROTOCOL_VERSION) {
    throw new KnowledgeServiceClientError(
      "PROTOCOL_INVALID",
      `pi-knowledge protocol mismatch; expected ${String(KNOWLEDGE_SERVICE_PROTOCOL_VERSION)}`,
    );
  }
}

function requireCorrelatedRequestId(response: Response, requestId: string): void {
  const headerRequestId = response.headers.get(KNOWLEDGE_SERVICE_REQUEST_ID_HEADER);
  if (headerRequestId !== requestId) {
    throw new KnowledgeServiceClientError(
      "PROTOCOL_INVALID",
      "pi-knowledge x-request-id header does not match the response body/request",
    );
  }
}

function requireBoundedRequestId(value: unknown): string {
  if (typeof value !== "string" || value.length === 0 || value.length > KNOWLEDGE_SERVICE_MAX_REQUEST_ID_LENGTH) {
    throw new KnowledgeServiceClientError("PROTOCOL_INVALID", "pi-knowledge response requestId is invalid");
  }
  return value;
}

function throwRemoteError(envelope: Record<string, unknown>): never {
  const error = requireRecord(envelope["error"], "pi-knowledge error response");
  const code = error["code"];
  const message = error["message"];
  if (typeof code !== "string" || code.length === 0 || typeof message !== "string" || message.length === 0) {
    throw new KnowledgeServiceClientError("PROTOCOL_INVALID", "pi-knowledge structured error payload is invalid");
  }
  throw new KnowledgeServiceClientError(
    "SERVICE_REJECTED",
    `pi-knowledge rejected the request: ${code}`,
    { remoteCode: code },
  );
}

function requireRecord(value: unknown, label: string): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new KnowledgeServiceClientError("PROTOCOL_INVALID", `${label} must be a JSON object`);
  }
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validateHost(host: string): string {
  if (!isLoopbackHost(host)) {
    throw new KnowledgeServiceClientError(
      "CONFIG_INVALID",
      "pi-knowledge adapter host must be 127.0.0.1 or ::1",
    );
  }
  return host;
}

function isLoopbackHost(host: string): boolean {
  return host === "127.0.0.1" || host === "::1";
}

function validatePort(port: number): number {
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new KnowledgeServiceClientError("CONFIG_INVALID", "pi-knowledge adapter port must be between 1 and 65535");
  }
  return port;
}

function parsePort(value: string | undefined): number {
  if (value === undefined) return KNOWLEDGE_SERVICE_DEFAULT_PORT;
  if (!/^\d+$/u.test(value)) {
    throw new KnowledgeServiceClientError("CONFIG_INVALID", "PI_KNOWLEDGE_PORT must be an integer");
  }
  return validatePort(Number(value));
}

function validateToken(token: string): string {
  if (token.length < KNOWLEDGE_SERVICE_TOKEN_MIN_LENGTH) {
    throw new KnowledgeServiceClientError(
      "CONFIG_INVALID",
      `pi-knowledge adapter token must contain at least ${String(KNOWLEDGE_SERVICE_TOKEN_MIN_LENGTH)} characters`,
    );
  }
  return token;
}

function validatePositiveInteger(value: number, label: string): number {
  if (!Number.isInteger(value) || value <= 0) {
    throw new KnowledgeServiceClientError("CONFIG_INVALID", `${label} must be a positive integer`);
  }
  return value;
}

function formatHost(host: string): string {
  return host === "::1" ? "[::1]" : host;
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
