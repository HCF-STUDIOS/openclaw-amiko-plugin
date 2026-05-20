export const AUTO_COMMENT_MODEL = "openrouter/openai/gpt-5-nano";

type ModelField = string | { primary?: string; fallbacks?: string[] } | undefined;
type AgentsDefaults = { model?: ModelField; [k: string]: unknown };
type AgentsList = Array<{ id?: string; model?: ModelField; [k: string]: unknown }>;
type OpenClawConfig = {
  agents?: { defaults?: AgentsDefaults; list?: AgentsList; [k: string]: unknown };
  [k: string]: unknown;
};

function forceAutoCommentModel<T extends { model?: unknown }>(entry: T): T {
  const current = entry.model;
  if (current && typeof current === "object") {
    return {
      ...entry,
      model: { primary: AUTO_COMMENT_MODEL, fallbacks: [] },
    };
  }
  return { ...entry, model: AUTO_COMMENT_MODEL };
}

export function withAutoCommentModelOverride(
  cfg: OpenClawConfig,
  agentId: string,
): OpenClawConfig {
  const agents = cfg.agents ?? {};
  const defaults: AgentsDefaults = (agents.defaults ?? {}) as AgentsDefaults;
  const list: AgentsList = (agents.list ?? []) as AgentsList;

  return {
    ...cfg,
    agents: {
      ...agents,
      defaults: forceAutoCommentModel(defaults),
      list: list.map((entry) =>
        entry.id === agentId ? forceAutoCommentModel(entry) : entry,
      ),
    },
  };
}
