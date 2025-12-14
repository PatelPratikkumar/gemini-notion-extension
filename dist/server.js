#!/usr/bin/env node
// Full-featured Notion MCP Server with comprehensive tool support
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema, } from '@modelcontextprotocol/sdk/types.js';
import { Client, APIResponseError } from '@notionhq/client';
import { tools } from './tools.js';
import { getNotionApiKey } from './credentials.js';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
// Get the directory where this script is located
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..');
// Global Notion client
let notion;
let conversationDbId;
let projectDbId;
// ============================================================
// RATE LIMITING & RETRY LOGIC (from research/api_help.md)
// ============================================================
/**
 * Token Bucket Rate Limiter
 * Notion API: 3 requests/second average
 */
class TokenBucket {
    tokens;
    lastRefillTime;
    maxTokens;
    refillRate; // tokens per second
    constructor(maxTokens = 3, refillRate = 3) {
        this.maxTokens = maxTokens;
        this.refillRate = refillRate;
        this.tokens = maxTokens;
        this.lastRefillTime = Date.now();
    }
    async acquireToken() {
        // Refill tokens based on elapsed time
        const now = Date.now();
        const elapsedSeconds = (now - this.lastRefillTime) / 1000;
        this.tokens = Math.min(this.maxTokens, this.tokens + elapsedSeconds * this.refillRate);
        this.lastRefillTime = now;
        if (this.tokens >= 1) {
            this.tokens -= 1;
            return;
        }
        // Wait for token to become available
        const waitTime = ((1 - this.tokens) / this.refillRate) * 1000;
        await sleep(waitTime);
        this.tokens = 0;
        this.lastRefillTime = Date.now();
    }
}
const rateLimiter = new TokenBucket(3, 3);
/**
 * Sleep helper
 */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
/**
 * Execute with retry and exponential backoff
 * Handles 429 (rate limit) and 5xx (server errors)
 */
async function withRetry(operation, maxRetries = 3, operationName = 'API call') {
    let lastError;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            // Acquire rate limit token before each request
            await rateLimiter.acquireToken();
            return await operation();
        }
        catch (error) {
            lastError = error;
            // Check if it's a Notion API error
            if (error instanceof APIResponseError) {
                const status = error.status;
                // Rate limited (429) - wait and retry
                if (status === 429) {
                    // Try to get Retry-After header value, default to exponential backoff
                    const retryAfter = Math.pow(2, attempt) + Math.random();
                    console.error(`[Rate Limited] ${operationName} - waiting ${retryAfter.toFixed(1)}s (attempt ${attempt + 1}/${maxRetries + 1})`);
                    await sleep(retryAfter * 1000);
                    continue;
                }
                // Server errors (5xx) - retry with backoff
                if (status >= 500) {
                    const backoff = Math.pow(2, attempt) + Math.random();
                    console.error(`[Server Error ${status}] ${operationName} - retrying in ${backoff.toFixed(1)}s (attempt ${attempt + 1}/${maxRetries + 1})`);
                    await sleep(backoff * 1000);
                    continue;
                }
                // Client errors (4xx except 429) - don't retry
                throw error;
            }
            // Network errors - retry with backoff
            if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT' || error.code === 'ENOTFOUND') {
                const backoff = Math.pow(2, attempt) + Math.random();
                console.error(`[Network Error] ${operationName} - retrying in ${backoff.toFixed(1)}s (attempt ${attempt + 1}/${maxRetries + 1})`);
                await sleep(backoff * 1000);
                continue;
            }
            // Unknown error - don't retry
            throw error;
        }
    }
    throw lastError || new Error(`${operationName} failed after ${maxRetries + 1} attempts`);
}
// ============================================================
/**
 * Load database IDs from cache file
 */
function loadDatabaseCache() {
    // Try multiple locations for the cache file
    const possiblePaths = [
        join(PROJECT_ROOT, '.notion-cache.json'),
        join(process.cwd(), '.notion-cache.json'),
        'Y:\\02_DATA\\09_Python\\00_Resilio_Common\\09_GeminiCLI_Notion\\.notion-cache.json',
    ];
    for (const cacheFile of possiblePaths) {
        if (existsSync(cacheFile)) {
            try {
                console.error(`Loading cache from: ${cacheFile}`);
                return JSON.parse(readFileSync(cacheFile, 'utf-8'));
            }
            catch {
                continue;
            }
        }
    }
    console.error('Cache file not found in any location');
    return {};
}
/**
 * Extract page ID from URL or return as-is
 */
