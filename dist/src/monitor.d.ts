import type { ResolvedAmikoAccount } from "./types.js";
import type { PluginRuntime } from "./runtime.js";
import type { ProbeResult } from "./status.js";
export type MonitorOptions = {
    account: ResolvedAmikoAccount;
    config: unknown;
    runtime: PluginRuntime;
    abortSignal: AbortSignal;
    statusSink: (patch: Partial<ProbeResult> & {
        accountId: string;
    }) => void;
};
export type MonitorHandle = {
    stop: () => void;
    webhookPath: string;
    handler: (req: any, res: any) => Promise<void>;
};
export declare function monitorAmikoProvider(options: MonitorOptions): Promise<MonitorHandle>;
//# sourceMappingURL=monitor.d.ts.map