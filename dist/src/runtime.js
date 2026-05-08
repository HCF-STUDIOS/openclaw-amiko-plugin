let runtime = null;
const webhookDispatchers = new Map();
export function setAmikoRuntime(next) {
    runtime = next;
}
export function getAmikoRuntime() {
    if (!runtime)
        throw new Error("Amiko runtime not initialized");
    return runtime;
}
export function setWebhookDispatcher(path, handler) {
    if (!path)
        return;
    if (!handler) {
        webhookDispatchers.delete(path);
        return;
    }
    webhookDispatchers.set(path, handler);
}
export async function dispatchWebhookRequest(req, res) {
    const pathname = new URL(req.url ?? "/", "http://localhost").pathname;
    const handler = webhookDispatchers.get(pathname);
    if (!handler)
        return false;
    await handler(req, res);
    return true;
}
//# sourceMappingURL=runtime.js.map