import type { AmikoOutboundPayload, AmikoOutboundResponse } from "./types.js";
export type AmikoApiOptions = {
    chatApiBaseUrl: string;
    token: string;
    timeoutMs?: number;
};
export declare class AmikoApiError extends Error {
    readonly statusCode: number;
    readonly retriable: boolean;
    constructor(message: string, statusCode: number, retriable: boolean);
}
export declare function sendAmikoOutbound(options: AmikoApiOptions, payload: AmikoOutboundPayload): Promise<AmikoOutboundResponse>;
//# sourceMappingURL=api.d.ts.map