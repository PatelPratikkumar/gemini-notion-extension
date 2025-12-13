import { z } from 'zod';
export declare const NotionConfigSchema: z.ZodObject<{
    apiKey: z.ZodString;
    conversationDatabaseId: z.ZodString;
    projectDatabaseId: z.ZodString;
    workspaceId: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    apiKey: string;
    conversationDatabaseId: string;
    projectDatabaseId: string;
    workspaceId?: string | undefined;
}, {
    apiKey: string;
    conversationDatabaseId: string;
    projectDatabaseId: string;
    workspaceId?: string | undefined;
}>;
export type NotionConfig = z.infer<typeof NotionConfigSchema>;
export interface Config {
    notion: NotionConfig;
}
export interface DatabaseCache {
    conversationDbId: string;
    projectDbId: string;
    lastUpdated: string;
}
export interface EnvironmentVariables {
    NOTION_API_KEY: string;
    NOTION_CONVERSATION_DB?: string;
    NOTION_PROJECT_DB?: string;
    NOTION_WORKSPACE_ID?: string;
}
//# sourceMappingURL=config.d.ts.map