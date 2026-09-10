import { timingSafeEqual } from "node:crypto";
import Fastify, { type FastifyInstance, type FastifyReply, type FastifyServerOptions } from "fastify";
import { KNOWLEDGE_ERROR_CODES, KnowledgeServiceError } from "../contracts/errors.js";
import { isKnowledgeOperation } from "../contracts/operations.js";
import {
  PI_KNOWLEDGE_AUTH_SCHEME,
  PI_KNOWLEDGE_DEFAULT_MAX_REQUEST_BYTES,
  PI_KNOWLEDGE_DEFAULT_MAX_RESPONSE_BYTES,
  PI_KNOWLEDGE_PROTOCOL_VERSION,
  PI_KNOWLEDGE_REQUEST_ID_HEADER,
} from "../contracts/protocol.js";
import { createKnowledgeErrorEnvelope, parseKnowledgeDispatchRequest } from "../contracts/schemas.js";
import { dispatchKnowledgeOperation } from "./dispatch.js";
import { knowledgeHealth } from "./health.js";
import type { GroundedAskDispatch } from "./groundedAsk.js";
import type { KnowledgeImportDispatch, KnowledgePublishDispatch } from "./composition.js";
import type { KnowledgeViewerDispatch } from "./viewerDispatch.js";

export interface KnowledgeAppOptions {
  token: string;
  maxRequestBytes?: number;
  maxResponseBytes?: number;
  logger?: FastifyServerOptions["logger"];
  viewer?: KnowledgeViewerDispatch;
  groundedAsk?: GroundedAskDispatch;
  importJobs?: KnowledgeImportDispatch;
  publish?: KnowledgePublishDispatch;
}

const MIN_RESPONSE_LIMIT = 512;

export async function buildKnowledgeApp(options: KnowledgeAppOptions): Promise<FastifyInstance> {
  if (options.token.length === 0) throw new Error("Knowledge service token must not be empty");

  const maxRequestBytes = options.maxRequestBytes ?? PI_KNOWLEDGE_DEFAULT_MAX_REQUEST_BYTES;
  const maxResponseBytes = options.maxResponseBytes ?? PI_KNOWLEDGE_DEFAULT_MAX_RESPONSE_BYTES;
  if (!Number.isInteger(maxRequestBytes) || maxRequestBytes <= 0) {
    throw new Error("maxRequestBytes must be a positive integer");
  }
  if (!Number.isInteger(maxResponseBytes) || maxResponseBytes < MIN_RESPONSE_LIMIT) {
    throw new Error(`maxResponseBytes must be an integer of at least ${String(MIN_RESPONSE_LIMIT)}`);
  }

  const app = Fastify({
    logger: options.logger ?? false,
    bodyLimit: maxRequestBytes,
  });

  app.addHook("onRequest", (request, reply, done) => {
    const authError = authenticate(request.headers.authorization, options.token);
    if (authError === undefined) {
      done();
      return;
    }
    reply.header("www-authenticate", PI_KNOWLEDGE_AUTH_SCHEME);
    sendKnowledgeError(reply, requestHeaderId(request.headers[PI_KNOWLEDGE_REQUEST_ID_HEADER]) ?? request.id, authError, maxResponseBytes);
  });

  app.setErrorHandler((error, request, reply) => {
    if (hasErrorCode(error, "FST_ERR_CTP_INVALID_JSON_BODY")) {
      return sendKnowledgeError(
        reply,
        request.id,
        new KnowledgeServiceError(KNOWLEDGE_ERROR_CODES.malformedJson, "Request body must contain valid JSON", 400),
        maxResponseBytes,
      );
    }
    if (hasErrorCode(error, "FST_ERR_CTP_BODY_TOO_LARGE") || hasStatusCode(error, 413)) {
      return sendKnowledgeError(
        reply,
        request.id,
        new KnowledgeServiceError(
          KNOWLEDGE_ERROR_CODES.requestTooLarge,
          `Request body exceeds the ${String(maxRequestBytes)} byte limit`,
          413,
        ),
        maxResponseBytes,
      );
    }
    if (error instanceof KnowledgeServiceError) {
      return sendKnowledgeError(reply, request.id, error, maxResponseBytes);
    }

    request.log.error({ err: error }, "pi-knowledge request failed");
    return sendKnowledgeError(
      reply,
      request.id,
      new KnowledgeServiceError(KNOWLEDGE_ERROR_CODES.internal, "Internal pi-knowledge error", 500),
      maxResponseBytes,
    );
  });

  app.setNotFoundHandler((request, reply) => sendKnowledgeError(
    reply,
    request.id,
    new KnowledgeServiceError(KNOWLEDGE_ERROR_CODES.notFound, "Knowledge endpoint not found", 404),
    maxResponseBytes,
  ));

  app.get("/v1/health", (request, reply) => sendBoundedSuccess(
    reply,
    request.id,
    200,
    knowledgeHealth(request.id),
    maxResponseBytes,
  ));

  app.post("/v1/dispatch", async (request, reply) => {
    let requestId = request.id;
    try {
      const dispatchRequest = parseKnowledgeDispatchRequest(request.body);
      requestId = dispatchRequest.requestId;

      if (dispatchRequest.protocolVersion !== PI_KNOWLEDGE_PROTOCOL_VERSION) {
        throw new KnowledgeServiceError(
          KNOWLEDGE_ERROR_CODES.incompatibleProtocol,
          `Unsupported protocol version: ${String(dispatchRequest.protocolVersion)}`,
          409,
          { expectedProtocolVersion: PI_KNOWLEDGE_PROTOCOL_VERSION },
        );
      }
      if (!isKnowledgeOperation(dispatchRequest.operation)) {
        throw new KnowledgeServiceError(
          KNOWLEDGE_ERROR_CODES.unsupportedOperation,
          `Unsupported Knowledge operation: ${dispatchRequest.operation}`,
          400,
        );
      }

      const result = await dispatchKnowledgeOperation(
        dispatchRequest.operation,
        dispatchRequest.input,
        { maxRequestBytes, maxResponseBytes },
        {
          ...(options.viewer === undefined ? {} : { viewer: options.viewer }),
          ...(options.groundedAsk === undefined ? {} : { groundedAsk: options.groundedAsk }),
          ...(options.importJobs === undefined ? {} : { importJobs: options.importJobs }),
          ...(options.publish === undefined ? {} : { publish: options.publish }),
        },
      );
      const payload: Record<string, unknown> = {
        ok: true,
        protocolVersion: PI_KNOWLEDGE_PROTOCOL_VERSION,
        requestId,
        operation: dispatchRequest.operation,
        result,
      };
      return await sendBoundedSuccess(reply, requestId, 200, payload, maxResponseBytes);
    } catch (error) {
      return sendKnowledgeError(reply, requestId, normalizeServiceError(error), maxResponseBytes);
    }
  });

  await app.ready();
  return app;
}

