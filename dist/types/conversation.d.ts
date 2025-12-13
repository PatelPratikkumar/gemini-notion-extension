export interface Message {
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: Date;
    metadata?: {
        model?: string;
        tokens?: number;
        [key: string]: any;
    };
}
export interface ConversationData {
    messages: Message[];
    metadata: ConversationMetadata;
}
export interface ConversationMetadata {
    startTime: Date;
    endTime: Date;
    title?: string;
    userId?: string;
    model?: string;
    totalMessages: number;
}
export interface ExportOptions {
    title?: string;
    tags?: string[];
    projectId?: string;
    generateSummary?: boolean;
}
export interface ConversationExportResult {
    pageId: string;
    url: string;
    timestamp: Date;
    success: boolean;
    error?: string;
}
export interface CodeSnippet {
    language: string;
    code: string;
    startIndex: number;
    endIndex: number;
}
//# sourceMappingURL=conversation.d.ts.map