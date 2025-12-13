// Helper to create rich text
export function createRichText(content, bold = false, italic = false) {
    return {
        type: 'text',
        text: { content },
        annotations: {
            bold,
            italic,
            strikethrough: false,
            underline: false,
            code: false,
            color: 'default',
        },
    };
}
// Helper to create paragraph block
export function createParagraph(content) {
    return {
        object: 'block',
        type: 'paragraph',
        paragraph: {
            rich_text: [createRichText(content)],
        },
    };
}
// Helper to create heading block
export function createHeading(content, level = 1) {
    const type = `heading_${level}`;
    return {
        object: 'block',
        type,
        [type]: {
            rich_text: [createRichText(content)],
        },
    };
}
// Helper to create code block
export function createCodeBlock(code, language = 'plain text') {
    return {
        object: 'block',
        type: 'code',
        code: {
            rich_text: [createRichText(code)],
            language: language,
        },
    };
}
// Helper to create divider
export function createDivider() {
    return {
        object: 'block',
        type: 'divider',
        divider: {},
    };
}
//# sourceMappingURL=notion.js.map