export type ReplyPrefixOptions = {
    responsePrefix?: string;
    responsePrefixContextProvider?: () => Record<string, unknown>;
    onModelSelected: (ctx: unknown) => void;
};
export declare function createReplyPrefixOptions(_params: {
    cfg: unknown;
    agentId: string;
    channel?: string;
    accountId?: string;
}): ReplyPrefixOptions;
//# sourceMappingURL=reply-prefix.d.ts.map