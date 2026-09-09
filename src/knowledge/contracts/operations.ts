export const KNOWLEDGE_OPERATIONS = [
  "capabilities.get",
  "workspace.echo",
  "viewer.sources.list",
  "viewer.source.get",
  "viewer.artifact.open",
] as const;

export type KnowledgeOperation = (typeof KNOWLEDGE_OPERATIONS)[number];

export function isKnowledgeOperation(value: string): value is KnowledgeOperation {
  return (KNOWLEDGE_OPERATIONS as readonly string[]).includes(value);
}
