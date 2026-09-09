export const KNOWLEDGE_OPERATIONS = [
  "capabilities.get",
  "workspace.echo",
  "viewer.sources.list",
  "viewer.source.get",
  "viewer.artifact.open",
] as const;

export type KnowledgeOperation = (typeof KNOWLEDGE_OPERATIONS)[number];

const KNOWLEDGE_OPERATION_SET: ReadonlySet<string> = new Set(KNOWLEDGE_OPERATIONS);

export function isKnowledgeOperation(value: string): value is KnowledgeOperation {
  return KNOWLEDGE_OPERATION_SET.has(value);
}
