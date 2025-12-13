import type { BlockObjectRequest } from '@notionhq/client/build/src/api-endpoints';
export interface NotionPage {
    id: string;
    url: string;
    properties: Record<string, any>;
    createdTime: string;
    lastEditedTime: string;
}
export interface NotionDatabase {
    id: string;
    title: Array<{
        plain_text: string;
    }>;
    properties: Record<string, any>;
}
export type NotionBlock = BlockObjectRequest;
export declare function createRichText(content: string, bold?: boolean, italic?: boolean): {
    type: "text";
    text: {
        content: string;
    };
    annotations: {
        bold: boolean;
        italic: boolean;
        strikethrough: boolean;
        underline: boolean;
        code: boolean;
        color: "default";
    };
};
export declare function createParagraph(content: string): NotionBlock;
export declare function createHeading(content: string, level?: 1 | 2 | 3): NotionBlock;
export declare function createCodeBlock(code: string, language?: string): NotionBlock;
export declare function createDivider(): NotionBlock;
//# sourceMappingURL=notion.d.ts.map