import test from "node:test";
import assert from "node:assert/strict";

const { AUTO_COMMENT_MODEL, withAutoCommentModelOverride } = await import(
  new URL("./auto-comment-model.ts", import.meta.url).href,
);

test("AUTO_COMMENT_MODEL pins the cheap OpenRouter model", () => {
  assert.equal(AUTO_COMMENT_MODEL, "openrouter/openai/gpt-5-nano");
});

test("withAutoCommentModelOverride replaces agents.defaults.model (string form)", () => {
  const cfg = {
    agents: {
      defaults: { model: "openrouter/google/gemini-3.1-flash-lite" },
      list: [],
    },
  };
  const out = withAutoCommentModelOverride(cfg, "amiko-default");
  assert.equal(out.agents.defaults.model, "openrouter/openai/gpt-5-nano");
  assert.equal(cfg.agents.defaults.model, "openrouter/google/gemini-3.1-flash-lite");
});

test("withAutoCommentModelOverride replaces agents.defaults.model.primary (object form) and clears fallbacks", () => {
  const cfg = {
    agents: {
      defaults: {
        model: {
          primary: "openrouter/google/gemini-3.1-flash-lite",
          fallbacks: ["openrouter/anthropic/claude-sonnet-4.5"],
        },
      },
      list: [],
    },
  };
  const out = withAutoCommentModelOverride(cfg, "amiko-default");
  assert.deepEqual(out.agents.defaults.model, {
    primary: "openrouter/openai/gpt-5-nano",
    fallbacks: [],
  });
  assert.deepEqual(cfg.agents.defaults.model, {
    primary: "openrouter/google/gemini-3.1-flash-lite",
    fallbacks: ["openrouter/anthropic/claude-sonnet-4.5"],
  });
});

test("withAutoCommentModelOverride also overrides the matched per-agent entry", () => {
  const cfg = {
    agents: {
      defaults: { model: "openrouter/google/gemini-3.1-flash-lite" },
      list: [
        { id: "amiko-default", model: "openrouter/google/gemini-3.1-flash-lite" },
        { id: "other-agent", model: "openrouter/anthropic/claude-sonnet-4.5" },
      ],
    },
  };
  const out = withAutoCommentModelOverride(cfg, "amiko-default");
  assert.equal(out.agents.list[0].model, "openrouter/openai/gpt-5-nano");
  assert.equal(out.agents.list[1].model, "openrouter/anthropic/claude-sonnet-4.5");
});

test("withAutoCommentModelOverride leaves list entries untouched when agentId does not match", () => {
  const cfg = {
    agents: {
      defaults: { model: "openrouter/google/gemini-3.1-flash-lite" },
      list: [
        { id: "agent-a", model: "openrouter/google/gemini-3.1-flash-lite" },
        { id: "agent-b", model: "openrouter/anthropic/claude-sonnet-4.5" },
      ],
    },
  };
  const out = withAutoCommentModelOverride(cfg, "no-match");
  assert.equal(out.agents.list[0].model, "openrouter/google/gemini-3.1-flash-lite");
  assert.equal(out.agents.list[1].model, "openrouter/anthropic/claude-sonnet-4.5");
  assert.equal(out.agents.defaults.model, "openrouter/openai/gpt-5-nano");
});

test("withAutoCommentModelOverride leaves cfg shape valid when agents is missing", () => {
  const cfg = {};
  const out = withAutoCommentModelOverride(cfg, "amiko-default");
  assert.equal(out.agents.defaults.model, "openrouter/openai/gpt-5-nano");
});
