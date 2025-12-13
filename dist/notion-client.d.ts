import type { QueryDatabaseParameters, CreatePageParameters, UpdatePageParameters, AppendBlockChildrenParameters, SearchParameters } from '@notionhq/client/build/src/api-endpoints';
import type { NotionConfig } from './types/config.js';
export declare class NotionClient {
    private client;
    private config;
    constructor(config: NotionConfig);
    /**
     * Test connection to Notion API by retrieving user info
     */
    validateConnection(): Promise<boolean>;
    /**
     * Create a new page in a database
     */
    createPage(params: CreatePageParameters): Promise<import("@notionhq/client/build/src/api-endpoints").CreatePageResponse>;
    /**
     * Update an existing page
     */
    updatePage(params: UpdatePageParameters): Promise<import("@notionhq/client/build/src/api-endpoints").UpdatePageResponse>;
    /**
     * Retrieve a page by ID
     */
    getPage(pageId: string): Promise<import("@notionhq/client/build/src/api-endpoints").GetPageResponse>;
    /**
     * Query a database with filters and sorts
     */
    queryDatabase(params: QueryDatabaseParameters): Promise<import("@notionhq/client/build/src/api-endpoints").QueryDatabaseResponse>;
    /**
     * Retrieve database info
     */
    getDatabase(databaseId: string): Promise<import("@notionhq/client/build/src/api-endpoints").GetDatabaseResponse>;
    /**
     * Append blocks to a page
     */
    appendBlocks(params: AppendBlockChildrenParameters): Promise<import("@notionhq/client/build/src/api-endpoints").AppendBlockChildrenResponse>;
    /**
     * Get blocks from a page
     */
    getBlocks(blockId: string): Promise<import("@notionhq/client/build/src/api-endpoints").ListBlockChildrenResponse>;
    /**
     * Search across workspace
     */
    search(params: SearchParameters): Promise<import("@notionhq/client/build/src/api-endpoints").SearchResponse>;
    /**
     * Create a comment on a page or block
     */
    createComment(params: {
        parent: {
            page_id: string;
        };
        rich_text: any[];
    }): Promise<import("@notionhq/client/build/src/api-endpoints").CreateCommentResponse>;
    /**
     * Get conversation database ID from config
     */
    getConversationDatabaseId(): string;
    /**
     * Get project database ID from config
     */
    getProjectDatabaseId(): string;
}
/**
 * Initialize Notion client with validation
 */
export declare function initializeNotionClient(config: NotionConfig): Promise<NotionClient>;
//# sourceMappingURL=notion-client.d.ts.map