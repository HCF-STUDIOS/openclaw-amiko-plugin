import { normalizeAgentId } from "openclaw/plugin-sdk";

export const AUTO_COMMENT_MODEL = "openrouter/openai/gpt-5-nano";
// gpt-5-nano is a reasoning model; cap thinking to minimal so the visible reply isn't starved by hidden reasoning tokens
export const AUTO_COMMENT_THINKING = "minimal";

export { isAutoCommentSource } from "./types.js";

type ModelField = string | { primary?: string; fallbacks?: string[] } | undefined;
type AgentsDefaults = { model?: ModelField; thinkingDefault?: string; [k: string]: unknown };
type AgentsList = Array<{ id?: string; model?: ModelField; thinkingDefault?: string; [k: string]: unknown }>;
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
  const targetId = normalizeAgentId(agentId);

  return {
    ...cfg,
    agents: {
      ...agents,
      defaults: {
        ...forceAutoCommentModel(defaults),
        thinkingDefault: AUTO_COMMENT_THINKING,
      },
      list: list.map((entry) =>
        normalizeAgentId(entry.id ?? "") === targetId
          ? {
              ...forceAutoCommentModel(entry),
              thinkingDefault: AUTO_COMMENT_THINKING,
            }
          : entry,
      ),
    },
  };
}
