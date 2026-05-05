import type { ResolvedAmikoAccount } from "./types.js";
export declare const amikoPlugin: {
    id: string;
    meta: {
        id: string;
        label: string;
        selectionLabel: string;
        docsPath: string;
        blurb: string;
        order: number;
    };
    capabilities: {
        chatTypes: readonly ["direct", "group"];
        media: boolean;
        reactions: boolean;
        threads: boolean;
        polls: boolean;
        nativeCommands: boolean;
        blockStreaming: boolean;
    };
    reload: {
        configPrefixes: string[];
    };
    configSchema: import("zod").ZodObject<{
        name: import("zod").ZodOptional<import("zod").ZodString>;
        enabled: import("zod").ZodOptional<import("zod").ZodBoolean>;
        twinId: import("zod").ZodOptional<import("zod").ZodString>;
        token: import("zod").ZodOptional<import("zod").ZodString>;
        platformApiBaseUrl: import("zod").ZodOptional<import("zod").ZodString>;
        chatApiBaseUrl: import("zod").ZodOptional<import("zod").ZodString>;
        apiBaseUrl: import("zod").ZodOptional<import("zod").ZodString>;
        webhookPath: import("zod").ZodOptional<import("zod").ZodString>;
        webhookSecret: import("zod").ZodOptional<import("zod").ZodString>;
    } & {
        accounts: import("zod").ZodOptional<import("zod").ZodRecord<import("zod").ZodString, import("zod").ZodObject<{
            name: import("zod").ZodOptional<import("zod").ZodString>;
            enabled: import("zod").ZodOptional<import("zod").ZodBoolean>;
            twinId: import("zod").ZodOptional<import("zod").ZodString>;
            token: import("zod").ZodOptional<import("zod").ZodString>;
            platformApiBaseUrl: import("zod").ZodOptional<import("zod").ZodString>;
            chatApiBaseUrl: import("zod").ZodOptional<import("zod").ZodString>;
            apiBaseUrl: import("zod").ZodOptional<import("zod").ZodString>;
            webhookPath: import("zod").ZodOptional<import("zod").ZodString>;
            webhookSecret: import("zod").ZodOptional<import("zod").ZodString>;
        }, "strip", import("zod").ZodTypeAny, {
            name?: string;
            enabled?: boolean;
            twinId?: string;
            token?: string;
            platformApiBaseUrl?: string;
            chatApiBaseUrl?: string;
            apiBaseUrl?: string;
            webhookPath?: string;
            webhookSecret?: string;
        }, {
            name?: string;
            enabled?: boolean;
            twinId?: string;
            token?: string;
            platformApiBaseUrl?: string;
            chatApiBaseUrl?: string;
            apiBaseUrl?: string;
            webhookPath?: string;
            webhookSecret?: string;
        }>>>;
        defaultAccount: import("zod").ZodOptional<import("zod").ZodString>;
    }, "strip", import("zod").ZodTypeAny, {
        name?: string;
        enabled?: boolean;
        twinId?: string;
        token?: string;
        platformApiBaseUrl?: string;
        chatApiBaseUrl?: string;
        apiBaseUrl?: string;
        webhookPath?: string;
        webhookSecret?: string;
        accounts?: Record<string, {
            name?: string;
            enabled?: boolean;
            twinId?: string;
            token?: string;
            platformApiBaseUrl?: string;
            chatApiBaseUrl?: string;
            apiBaseUrl?: string;
            webhookPath?: string;
            webhookSecret?: string;
        }>;
        defaultAccount?: string;
    }, {
        name?: string;
        enabled?: boolean;
        twinId?: string;
        token?: string;
        platformApiBaseUrl?: string;
        chatApiBaseUrl?: string;
        apiBaseUrl?: string;
        webhookPath?: string;
        webhookSecret?: string;
        accounts?: Record<string, {
            name?: string;
            enabled?: boolean;
            twinId?: string;
            token?: string;
            platformApiBaseUrl?: string;
            chatApiBaseUrl?: string;
            apiBaseUrl?: string;
            webhookPath?: string;
            webhookSecret?: string;
        }>;
        defaultAccount?: string;
    }>;
    config: {
        listAccountIds(cfg: unknown): string[];
        resolveAccount(cfg: unknown, accountId: string): ResolvedAmikoAccount;
        defaultAccountId(cfg: unknown): string;
        isConfigured(account: ResolvedAmikoAccount): boolean;
        describeAccount(account: ResolvedAmikoAccount): import("./status.js").AccountSnapshot;
        inspectAccount(cfg: unknown, accountId: string): Record<string, unknown>;
    };
    security: {
        resolveDmPolicy(_params: {
            account: ResolvedAmikoAccount;
        }): {
            policy: "open";
            allowFrom: string[];
            allowFromPath: string;
            approveHint: string;
            normalizeEntry: (e: string) => string;
        };
    };
    groups: {
        resolveRequireMention(): boolean;
        resolveToolPolicy(): {
            allow: string[];
        };
    };
    outbound: {
        deliveryMode: "direct";
        textChunkLimit: number;
        chunkerMode: "markdown";
        resolveTarget({ to }: {
            to?: string;
            cfg?: unknown;
            allowFrom?: string[];
            accountId?: string | null;
            mode?: string;
        }): {
            ok: false;
            error: Error;
            to?: undefined;
        } | {
            ok: true;
            to: string;
            error?: undefined;
        };
        sendText({ to, text, account }: {
            to: string;
            text: string;
            account: ResolvedAmikoAccount;
            cfg: unknown;
            accountId: string;
        }): Promise<import("./types.js").AmikoSendResult>;
        sendMedia({ to, text, mediaUrl, account }: {
            to: string;
            text: string;
            mediaUrl: string;
            cfg: unknown;
            accountId: string;
            account: ResolvedAmikoAccount;
        }): Promise<import("./types.js").AmikoSendResult>;
    };
    status: {
        probeAccount({ account }: {
            account: ResolvedAmikoAccount;
        }): Promise<import("./status.js").ProbeResult>;
        buildAccountSnapshot({ account }: {
            account: ResolvedAmikoAccount;
            runtime: unknown;
        }): import("./status.js").AccountSnapshot;
    };
    gateway: {
        startAccount(ctx: {
            account: ResolvedAmikoAccount;
            accountId: string;
            cfg: unknown;
            runtime: any;
            abortSignal: AbortSignal;
            setStatus: (patch: any) => void;
        }): Promise<void>;
    };
};
//# sourceMappingURL=channel.d.ts.map