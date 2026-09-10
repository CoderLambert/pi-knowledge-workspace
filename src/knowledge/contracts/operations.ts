export const KNOWLEDGE_OPERATIONS = [
  "capabilities.get",
  "workspace.echo",
  "viewer.sources.list",
  "viewer.source.get",
  "viewer.artifact.open",
  "knowledge.import.submit",
  "knowledge.import.status",
  "knowledge.publish",
  "knowledge.ask",
  "knowledge.answer.get",
  "knowledge.answers.list",
  "knowledge.citation.open",
] as const;

export const GROUNDED_ASK_OPERATIONS = [
  "knowledge.ask",
  "knowledge.answer.get",
  "knowledge.answers.list",
  "knowledge.citation.open",
] as const;

export const KNOWLEDGE_IMPORT_OPERATIONS = [
  "knowledge.import.submit",
  "knowledge.import.status",
] as const;

export const KNOWLEDGE_PUBLISH_OPERATIONS = ["knowledge.publish"] as const;

export const KNOWLEDGE_VIEWER_OPERATIONS = [
  "viewer.sources.list",
  "viewer.source.get",
  "viewer.artifact.open",
] as const;

export type KnowledgeOperation = (typeof KNOWLEDGE_OPERATIONS)[number];

const KNOWLEDGE_OPERATION_SET: ReadonlySet<string> = new Set(KNOWLEDGE_OPERATIONS);

export function isKnowledgeOperation(value: string): value is KnowledgeOperation {
  return KNOWLEDGE_OPERATION_SET.has(value);
}
