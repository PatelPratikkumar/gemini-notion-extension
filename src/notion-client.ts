// Notion API client wrapper with authentication and error handling
import { Client } from '@notionhq/client';
import type {
  QueryDatabaseParameters,
  CreatePageParameters,
  UpdatePageParameters,
  AppendBlockChildrenParameters,
  SearchParameters,
} from '@notionhq/client/build/src/api-endpoints';
import type { NotionConfig } from './types/config.js';

export class NotionClient {
  private client: Client;
  private config: NotionConfig;

  constructor(config: NotionConfig) {
    this.config = config;
    this.client = new Client({ auth: config.apiKey });
  }

  /**
   * Test connection to Notion API by retrieving user info
   */
  async validateConnection(): Promise<boolean> {
    try {
      await this.client.users.me({});
      return true;
    } catch (error: any) {
      throw new Error(
        `Failed to authenticate with Notion API. Check your API key validity. ${error.message}`
      );
    }
  }

  /**
   * Create a new page in a database
   */
  async createPage(params: CreatePageParameters) {
    try {
      const response = await this.client.pages.create(params);
      return response;
    } catch (error: any) {
      throw new Error(`Failed to create page: ${error.message}`);
    }
  }

  /**
   * Update an existing page
   */
  async updatePage(params: UpdatePageParameters) {
    try {
      const response = await this.client.pages.update(params);
      return response;
    } catch (error: any) {
      throw new Error(`Failed to update page: ${error.message}`);
    }
  }

  /**
   * Retrieve a page by ID
   */
  async getPage(pageId: string) {
    try {
      const response = await this.client.pages.retrieve({ page_id: pageId });
      return response;
    } catch (error: any) {
      throw new Error(`Failed to retrieve page: ${error.message}`);
    }
  }

  /**
   * Query a database with filters and sorts
   */
  async queryDatabase(params: QueryDatabaseParameters) {
    try {
      const response = await this.client.databases.query(params);
      return response;
    } catch (error: any) {
      throw new Error(`Failed to query database: ${error.message}`);
    }
  }

  /**
   * Retrieve database info
   */
  async getDatabase(databaseId: string) {
    try {
      const response = await this.client.databases.retrieve({ database_id: databaseId });
      return response;
    } catch (error: any) {
      throw new Error(`Failed to retrieve database: ${error.message}`);
    }
  }

  /**
   * Append blocks to a page
   */
  async appendBlocks(params: AppendBlockChildrenParameters) {
    try {
      const response = await this.client.blocks.children.append(params);
      return response;
    } catch (error: any) {
      throw new Error(`Failed to append blocks: ${error.message}`);
    }
  }

  /**
   * Get blocks from a page
   */
  async getBlocks(blockId: string) {
    try {
      const response = await this.client.blocks.children.list({
        block_id: blockId,
        page_size: 100,
      });
      return response;
    } catch (error: any) {
      throw new Error(`Failed to retrieve blocks: ${error.message}`);
    }
  }

  /**
   * Search across workspace
   */
  async search(params: SearchParameters) {
    try {
      const response = await this.client.search(params);
      return response;
    } catch (error: any) {
      throw new Error(`Failed to search: ${error.message}`);
    }
  }

  /**
   * Create a comment on a page or block
   */
  async createComment(params: { parent: { page_id: string }; rich_text: any[] }) {
    try {
      const response = await this.client.comments.create(params);
      return response;
    } catch (error: any) {
      throw new Error(`Failed to create comment: ${error.message}`);
    }
  }

  /**
   * Get conversation database ID from config
   */
  getConversationDatabaseId(): string {
    return this.config.conversationDatabaseId;
  }

  /**
   * Get project database ID from config
   */
  getProjectDatabaseId(): string {
    return this.config.projectDatabaseId;
  }
}

/**
 * Initialize Notion client with validation
 */
export async function initializeNotionClient(config: NotionConfig): Promise<NotionClient> {
  if (!config.apiKey || config.apiKey === 'secret_your_integration_token_here') {
    throw new Error(
      'NOTION_API_KEY environment variable not set. Please add it to .env file.\n' +
      'Get your token from: https://www.notion.so/my-integrations'
    );
  }

  const client = new NotionClient(config);
  
  // Validate connection on initialization
  await client.validateConnection();
  
  return client;
}
