import type { NotionClient } from '../notion-client.js';
import type { ConversationData, ExportOptions, ConversationExportResult } from '../types/conversation.js';
export declare class ConversationManager {
    private client;
    constructor(client: NotionClient);
    /**
     * Export a conversation to Notion
     */
    exportConversation(conversationData: ConversationData, options?: ExportOptions): Promise<ConversationExportResult>;
    /**
     * Generate a title from the first user message
     */
    private generateTitle;
    /**
     * Generate unique conversation ID
     */
    private generateConversationId;
    /**
     * Detect code snippets in messages
     */
    private detectCodeSnippets;
    /**
     * Format conversation messages as Notion blocks
     */
    private formatConversationBlocks;
    /**
     * Split content by code blocks
     */
    private splitContentByCodeBlocks;
    /**
     * Link conversation to project
     */
    private linkToProject;
}
//# sourceMappingURL=conversation-manager.d.ts.map