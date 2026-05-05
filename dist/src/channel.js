import { AmikoConfigSchema } from "./config-schema.js";
import { listAmikoAccountIds, resolveAmikoAccount, resolveDefaultAmikoAccountId, } from "./accounts.js";
import { sendTextAmiko, sendMediaAmiko } from "./send.js";
import { probeAmikoAccount, buildAmikoAccountSnapshot, inspectAmikoAccount } from "./status.js";
import { getAmikoRuntime, setWebhookDispatcher } from "./runtime.js";
// Local builds use zod v3 while the runtime SDK may use a newer zod type surface.
// Keep this wrapper as a pass-through so the plugin stays buildable across both.
function buildChannelConfigSchema(schema) {
    return schema;
}
const activeRouteUnregisters = new Map();
export const amikoPlugin = {
    id: "amiko",
    meta: {
        id: "amiko",
        label: "Amiko",
        selectionLabel: "Amiko (Webhook)",
        docsPath: "/channels/amiko",
        blurb: "Connect OpenClaw to Amiko platform for direct and group chat via webhook.",
        order: 90,
    },
    capabilities: {
        chatTypes: ["direct", "group"],
        media: true,
        reactions: false,
        threads: false,
        polls: false,
        nativeCommands: false,
        blockStreaming: false,
    },
    reload: {
        configPrefixes: ["channels.amiko"],
    },
    configSchema: buildChannelConfigSchema(AmikoConfigSchema),
    config: {
        listAccountIds(cfg) {
            return listAmikoAccountIds(cfg);
        },
        resolveAccount(cfg, accountId) {
            return resolveAmikoAccount({ cfg: cfg, accountId });
        },
        defaultAccountId(cfg) {
            return resolveDefaultAmikoAccountId(cfg);
        },
        isConfigured(account) {
            return Boolean(account.token?.trim());
        },
        describeAccount(account) {
            return buildAmikoAccountSnapshot(account);
        },
        inspectAccount(cfg, accountId) {
            return inspectAmikoAccount(resolveAmikoAccount({ cfg: cfg, accountId }));
        },
    },
    security: {
        resolveDmPolicy(_params) {
            return {
                policy: "open",
                allowFrom: ["*"],
                allowFromPath: "channels.amiko.accounts",
                approveHint: "DM and group access are controlled by Amiko conversations.",
                normalizeEntry: (e) => e.trim(),
            };
        },
    },
    groups: {
        resolveRequireMention() {
            return true;
        },
        resolveToolPolicy() {
            return {
                allow: ["message", "memory_read"],
            };
        },
    },
    outbound: {
        deliveryMode: "direct",
        textChunkLimit: 4_000,
        chunkerMode: "markdown",
        resolveTarget({ to }) {
            const raw = (to ?? "").trim();
            if (!raw) {
                return { ok: false, error: new Error('Amiko target is required. Use a conversation ID (e.g. "conv-abc123").') };
            }
            // Strip optional "amiko:" prefix that the agent session context adds.
            const stripped = raw.replace(/^amiko:/i, "");
            if (!stripped) {
                return { ok: false, error: new Error(`Invalid Amiko target: "${raw}".`) };
            }
            // Post targets (amiko:post:xxx) cannot be delivered via the chat API.
            if (stripped.startsWith("post:") || stripped.startsWith("post.")) {
                return { ok: false, error: new Error(`Post targets are not supported for outbound messages. Got: "${raw}".`) };
            }
            // What remains should be a bare conversation ID.  Strip a leading
            // "direct:" or "group:" prefix if the agent included one (mirrors the
            // session-key kind segment).
            const conversationId = stripped.replace(/^(direct|group):/, "");
            if (!conversationId) {
                return { ok: false, error: new Error(`Could not extract conversation ID from target: "${raw}".`) };
            }
            return { ok: true, to: conversationId };
        },
        async sendText({ to, text, account }) {
            return sendTextAmiko(to, text, account, { replyMode: "as_owner" });
        },
        async sendMedia({ to, text, mediaUrl, account }) {
            return sendMediaAmiko(to, text, mediaUrl, undefined, account, { replyMode: "as_owner" });
        },
    },
    status: {
        async probeAccount({ account }) {
            return probeAmikoAccount(account);
        },
        buildAccountSnapshot({ account }) {
            return buildAmikoAccountSnapshot(account);
        },
    },
    gateway: {
        async startAccount(ctx) {
            try {
                const runtime = getAmikoRuntime();
                const { monitorAmikoProvider } = await import("./monitor.js");
                const handle = await monitorAmikoProvider({
                    account: ctx.account,
                    config: ctx.cfg,
                    runtime,
                    abortSignal: ctx.abortSignal,
                    statusSink: (patch) => ctx.setStatus({ accountId: ctx.accountId, ...patch }),
                });
                const routeKey = `${ctx.accountId}:${handle.webhookPath}`;
                const prevUnregister = activeRouteUnregisters.get(routeKey);
                if (prevUnregister) {
                    prevUnregister();
                    activeRouteUnregisters.delete(routeKey);
                }
                setWebhookDispatcher(handle.webhookPath, handle.handler);
                activeRouteUnregisters.set(routeKey, () => {
                    setWebhookDispatcher(handle.webhookPath, null);
                });
                let stopped = false;
                const stop = () => {
                    if (stopped)
                        return;
                    stopped = true;
                    const unregister = activeRouteUnregisters.get(routeKey);
                    unregister?.();
                    activeRouteUnregisters.delete(routeKey);
                    handle.stop();
                };
                if (ctx.abortSignal.aborted) {
                    stop();
                    return;
                }
                await new Promise((resolve) => {
                    ctx.abortSignal.addEventListener("abort", () => {
                        stop();
                        resolve();
                    }, { once: true });
                });
            }
            catch (err) {
                console.error(`[amiko:startAccount] FAILED for account=${ctx.accountId}:`, err);
                throw err;
            }
        },
    },
};
//# sourceMappingURL=channel.js.map