function parsePageId(input) {
    if (input.includes('notion.so') || input.includes('notion.site')) {
        const match = input.match(/([a-f0-9]{32}|[a-f0-9-]{36})/i);
        if (match)
            return match[1];
    }
    return input.replace(/-/g, '');
}
/**
 * Resolve database ID shortcuts
 */
function resolveDatabaseId(id) {
    if (id === 'conversations')
        return conversationDbId;
    if (id === 'projects')
        return projectDbId;
    return id;
}
/**
 * Convert markdown to Notion blocks
 */
function markdownToBlocks(markdown) {
    const blocks = [];
    const lines = markdown.split('\n');
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        // Skip empty lines
        if (!line.trim())
            continue;
        // Headings
        if (line.startsWith('### ')) {
            blocks.push({
                object: 'block',
                type: 'heading_3',
                heading_3: { rich_text: [{ type: 'text', text: { content: line.slice(4) } }] },
            });
        }
        else if (line.startsWith('## ')) {
            blocks.push({
                object: 'block',
                type: 'heading_2',
                heading_2: { rich_text: [{ type: 'text', text: { content: line.slice(3) } }] },
            });
        }
        else if (line.startsWith('# ')) {
            blocks.push({
                object: 'block',
                type: 'heading_1',
                heading_1: { rich_text: [{ type: 'text', text: { content: line.slice(2) } }] },
            });
        }
        // Bullet list
        else if (line.startsWith('- ') || line.startsWith('* ')) {
            blocks.push({
                object: 'block',
                type: 'bulleted_list_item',
                bulleted_list_item: { rich_text: [{ type: 'text', text: { content: line.slice(2) } }] },
            });
        }
        // Numbered list
        else if (/^\d+\.\s/.test(line)) {
            blocks.push({
                object: 'block',
                type: 'numbered_list_item',
                numbered_list_item: { rich_text: [{ type: 'text', text: { content: line.replace(/^\d+\.\s/, '') } }] },
            });
        }
        // Todo
        else if (line.startsWith('- [ ] ') || line.startsWith('- [x] ')) {
            blocks.push({
                object: 'block',
                type: 'to_do',
                to_do: {
                    rich_text: [{ type: 'text', text: { content: line.slice(6) } }],
                    checked: line.startsWith('- [x] '),
                },
            });
        }
        // Quote
        else if (line.startsWith('> ')) {
            blocks.push({
                object: 'block',
                type: 'quote',
                quote: { rich_text: [{ type: 'text', text: { content: line.slice(2) } }] },
            });
        }
        // Code block (simplified)
        else if (line.startsWith('```')) {
            const lang = line.slice(3).trim() || 'plain text';
            let code = '';
            i++;
            while (i < lines.length && !lines[i].startsWith('```')) {
                code += lines[i] + '\n';
                i++;
            }
            blocks.push({
                object: 'block',
                type: 'code',
                code: {
                    rich_text: [{ type: 'text', text: { content: code.trimEnd() } }],
                    language: lang,
                },
            });
        }
        // Divider
        else if (line === '---' || line === '***') {
            blocks.push({ object: 'block', type: 'divider', divider: {} });
        }
        // Paragraph (default)
        else {
            blocks.push({
                object: 'block',
                type: 'paragraph',
                paragraph: { rich_text: [{ type: 'text', text: { content: line } }] },
            });
        }
    }
    return blocks;
}
/**
 * Extract plain text from rich_text array
 */
function richTextToPlain(richText) {
    return richText?.map(t => t.plain_text || t.text?.content || '').join('') || '';
}
/**
 * Format database results for readability
 */
