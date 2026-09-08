import type { FastifyInstance } from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import { PI_KNOWLEDGE_PROTOCOL_VERSION } from "../contracts/protocol.js";
import { buildKnowledgeApp, type KnowledgeAppOptions } from "./app.js";

const TOKEN = "0123456789abcdef0123456789abcdef";
const apps: FastifyInstance[] = [];

async function createApp(overrides: Partial<KnowledgeAppOptions> = {}): Promise<FastifyInstance> {
  const app = await buildKnowledgeApp({ token: TOKEN, ...overrides });
  apps.push(app);
  return app;
}

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

describe("standalone pi-knowledge HTTP contract", () => {
  it("starts a loopback listener, serves authenticated health, and closes without sessiond", async () => {
    const app = await createApp();
    const address = await app.listen({ host: "127.0.0.1", port: 0 });
    const response = await fetch(`${address}/v1/health`, { headers: authHeaders() });

    expect(response.status).toBe(200);
    const body = parseObject(await response.text());
    expect(body["ok"]).toBe(true);
    expect(body["service"]).toBe("pi-knowledge");
    expect(body["status"]).toBe("healthy");
    expect(body["protocolVersion"]).toBe(PI_KNOWLEDGE_PROTOCOL_VERSION);
    expect(body["requestId"]).toBe(response.headers.get("x-request-id"));

    await app.close();
    expect(app.server.listening).toBe(false);
    const appIndex = apps.indexOf(app);
    if (appIndex >= 0) apps.splice(appIndex, 1);
  });

  it("dispatches capabilities.get through the operation allowlist", async () => {
    const app = await createApp();
    const response = await dispatch(app, {
      protocolVersion: PI_KNOWLEDGE_PROTOCOL_VERSION,
      requestId: "cap-1",
      operation: "capabilities.get",
      input: null,
    });

    expect(response.statusCode).toBe(200);
    const body = parseObject(response.body);
    expect(body["requestId"]).toBe("cap-1");
    const result = requireObject(body["result"]);
    expect(result["operations"]).toEqual(["capabilities.get", "workspace.echo"]);
    expect(result["protocolVersion"]).toBe(PI_KNOWLEDGE_PROTOCOL_VERSION);
  });

  it("dispatches workspace.echo without adding authority or filesystem behavior", async () => {
    const app = await createApp();
    const input = {
      projectId: "project-1",
      workspaceId: "workspace-1",
      workspacePath: "/tmp/example-worktree",
      workspaceLabel: "example",
    };
    const response = await dispatch(app, {
      protocolVersion: PI_KNOWLEDGE_PROTOCOL_VERSION,
      requestId: "echo-1",
      operation: "workspace.echo",
      input,
    });

    expect(response.statusCode).toBe(200);
    const body = parseObject(response.body);
    expect(body["operation"]).toBe("workspace.echo");
    expect(body["result"]).toEqual(input);
  });

  it("rejects missing and incorrect bearer tokens", async () => {
    const app = await createApp();
    const missing = await app.inject({ method: "GET", url: "/v1/health" });
    const wrong = await app.inject({
      method: "GET",
      url: "/v1/health",
      headers: authHeaders("wrong-token"),
    });

    expect(missing.statusCode).toBe(401);
    expect(errorCode(missing.body)).toBe("AUTH_REQUIRED");
    expect(wrong.statusCode).toBe(401);
    expect(errorCode(wrong.body)).toBe("AUTH_INVALID");
  });

  it("rejects malformed JSON with the stable error envelope", async () => {
    const app = await createApp();
    const response = await app.inject({
      method: "POST",
      url: "/v1/dispatch",
      headers: { ...authHeaders(), "content-type": "application/json" },
      payload: "{\"protocolVersion\":",
    });

    expect(response.statusCode).toBe(400);
    expect(errorCode(response.body)).toBe("MALFORMED_JSON");
    expectErrorEnvelope(response.body);
  });

  it("rejects malformed schema and arbitrary proxy target fields", async () => {
    const app = await createApp();
    const missingField = await dispatch(app, {
      protocolVersion: PI_KNOWLEDGE_PROTOCOL_VERSION,
      requestId: "schema-1",
      operation: "workspace.echo",
    });
    const proxyTarget = await dispatch(app, {
      protocolVersion: PI_KNOWLEDGE_PROTOCOL_VERSION,
      requestId: "schema-2",
      operation: "workspace.echo",
      input: {
        projectId: "project-1",
        workspaceId: "workspace-1",
        workspacePath: "/tmp/workspace",
        targetUrl: "http://127.0.0.1:9999",
      },
    });

    expect(missingField.statusCode).toBe(400);
    expect(errorCode(missingField.body)).toBe("INVALID_REQUEST");
    expect(proxyTarget.statusCode).toBe(400);
    expect(errorCode(proxyTarget.body)).toBe("INVALID_REQUEST");
  });

  it("rejects unsupported operations", async () => {
    const app = await createApp();
    const response = await dispatch(app, {
      protocolVersion: PI_KNOWLEDGE_PROTOCOL_VERSION,
      requestId: "unsupported-1",
      operation: "proxy.fetch",
      input: null,
    });

    expect(response.statusCode).toBe(400);
    expect(errorCode(response.body)).toBe("UNSUPPORTED_OPERATION");
  });

  it("rejects incompatible protocol versions", async () => {
    const app = await createApp();
    const response = await dispatch(app, {
      protocolVersion: PI_KNOWLEDGE_PROTOCOL_VERSION + 1,
      requestId: "version-1",
      operation: "capabilities.get",
      input: null,
    });

    expect(response.statusCode).toBe(409);
    expect(errorCode(response.body)).toBe("INCOMPATIBLE_PROTOCOL_VERSION");
  });

  it("enforces the request body byte limit", async () => {
    const app = await createApp({ maxRequestBytes: 256 });
    const response = await dispatch(app, {
      protocolVersion: PI_KNOWLEDGE_PROTOCOL_VERSION,
      requestId: "large-request",
      operation: "workspace.echo",
      input: {
        projectId: "project-1",
        workspaceId: "workspace-1",
        workspacePath: `/${"x".repeat(512)}`,
      },
    });

    expect(response.statusCode).toBe(413);
    expect(errorCode(response.body)).toBe("REQUEST_TOO_LARGE");
  });

  it("enforces the response byte limit", async () => {
    const app = await createApp({ maxRequestBytes: 4096, maxResponseBytes: 512 });
    const response = await dispatch(app, {
      protocolVersion: PI_KNOWLEDGE_PROTOCOL_VERSION,
      requestId: "large-response",
      operation: "workspace.echo",
      input: {
        projectId: "project-1",
        workspaceId: "workspace-1",
        workspacePath: `/${"x".repeat(768)}`,
      },
    });

    expect(response.statusCode).toBe(500);
    expect(errorCode(response.body)).toBe("RESPONSE_TOO_LARGE");
    expect(Buffer.byteLength(response.body, "utf8")).toBeLessThanOrEqual(512);
  });
});

function authHeaders(token = TOKEN): Record<string, string> {
  return { authorization: `Bearer ${token}` };
}

async function dispatch(app: FastifyInstance, payload: object) {
  return app.inject({
    method: "POST",
    url: "/v1/dispatch",
    headers: authHeaders(),
    payload,
  });
}

function errorCode(body: string): unknown {
  const envelope = parseObject(body);
  const error = requireObject(envelope["error"]);
  return error["code"];
}

function expectErrorEnvelope(body: string): void {
  const envelope = parseObject(body);
  expect(envelope["ok"]).toBe(false);
  expect(envelope["protocolVersion"]).toBe(PI_KNOWLEDGE_PROTOCOL_VERSION);
  expect(typeof envelope["requestId"]).toBe("string");
  const error = requireObject(envelope["error"]);
  expect(typeof error["code"]).toBe("string");
  expect(typeof error["message"]).toBe("string");
}

function parseObject(serialized: string): Record<string, unknown> {
  const parsed: unknown = JSON.parse(serialized);
  return requireObject(parsed);
}

function requireObject(value: unknown): Record<string, unknown> {
  if (!isRecord(value)) throw new Error("Expected a JSON object");
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
