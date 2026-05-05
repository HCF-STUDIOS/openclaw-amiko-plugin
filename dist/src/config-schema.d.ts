import { z } from "zod";
export declare const AmikoConfigSchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    enabled: z.ZodOptional<z.ZodBoolean>;
    twinId: z.ZodOptional<z.ZodString>;
    token: z.ZodOptional<z.ZodString>;
    platformApiBaseUrl: z.ZodOptional<z.ZodString>;
    chatApiBaseUrl: z.ZodOptional<z.ZodString>;
    apiBaseUrl: z.ZodOptional<z.ZodString>;
    webhookPath: z.ZodOptional<z.ZodString>;
    webhookSecret: z.ZodOptional<z.ZodString>;
} & {
    accounts: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodObject<{
        name: z.ZodOptional<z.ZodString>;
        enabled: z.ZodOptional<z.ZodBoolean>;
        twinId: z.ZodOptional<z.ZodString>;
        token: z.ZodOptional<z.ZodString>;
        platformApiBaseUrl: z.ZodOptional<z.ZodString>;
        chatApiBaseUrl: z.ZodOptional<z.ZodString>;
        apiBaseUrl: z.ZodOptional<z.ZodString>;
        webhookPath: z.ZodOptional<z.ZodString>;
        webhookSecret: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        name?: string;
        enabled?: boolean;
        twinId?: string;
        token?: string;
        platformApiBaseUrl?: string;
        chatApiBaseUrl?: string;
        apiBaseUrl?: string;
        webhookPath?: string;
        webhookSecret?: string;
    }, {
        name?: string;
        enabled?: boolean;
        twinId?: string;
        token?: string;
        platformApiBaseUrl?: string;
        chatApiBaseUrl?: string;
        apiBaseUrl?: string;
        webhookPath?: string;
        webhookSecret?: string;
    }>>>;
    defaultAccount: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    name?: string;
    enabled?: boolean;
    twinId?: string;
    token?: string;
    platformApiBaseUrl?: string;
    chatApiBaseUrl?: string;
    apiBaseUrl?: string;
    webhookPath?: string;
    webhookSecret?: string;
    accounts?: Record<string, {
        name?: string;
        enabled?: boolean;
        twinId?: string;
        token?: string;
        platformApiBaseUrl?: string;
        chatApiBaseUrl?: string;
        apiBaseUrl?: string;
        webhookPath?: string;
        webhookSecret?: string;
    }>;
    defaultAccount?: string;
}, {
    name?: string;
    enabled?: boolean;
    twinId?: string;
    token?: string;
    platformApiBaseUrl?: string;
    chatApiBaseUrl?: string;
    apiBaseUrl?: string;
    webhookPath?: string;
    webhookSecret?: string;
    accounts?: Record<string, {
        name?: string;
        enabled?: boolean;
        twinId?: string;
        token?: string;
        platformApiBaseUrl?: string;
        chatApiBaseUrl?: string;
        apiBaseUrl?: string;
        webhookPath?: string;
        webhookSecret?: string;
    }>;
    defaultAccount?: string;
}>;
export type AmikoConfigInput = z.input<typeof AmikoConfigSchema>;
export type AmikoConfigOutput = z.output<typeof AmikoConfigSchema>;
//# sourceMappingURL=config-schema.d.ts.map