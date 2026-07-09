---
name: create
description: Real media generation tools (image, video, TTS, SFX, music) exposed to this agent via an amiko MCP server, plus the rule against fabricating capabilities
metadata: {"openclaw":{"emoji":"🎨"}}
---

# Create Skill

You have five real media generation tools: `create_image`, `create_video`, `create_tts`, `create_sfx`, `create_music`. They are MCP tools, served by an amiko MCP server your agent connects to, not an external CLI and not something you shell out to.

In your tool list they appear under a per-agent namespaced prefix (the server id includes your agent id, since the auth header carries your own token), something like `mcp__amiko-create-<agentId>__create_image`. This doc refers to them by their base function name, use whatever exact namespaced name shows up in your own tool list.

## THE RULE: never fabricate a capability

If you do not have a tool for what the user asks, say so plainly. **NEVER invent a command, tool, job id, cost, or status.** NEVER claim media is "generating" or "processing" unless a real `create_*` tool actually returned a job id. If a `create_*` tool returns an error, relay the real reason to the user, do not blame your own syntax or silently retry.

## The tools

- **create_image**: generates an image. Args: `prompt`, plus optional `model`, `size`.
- **create_video**: generates a video. Args: optional motion `prompt`, optional `firstFrameImage` (image URL), plus optional `model`, `resolution`, `seconds`, `aspectRatio`. **Default model is I2V** (`MiniMax-Hailuo-2.3-Fast`): you **must** pass `firstFrameImage` (and may add a motion `prompt`). For **prompt-only** (T2V) video, pass a T2V-capable `model` such as `MiniMax-Hailuo-02` or `MiniMax-Hailuo-2.3` (do **not** use Fast alone without a first frame; the server rejects it).
- **create_tts**: generates spoken audio from text. Args: `prompt`, plus optional `model`, `voiceId`.
- **create_sfx**: generates a sound effect. Args: `prompt`, plus optional `durationSeconds`.
- **create_music**: generates a music track. Args: `prompt` and/or `lyrics`, plus optional `model`, `durationMs`, `isInstrumental`.

Defaults for optional args are applied server-side. Image, TTS, SFX, and music usually need only `prompt`. Video is different: under the default I2V model, pass `firstFrameImage`; for prompt-only video, also pass a T2V-capable `model`.

## How generation works

Calling a `create_*` tool is **asynchronous and charged only on success**. The tool call returns a job id, and a placeholder appears in the chat right away; it resolves into playable media once generation finishes, or into an error if it fails. A generation that fails is never billed.

## When the tools can't do it

If the user wants media beyond what these five tools support, tell them to use the web Create Studio at platform.heyamiko.com/create.
