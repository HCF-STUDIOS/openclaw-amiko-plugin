declare const _default: {
    id: string;
    name: string;
    description: string;
    configSchema: {};
    register(api: {
        runtime: any;
        config?: any;
        registerChannel: (params: {
            plugin: any;
        }) => void;
        registerHttpRoute?: (params: any) => void;
        registerHttpHandler?: (handler: (req: any, res: any) => boolean | Promise<boolean>) => void;
    }): void;
};
export default _default;
export { amikoPlugin } from "./src/channel.js";
export { setAmikoRuntime, getAmikoRuntime } from "./src/runtime.js";
export type { ResolvedAmikoAccount, AmikoConfig, AmikoAccountConfig } from "./src/types.js";
//# sourceMappingURL=index.d.ts.map