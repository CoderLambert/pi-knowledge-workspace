import { InMemoryCredentialStore } from "@earendil-works/pi-ai";
import {
  createAgentSession,
  DefaultResourceLoader,
  defineTool,
  ModelRuntime,
  SessionManager,
  SettingsManager,
} from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";

export const RESTRICTED_KNOWLEDGE_TOOL_NAMES = [
  "knowledge_sources",
  "knowledge_search",
  "knowledge_read",
  "submit_answer",
] as const;

const emptyParameters = Type.Object({}, { additionalProperties: false });

function restrictedTool(name: (typeof RESTRICTED_KNOWLEDGE_TOOL_NAMES)[number]) {
  return defineTool({
    name,
    label: name,
    description: `P0 restricted-runtime probe tool: ${name}`,
    parameters: emptyParameters,
    async execute() {
      return {
        content: [{ type: "text" as const, text: `${name}: probe` }],
        details: { probe: true },
      };
    },
  });
}

function createInMemorySettingsManager() {
  let globalSettings: string | undefined;
  let projectSettings: string | undefined;
  return SettingsManager.fromStorage(
    {
      withLock(
        scope: "global" | "project",
        fn: (current: string | undefined) => string | undefined,
      ) {
        const current = scope === "global" ? globalSettings : projectSettings;
        const next = fn(current);
        if (next === undefined) return;
        if (scope === "global") globalSettings = next;
        else projectSettings = next;
      },
    },
    { projectTrusted: false },
  );
}

export interface RestrictedPiRuntimeProbe {
  activeToolNames: string[];
  discoveredResources: {
    extensions: number;
    skills: number;
    prompts: number;
    themes: number;
    agentsFiles: number;
  };
}

export async function createRestrictedPiRuntimeProbe(cwd = process.cwd()): Promise<RestrictedPiRuntimeProbe> {
  const settingsManager = createInMemorySettingsManager();
  const resourceLoader = new DefaultResourceLoader({
    cwd,
    agentDir: cwd,
    settingsManager,
    noExtensions: true,
    noSkills: true,
    noPromptTemplates: true,
    noThemes: true,
    noContextFiles: true,
    systemPrompt: "Restricted Knowledge runtime probe.",
  });
  await resourceLoader.reload();

  const modelRuntime = await ModelRuntime.create({
    credentials: new InMemoryCredentialStore(),
    modelsPath: null,
    refreshOnCreate: false,
    allowModelNetwork: false,
  });

  const customTools = RESTRICTED_KNOWLEDGE_TOOL_NAMES.map(restrictedTool);
  const { session } = await createAgentSession({
    cwd,
    modelRuntime,
    settingsManager,
    sessionManager: SessionManager.inMemory(),
    resourceLoader,
    customTools,
    tools: [...RESTRICTED_KNOWLEDGE_TOOL_NAMES],
  });

  return {
    activeToolNames: session.agent.state.tools.map((tool) => tool.name).sort(),
    discoveredResources: {
      extensions: resourceLoader.getExtensions().extensions.length,
      skills: resourceLoader.getSkills().skills.length,
      prompts: resourceLoader.getPrompts().prompts.length,
      themes: resourceLoader.getThemes().themes.length,
      agentsFiles: resourceLoader.getAgentsFiles().agentsFiles.length,
    },
  };
}
