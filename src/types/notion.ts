// Notion-specific type definitions
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
  title: Array<{ plain_text: string }>;
  properties: Record<string, any>;
}

export type NotionBlock = BlockObjectRequest;

// Helper to create rich text
export function createRichText(content: string, bold: boolean = false, italic: boolean = false) {
  return {
    type: 'text' as const,
    text: { content },
    annotations: {
      bold,
      italic,
      strikethrough: false,
      underline: false,
      code: false,
      color: 'default' as const,
    },
  };
}

// Helper to create paragraph block
export function createParagraph(content: string): NotionBlock {
  return {
    object: 'block',
    type: 'paragraph',
    paragraph: {
      rich_text: [createRichText(content)],
    },
  };
}

// Helper to create heading block
export function createHeading(content: string, level: 1 | 2 | 3 = 1): NotionBlock {
  const type = `heading_${level}` as 'heading_1' | 'heading_2' | 'heading_3';
  return {
    object: 'block',
    type,
    [type]: {
      rich_text: [createRichText(content)],
    },
  } as any;
}

// Helper to create code block
export function createCodeBlock(code: string, language: string = 'plain text'): NotionBlock {
  return {
    object: 'block',
    type: 'code',
    code: {
      rich_text: [createRichText(code)],
      language: language as any,
    },
  };
}

// Helper to create divider
export function createDivider(): NotionBlock {
  return {
    object: 'block',
    type: 'divider',
    divider: {},
  };
}
