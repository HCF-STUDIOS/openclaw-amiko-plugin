import type { ResolvedAmikoAccount } from "./types.js";
export type ProbeResult = {
    status: "healthy" | "unhealthy" | "unconfigured";
    message?: string;
    latencyMs?: number;
};
export type AccountSnapshot = {
    accountId: string;
    twinId: string;
    name?: string;
    enabled: boolean;
    configured: boolean;
    platformApiBaseUrl: string;
    chatApiBaseUrl: string;
};
export declare function probeAmikoAccount(account: ResolvedAmikoAccount): Promise<ProbeResult>;
export declare function buildAmikoAccountSnapshot(account: ResolvedAmikoAccount): AccountSnapshot;
export declare function inspectAmikoAccount(account: ResolvedAmikoAccount): Record<string, unknown>;
//# sourceMappingURL=status.d.ts.map