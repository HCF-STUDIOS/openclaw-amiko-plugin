import { randomUUID } from "node:crypto";
import { sendAmikoOutbound, AmikoApiError } from "./api.js";
export async function sendTextAmiko(conversationId, text, account, options) {
    const idempotencyKey = `${account.twinId}:${conversationId}:${randomUUID()}`;
    try {
        const res = await sendAmikoOutbound({ chatApiBaseUrl: account.chatApiBaseUrl, token: account.token, timeoutMs: 30_000 }, {
            accountId: account.twinId,
            conversationId,
            idempotencyKey,
            type: "text",
            text,
            replyMode: options?.replyMode,
        });
        if (!res.ok) {
            return { ok: false, retriable: res.retriable ?? false, error: res.error ?? "Unknown error" };
        }
        return { ok: true, messageId: res.messageId };
    }
    catch (err) {
        if (err instanceof AmikoApiError) {
            return { ok: false, retriable: err.retriable, error: err.message };
        }
        return { ok: false, retriable: false, error: String(err) };
    }
}
export async function sendMediaAmiko(conversationId, text, mediaUrl, mediaCaption, account, options) {
    const idempotencyKey = `${account.twinId}:${conversationId}:${randomUUID()}`;
    try {
        const res = await sendAmikoOutbound({ chatApiBaseUrl: account.chatApiBaseUrl, token: account.token, timeoutMs: 30_000 }, {
            accountId: account.twinId,
            conversationId,
            idempotencyKey,
            type: "media",
            text,
            mediaUrl,
            mediaCaption,
            replyMode: options?.replyMode,
        });
        if (!res.ok) {
            return { ok: false, retriable: res.retriable ?? false, error: res.error ?? "Unknown error" };
        }
        return { ok: true, messageId: res.messageId };
    }
    catch (err) {
        if (err instanceof AmikoApiError) {
            return { ok: false, retriable: err.retriable, error: err.message };
        }
        return { ok: false, retriable: false, error: String(err) };
    }
}
//# sourceMappingURL=send.js.map