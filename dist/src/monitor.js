import { randomUUID, createHmac, timingSafeEqual } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { buildPostCommentPrompt, buildPostCommentRequestBody, } from "./post-events.js";
import { sendTextAmiko } from "./send.js";
import { createReplyPrefixOptions } from "./reply-prefix.js";
/**
 * Build a per-conversation session key that does not depend on the global
 * `session.dmScope` setting.  Format mirrors the SDK convention:
 *
 *   agent:{agentId}:amiko:{kind}:{conversationId}
 *
 * This ensures every Amiko conversation (DM or group) gets its own isolated
 * session regardless of how the user configures dmScope.
 */
function hasVisitorAgent(config) {
    const cfg = config;
    const list = cfg?.agents?.list;
    if (!Array.isArray(list))
        return false;
    return list.some((entry) => entry?.id === "visitor");
}
function buildAmikoSessionKey(agentId, kind, id) {
    if (kind === "visitor") {
        return `agent:${agentId}:amiko:visitor:${id}`.toLowerCase();
    }
    // Always use "group" kind so openclaw's group tool policy applies to all
    // amiko sessions (direct, group, post). The actual conversation type is
    // conveyed via ConversationLabel / ChatType metadata instead.
    return `agent:${agentId}:amiko:group:${id}`.toLowerCase();
}
function verifyHmacSignature(secret, body, signature) {
    const expected = createHmac("sha256", secret)
        .update(typeof body === "string" ? body : body)
        .digest("hex");
    const expectedBuf = Buffer.from(`sha256=${expected}`, "utf8");
    const actualBuf = Buffer.from(signature, "utf8");
    if (expectedBuf.length !== actualBuf.length)
        return false;
    return timingSafeEqual(expectedBuf, actualBuf);
}
function buildAmikoSessionSystemPrompt(account, event) {
    const lines = [
        "Amiko channel context:",
        `- Channel account: ${account.accountId}`,
        `- Twin ID: ${account.twinId}`,
    ];
    if (event.ownerId) {
        lines.push(`- Owner ID: ${event.ownerId}`);
    }
    if (event.conversationType) {
        lines.push(`- Conversation type: ${event.conversationType}`);
    }
    lines.push("- IMPORTANT: Reply by returning your message text directly. Do NOT use the message tool or send action to reply — your text output will be delivered automatically.");
    return lines.join("\n");
}
function buildAmikoReplyContext(event, opts) {
    const replyMode = event.replyMode ?? "as_owner";
    const isVisitor = event.conversationType === "visitor";
    const lines = [
        "Amiko reply context:",
        `- Reply mode: ${replyMode}`,
    ];
    if (isVisitor) {
        lines.push(`- This is a visitor chat: an unauthenticated visitor is messaging${event.ownerName ? ` ${event.ownerName}` : " the owner"} from a public profile page.`, "- You are replying as the agent persona representing the owner.", "- Be friendly and helpful. Answer questions about the owner using the visitor-facing prompt below as your authoritative context.", "- If a question is outside that context, politely say you don't have that information rather than inventing details.");
        if (event.sharedAccountPrompt?.trim()) {
            lines.push(`- Visitor-facing prompt:\n${event.sharedAccountPrompt.trim()}`);
        }
    }
    else if (replyMode === "as_owner") {
        lines.push(`- You are replying on behalf of the owner${event.ownerName ? `, ${event.ownerName}` : ""}.`, `- Write as the owner in first person. Do not describe yourself as an AI, assistant, or proxy unless the owner explicitly wants that.`);
        if (event.sharedAccountPrompt?.trim()) {
            lines.push(`- Shared account prompt: ${event.sharedAccountPrompt.trim()}`);
        }
    }
    else {
        lines.push("- You are replying as the twin/agent identity, not as the owner.", "- Write as that persona directly in first person.");
    }
    if (event.senderName || event.senderId) {
        lines.push(`- Incoming sender: ${event.senderName || event.senderId}`);
    }
    if (event.senderIsAgent) {
        const rounds = opts?.agentRoundCount ?? 0;
        lines.push("- NOTE: This message was sent by the other party's AI agent, not a human.");
        if (rounds <= 3) {
            lines.push("- To avoid an endless back-and-forth loop between agents, only reply if your response adds genuine value (e.g. answers a question, provides requested info). If the conversation has reached a natural pause or the exchange is purely pleasantries, respond with <empty-response/> to skip.");
        }
        else {
            lines.push(`- WARNING: This conversation has had ${rounds} consecutive agent-to-agent exchanges with no human participation.`, "- You MUST wrap up the conversation quickly to avoid a loop. Keep your reply to one short sentence at most, or respond with <empty-response/> to stop. Do not ask new questions or introduce new topics. Wait for a human to join before continuing further.");
        }
    }
    return lines.join("\n");
}
// ── Consecutive agent-round tracker (loop prevention) ──────────────────────
// Tracks how many consecutive messages from agents (no human in between) have
// been seen per conversation.  Reset to 0 when a human message arrives.
const agentRoundCounters = new Map();
function trackAgentRound(conversationId, senderIsAgent) {
    if (!senderIsAgent) {
        agentRoundCounters.delete(conversationId);
        return 0;
    }
    const prev = agentRoundCounters.get(conversationId) ?? 0;
    const next = prev + 1;
    agentRoundCounters.set(conversationId, next);
    return next;
}
const SESSION_TRANSCRIPT_VERSION = 3;
function buildTranscriptEntryId() {
    return randomUUID().replace(/-/g, "").slice(0, 8);
}
function resolveWorkspaceDirFromStorePath(storePath) {
    const stateDir = path.resolve(path.dirname(storePath), "..", "..", "..");
    return path.join(stateDir, "workspace");
}
function buildSessionHeader(sessionId, storePath) {
    return {
        type: "session",
        version: SESSION_TRANSCRIPT_VERSION,
        id: sessionId,
        timestamp: new Date().toISOString(),
        cwd: resolveWorkspaceDirFromStorePath(storePath),
    };
}
function resolveTranscriptRole(event) {
    if (event.transcriptRoleHint === "user" || event.transcriptRoleHint === "assistant") {
        return event.transcriptRoleHint;
    }
    if (event.replyMode === "as_owner" &&
        event.ownerId?.trim() &&
        event.senderId?.trim() &&
        event.ownerId.trim() === event.senderId.trim()) {
        return "assistant";
    }
    return "user";
}
function parseSessionStoreEntry(store, sessionKey) {
    const normalizedKey = sessionKey.trim().toLowerCase();
    if (!normalizedKey)
        return undefined;
    if (store[normalizedKey])
        return store[normalizedKey];
    for (const [candidateKey, candidateEntry] of Object.entries(store)) {
        if (candidateKey.toLowerCase() === normalizedKey)
            return candidateEntry;
    }
    return undefined;
}
function readTranscriptState(rawTranscript, idempotencyKey) {
    let lastEntryId;
    let hasIdempotencyKey = false;
    for (const line of rawTranscript.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed)
            continue;
        try {
            const entry = JSON.parse(trimmed);
            if (typeof entry.id === "string" && entry.id.trim()) {
                lastEntryId = entry.id;
            }
            if (idempotencyKey &&
                typeof entry.message?.idempotencyKey === "string" &&
                entry.message.idempotencyKey === idempotencyKey) {
                hasIdempotencyKey = true;
            }
        }
        catch {
            continue;
        }
    }
    return { hasIdempotencyKey, lastEntryId };
}
async function appendContextMessageToTranscript(params) {
    const { account, storePath, sessionKey, eventId, eventTimestamp, transcriptRole, rawBody, senderName, senderId } = params;
    const readStore = async () => {
        const raw = await fs.readFile(storePath, "utf8");
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === "object" ? parsed : {};
    };
    let store;
    try {
        store = await readStore();
    }
    catch (err) {
        console.error(`[amiko:${account.accountId}] failed to read session store for transcript append:`, err);
        return;
    }
    let sessionEntry = parseSessionStoreEntry(store, sessionKey);
    let sessionId = sessionEntry?.sessionId?.trim();
    // After a fresh recordInboundSession the store file may not be flushed yet.
    // Retry with increasing delays to handle the first-create race.
    if (!sessionId) {
        for (const delayMs of [200, 500, 1000, 2000]) {
            await new Promise((r) => setTimeout(r, delayMs));
            try {
                store = await readStore();
                sessionEntry = parseSessionStoreEntry(store, sessionKey);
                sessionId = sessionEntry?.sessionId?.trim();
                if (sessionId)
                    break;
            }
            catch { /* ignore retry failure */ }
        }
    }
    if (!sessionId) {
        console.warn(`[amiko:${account.accountId}] transcript append skipped: missing sessionId for ${sessionKey}`);
        return;
    }
    const sessionFile = sessionEntry?.sessionFile?.trim()
        || path.join(path.dirname(storePath), `${sessionId}.jsonl`);
    // Build sender metadata blocks matching SDK format so the UI can identify the sender.
    const metadataBlocks = [];
    if (senderName || senderId) {
        const senderLabel = senderName
            ? (senderId ? `${senderName} (${senderId})` : senderName)
            : senderId;
        const senderInfo = {
            label: senderLabel,
            id: senderId,
            name: senderName,
        };
        metadataBlocks.push(`Sender (untrusted metadata):\n\`\`\`json\n${JSON.stringify(senderInfo, null, 2)}\n\`\`\``);
    }
    const bodyText = rawBody || "[non-text message]";
    const text = metadataBlocks.length > 0
        ? `${metadataBlocks.join("\n\n")}\n\n${bodyText}`
        : bodyText;
    const idempotencyKey = eventId?.trim() ? `amiko:${eventId.trim()}` : undefined;
    let rawTranscript = "";
    try {
        rawTranscript = await fs.readFile(sessionFile, "utf8");
    }
    catch (err) {
        const code = err && typeof err === "object" && "code" in err ? String(err.code) : "";
        if (code !== "ENOENT") {
            console.error(`[amiko:${account.accountId}] failed to read transcript ${sessionFile}:`, err);
            return;
        }
    }
    const transcriptState = readTranscriptState(rawTranscript, idempotencyKey);
    if (transcriptState.hasIdempotencyKey) {
        console.log(`[amiko:${account.accountId}] transcript append deduped: sessionKey=${sessionKey} eventId=${eventId ?? "unknown"}`);
        return;
    }
    if (!rawTranscript) {
        await fs.mkdir(path.dirname(sessionFile), { recursive: true });
        await fs.writeFile(sessionFile, `${JSON.stringify(buildSessionHeader(sessionId, storePath))}\n`, { encoding: "utf8", mode: 0o600 });
        rawTranscript = "";
    }
    const entry = {
        type: "message",
        id: buildTranscriptEntryId(),
        parentId: transcriptState.lastEntryId ?? null,
        timestamp: new Date().toISOString(),
        message: {
            role: transcriptRole,
            content: [{ type: "text", text }],
            timestamp: eventTimestamp,
            metadata: { source: transcriptRole === "assistant" ? "owner" : "peer", channel: "amiko" },
            ...(idempotencyKey ? { idempotencyKey } : {}),
            ...(transcriptRole === "assistant"
                ? {
                    api: "openai-responses",
                    provider: "openclaw",
                    model: "amiko-context-mirror",
                    usage: {
                        input: 0,
                        output: 0,
                        cacheRead: 0,
                        cacheWrite: 0,
                        totalTokens: 0,
                        cost: {
                            input: 0,
                            output: 0,
                            cacheRead: 0,
                            cacheWrite: 0,
                            total: 0,
                        },
                    },
                    stopReason: "stop",
                }
                : {}),
        },
    };
    await fs.appendFile(sessionFile, `${JSON.stringify(entry)}\n`, {
        encoding: "utf8",
        mode: 0o600,
    });
    console.log(`[amiko:${account.accountId}] context appended to transcript: sessionKey=${sessionKey} role=${transcriptRole} sessionFile=${sessionFile}`);
}
async function persistContextOnlyMessage(params) {
    const { account, core, storePath, sessionKey, ctxPayload, rawBody, eventId, eventTimestamp, transcriptRole, senderName, senderId } = params;
    await core.channel.session.recordInboundSession({
        storePath,
        sessionKey,
        ctx: ctxPayload,
        onRecordError: (err) => {
            console.error(`[amiko:${account.accountId}] recordInboundSession error:`, err);
        },
    });
    await appendContextMessageToTranscript({
        account,
        storePath,
        sessionKey,
        eventId,
        eventTimestamp,
        transcriptRole,
        rawBody,
        senderName,
        senderId,
    });
}
// ── Chat message processing ─────────────────────────────────────────────────
async function processChatEvent(event, options) {
    const { account, runtime: core, config } = options;
    const replyExpected = event.replyExpected !== false;
    const replyMode = event.replyMode ?? "as_owner";
    console.log(`[amiko:${account.accountId}] processChatEvent: convId=${event.conversationId} convType=${event.conversationType} sender=${event.senderName} replyExpected=${replyExpected} replyMode=${replyMode}`);
    const isGroup = event.conversationType === "group";
    const isVisitor = event.conversationType === "visitor";
    const conversationId = event.conversationId?.trim();
    if (!conversationId) {
        console.error(`[amiko:${account.accountId}] processChatEvent: missing conversationId, skipping`);
        return;
    }
    // Use "group" kind for all chat peers so openclaw's group tool policy applies
    // to DM, group, and visitor conversations (restricting exec, readFile, etc.).
    // The session key still distinguishes the conversation kind via
    // buildAmikoSessionKey.
    const peer = { kind: "group", id: conversationId };
    // Visitor conversations route to a dedicated "visitor" agent when it exists in
    // the gateway config. This isolates visitor sessions from the owner's
    // workspace (memory, tokens, skills) so an unauthenticated visitor cannot
    // read or exfiltrate private context via prompt injection. If no visitor
    // agent is configured, fall back to standard routing — the operator must
    // provision one before exposing visitor chat. See
    // amiko-platform/amiko-web/scripts/clawds/provision-visitor-agent.ts.
    const route = isVisitor && hasVisitorAgent(config)
        ? {
            agentId: "visitor",
            accountId: account.accountId,
            sessionKey: `agent:visitor:amiko:visitor:${conversationId}`.toLowerCase(),
        }
        : core.channel.routing.resolveAgentRoute({
            cfg: config,
            channel: "amiko",
            accountId: account.accountId,
            peer,
        });
    const chatKind = isVisitor
        ? "visitor"
        : isGroup
            ? "group"
            : "direct";
    const sessionKey = buildAmikoSessionKey(route.agentId, chatKind, conversationId);
    const storePath = core.channel.session.resolveStorePath(config.session?.store, { agentId: route.agentId });
    const rawBody = event.text?.trim() ?? "";
    const agentRoundCount = trackAgentRound(conversationId, !!event.senderIsAgent);
    const sessionSystemPrompt = buildAmikoSessionSystemPrompt(account, event);
    const roleContext = buildAmikoReplyContext(event, { agentRoundCount });
    const agentBody = `${roleContext}\n\nIncoming message:\n${rawBody}`.trim();
    const fromLabel = event.conversationTitle
        || (isGroup ? `group:${conversationId}` : (event.senderName || `user:${event.senderId}`));
    const previousTimestamp = core.channel.session.readSessionUpdatedAt({
        storePath,
        sessionKey,
    });
    const body = core.channel.reply.formatAgentEnvelope({
        channel: "Amiko",
        from: fromLabel,
        timestamp: event.timestamp,
        previousTimestamp,
        envelope: core.channel.reply.resolveEnvelopeFormatOptions(config),
        body: agentBody,
    });
    const ctxPayload = core.channel.reply.finalizeInboundContext({
        Body: body,
        BodyForAgent: agentBody,
        RawBody: rawBody,
        CommandBody: rawBody,
        From: isGroup ? `amiko:group:${conversationId}` : `amiko:${event.senderId}`,
        To: `amiko:${conversationId}`,
        SessionKey: sessionKey,
        AccountId: route.accountId,
        ChatType: isGroup ? "group" : "direct",
        ConversationLabel: fromLabel,
        GroupSystemPrompt: sessionSystemPrompt,
        SenderName: event.senderName || undefined,
        SenderId: event.senderId,
        Provider: "amiko",
        Surface: "amiko",
        MessageSid: event.id,
        OriginatingChannel: "amiko",
        OriginatingTo: `amiko:${conversationId}`,
    });
    // ── Detect owner's own messages: always context-only as assistant ──────────
    const isOwnerMessage = event.ownerId?.trim() &&
        event.senderId?.trim() &&
        event.ownerId.trim() === event.senderId.trim();
    // ── replyExpected: false OR owner's own message → persist context only ─────
    if (!replyExpected || isOwnerMessage) {
        const transcriptRole = isOwnerMessage ? "assistant" : resolveTranscriptRole(event);
        console.log(`[amiko:${account.accountId}] recording context only (no reply): role=${transcriptRole} isOwner=${!!isOwnerMessage} ${rawBody.slice(0, 100)}`);
        await persistContextOnlyMessage({
            account,
            core,
            storePath,
            sessionKey,
            ctxPayload,
            rawBody: body,
            eventId: event.id,
            eventTimestamp: event.timestamp,
            transcriptRole,
            senderName: event.senderName,
            senderId: event.senderId,
        });
        return;
    }
    // ── replyExpected: true → full agent dispatch ──────────────────────────────
    await core.channel.session.recordInboundSession({
        storePath,
        sessionKey,
        ctx: ctxPayload,
        onRecordError: (err) => {
            console.error(`[amiko:${account.accountId}] recordInboundSession error:`, err);
        },
    });
    const { onModelSelected, ...prefixOptions } = createReplyPrefixOptions({
        cfg: config,
        agentId: route.agentId,
        channel: "amiko",
        accountId: account.accountId,
    });
    console.log(`[amiko:${account.accountId}] dispatching reply: sessionKey=${sessionKey} replyMode=${replyMode}`);
    await core.channel.reply.dispatchReplyWithBufferedBlockDispatcher({
        ctx: ctxPayload,
        cfg: config,
        dispatcherOptions: {
            ...prefixOptions,
            deliver: async (payload) => {
                if (!payload.text)
                    return;
                const text = payload.text.trim();
                if (text === "<empty-response/>" || text.includes("<empty-response/>")) {
                    console.log(`[amiko:${account.accountId}] agent skipped reply for ${conversationId}`);
                    return;
                }
                console.log(`[amiko:${account.accountId}] delivering reply (${replyMode}) to ${conversationId}: ${text.slice(0, 100)}`);
                const result = await sendTextAmiko(conversationId, text, account, { replyMode });
                if (!result.ok) {
                    console.error(`[amiko:${account.accountId}] sendTextAmiko failed:`, result);
                }
                else {
                    console.log(`[amiko:${account.accountId}] reply delivered ok: messageId=${result.messageId}`);
                }
            },
            onError: (err, info) => {
                console.error(`[amiko:${account.accountId}] ${info.kind} reply error:`, err);
            },
        },
        replyOptions: {
            onModelSelected,
        },
    });
}
// ── Post comment processing ─────────────────────────────────────────────────
async function processPostEvent(event, options) {
    const { account, runtime: core, config } = options;
    const postId = (event.postId ?? event.id)?.trim();
    const authorName = event.authorName ?? event.senderName ?? "Someone";
    const content = event.text?.trim() ?? "";
    const selfAuthored = event.selfAuthored === true;
    console.log(`[amiko:${account.accountId}] processPostEvent: postId=${postId} author=${authorName} selfAuthored=${selfAuthored}`);
    if (!postId) {
        console.error(`[amiko:${account.accountId}] processPostEvent: missing postId, skipping`);
        return;
    }
    if (!content)
        return;
    const peer = { kind: "group", id: `post:${postId}` };
    const route = core.channel.routing.resolveAgentRoute({
        cfg: config,
        channel: "amiko",
        accountId: account.accountId,
        peer,
    });
    const sessionKey = buildAmikoSessionKey(route.agentId, "post", postId);
    const storePath = core.channel.session.resolveStorePath(config.session?.store, { agentId: route.agentId });
    // Self-authored post: record as context-only to seed the session, no agent reply.
    if (selfAuthored) {
        const contextMessage = `You published a new post on Amiko:\n\n"${content}"`;
        const ctxPayload = core.channel.reply.finalizeInboundContext({
            Body: contextMessage,
            BodyForAgent: contextMessage,
            RawBody: contextMessage,
            CommandBody: contextMessage,
            From: `amiko:post:${postId}`,
            To: `amiko:${account.accountId}`,
            SessionKey: sessionKey,
            AccountId: route.accountId,
            ChatType: "group",
            ConversationLabel: `post by ${authorName}`,
            Provider: "amiko",
            Surface: "amiko",
            MessageSid: event.id,
            OriginatingChannel: "amiko",
            OriginatingTo: `amiko:post:${postId}`,
        });
        // Create the session first so transcript append has a valid sessionId.
        await core.channel.session.recordInboundSession({
            storePath,
            sessionKey,
            ctx: ctxPayload,
            onRecordError: (err) => {
                console.error(`[amiko:${account.accountId}] recordInboundSession error (self-post):`, err);
            },
        });
        await persistContextOnlyMessage({
            account,
            core,
            storePath,
            sessionKey,
            ctxPayload,
            rawBody: contextMessage,
            eventId: event.id,
            eventTimestamp: event.timestamp,
            transcriptRole: "assistant",
            senderName: authorName,
            senderId: event.authorId ?? event.senderId,
        });
        console.log(`[amiko:${account.accountId}] self-authored post recorded as context: postId=${postId}`);
        return;
    }
    // Friend's post: agent decides whether to comment.
    const prompt = buildPostCommentPrompt({
        authorName,
        content,
        autoCommentSource: event.autoCommentSource,
    });
    const ctxPayload = core.channel.reply.finalizeInboundContext({
        Body: prompt,
        BodyForAgent: prompt,
        RawBody: prompt,
        CommandBody: prompt,
        From: `amiko:post:${postId}`,
        To: `amiko:${account.accountId}`,
        SessionKey: sessionKey,
        AccountId: route.accountId,
        ChatType: "group",
        ConversationLabel: `post by ${authorName}`,
        SenderName: authorName,
        SenderId: event.authorId ?? event.senderId,
        Provider: "amiko",
        Surface: "amiko",
        MessageSid: event.id,
        OriginatingChannel: "amiko",
        OriginatingTo: `amiko:post:${postId}`,
    });
    await core.channel.session.recordInboundSession({
        storePath,
        sessionKey,
        ctx: ctxPayload,
        onRecordError: (err) => {
            console.error(`[amiko:${account.accountId}] recordInboundSession error (post):`, err);
        },
    });
    const { onModelSelected, ...prefixOptions } = createReplyPrefixOptions({
        cfg: config,
        agentId: route.agentId,
        channel: "amiko",
        accountId: account.accountId,
    });
    console.log(`[amiko:${account.accountId}] dispatching post comment: sessionKey=${sessionKey}`);
    await core.channel.reply.dispatchReplyWithBufferedBlockDispatcher({
        ctx: ctxPayload,
        cfg: config,
        dispatcherOptions: {
            ...prefixOptions,
            deliver: async (payload) => {
                if (!payload.text)
                    return;
                const text = payload.text.trim();
                // Agent chose not to comment
                if (text === "<empty-response/>" || text.includes("<empty-response/>")) {
                    console.log(`[amiko:${account.accountId}] agent skipped post comment for ${postId}`);
                    return;
                }
                // Post comment via amiko-new API
                const commentUrl = `${account.platformApiBaseUrl}/api/posts/${postId}/comments`;
                console.log(`[amiko:${account.accountId}] posting comment on ${postId}: ${text.slice(0, 100)}`);
                try {
                    const res = await fetch(commentUrl, {
                        method: "POST",
                        headers: {
                            Authorization: `Bearer ${account.token}`,
                            "Content-Type": "application/json",
                        },
                        body: JSON.stringify(buildPostCommentRequestBody(text, event.autoCommentSource)),
                    });
                    if (!res.ok) {
                        const errText = await res.text().catch(() => "");
                        console.error(`[amiko:${account.accountId}] comment POST failed: ${res.status} ${errText.slice(0, 200)}`);
                    }
                    else {
                        const data = (await res.json());
                        console.log(`[amiko:${account.accountId}] comment posted ok: ${data.comment?.id ?? "unknown"}`);
                    }
                }
                catch (err) {
                    console.error(`[amiko:${account.accountId}] comment POST error:`, err);
                }
            },
            onError: (err, info) => {
                console.error(`[amiko:${account.accountId}] ${info.kind} post reply error:`, err);
            },
        },
        replyOptions: {
            onModelSelected,
        },
    });
}
async function processPostCommentEvent(event, options) {
    const { account, runtime: core, config } = options;
    const postId = (event.postId ?? event.id)?.trim();
    const commentId = (event.commentId ?? event.id)?.trim();
    const commenterName = event.senderName ?? event.authorName ?? "Someone";
    const content = event.text?.trim() ?? "";
    console.log(`[amiko:${account.accountId}] processPostCommentEvent: postId=${postId} commentId=${commentId} commenter=${commenterName}`);
    if (!postId) {
        console.error(`[amiko:${account.accountId}] processPostCommentEvent: missing postId, skipping`);
        return;
    }
    if (!content)
        return;
    const peer = { kind: "group", id: `post:${postId}` };
    const route = core.channel.routing.resolveAgentRoute({
        cfg: config,
        channel: "amiko",
        accountId: account.accountId,
        peer,
    });
    // Same session as the parent post — all comments on a post share context.
    const sessionKey = buildAmikoSessionKey(route.agentId, "post", postId);
    const contextMessage = `${commenterName} commented on the post:\n\n"${content}"`;
    const storePath = core.channel.session.resolveStorePath(config.session?.store, { agentId: route.agentId });
    const ctxPayload = core.channel.reply.finalizeInboundContext({
        Body: contextMessage,
        BodyForAgent: contextMessage,
        RawBody: contextMessage,
        CommandBody: contextMessage,
        From: `amiko:post:${postId}:comment:${commentId}`,
        To: `amiko:${account.accountId}`,
        SessionKey: sessionKey,
        AccountId: route.accountId,
        ChatType: "group",
        ConversationLabel: `comment by ${commenterName} on post ${postId}`,
        Provider: "amiko",
        Surface: "amiko",
        MessageSid: event.id,
        OriginatingChannel: "amiko",
        OriginatingTo: `amiko:post:${postId}:comment:${commentId}`,
    });
    // Record as context-only — no agent reply for now.
    await core.channel.session.recordInboundSession({
        storePath,
        sessionKey,
        ctx: ctxPayload,
        onRecordError: (err) => {
            console.error(`[amiko:${account.accountId}] recordInboundSession error (post comment):`, err);
        },
    });
    await persistContextOnlyMessage({
        account,
        core,
        storePath,
        sessionKey,
        ctxPayload,
        rawBody: contextMessage,
        eventId: event.id,
        eventTimestamp: event.timestamp,
        transcriptRole: "user",
        senderName: commenterName,
        senderId: event.senderId,
    });
    console.log(`[amiko:${account.accountId}] post-comment recorded as context: postId=${postId} commentId=${commentId}`);
}
// ── Comment moderation processing ──────────────────────────────────────────
async function processCommentModerationEvent(event, options) {
    const { account, runtime: core, config } = options;
    const postId = event.postId?.trim();
    const commentId = event.commentId?.trim();
    const decision = event.type === "comment.approved" ? "approved" : "rejected";
    console.log(`[amiko:${account.accountId}] processCommentModerationEvent: postId=${postId} commentId=${commentId} decision=${decision}`);
    if (!postId || !commentId) {
        console.error(`[amiko:${account.accountId}] comment moderation: missing postId or commentId, skipping`);
        return;
    }
    const peer = { kind: "group", id: `post:${postId}` };
    const route = core.channel.routing.resolveAgentRoute({
        cfg: config,
        channel: "amiko",
        accountId: account.accountId,
        peer,
    });
    // Same session as the parent post — moderation results share context.
    const sessionKey = buildAmikoSessionKey(route.agentId, "post", postId);
    const storePath = core.channel.session.resolveStorePath(config.session?.store, { agentId: route.agentId });
    const commentPreview = event.text?.trim().slice(0, 200) ?? "";
    const contextMessage = decision === "approved"
        ? `Your draft comment on post ${postId} was approved and published:\n"${commentPreview}"`
        : `Your draft comment on post ${postId} was rejected by the owner:\n"${commentPreview}"`;
    const ctxPayload = core.channel.reply.finalizeInboundContext({
        Body: contextMessage,
        BodyForAgent: contextMessage,
        RawBody: contextMessage,
        CommandBody: contextMessage,
        From: `amiko:post:${postId}:moderation`,
        To: `amiko:${account.accountId}`,
        SessionKey: sessionKey,
        AccountId: route.accountId,
        ChatType: "group",
        ConversationLabel: `comment ${decision} on post ${postId}`,
        Provider: "amiko",
        Surface: "amiko",
        MessageSid: event.id,
        OriginatingChannel: "amiko",
        OriginatingTo: `amiko:post:${postId}`,
    });
    await persistContextOnlyMessage({
        account,
        core,
        storePath,
        sessionKey,
        ctxPayload,
        rawBody: contextMessage,
        eventId: event.id,
        eventTimestamp: event.timestamp,
        transcriptRole: "user",
        senderName: "System",
        senderId: undefined,
    });
    console.log(`[amiko:${account.accountId}] comment moderation recorded: ${decision} commentId=${commentId}`);
}
// ── Inbox event processing ──────────────────────────────────────────────────
/**
 * Build the fixed session key for the per-account inbox.
 * All platform events for an account land in one shared session so the main
 * agent can read a single place for recent platform activity.
 */
