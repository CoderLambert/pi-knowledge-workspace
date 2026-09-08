import { describe, expect, it } from "vitest";
import {
  PI_KNOWLEDGE_DEFAULT_HOST,
  PI_KNOWLEDGE_DEFAULT_MAX_REQUEST_BYTES,
  PI_KNOWLEDGE_DEFAULT_MAX_RESPONSE_BYTES,
  PI_KNOWLEDGE_DEFAULT_PORT,
} from "../contracts/protocol.js";
import { loadKnowledgeServiceConfig } from "./config.js";

const TOKEN = "0123456789abcdef0123456789abcdef";

describe("pi-knowledge service config", () => {
  it("defaults to an explicit loopback bind and bounded transport", () => {
    const config = loadKnowledgeServiceConfig({ PI_KNOWLEDGE_TOKEN: TOKEN });

    expect(config).toEqual({
      host: PI_KNOWLEDGE_DEFAULT_HOST,
      port: PI_KNOWLEDGE_DEFAULT_PORT,
      token: TOKEN,
      maxRequestBytes: PI_KNOWLEDGE_DEFAULT_MAX_REQUEST_BYTES,
      maxResponseBytes: PI_KNOWLEDGE_DEFAULT_MAX_RESPONSE_BYTES,
    });
  });

  it("accepts only explicit IPv4 or IPv6 loopback hosts", () => {
    expect(loadKnowledgeServiceConfig({
      PI_KNOWLEDGE_TOKEN: TOKEN,
      PI_KNOWLEDGE_HOST: "::1",
    }).host).toBe("::1");

    expect(() => loadKnowledgeServiceConfig({
      PI_KNOWLEDGE_TOKEN: TOKEN,
      PI_KNOWLEDGE_HOST: "0.0.0.0",
    })).toThrow(/explicit loopback/);
  });

  it("requires a non-trivial service token", () => {
    expect(() => loadKnowledgeServiceConfig({})).toThrow(/PI_KNOWLEDGE_TOKEN/);
    expect(() => loadKnowledgeServiceConfig({ PI_KNOWLEDGE_TOKEN: "short" })).toThrow(/at least 16/);
  });

  it("validates configured port and byte limits", () => {
    const config = loadKnowledgeServiceConfig({
      PI_KNOWLEDGE_TOKEN: TOKEN,
      PI_KNOWLEDGE_PORT: "18515",
      PI_KNOWLEDGE_MAX_REQUEST_BYTES: "2048",
      PI_KNOWLEDGE_MAX_RESPONSE_BYTES: "4096",
    });

    expect(config.port).toBe(18515);
    expect(config.maxRequestBytes).toBe(2048);
    expect(config.maxResponseBytes).toBe(4096);
    expect(() => loadKnowledgeServiceConfig({
      PI_KNOWLEDGE_TOKEN: TOKEN,
      PI_KNOWLEDGE_PORT: "0",
    })).toThrow(/PI_KNOWLEDGE_PORT/);
    expect(() => loadKnowledgeServiceConfig({
      PI_KNOWLEDGE_TOKEN: TOKEN,
      PI_KNOWLEDGE_MAX_REQUEST_BYTES: "255",
    })).toThrow(/PI_KNOWLEDGE_MAX_REQUEST_BYTES/);
    expect(() => loadKnowledgeServiceConfig({
      PI_KNOWLEDGE_TOKEN: TOKEN,
      PI_KNOWLEDGE_MAX_RESPONSE_BYTES: "511",
    })).toThrow(/PI_KNOWLEDGE_MAX_RESPONSE_BYTES/);
  });
});
