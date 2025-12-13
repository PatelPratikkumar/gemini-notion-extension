import { createRichText, createParagraph, createHeading, createCodeBlock, createDivider, } from '../src/types/notion.js';
export class ConversationManager {
    client;
    constructor(client) {
        this.client = client;
    }
    /**
     * Export a conversation to Notion
     */
    async exportConversation(conversationData, options = {}) {
        try {
            const { messages, metadata } = conversationData;
            const title = options.title || this.generateTitle(messages);
            const tags = options.tags || [];
            // Detect code snippets and languages
            const codeSnippets = this.detectCodeSnippets(messages);
            const languages = [...new Set(codeSnippets.map(s => s.language))];
            // Generate conversation ID
            const conversationId = this.generateConversationId(metadata);
            // Create conversation page in database
            const databaseId = this.client.getConversationDatabaseId();
            const page = await this.client.createPage({
                parent: { database_id: databaseId },
                properties: {
                    title: {
                        title: [createRichText(title)],
                    },
                    'Conversation ID': {
                        rich_text: [createRichText(conversationId)],
                    },
                    'Export Date': {
                        date: { start: new Date().toISOString() },
                    },
                    'Message Count': {
                        number: messages.length,
                    },
                    'Tags': {
                        multi_select: tags.map(tag => ({ name: tag })),
                    },
                    'Code Snippets Present': {
                        checkbox: codeSnippets.length > 0,
                    },
                    'Languages Mentioned': {
                        multi_select: languages.map(lang => ({ name: lang })),
                    },
                },
                children: this.formatConversationBlocks(messages),
            });
            // Link to project if specified
            if (options.projectId) {
                await this.linkToProject(page.id, options.projectId);
            }
            return {
                pageId: page.id,
                url: page.url,
                timestamp: new Date(),
                success: true,
            };
        }
        catch (error) {
            return {
                pageId: '',
                url: '',
                timestamp: new Date(),
                success: false,
                error: error.message,
            };
        }
    }
    /**
     * Generate a title from the first user message
     */
    generateTitle(messages) {
        const firstUserMessage = messages.find(m => m.role === 'user');
        if (!firstUserMessage)
            return 'Gemini Conversation';
        const content = firstUserMessage.content.substring(0, 100);
        return content.length < firstUserMessage.content.length
            ? content + '...'
            : content;
    }
    /**
     * Generate unique conversation ID
     */
    generateConversationId(metadata) {
        const timestamp = metadata.startTime
            ? new Date(metadata.startTime).getTime()
            : Date.now();
        return `conv_${timestamp}_${Math.random().toString(36).substring(7)}`;
    }
    /**
     * Detect code snippets in messages
     */
    detectCodeSnippets(messages) {
        const snippets = [];
        const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
        messages.forEach((message, idx) => {
            let match;
            while ((match = codeBlockRegex.exec(message.content)) !== null) {
                snippets.push({
                    language: match[1] || 'plain text',
                    code: match[2],
                    startIndex: match.index,
                    endIndex: match.index + match[0].length,
                });
            }
        });
        return snippets;
    }
    /**
     * Format conversation messages as Notion blocks
     */
    formatConversationBlocks(messages) {
        const blocks = [];
        messages.forEach((message, index) => {
            // Add role heading
            const roleLabel = message.role === 'user' ? '👤 User' : '🤖 Assistant';
            blocks.push(createHeading(roleLabel, 3));
            // Split content by code blocks
            const parts = this.splitContentByCodeBlocks(message.content);
            parts.forEach(part => {
                if (part.type === 'code') {
                    blocks.push(createCodeBlock(part.content, part.language || 'plain text'));
                }
                else {
                    // Split long text into paragraphs
                    const paragraphs = part.content.split('\n\n').filter(p => p.trim());
                    paragraphs.forEach(para => {
                        if (para.trim()) {
                            blocks.push(createParagraph(para.trim()));
                        }
                    });
                }
            });
            // Add divider between messages (except last)
            if (index < messages.length - 1) {
                blocks.push(createDivider());
            }
        });
        return blocks;
    }
    /**
     * Split content by code blocks
     */
    splitContentByCodeBlocks(content) {
        const parts = [];
        const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
        let lastIndex = 0;
        let match;
        while ((match = codeBlockRegex.exec(content)) !== null) {
            // Add text before code block
            if (match.index > lastIndex) {
                const textContent = content.substring(lastIndex, match.index).trim();
                if (textContent) {
                    parts.push({ type: 'text', content: textContent });
                }
            }
            // Add code block
            parts.push({
                type: 'code',
                content: match[2],
                language: match[1] || 'plain text',
            });
            lastIndex = match.index + match[0].length;
        }
        // Add remaining text
        if (lastIndex < content.length) {
            const textContent = content.substring(lastIndex).trim();
            if (textContent) {
                parts.push({ type: 'text', content: textContent });
            }
        }
        return parts;
    }
    /**
     * Link conversation to project
     */
    async linkToProject(conversationPageId, projectId) {
        await this.client.updatePage({
            page_id: conversationPageId,
            properties: {
                'Associated Project': {
                    relation: [{ id: projectId }],
                },
            },
        });
    }
}
//# sourceMappingURL=conversation-manager.js.map