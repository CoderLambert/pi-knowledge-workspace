export const KNOWLEDGE_OPERATIONS = ["capabilities.get", "workspace.echo"] as const;

export type KnowledgeOperation = (typeof KNOWLEDGE_OPERATIONS)[number];

export function isKnowledgeOperation(value: string): value is KnowledgeOperation {
  return value === "capabilities.get" || value === "workspace.echo";
}
