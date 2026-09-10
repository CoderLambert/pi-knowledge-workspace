import { contentText, type Api, type AssistantMessage, type Context, type Model } from "@earendil-works/pi-ai";
import type { ModelRuntime } from "@earendil-works/pi-coding-agent";

import {
  createGroundedAskProvider,
  type GroundedAskModelIdentity,
  type GroundedAskProvider,
  type GroundedAskProviderResult,
} from "./groundedAsk.js";

export interface GroundedAskModelRuntime {
  getModel(providerId: string, modelId: string): Model<Api> | undefined;
  completeSimple(model: Model<Api>, context: Context, options?: { signal?: AbortSignal }): Promise<AssistantMessage>;
}

export interface PiModelGroundedAskAdapter {
  provider: GroundedAskProvider;
  identity: GroundedAskModelIdentity;
}

export function createPiModelGroundedAskAdapter(input: {
  runtime: GroundedAskModelRuntime | ModelRuntime;
  provider: string;
  model: string;
  modelRevision: string;
}): PiModelGroundedAskAdapter {
  const identity = Object.freeze({
    provider: nonEmpty(input.provider, "provider"),
    model: nonEmpty(input.model, "model"),
    modelRevision: nonEmpty(input.modelRevision, "modelRevision"),
  });
  const model = input.runtime.getModel(identity.provider, identity.model);
  if (model === undefined) throw new Error(`Grounded Ask model is not available: ${identity.provider}/${identity.model}`);

  return Object.freeze({
    identity,
    provider: createGroundedAskProvider(async (request) => {
      if (request.deliveredEvidence.evidence.length === 0) {
        throw new Error("Grounded Ask has insufficient published Evidence for this question");
      }
      const evidence: unknown = JSON.parse(request.deliveredEvidence.serializedContext);
      const response = await input.runtime.completeSimple(model, {
        systemPrompt: systemPrompt(),
        messages: [{
          role: "user",
          content: JSON.stringify({
            question: request.question,
            evidence,
          }),
          timestamp: Date.now(),
        }],
      }, { signal: request.signal });
      if (response.stopReason === "error" || response.stopReason === "aborted") {
        throw new Error(response.errorMessage ?? `Grounded Ask provider stopped: ${response.stopReason}`);
      }
      return parseGroundedModelResponse(contentText(response.content));
    }),
  });
}

export function parseGroundedModelResponse(text: string): GroundedAskProviderResult {
  const raw = stripJsonFence(text.trim());
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new Error("Grounded Ask provider did not return valid JSON", { cause: error });
  }
  if (!isRecord(parsed) || typeof parsed["answer"] !== "string" || parsed["answer"].trim().length === 0) {
    throw new Error("Grounded Ask provider response is missing answer text");
  }
  const citations = parsed["citations"];
  if (!Array.isArray(citations) || citations.length === 0) {
    throw new Error("Grounded Ask provider response is missing Evidence citations");
  }
  return {
    text: parsed["answer"].trim(),
    citations: citations.map((citation, index) => {
      if (!isRecord(citation) || typeof citation["evidenceId"] !== "string" || citation["evidenceId"].trim().length === 0) {
        throw new Error(`Grounded Ask citation ${String(index + 1)} is missing evidenceId`);
      }
      const label = citation["label"];
      return {
        label: typeof label === "string" && label.trim().length > 0 ? label.trim() : `[${String(index + 1)}]`,
        evidenceId: citation["evidenceId"].trim(),
      };
    }),
  };
}

function systemPrompt(): string {
  return [
    "Answer only from the supplied Evidence JSON.",
    "Return strict JSON with this shape: {\"answer\":\"...\",\"citations\":[{\"label\":\"[1]\",\"evidenceId\":\"...\"}]}",
    "Every factual claim must cite an evidenceId present in the supplied Evidence. Do not invent ids.",
    "If the Evidence cannot support an answer, fail rather than using outside knowledge.",
  ].join("\n");
}

function stripJsonFence(value: string): string {
  const match = /^```(?:json)?\s*([\s\S]*?)\s*```$/iu.exec(value);
  return match?.[1] ?? value;
}

function nonEmpty(value: string, label: string): string {
  const normalized = value.trim();
  if (normalized.length === 0) throw new TypeError(`${label} must be non-empty`);
  return normalized;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