function formatDatabaseResults(results) {
    return results.map(page => {
        const formatted = { id: page.id };
        if (page.properties) {
            for (const [key, prop] of Object.entries(page.properties)) {
                switch (prop.type) {
                    case 'title':
                        formatted[key] = richTextToPlain(prop.title);
                        break;
                    case 'rich_text':
                        formatted[key] = richTextToPlain(prop.rich_text);
                        break;
                    case 'number':
                        formatted[key] = prop.number;
                        break;
                    case 'select':
                        formatted[key] = prop.select?.name;
                        break;
                    case 'multi_select':
                        formatted[key] = prop.multi_select?.map((s) => s.name);
                        break;
                    case 'date':
                        formatted[key] = prop.date?.start;
                        break;
                    case 'checkbox':
                        formatted[key] = prop.checkbox;
                        break;
                    case 'url':
                        formatted[key] = prop.url;
                        break;
                    case 'email':
                        formatted[key] = prop.email;
                        break;
                    case 'phone_number':
                        formatted[key] = prop.phone_number;
                        break;
                    case 'relation':
                        formatted[key] = prop.relation?.map((r) => r.id);
                        break;
                    default:
                        formatted[key] = prop[prop.type];
                }
            }
        }
        return formatted;
    });
}
/**
 * Initialize server
 */
