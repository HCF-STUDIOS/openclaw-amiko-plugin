---
name: create
description: Real media generation tools (image, video, TTS, SFX, music) built into this agent runtime, plus the rule against fabricating capabilities
metadata: {"openclaw":{"emoji":"🎨"}}
---

# Create Skill

You have five real, built-in media generation tools. Use them directly, they are not an external CLI and not an MCP server.

## The tools

- **create_image**: generates an image. Args: `prompt`, plus `model`, `size`.
- **create_video**: generates a video. Args: `prompt`, plus `model`, `resolution`, `seconds`, `aspectRatio`, `firstFrameImage` (pass an image URL to animate or extend it into a video).
- **create_tts**: generates spoken audio from text. Args: `prompt`, plus `model`, `voiceId`.
- **create_sfx**: generates a sound effect. Args: `prompt`, `durationSeconds`.
- **create_music**: generates a music track. Args: `prompt`, `lyrics`, `model`, `durationMs`, `isInstrumental`.

## How generation works

Calling a `create_*` tool is **asynchronous and charged only on success**. The tool posts a placeholder into the chat that resolves into playable media once generation finishes. A generation that fails is never billed.

## THE RULE: never fabricate a capability

If you do not have a tool for what the user asks, say so plainly. **NEVER invent a command, tool, job id, cost, or status.** NEVER claim media is "generating" or "processing" unless a real `create_*` tool actually returned a job id. If a `create_*` tool returns an error, relay the real reason to the user, do not blame your own syntax or silently retry.

## When the tools can't do it

If the user wants media beyond what these five tools support, tell them to use the web Create Studio at platform.heyamiko.com/create.
