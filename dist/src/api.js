export class AmikoApiError extends Error {
    statusCode;
    retriable;
    constructor(message, statusCode, retriable) {
        super(message);
        this.statusCode = statusCode;
        this.retriable = retriable;
        this.name = "AmikoApiError";
    }
}
async function apiRequest(method, url, options, body) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), options.timeoutMs ?? 10_000);
    try {
        const res = await fetch(url, {
            method,
            headers: {
                Authorization: `Bearer ${options.token}`,
                "Content-Type": "application/json",
                Accept: "application/json",
            },
            body: body !== undefined ? JSON.stringify(body) : undefined,
            signal: controller.signal,
        });
        if (!res.ok) {
            const text = await res.text().catch(() => "");
            const retriable = res.status === 429 || res.status >= 500;
            throw new AmikoApiError(`HTTP ${res.status}: ${text}`, res.status, retriable);
        }
        if (res.status === 204)
            return undefined;
        return res.json();
    }
    finally {
        clearTimeout(timeoutId);
    }
}
export async function sendAmikoOutbound(options, payload) {
    const url = `${options.chatApiBaseUrl}/api/internal/openclaw/amiko/messages`;
    console.log(`[amiko:api] sendAmikoOutbound POST ${url} conversationId=${payload.conversationId}`);
    const result = await apiRequest("POST", url, options, payload);
    console.log(`[amiko:api] sendAmikoOutbound response:`, result);
    return result;
}
//# sourceMappingURL=api.js.map