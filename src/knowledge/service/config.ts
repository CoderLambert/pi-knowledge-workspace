import {
  PI_KNOWLEDGE_DEFAULT_HOST,
  PI_KNOWLEDGE_DEFAULT_MAX_REQUEST_BYTES,
  PI_KNOWLEDGE_DEFAULT_MAX_RESPONSE_BYTES,
  PI_KNOWLEDGE_DEFAULT_PORT,
} from "../contracts/protocol.js";
import { effectiveAgentConfig, piWebDataDir } from "../../config.js";
import { join, resolve } from "node:path";

export interface KnowledgeModelConfig {
  provider: string;
  model: string;
  revision: string;
}

export interface KnowledgeServiceConfig {
  host: "127.0.0.1" | "::1";
  port: number;
  token: string;
  maxRequestBytes: number;
  maxResponseBytes: number;
  dataDir: string;
  agentDir: string;
  model: KnowledgeModelConfig | undefined;
}

const MIN_TOKEN_LENGTH = 16;
const MIN_REQUEST_LIMIT = 256;
const MIN_RESPONSE_LIMIT = 512;
const MAX_BODY_LIMIT = 4 * 1024 * 1024;

export function loadKnowledgeServiceConfig(env: NodeJS.ProcessEnv = process.env): KnowledgeServiceConfig {
  const host = parseLoopbackHost(env["PI_KNOWLEDGE_HOST"]);
  const token = env["PI_KNOWLEDGE_TOKEN"];
  if (token === undefined || token.length < MIN_TOKEN_LENGTH) {
    throw new Error(`PI_KNOWLEDGE_TOKEN is required and must be at least ${String(MIN_TOKEN_LENGTH)} characters`);
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
    dataDir: resolve(env["PI_KNOWLEDGE_DATA_DIR"] ?? join(piWebDataDir(env), "knowledge")),
    agentDir: effectiveAgentConfig(env).dir,
    model: parseModelConfig(env),
  };
}

function parseModelConfig(env: NodeJS.ProcessEnv): KnowledgeModelConfig | undefined {
  const values = [
    env["PI_KNOWLEDGE_PROVIDER"],
    env["PI_KNOWLEDGE_MODEL"],
    env["PI_KNOWLEDGE_MODEL_REVISION"],
  ];
  if (values.every((value) => value === undefined || value.trim().length === 0)) return undefined;
  if (values.some((value) => value === undefined || value.trim().length === 0)) {
    throw new Error(
      "PI_KNOWLEDGE_PROVIDER, PI_KNOWLEDGE_MODEL and PI_KNOWLEDGE_MODEL_REVISION must be configured together",
    );
  }
  const [provider, model, revision] = values;
  if (provider === undefined || model === undefined || revision === undefined) {
    throw new Error("Knowledge model configuration is incomplete");
  }
  return { provider: provider.trim(), model: model.trim(), revision: revision.trim() };
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
    throw new Error(`${name} must be an integer between ${String(min)} and ${String(max)}`);
  }
  return parsed;
}
