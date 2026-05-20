import test from "node:test";
import assert from "node:assert/strict";

const { processPostEvent } = await import(
  new URL("./monitor.ts", import.meta.url).href,
);

type Captured = { cfg: unknown };

function buildHarness() {
  const captured: Captured[] = [];

  const config = {
    agents: {
      defaults: { model: "openrouter/google/gemini-3.1-flash-lite" },
      list: [
        { id: "amiko-default", model: "openrouter/google/gemini-3.1-flash-lite" },
      ],
    },
  };

  const runtime = {
    channel: {
      reply: {
        finalizeInboundContext: (params: unknown) => params,
        dispatchReplyWithBufferedBlockDispatcher: async (params: {
          ctx: unknown;
          cfg: unknown;
        }) => {
          captured.push({ cfg: params.cfg });
        },
        formatAgentEnvelope: () => "envelope",
        resolveEnvelopeFormatOptions: () => ({}),
      },
      session: {
        recordInboundSession: async () => undefined,
        resolveStorePath: (_store: unknown, _params: { agentId: string }) =>
          "/tmp/test-store.json",
        readSessionUpdatedAt: () => undefined,
      },
      routing: {
        resolveAgentRoute: (_params: unknown) => ({
          agentId: "amiko-default",
          accountId: "amiko-default",
          sessionKey: "test-session-key",
        }),
      },
    },
  };

  const account = {
    accountId: "amiko-default",
    twinId: "twin-1",
    enabled: true,
    token: "test-token",
    platformApiBaseUrl: "https://example.test",
    chatApiBaseUrl: "https://example.test",
    config: {},
  };

  return { captured, config, runtime, account };
}

function buildEvent(overrides: Record<string, unknown> = {}) {
  return {
    id: "evt-1",
    type: "post.published" as const,
    accountId: "amiko-default",
    conversationId: "conv-1",
    conversationType: "group" as const,
    senderId: "author-1",
    senderName: "Avery",
    authorId: "author-1",
    authorName: "Avery",
    authorHandle: "avery",
    timestamp: Date.now(),
    text: "Spent all night prototyping.",
    postId: "post-1",
    selfAuthored: false,
    mediaUrls: [],
    ...overrides,
  };
}

test("post.published with autoCommentSource='friend' dispatches with the cheap model", async () => {
  const { captured, config, runtime, account } = buildHarness();

  await processPostEvent(buildEvent({ autoCommentSource: "friend" }), {
    account,
    config,
    runtime,
  });

  assert.equal(captured.length, 1);
  const cfg = captured[0].cfg as {
    agents: { defaults: { model: string }; list: Array<{ model: string }> };
  };
  assert.equal(cfg.agents.defaults.model, "openrouter/openai/gpt-5-nano");
  assert.equal(cfg.agents.list[0].model, "openrouter/openai/gpt-5-nano");
});

test("post.published with autoCommentSource='related_tags' dispatches with the cheap model", async () => {
  const { captured, config, runtime, account } = buildHarness();

  await processPostEvent(
    buildEvent({ autoCommentSource: "related_tags" }),
    { account, config, runtime },
  );

  assert.equal(captured.length, 1);
  const cfg = captured[0].cfg as {
    agents: { defaults: { model: string }; list: Array<{ model: string }> };
  };
  assert.equal(cfg.agents.defaults.model, "openrouter/openai/gpt-5-nano");
  assert.equal(cfg.agents.list[0].model, "openrouter/openai/gpt-5-nano");
});

test("post.published without autoCommentSource keeps the configured model", async () => {
  const { captured, config, runtime, account } = buildHarness();

  await processPostEvent(buildEvent({}), {
    account,
    config,
    runtime,
  });

  assert.equal(captured.length, 1, "dispatch should be called");
  const cfg = captured[0].cfg as {
    agents: { defaults: { model: string } };
  };
  assert.equal(cfg.agents.defaults.model, "openrouter/google/gemini-3.1-flash-lite");
});
