import { afterEach, describe, expect, it } from "vitest";
import {
  PI_KNOWLEDGE_DEFAULT_MAX_REQUEST_BYTES,
  PI_KNOWLEDGE_DEFAULT_MAX_RESPONSE_BYTES,
  PI_KNOWLEDGE_DEFAULT_PORT,
  PI_KNOWLEDGE_PROTOCOL_VERSION,
} from "../../src/knowledge/contracts/protocol.js";
import { buildKnowledgeApp } from "../../src/knowledge/service/app.js";
import {
  createKnowledgeServiceClient,
  createKnowledgeServiceClientFromEnvironment,
  KNOWLEDGE_SERVICE_DEFAULT_HOST,
  KNOWLEDGE_SERVICE_DEFAULT_MAX_REQUEST_BYTES,
  KNOWLEDGE_SERVICE_DEFAULT_MAX_RESPONSE_BYTES,
  KNOWLEDGE_SERVICE_DEFAULT_PORT,
  KNOWLEDGE_SERVICE_PROTOCOL_VERSION,
  KnowledgeServiceClientError,
} from "./service-client.js";

const SERVICE_TOKEN = "p0-t04-service-client-test-token";
const apps: Array<Awaited<ReturnType<typeof buildKnowledgeApp>>> = [];

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

async function startService(token: string = SERVICE_TOKEN): Promise<number> {
  const app = await buildKnowledgeApp({ token });
  apps.push(app);
  const address = await app.listen({ host: "127.0.0.1", port: 0 });
  return Number(new URL(address).port);
}

describe("Knowledge service client", () => {
  it("keeps adapter wire defaults aligned with the standalone service contract", () => {
    expect(KNOWLEDGE_SERVICE_PROTOCOL_VERSION).toBe(PI_KNOWLEDGE_PROTOCOL_VERSION);
    expect(KNOWLEDGE_SERVICE_DEFAULT_PORT).toBe(PI_KNOWLEDGE_DEFAULT_PORT);
    expect(KNOWLEDGE_SERVICE_DEFAULT_MAX_REQUEST_BYTES).toBe(PI_KNOWLEDGE_DEFAULT_MAX_REQUEST_BYTES);
    expect(KNOWLEDGE_SERVICE_DEFAULT_MAX_RESPONSE_BYTES).toBe(PI_KNOWLEDGE_DEFAULT_MAX_RESPONSE_BYTES);
  });

  it("performs authenticated health and workspace.echo calls against the real standalone app", async () => {
    const port = await startService();
    const client = createKnowledgeServiceClient({
      host: KNOWLEDGE_SERVICE_DEFAULT_HOST,
      port,
      token: SERVICE_TOKEN,
    });
    const signal = new AbortController().signal;

    await expect(client.health(signal)).resolves.toMatchObject({
      ok: true,
      protocolVersion: 1,
      service: "pi-knowledge",
      status: "healthy",
    });
    await expect(client.dispatch("workspace.echo", {
      projectId: "project-real",
      workspaceId: "workspace-real",
      workspacePath: "/tmp/workspace-real",
      workspaceLabel: "real",
    }, signal)).resolves.toEqual({
      projectId: "project-real",
      workspaceId: "workspace-real",
      workspacePath: "/tmp/workspace-real",
      workspaceLabel: "real",
    });
  });

  it("maps service authentication rejection without exposing the configured token", async () => {
    const port = await startService();
    const wrongToken = "p0-t04-definitely-wrong-token";
    const client = createKnowledgeServiceClient({
      host: "127.0.0.1",
      port,
      token: wrongToken,
    });

    let caught: unknown;
    try {
      await client.health(new AbortController().signal);
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(KnowledgeServiceClientError);
    expect(caught).toMatchObject({
      code: "SERVICE_REJECTED",
      remoteCode: "AUTH_INVALID",
    });
    expect(caught instanceof Error ? caught.message : "").not.toContain(wrongToken);
  });

  it("rejects non-loopback environment configuration before creating a client", () => {
    expect(() => createKnowledgeServiceClientFromEnvironment({
      PI_KNOWLEDGE_HOST: "0.0.0.0",
      PI_KNOWLEDGE_PORT: "8515",
      PI_KNOWLEDGE_TOKEN: SERVICE_TOKEN,
    })).toThrow("PI_KNOWLEDGE_HOST must be 127.0.0.1 or ::1");
  });

  it("requires the service token to stay server-side and non-trivial", () => {
    expect(() => createKnowledgeServiceClientFromEnvironment({
      PI_KNOWLEDGE_HOST: "127.0.0.1",
      PI_KNOWLEDGE_PORT: "8515",
    })).toThrow("PI_KNOWLEDGE_TOKEN must contain at least 16 characters");
  });

  it("rejects a generated request that exceeds the adapter request bound before fetch", async () => {
    let fetchCalls = 0;
    const fetchImpl: typeof fetch = () => {
      fetchCalls += 1;
      return Promise.resolve(new Response("{}"));
    };
    const client = createKnowledgeServiceClient({
      host: "127.0.0.1",
      port: 8515,
      token: SERVICE_TOKEN,
      maxRequestBytes: 128,
      fetchImpl,
    });

    await expect(client.dispatch("workspace.echo", {
      projectId: "project",
      workspaceId: "workspace",
      workspacePath: `/${"x".repeat(512)}`,
    }, new AbortController().signal)).rejects.toMatchObject({ code: "REQUEST_TOO_LARGE" });
    expect(fetchCalls).toBe(0);
  });

  it("rejects an oversized response from content-length before buffering its body", async () => {
    const fetchImpl: typeof fetch = () => Promise.resolve(new Response("{}", {
      status: 200,
      headers: { "content-length": "4096" },
    }));
    const client = createKnowledgeServiceClient({
      host: "127.0.0.1",
      port: 8515,
      token: SERVICE_TOKEN,
      maxResponseBytes: 512,
      fetchImpl,
    });

    await expect(client.health(new AbortController().signal))
      .rejects.toMatchObject({ code: "RESPONSE_TOO_LARGE" });
  });

  it("propagates caller cancellation through the fetch signal", async () => {
    const fetchImpl: typeof fetch = (_input, init) => {
      const signal = init?.signal;
      if (signal === undefined || signal === null) throw new Error("expected fetch AbortSignal");
      return new Promise<Response>((_resolve, reject) => {
        signal.addEventListener("abort", () => {
          const reason: unknown = signal.reason;
          reject(reason);
        }, { once: true });
      });
    };
    const client = createKnowledgeServiceClient({
      host: "127.0.0.1",
      port: 8515,
      token: SERVICE_TOKEN,
      fetchImpl,
    });
    const controller = new AbortController();
    const pending = client.health(controller.signal);
    controller.abort(new Error("host deadline reached"));

    await expect(pending).rejects.toThrow("host deadline reached");
  });

  it("maps the adapter deadline when the complete service call does not settle in time", async () => {
    const fetchImpl: typeof fetch = (_input, init) => {
      const signal = init?.signal;
      if (signal === undefined || signal === null) throw new Error("expected fetch AbortSignal");
      return new Promise<Response>((_resolve, reject) => {
        signal.addEventListener("abort", () => {
          const reason: unknown = signal.reason;
          reject(reason);
        }, { once: true });
      });
    };
    const client = createKnowledgeServiceClient({
      host: "127.0.0.1",
      port: 8515,
      token: SERVICE_TOKEN,
      timeoutMs: 5,
      fetchImpl,
    });

    await expect(client.health(new AbortController().signal))
      .rejects.toMatchObject({ code: "SERVICE_TIMEOUT" });
  });
});