function requestHeaderId(value: string | string[] | undefined): string | undefined {
  if (typeof value !== "string" || value.length === 0 || value.length > 128 || !/^[A-Za-z0-9._:-]+$/u.test(value)) {
    return undefined;
  }
  return value;
}

function authenticate(authorization: string | undefined, expectedToken: string): KnowledgeServiceError | undefined {
  if (authorization === undefined) {
    return new KnowledgeServiceError(KNOWLEDGE_ERROR_CODES.authRequired, "Authorization token is required", 401);
  }

  const prefix = `${PI_KNOWLEDGE_AUTH_SCHEME} `;
  if (!authorization.startsWith(prefix)) {
    return new KnowledgeServiceError(KNOWLEDGE_ERROR_CODES.authInvalid, "Authorization token is invalid", 401);
  }

  const actualToken = authorization.slice(prefix.length);
  const actual = Buffer.from(actualToken);
  const expected = Buffer.from(expectedToken);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    return new KnowledgeServiceError(KNOWLEDGE_ERROR_CODES.authInvalid, "Authorization token is invalid", 401);
  }
  return undefined;
}

function hasErrorCode(error: unknown, code: string): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === code;
}

function hasStatusCode(error: unknown, statusCode: number): boolean {
  return typeof error === "object"
    && error !== null
    && "statusCode" in error
    && error.statusCode === statusCode;
}

function normalizeServiceError(error: unknown): KnowledgeServiceError {
  if (error instanceof KnowledgeServiceError) return error;
  return new KnowledgeServiceError(KNOWLEDGE_ERROR_CODES.internal, "Internal pi-knowledge error", 500);
}

function sendBoundedSuccess(
  reply: FastifyReply,
  requestId: string,
  statusCode: number,
  payload: Record<string, unknown>,
  maxResponseBytes: number,
): FastifyReply {
  const serialized = JSON.stringify(payload);
  if (Buffer.byteLength(serialized, "utf8") > maxResponseBytes) {
    return sendKnowledgeError(
      reply,
      requestId,
      new KnowledgeServiceError(
        KNOWLEDGE_ERROR_CODES.responseTooLarge,
        `Response exceeds the ${String(maxResponseBytes)} byte limit`,
        500,
      ),
      maxResponseBytes,
    );
  }
  return sendSerializedJson(reply, requestId, statusCode, serialized);
}

function sendKnowledgeError(
  reply: FastifyReply,
  requestId: string,
  error: KnowledgeServiceError,
  maxResponseBytes: number,
): FastifyReply {
  let statusCode = error.statusCode;
  let serialized = JSON.stringify(createKnowledgeErrorEnvelope(requestId, error));
  if (Buffer.byteLength(serialized, "utf8") > maxResponseBytes) {
    statusCode = 500;
    serialized = JSON.stringify(createKnowledgeErrorEnvelope(
      requestId,
      new KnowledgeServiceError(KNOWLEDGE_ERROR_CODES.responseTooLarge, "Response exceeds configured limit", statusCode),
    ));
  }
  return sendSerializedJson(reply, requestId, statusCode, serialized);
}

function sendSerializedJson(
  reply: FastifyReply,
  requestId: string,
  statusCode: number,
  serialized: string,
): FastifyReply {
  return reply
    .header(PI_KNOWLEDGE_REQUEST_ID_HEADER, requestId)
    .code(statusCode)
    .type("application/json; charset=utf-8")
    .send(serialized);
}
