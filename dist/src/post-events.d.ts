import type { AutoCommentSource } from "./types.js";
export declare function buildPostCommentPrompt(params: {
    authorName: string;
    content: string;
    autoCommentSource?: AutoCommentSource;
}): string;
export declare function buildPostCommentRequestBody(text: string, autoCommentSource?: AutoCommentSource): {
    comment: string;
    auto_comment_source: AutoCommentSource;
} | {
    comment: string;
    auto_comment_source?: undefined;
};
//# sourceMappingURL=post-events.d.ts.map