import { Readable } from "node:stream";
import { describe, expect, it, vi, type MockedFunction } from "vitest";
import { PLUGIN_BACKEND_FEDERATION_TIMEOUT_MS } from "../shared/federatedRoutes.js";
import { RemoteMachineRequestError, type MachineClient } from "./machines/machineClient.js";
import { appTestContext, fakeRemoteClient, registerAppTestHooks } from "./app.testSupport.js";

registerAppTestHooks();

const knowledgePath = "/paired-plugin-backends/knowledge/projects/p1/workspaces/w1/knowledge.status";
const knowledgePayload = { revision: "server-r1", input: null };

function remoteKnowledgeResponse(machine: string) {
  return {
    statusCode: 200,
    headers: { "content-type": "application/json" },
    body: Readable.from([JSON.stringify({ machine, status: "ready" })]),
  };
}

async function addMachine(name: string, baseUrl: string): Promise<string> {
  const response = await appTestContext.app.inject({
    method: "POST",
    url: "/api/machines",
    payload: { name, baseUrl },
  });
  expect(response.statusCode).toBe(200);
  return response.json<{ id: string }>().id;
}

function selectedKnowledgeUrl(machineId: string): string {
  return `/api/machines/${machineId}${knowledgePath}`;
}

function expectKnowledgeFederationCall(request: MockedFunction<MachineClient["request"]>): void {
  expect(request).toHaveBeenCalledTimes(1);
  const [method, path, body, options] = request.mock.calls[0] ?? [];
  expect([method, path, body]).toEqual(["POST", `/api${knowledgePath}`, knowledgePayload]);
  expect(options?.timeoutMs).toBe(PLUGIN_BACKEND_FEDERATION_TIMEOUT_MS);
  expect(options?.signal).toBeInstanceOf(AbortSignal);
}

describe("Knowledge selected-machine federation contract", () => {
  it("routes Knowledge through the selected target Machine without touching gateway-local sessiond", async () => {
    const remoteId = await addMachine("Target A", "https://target-a.example.test/");
    const request = vi.fn<MachineClient["request"]>(() => Promise.resolve(remoteKnowledgeResponse("target-a")));
    appTestContext.remoteClient = fakeRemoteClient({ request });

    const response = await appTestContext.app.inject({
      method: "POST",
      url: selectedKnowledgeUrl(remoteId),
      payload: knowledgePayload,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ machine: "target-a", status: "ready" });
    expectKnowledgeFederationCall(request);
    expect(appTestContext.sessionDaemonRequests).toEqual([]);
  });

  it("does not fall back to gateway-local Knowledge when the selected target is unavailable", async () => {
    const remoteId = await addMachine("Unavailable target", "https://offline.example.test/");
    const request = vi.fn<MachineClient["request"]>(() => Promise.reject(new RemoteMachineRequestError("connect failed", 502)));
    appTestContext.remoteClient = fakeRemoteClient({ request });

    const response = await appTestContext.app.inject({
      method: "POST",
      url: selectedKnowledgeUrl(remoteId),
      payload: knowledgePayload,
    });

    expect(response.statusCode).toBe(502);
    expect(response.json()).toMatchObject({
      error: "Remote machine unavailable",
      machineId: remoteId,
      statusCode: 502,
    });
    expectKnowledgeFederationCall(request);
    expect(appTestContext.sessionDaemonRequests).toEqual([]);
  });

  it("preserves a selected target's pi-knowledge unavailable response instead of using gateway-local Knowledge", async () => {
    const remoteId = await addMachine("Target without Knowledge", "https://target-no-knowledge.example.test/");
    const unavailable = {
      error: "Knowledge service unavailable",
      code: "knowledge-service-unavailable",
      detail: "connect ECONNREFUSED 127.0.0.1:43127",
    };
    const request = vi.fn<MachineClient["request"]>(() => Promise.resolve({
      statusCode: 503,
      headers: { "content-type": "application/json" },
      body: Readable.from([JSON.stringify(unavailable)]),
    }));
    appTestContext.remoteClient = fakeRemoteClient({ request });

    const response = await appTestContext.app.inject({
      method: "POST",
      url: selectedKnowledgeUrl(remoteId),
      payload: knowledgePayload,
    });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual(unavailable);
    expectKnowledgeFederationCall(request);
    expect(appTestContext.sessionDaemonRequests).toEqual([]);
  });

  it("uses the currently selected target for each request and never leaks a previous target result", async () => {
    const targetA = await addMachine("Target A", "https://target-a.example.test/");
    const targetB = await addMachine("Target B", "https://target-b.example.test/");
    const requestA = vi.fn<MachineClient["request"]>(() => Promise.resolve(remoteKnowledgeResponse("target-a")));
    const requestB = vi.fn<MachineClient["request"]>(() => Promise.resolve(remoteKnowledgeResponse("target-b")));

    appTestContext.remoteClient = fakeRemoteClient({ request: requestA });
    const responseA = await appTestContext.app.inject({ method: "POST", url: selectedKnowledgeUrl(targetA), payload: knowledgePayload });

    appTestContext.remoteClient = fakeRemoteClient({ request: requestB });
    const responseB = await appTestContext.app.inject({ method: "POST", url: selectedKnowledgeUrl(targetB), payload: knowledgePayload });

    expect(responseA.json()).toEqual({ machine: "target-a", status: "ready" });
    expect(responseB.json()).toEqual({ machine: "target-b", status: "ready" });
    expectKnowledgeFederationCall(requestA);
    expectKnowledgeFederationCall(requestB);
    expect(appTestContext.sessionDaemonRequests).toEqual([]);
  });

  it("propagates an inbound disconnect to the selected target Knowledge request", async () => {
    const remoteId = await addMachine("Slow target", "https://slow-target.example.test/");
    let observedSignal: AbortSignal | undefined;
    const request = vi.fn<MachineClient["request"]>((_method, _path, _body, options) => new Promise((_resolve, reject) => {
      observedSignal = options?.signal;
      if (observedSignal === undefined) {
        reject(new Error("Expected federation cancellation signal"));
        return;
      }
      const failOnAbort = (): void => {
        reject(new RemoteMachineRequestError("request cancelled", 502));
      };
      if (observedSignal.aborted) {
        failOnAbort();
      } else {
        observedSignal.addEventListener("abort", failOnAbort, { once: true });
      }
    }));
    appTestContext.remoteClient = fakeRemoteClient({ request });

    const address = await appTestContext.app.listen({ port: 0, host: "127.0.0.1" });
    const controller = new AbortController();
    const pending = fetch(`${address}${selectedKnowledgeUrl(remoteId)}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(knowledgePayload),
      signal: controller.signal,
    });

    await vi.waitFor(() => {
      expect(request).toHaveBeenCalledTimes(1);
    });
    controller.abort();

    await expect(pending).rejects.toThrow();
    await vi.waitFor(() => {
      expect(observedSignal?.aborted).toBe(true);
    });
    expect(appTestContext.sessionDaemonRequests).toEqual([]);
  });

  it("keeps the explicit local Machine on the existing local paired-backend route", async () => {
    const response = await appTestContext.app.inject({
      method: "POST",
      url: `/api/machines/local${knowledgePath}`,
      payload: knowledgePayload,
    });

    expect(response.statusCode).toBe(200);
    expect(appTestContext.sessionDaemonRequests).toEqual([{
      method: "POST",
      path: knowledgePath,
      body: knowledgePayload,
    }]);
  });
});
