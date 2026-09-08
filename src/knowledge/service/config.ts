import {
  PI_KNOWLEDGE_DEFAULT_HOST,
  PI_KNOWLEDGE_DEFAULT_MAX_REQUEST_BYTES,
  PI_KNOWLEDGE_DEFAULT_MAX_RESPONSE_BYTES,
  PI_KNOWLEDGE_DEFAULT_PORT,
} from "../contracts/protocol.js";

export interface KnowledgeServiceConfig {
  host: "127.0.0.1" | "::1";
  port: number;
  token: string;
  maxRequestBytes: number;
  maxResponseBytes: number;
}

const MIN_TOKEN_LENGTH = 16;
const MIN_REQUEST_LIMIT = 256;
const MIN_RESPONSE_LIMIT = 512;
const MAX_BODY_LIMIT = 4 * 1024 * 1024;

export function loadKnowledgeServiceConfig(env: NodeJS.ProcessEnv = process.env): KnowledgeServiceConfig {
  const host = parseLoopbackHost(env["PI_KNOWLEDGE_HOST"]);
  const token = env["PI_KNOWLEDGE_TOKEN"];
  if (token === undefined || token.length < MIN_TOKEN_LENGTH) {
    throw new Error(`PI_KNOWLEDGE_TOKEN is required and must be at least ${MIN_TOKEN_LENGTH} characters`);
  }

  return {
    host,
    port: parseInteger(env["PI_KNOWLEDGE_PORT"], PI_KNOWLEDGE_DEFAULT_PORT, 1, 65_535, "PI_KNOWLEDGE_PORT"),
    token,
    maxRequestBytes: parseInteger(
      env["PI_KNOWLEDGE_MAX_REQUEST_BYTES"],
      PI_KNOWLEDGE_DEFAULT_MAX_REQUEST_BYTES,
      MIN_REQUEST_LIMIT,
      MAX_BODY_LIMIT,
      "PI_KNOWLEDGE_MAX_REQUEST_BYTES",
    ),
    maxResponseBytes: parseInteger(
      env["PI_KNOWLEDGE_MAX_RESPONSE_BYTES"],
      PI_KNOWLEDGE_DEFAULT_MAX_RESPONSE_BYTES,
      MIN_RESPONSE_LIMIT,
      MAX_BODY_LIMIT,
      "PI_KNOWLEDGE_MAX_RESPONSE_BYTES",
    ),
  };
}

function parseLoopbackHost(value: string | undefined): "127.0.0.1" | "::1" {
  const host = value ?? PI_KNOWLEDGE_DEFAULT_HOST;
  if (host === "127.0.0.1" || host === "::1") return host;
  throw new Error("PI_KNOWLEDGE_HOST must be an explicit loopback address: 127.0.0.1 or ::1");
}

function parseInteger(
  value: string | undefined,
  defaultValue: number,
  min: number,
  max: number,
  name: string,
): number {
  if (value === undefined || value === "") return defaultValue;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new Error(`${name} must be an integer between ${min} and ${max}`);
  }
  return parsed;
}
