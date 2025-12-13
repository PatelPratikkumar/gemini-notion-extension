// Configuration and environment types
import { z } from 'zod';

export const NotionConfigSchema = z.object({
  apiKey: z.string().min(1, 'Notion API key is required'),
  conversationDatabaseId: z.string().uuid('Invalid conversation database ID'),
  projectDatabaseId: z.string().uuid('Invalid project database ID'),
  workspaceId: z.string().optional(),
});

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
  NOTION_CONVERSATION_DB?: string; // Optional - can be auto-discovered
  NOTION_PROJECT_DB?: string; // Optional - can be auto-discovered
  NOTION_WORKSPACE_ID?: string;
}