async function initialize() {
    try {
        const apiKey = await getNotionApiKey();
        if (!apiKey) {
            throw new Error('Notion API key not found. Run setup-windows.ps1 first.');
        }
        notion = new Client({ auth: apiKey });
        const cache = loadDatabaseCache();
        conversationDbId = cache.conversationDbId || '';
        projectDbId = cache.projectDbId || '';
        if (!conversationDbId) {
            console.error('⚠ No conversation database configured');
        }
        if (!projectDbId) {
            console.error('⚠ No project database configured');
        }
        // Verify connection
        await notion.users.me({});
        console.error('✓ Notion client initialized');
    }
    catch (error) {
        console.error('Failed to initialize:', error.message);
        process.exit(1);
    }
}
// Create MCP server
const server = new Server({ name: 'notion-sync', version: '2.0.0' }, { capabilities: { tools: {} } });
// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }));
// Handle tool execution
server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const respond = (data) => ({
        content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
    });
    const error = (msg) => ({
        content: [{ type: 'text', text: JSON.stringify({ error: msg }, null, 2) }],
        isError: true,
    });
    try {
        switch (name) {
            // ==================== SEARCH ====================
            case 'notion_search': {
                const filter = args?.filter === 'all' ? undefined :
                    args?.filter ? { property: 'object', value: args.filter } : undefined;
                const results = await withRetry(() => notion.search({
                    query: args?.query,
                    filter,
                    page_size: args?.limit || 20,
                }), 3, 'notion_search');
                const formatted = results.results.map((r) => ({
                    id: r.id,
                    type: r.object,
                    title: r.object === 'database'
                        ? richTextToPlain(r.title)
                        : richTextToPlain(r.properties?.title?.title || r.properties?.Name?.title || []),
                    url: r.url,
                    lastEdited: r.last_edited_time,
                }));
                return respond({ count: formatted.length, results: formatted });
            }
            // ==================== PAGES ====================
            case 'create_page': {
                const parent = args?.parentDatabaseId
                    ? { database_id: resolveDatabaseId(args.parentDatabaseId) }
                    : { page_id: parsePageId(args?.parentPageId || conversationDbId) };
                const properties = args?.parentDatabaseId
                    ? { Name: { title: [{ text: { content: args?.title } }] }, ...(args?.properties || {}) }
                    : { title: { title: [{ text: { content: args?.title } }] } };
                const children = args?.content ? markdownToBlocks(args.content) : undefined;
                const page = await withRetry(() => notion.pages.create({
                    parent,
                    properties,
                    children,
                    icon: args?.icon ? args.icon.startsWith('http')
                        ? { type: 'external', external: { url: args.icon } }
                        : { type: 'emoji', emoji: args.icon } : undefined,
                    cover: args?.cover ? { type: 'external', external: { url: args.cover } } : undefined,
                }), 3, 'create_page');
                return respond({ id: page.id, url: page.url, message: 'Page created successfully' });
            }
            case 'get_page': {
                const pageId = parsePageId(args?.pageId);
                const page = await withRetry(() => notion.pages.retrieve({ page_id: pageId }), 3, 'get_page');
                let content = [];
                if (args?.includeContent !== false) {
                    const blocks = await withRetry(() => notion.blocks.children.list({ block_id: pageId, page_size: 100 }), 3, 'get_page_blocks');
                    content = blocks.results;
                }
                return respond({ page, content });
            }
            case 'update_page': {
                const pageId = parsePageId(args?.pageId);
                const updates = {};
                if (args?.properties)
                    updates.properties = args.properties;
                if (args?.title) {
                    updates.properties = {
                        ...updates.properties,
                        title: { title: [{ text: { content: args.title } }] },
                    };
                }
                if (args?.icon) {
                    updates.icon = args.icon.startsWith('http')
                        ? { type: 'external', external: { url: args.icon } }
                        : { type: 'emoji', emoji: args.icon };
                }
                if (args?.cover) {
                    updates.cover = { type: 'external', external: { url: args.cover } };
                }
                if (args?.archived !== undefined) {
                    updates.archived = args.archived;
                }
                const page = await withRetry(() => notion.pages.update({ page_id: pageId, ...updates }), 3, 'update_page');
                return respond({ id: page.id, message: 'Page updated successfully' });
            }
            case 'delete_page': {
                const pageId = parsePageId(args?.pageId);
                await withRetry(() => notion.pages.update({ page_id: pageId, archived: true }), 3, 'delete_page');
                return respond({ message: 'Page archived (deleted)' });
            }
            // ==================== DATABASES ====================
            case 'list_databases': {
                const results = await withRetry(() => notion.search({
                    filter: { property: 'object', value: 'database' },
                    page_size: args?.limit || 50,
                }), 3, 'list_databases');
                const databases = results.results.map((db) => ({
                    id: db.id,
                    title: richTextToPlain(db.title),
                    url: db.url,
                    isConversationDb: db.id === conversationDbId,
                    isProjectDb: db.id === projectDbId,
                }));
                return respond({ count: databases.length, databases });
            }
            case 'query_database': {
                const dbId = resolveDatabaseId(args?.databaseId);
                // Process sorts - support both property and timestamp sorts
                let processedSorts = args?.sorts;
                if (processedSorts) {
                    processedSorts = processedSorts.map((sort) => {
                        // If it has 'timestamp' field, it's a timestamp sort (last_edited_time, created_time)
                        if (sort.timestamp) {
                            return { timestamp: sort.timestamp, direction: sort.direction || 'descending' };
                        }
                        // Otherwise it's a property sort
                        return { property: sort.property, direction: sort.direction || 'ascending' };
                    });
                }
                const results = await withRetry(() => notion.databases.query({
                    database_id: dbId,
                    filter: args?.filter,
                    sorts: processedSorts,
                    page_size: args?.limit || 100,
                }), 3, 'query_database');
                const formatted = formatDatabaseResults(results.results);
                return respond({ count: formatted.length, results: formatted });
            }
            case 'create_database': {
                const parentId = parsePageId(args?.parentPageId);
                const defaultProperties = {
                    Name: { title: {} },
                };
                const db = await withRetry(() => notion.databases.create({
                    parent: { type: 'page_id', page_id: parentId },
                    title: [{ type: 'text', text: { content: args?.title } }],
                    is_inline: args?.isInline || false,
                    properties: args?.properties || defaultProperties,
                }), 3, 'create_database');
                return respond({ id: db.id, url: db.url, message: 'Database created' });
            }
            case 'add_database_entry': {
                const dbId = resolveDatabaseId(args?.databaseId);
                const children = args?.content ? markdownToBlocks(args.content) : undefined;
                const page = await withRetry(() => notion.pages.create({
                    parent: { database_id: dbId },
                    properties: args?.properties,
                    children,
                }), 3, 'add_database_entry');
                return respond({ id: page.id, url: page.url, message: 'Entry added' });
            }
            case 'get_database_schema': {
                const dbId = resolveDatabaseId(args?.databaseId);
                const db = await withRetry(() => notion.databases.retrieve({ database_id: dbId }), 3, 'get_database_schema');
                const schema = Object.entries(db.properties).map(([name, prop]) => ({
                    name,
                    type: prop.type,
                    options: prop.select?.options || prop.multi_select?.options || undefined,
                }));
                return respond({
                    id: db.id,
                    title: richTextToPlain(db.title),
                    properties: schema
                });
            }
            case 'update_database_schema': {
                const dbId = resolveDatabaseId(args?.databaseId);
                const updates = {};
                // Update title
                if (args?.title) {
                    updates.title = [{ type: 'text', text: { content: args.title } }];
                }
                // Build properties update
                const propertyUpdates = {};
                // Add new properties
                if (args?.addProperties) {
                    for (const [name, config] of Object.entries(args.addProperties)) {
                        const propType = config.type || config;
                        switch (propType) {
                            case 'rich_text':
                                propertyUpdates[name] = { rich_text: {} };
                                break;
                            case 'number':
                                propertyUpdates[name] = { number: { format: config.format || 'number' } };
                                break;
                            case 'select':
                                propertyUpdates[name] = { select: { options: config.options || [] } };
                                break;
                            case 'multi_select':
                                propertyUpdates[name] = { multi_select: { options: config.options || [] } };
                                break;
                            case 'date':
                                propertyUpdates[name] = { date: {} };
                                break;
                            case 'checkbox':
                                propertyUpdates[name] = { checkbox: {} };
                                break;
                            case 'url':
                                propertyUpdates[name] = { url: {} };
                                break;
                            case 'email':
                                propertyUpdates[name] = { email: {} };
                                break;
                            case 'phone_number':
                                propertyUpdates[name] = { phone_number: {} };
                                break;
                            case 'people':
                                propertyUpdates[name] = { people: {} };
                                break;
                            case 'status':
                                propertyUpdates[name] = { status: { options: config.options || [], groups: config.groups || [] } };
                                break;
                            default:
                                propertyUpdates[name] = { [propType]: config.options ? { options: config.options } : {} };
                        }
                    }
                }
                // Update existing properties
                if (args?.updateProperties) {
                    Object.assign(propertyUpdates, args.updateProperties);
                }
                // Remove properties (set to null)
                if (args?.removeProperties) {
                    for (const name of args.removeProperties) {
                        propertyUpdates[name] = null;
                    }
                }
                if (Object.keys(propertyUpdates).length > 0) {
                    updates.properties = propertyUpdates;
                }
                const db = await notion.databases.update({ database_id: dbId, ...updates });
                return respond({
                    id: db.id,
                    message: 'Database schema updated',
                    propertiesModified: Object.keys(propertyUpdates)
                });
            }
            // ==================== BLOCKS ====================
            case 'get_block_children': {
                const blockId = parsePageId(args?.blockId);
                const fetchChildren = async (id, depth = 0) => {
                    const response = await notion.blocks.children.list({ block_id: id, page_size: 100 });
                    const blocks = response.results;
                    if (args?.recursive && depth < 3) {
                        for (const block of blocks) {
                            if (block.has_children) {
                                block.children = await fetchChildren(block.id, depth + 1);
                            }
                        }
                    }
                    return blocks;
                };
                const children = await fetchChildren(blockId);
                return respond({ count: children.length, blocks: children });
            }
            case 'append_blocks': {
                const parentId = parsePageId(args?.parentId);
                const blocks = args?.blocks ||
                    (args?.content ? markdownToBlocks(args.content) : []);
                if (blocks.length === 0) {
                    return error('No content or blocks provided');
                }
                const result = await notion.blocks.children.append({
                    block_id: parentId,
                    children: blocks,
                });
                return respond({ blocksAdded: result.results.length, message: 'Content appended' });
            }
            case 'update_block': {
                const blockId = args?.blockId;
                const updates = {};
                if (args?.archived !== undefined) {
                    updates.archived = args.archived;
                }
                if (args?.content && args?.type) {
                    updates[args.type] = {
                        rich_text: [{ type: 'text', text: { content: args.content } }],
                    };
                }
                const block = await notion.blocks.update({ block_id: blockId, ...updates });
                return respond({ id: block.id, message: 'Block updated' });
            }
            case 'delete_block': {
                await notion.blocks.delete({ block_id: args?.blockId });
                return respond({ message: 'Block deleted' });
            }
            // ==================== COMMENTS ====================
            case 'get_comments': {
                const pageId = parsePageId(args?.pageId);
                const comments = await notion.comments.list({ block_id: pageId });
                const formatted = comments.results.map((c) => ({
                    id: c.id,
                    text: richTextToPlain(c.rich_text),
                    createdTime: c.created_time,
                    discussionId: c.discussion_id,
                }));
                return respond({ count: formatted.length, comments: formatted });
            }
            case 'add_comment': {
                const params = {
                    rich_text: [{ type: 'text', text: { content: args?.content } }],
                };
                if (args?.discussionId) {
                    params.discussion_id = args.discussionId;
                }
                else {
                    params.parent = { page_id: parsePageId(args?.pageId) };
                }
                const comment = await notion.comments.create(params);
                return respond({ id: comment.id, message: 'Comment added' });
            }
            // ==================== USERS ====================
            case 'list_users': {
                const users = await notion.users.list({ page_size: args?.limit || 100 });
                const formatted = users.results.map((u) => ({
                    id: u.id,
                    name: u.name,
                    type: u.type,
                    email: u.person?.email,
                    avatarUrl: u.avatar_url,
                }));
                return respond({ count: formatted.length, users: formatted });
            }
            case 'get_current_user': {
                const user = await notion.users.me({});
                return respond({
                    id: user.id,
                    name: user.name,
                    type: user.type,
                    avatarUrl: user.avatar_url,
                });
            }
            // ==================== PROJECTS ====================
            case 'list_projects': {
                if (!projectDbId)
                    return error('No project database configured');
                const filter = args?.status
                    ? { property: 'Status', select: { equals: args.status } }
                    : undefined;
                const sorts = args?.sortBy === 'date'
                    ? [{ property: 'Start Date', direction: 'descending' }]
                    : args?.sortBy === 'status'
                        ? [{ property: 'Status', direction: 'ascending' }]
                        : [{ property: 'Project Name', direction: 'ascending' }];
                const results = await notion.databases.query({
                    database_id: projectDbId,
                    filter,
                    sorts,
                    page_size: args?.limit || 50,
                });
                return respond({ count: results.results.length, projects: formatDatabaseResults(results.results) });
            }
            case 'create_project': {
                if (!projectDbId)
                    return error('No project database configured');
                const properties = {
                    'Project Name': { title: [{ text: { content: args?.name } }] },
                };
                if (args?.status) {
                    properties['Status'] = { select: { name: args.status } };
                }
                if (args?.description) {
                    properties['Description'] = { rich_text: [{ text: { content: args.description } }] };
                }
                if (args?.technologies) {
                    properties['Key Technologies'] = {
                        multi_select: args.technologies.map(t => ({ name: t }))
                    };
                }
                if (args?.githubRepo) {
                    properties['GitHub Repository'] = { url: args.githubRepo };
                }
                const page = await notion.pages.create({
                    parent: { database_id: projectDbId },
                    properties,
                });
                return respond({ id: page.id, url: page.url, message: 'Project created' });
            }
            case 'update_project': {
                if (!projectDbId)
                    return error('No project database configured');
                let pageId = args?.projectId;
                // If it's a name, find the project
                if (!pageId.match(/^[a-f0-9-]{32,36}$/i)) {
                    const search = await notion.databases.query({
                        database_id: projectDbId,
                        filter: { property: 'Project Name', title: { contains: pageId } },
                        page_size: 1,
                    });
                    if (search.results.length === 0)
                        return error(`Project not found: ${pageId}`);
                    pageId = search.results[0].id;
                }
                const properties = {};
                if (args?.name)
                    properties['Project Name'] = { title: [{ text: { content: args.name } }] };
                if (args?.status)
                    properties['Status'] = { select: { name: args.status } };
                if (args?.description)
                    properties['Description'] = { rich_text: [{ text: { content: args.description } }] };
                if (args?.technologies)
                    properties['Key Technologies'] = { multi_select: args.technologies.map(t => ({ name: t })) };
                if (args?.githubRepo)
                    properties['GitHub Repository'] = { url: args.githubRepo };
                await notion.pages.update({ page_id: pageId, properties });
                return respond({ message: 'Project updated' });
            }
            // ==================== CONVERSATIONS ====================
            case 'export_conversation': {
                if (!conversationDbId)
                    return error('No conversation database configured');
                const data = args?.conversationData;
                const messages = data?.messages || [];
                // Generate title from first user message
                const title = args?.title ||
                    messages.find((m) => m.role === 'user')?.content?.slice(0, 50) + '...' ||
                    'Gemini Conversation';
                // Convert conversation to blocks
                const blocks = [];
                for (const msg of messages) {
                    blocks.push({
                        object: 'block',
                        type: 'callout',
                        callout: {
                            icon: { type: 'emoji', emoji: msg.role === 'user' ? '👤' : '🤖' },
                            rich_text: [{ type: 'text', text: { content: msg.content.slice(0, 2000) } }],
                        },
                    });
                }
                const properties = {
                    'Title': { title: [{ text: { content: title } }] },
                    'Export Date': { date: { start: new Date().toISOString() } },
                    'Message Count': { number: messages.length },
                };
                if (args?.tags) {
                    properties['Tags'] = { multi_select: args.tags.map(t => ({ name: t })) };
                }
                const page = await notion.pages.create({
                    parent: { database_id: conversationDbId },
                    properties,
                    children: blocks.slice(0, 100), // Notion limit
                });
                return respond({
                    id: page.id,
                    url: page.url,
                    title,
                    messageCount: messages.length,
                    message: 'Conversation exported successfully'
                });
            }
            case 'link_conversation_to_project': {
                const conversationId = parsePageId(args?.conversationId);
                let projectId = args?.projectId;
                // Find project by name if needed
                if (!projectId.match(/^[a-f0-9-]{32,36}$/i)) {
                    const search = await notion.databases.query({
                        database_id: projectDbId,
                        filter: { property: 'Project Name', title: { contains: projectId } },
                        page_size: 1,
                    });
                    if (search.results.length === 0)
                        return error(`Project not found: ${projectId}`);
                    projectId = search.results[0].id;
                }
                await notion.pages.update({
                    page_id: conversationId,
                    properties: {
                        'Associated Project': { relation: [{ id: projectId }] },
                    },
                });
                return respond({ message: 'Conversation linked to project' });
            }
            // ==================== UTILITY ====================
            case 'duplicate_page': {
                const sourceId = parsePageId(args?.pageId);
                const source = await notion.pages.retrieve({ page_id: sourceId });
                const blocks = await notion.blocks.children.list({ block_id: sourceId, page_size: 100 });
                const targetParent = args?.targetParentId
                    ? parsePageId(args.targetParentId)
                    : source.parent.page_id || source.parent.database_id;
                const newTitle = args?.newTitle ||
                    richTextToPlain(source.properties?.title?.title || source.properties?.Name?.title || []) + ' (Copy)';
                const parent = source.parent.type === 'database_id'
                    ? { database_id: targetParent }
                    : { page_id: targetParent };
                const properties = source.parent.type === 'database_id'
                    ? { ...source.properties, Name: { title: [{ text: { content: newTitle } }] } }
                    : { title: { title: [{ text: { content: newTitle } }] } };
                const newPage = await notion.pages.create({
                    parent,
                    properties,
                    children: blocks.results,
                });
                return respond({ id: newPage.id, url: newPage.url, message: 'Page duplicated' });
            }
            case 'get_recent_changes': {
                const filter = args?.filter === 'all' ? undefined :
                    args?.filter ? { property: 'object', value: args.filter } : undefined;
                const results = await notion.search({
                    filter,
                    sort: { direction: 'descending', timestamp: 'last_edited_time' },
                    page_size: args?.limit || 20,
                });
                const formatted = results.results.map((r) => ({
                    id: r.id,
                    type: r.object,
                    title: r.object === 'database'
                        ? richTextToPlain(r.title)
                        : richTextToPlain(r.properties?.title?.title || r.properties?.Name?.title || []),
                    lastEdited: r.last_edited_time,
                    url: r.url,
                }));
                return respond({ count: formatted.length, results: formatted });
            }
            default:
                return error(`Unknown tool: ${name}`);
        }
    }
    catch (err) {
        console.error(`Tool error [${name}]:`, err.message);
        return error(err.message);
    }
});
// Start server
async function main() {
    await initialize();
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error('Notion MCP Server v2.0 running');
}
main().catch(err => {
    console.error('Fatal:', err);
    process.exit(1);
});
//# sourceMappingURL=server.js.map