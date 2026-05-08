import type { AmikoConfig, AmikoAccountConfig, ResolvedAmikoAccount } from "./types.js";
export declare const DEFAULT_ACCOUNT_ID = "main";
export declare const DEFAULT_PLATFORM_API_BASE_URL = "https://platform.heyamiko.com";
export declare const DEFAULT_CHAT_API_BASE_URL = "https://api.amiko.app";
export declare function normalizeAccountId(id: string): string;
export declare function listAmikoAccountIds(cfg: {
    channels?: {
        amiko?: AmikoConfig;
    };
}): string[];
export declare function resolveDefaultAmikoAccountId(cfg: {
    channels?: {
        amiko?: AmikoConfig;
    };
}): string;
export declare function resolveAmikoAccountConfig(amiko: AmikoConfig, accountId: string): AmikoAccountConfig;
export declare function resolveAmikoAccount(params: {
    cfg: {
        channels?: {
            amiko?: AmikoConfig;
        };
    };
    accountId: string;
}): ResolvedAmikoAccount;
export declare function listEnabledAmikoAccounts(cfg: {
    channels?: {
        amiko?: AmikoConfig;
    };
}): string[];
//# sourceMappingURL=accounts.d.ts.map