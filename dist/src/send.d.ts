import type { ResolvedAmikoAccount, AmikoSendResult } from "./types.js";
export declare function sendTextAmiko(conversationId: string, text: string, account: ResolvedAmikoAccount, options?: {
    replyMode?: "as_owner" | "as_agent";
}): Promise<AmikoSendResult>;
export declare function sendMediaAmiko(conversationId: string, text: string, mediaUrl: string, mediaCaption: string | undefined, account: ResolvedAmikoAccount, options?: {
    replyMode?: "as_owner" | "as_agent";
}): Promise<AmikoSendResult>;
//# sourceMappingURL=send.d.ts.map