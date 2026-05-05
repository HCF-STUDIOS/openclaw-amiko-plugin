export type AgentRoute = {
    agentId: string;
    accountId: string;
    sessionKey: string;
};
export type PluginRuntime = {
    channel: {
        reply: {
            finalizeInboundContext(params: unknown): any;
            dispatchReplyWithBufferedBlockDispatcher(params: unknown): Promise<void>;
            formatAgentEnvelope(params: unknown): string;
            resolveEnvelopeFormatOptions(cfg: unknown): unknown;
        };
        session: {
            recordInboundSession(params: {
                storePath: string;
                sessionKey: string;
                ctx: unknown;
                onRecordError: (err: unknown) => void;
            }): Promise<void>;
            resolveStorePath(store: unknown, params: {
                agentId: string;
            }): string;
            readSessionUpdatedAt(params: {
                storePath: string;
                sessionKey: string;
            }): number | undefined;
        };
        routing: {
            resolveAgentRoute(params: {
                cfg: unknown;
                channel: string;
                accountId: string;
                peer: {
                    kind: "direct" | "group";
                    id: string;
                };
            }): AgentRoute;
        };
        chat?: {
            /** Inject a message into a session transcript without triggering agent inference. */
            inject(params: {
                sessionKey: string;
                message: string;
                label?: string;
            }): Promise<{
                ok: boolean;
                messageId?: string;
            }>;
        };
    };
};
export declare function setAmikoRuntime(next: PluginRuntime): void;
export declare function getAmikoRuntime(): PluginRuntime;
export declare function setWebhookDispatcher(path: string, handler: ((req: any, res: any) => Promise<void> | void) | null): void;
export declare function dispatchWebhookRequest(req: any, res: any): Promise<boolean>;
//# sourceMappingURL=runtime.d.ts.map