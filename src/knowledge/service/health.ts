import {
  PI_KNOWLEDGE_PROTOCOL_VERSION,
  PI_KNOWLEDGE_SERVICE_NAME,
  PI_KNOWLEDGE_SERVICE_VERSION,
} from "../contracts/protocol.js";

export function knowledgeHealth(requestId: string): Record<string, unknown> {
  return {
    ok: true,
    requestId,
    service: PI_KNOWLEDGE_SERVICE_NAME,
    serviceVersion: PI_KNOWLEDGE_SERVICE_VERSION,
    protocolVersion: PI_KNOWLEDGE_PROTOCOL_VERSION,
    status: "healthy",
  };
}