function buildInboxSessionKey(agentId) {
    return `agent:${agentId}:amiko:inbox`;
}
async function processInboxEvent(event, options) {
    const { account, runtime: core, config } = options;
    // Use a fixed peer to resolve the agent route (inbox is not a real conversation).
    const peer = { kind: "group", id: `inbox:${account.accountId}` };
    const route = core.channel.routing.resolveAgentRoute({
        cfg: config,
        channel: "amiko",
        accountId: account.accountId,
        peer,
    });
    const sessionKey = buildInboxSessionKey(route.agentId);
    const storePath = core.channel.session.resolveStorePath(config.session?.store, { agentId: route.agentId });
    const bodyText = event.text?.trim() ?? "";
    const ctxPayload = core.channel.reply.finalizeInboundContext({
        Body: bodyText,
        BodyForAgent: bodyText,
        RawBody: bodyText,
        CommandBody: bodyText,
        From: `amiko:platform:${event.type}`,
        To: `amiko:${account.accountId}:inbox`,
        SessionKey: sessionKey,
        AccountId: route.accountId,
        ChatType: "direct",
        ConversationLabel: `Platform Inbox (${account.accountId})`,
        Provider: "amiko",
        Surface: "amiko",
        MessageSid: event.id,
        OriginatingChannel: "amiko",
        OriginatingTo: `amiko:${account.accountId}:inbox`,
    });
    await persistContextOnlyMessage({
        account,
        core,
        storePath,
        sessionKey,
        ctxPayload,
        rawBody: bodyText,
        eventId: event.id,
        eventTimestamp: event.timestamp,
        transcriptRole: "user",
        senderName: "Platform",
        senderId: undefined,
    });
    console.log(`[amiko:${account.accountId}] inbox event recorded: type=${event.type} eventId=${event.id} sessionKey=${sessionKey}`);
}
// ── Event dispatcher ────────────────────────────────────────────────────────
async function processEvent(event, options) {
    if (event.type === "post.published") {
        return processPostEvent(event, options);
    }
    if (event.type === "post.comment") {
        return processPostCommentEvent(event, options);
    }
    if (event.type === "comment.approved" || event.type === "comment.rejected") {
        return processCommentModerationEvent(event, options);
    }
    if (event.type === "message.text" || event.type === "message.image") {
        return processChatEvent(event, options);
    }
    if (event.type === "platform.notification") {
        return processInboxEvent(event, options);
    }
    console.log(`[amiko:${options.account.accountId}] ignoring event type: ${event.type}`);
}
// ── Webhook monitor ─────────────────────────────────────────────────────────
export async function monitorAmikoProvider(options) {
    const { account, statusSink } = options;
    const webhookPath = account.config.webhookPath ?? `/amiko/webhook/${account.twinId}`;
    const webhookSecret = account.config.webhookSecret;
    const handler = async (req, res) => {
        const sendJson = (statusCode, body) => {
            const json = JSON.stringify(body);
            res.statusCode = statusCode;
            res.setHeader("Content-Type", "application/json");
            res.setHeader("Content-Length", Buffer.byteLength(json));
            res.end(json);
        };
        if ((req.method ?? "POST").toUpperCase() !== "POST") {
            sendJson(405, { error: "method not allowed" });
            return;
        }
        const rawBody = await new Promise((resolve, reject) => {
            const chunks = [];
            req.on("data", (chunk) => chunks.push(chunk));
            req.on("end", () => resolve(Buffer.concat(chunks)));
            req.on("error", reject);
        });
        if (webhookSecret) {
            const sig = req.headers["x-amiko-signature"];
            if (!sig) {
                sendJson(401, { error: "missing signature" });
                return;
            }
            if (!verifyHmacSignature(webhookSecret, rawBody, sig)) {
                sendJson(401, { error: "invalid signature" });
                return;
            }
        }
        let payload;
        try {
            payload = JSON.parse(rawBody.toString("utf8"));
        }
        catch {
            sendJson(400, { error: "invalid JSON" });
            return;
        }
        const event = payload?.event;
        if (!event?.id || !event?.type) {
            sendJson(400, { error: "missing event" });
            return;
        }
        sendJson(200, { ok: true });
        try {
            await processEvent(event, options);
            statusSink({ accountId: account.accountId, status: "healthy" });
        }
        catch (err) {
            console.error(`[amiko:${account.accountId}] Error processing event ${event.id}:`, err);
            statusSink({ accountId: account.accountId, status: "unhealthy", message: String(err) });
        }
    };
    statusSink({ accountId: account.accountId, status: "healthy" });
    return {
        webhookPath,
        handler,
        stop: () => { },
    };
}
//# sourceMappingURL=monitor.js.map