// Configuration and environment types
import { z } from 'zod';
export const NotionConfigSchema = z.object({
    apiKey: z.string().min(1, 'Notion API key is required'),
    conversationDatabaseId: z.string().uuid('Invalid conversation database ID'),
    projectDatabaseId: z.string().uuid('Invalid project database ID'),
    workspaceId: z.string().optional(),
});
//# sourceMappingURL=config.js.map