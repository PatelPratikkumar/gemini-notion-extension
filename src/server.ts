#!/usr/bin/env node
// Full-featured Notion MCP Server with comprehensive tool support
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
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
let notion: Client;
let conversationDbId: string;
let projectDbId: string;

// ============================================================
// RATE LIMITING & RETRY LOGIC (from research/api_help.md)
// ============================================================

/**
 * Token Bucket Rate Limiter
 * Notion API: 3 requests/second average
 */
class TokenBucket {
  private tokens: number;
  private lastRefillTime: number;
  private readonly maxTokens: number;
  private readonly refillRate: number; // tokens per second

  constructor(maxTokens: number = 3, refillRate: number = 3) {
    this.maxTokens = maxTokens;
    this.refillRate = refillRate;
    this.tokens = maxTokens;
    this.lastRefillTime = Date.now();
  }

  async acquireToken(): Promise<void> {
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
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Execute with retry and exponential backoff
 * Handles 429 (rate limit) and 5xx (server errors)
 */
async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  operationName: string = 'API call'
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // Acquire rate limit token before each request
      await rateLimiter.acquireToken();
      return await operation();
    } catch (error: any) {
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
// AUTO-PAGINATION (for >100 items)
// ============================================================

/**
 * Paginate through all results from a database query
 * Notion API returns max 100 items per request
 */
async function paginateQuery(
  databaseId: string,
  filter?: any,
  sorts?: any,
  maxItems: number = 1000
): Promise<any[]> {
  const allResults: any[] = [];
  let hasMore = true;
  let startCursor: string | undefined = undefined;

  while (hasMore && allResults.length < maxItems) {
    const response = await withRetry(
      () => notion.databases.query({
        database_id: databaseId,
        filter,
        sorts,
        page_size: 100,
        start_cursor: startCursor,
      }),
      3,
      'paginate_query'
    );

    allResults.push(...response.results);
    hasMore = response.has_more;
    startCursor = response.next_cursor || undefined;

    // Log progress for large queries
    if (allResults.length >= 100) {
      console.error(`[Pagination] Fetched ${allResults.length} items...`);
    }
  }

  return allResults;
}

/**
 * Paginate through all block children
 */
async function paginateBlockChildren(
  blockId: string,
  maxBlocks: number = 500
): Promise<any[]> {
  const allBlocks: any[] = [];
  let hasMore = true;
  let startCursor: string | undefined = undefined;

  while (hasMore && allBlocks.length < maxBlocks) {
    const response = await withRetry(
      () => notion.blocks.children.list({
        block_id: blockId,
        page_size: 100,
        start_cursor: startCursor,
      }),
      3,
      'paginate_blocks'
    );

    allBlocks.push(...response.results);
    hasMore = response.has_more;
    startCursor = response.next_cursor || undefined;
  }

  return allBlocks;
}

// ============================================================
// LARGE CONTENT CHUNKING (for >50KB content)
// ============================================================

const MAX_RICH_TEXT_LENGTH = 2000; // Notion limit per block
const MAX_CHUNK_SIZE = 50000; // 50KB per chunk for safety

/**
 * Split large content into chunks for Notion
 * Each chunk becomes a separate code block or set of paragraphs
 */
function chunkContent(content: string, chunkSize: number = MAX_CHUNK_SIZE): string[] {
  if (content.length <= chunkSize) {
    return [content];
  }

  const chunks: string[] = [];
  let remaining = content;

  while (remaining.length > 0) {
    if (remaining.length <= chunkSize) {
      chunks.push(remaining);
      break;
    }

    // Try to split at a natural boundary (newline, paragraph)
    let splitIndex = remaining.lastIndexOf('\n\n', chunkSize);
    if (splitIndex === -1 || splitIndex < chunkSize * 0.5) {
      splitIndex = remaining.lastIndexOf('\n', chunkSize);
    }
    if (splitIndex === -1 || splitIndex < chunkSize * 0.5) {
      splitIndex = chunkSize;
    }

    chunks.push(remaining.slice(0, splitIndex));
    remaining = remaining.slice(splitIndex).trimStart();
  }

  return chunks;
}

/**
 * Create blocks from large content, auto-chunking as needed
 */
function createChunkedBlocks(content: string, blockType: 'paragraph' | 'code' = 'paragraph'): any[] {
  const blocks: any[] = [];
  
  if (blockType === 'code') {
    // Code blocks can hold 100KB, but we chunk at 50KB for safety
    const chunks = chunkContent(content, MAX_CHUNK_SIZE);
    for (let i = 0; i < chunks.length; i++) {
      blocks.push({
        object: 'block',
        type: 'code',
        code: {
          language: 'plain text',
          rich_text: [{ type: 'text', text: { content: chunks[i] } }],
        },
      });
      
      // Add part indicator if multiple chunks
      if (chunks.length > 1 && i < chunks.length - 1) {
        blocks.push({
          object: 'block',
          type: 'paragraph',
          paragraph: {
            rich_text: [{ type: 'text', text: { content: `--- Part ${i + 1} of ${chunks.length} ---` } }],
          },
        });
      }
    }
  } else {
    // Paragraphs are limited to 2000 chars per rich_text
    const chunks = chunkContent(content, MAX_RICH_TEXT_LENGTH);
    for (const chunk of chunks) {
      blocks.push({
        object: 'block',
        type: 'paragraph',
        paragraph: {
          rich_text: [{ type: 'text', text: { content: chunk } }],
        },
      });
    }
  }

  return blocks;
}

/**
 * Append blocks in batches (max 100 blocks per request)
 */
async function appendBlocksInBatches(
  pageId: string,
  blocks: any[],
  batchSize: number = 100
): Promise<void> {
  for (let i = 0; i < blocks.length; i += batchSize) {
    const batch = blocks.slice(i, i + batchSize);
    
    await withRetry(
      () => notion.blocks.children.append({
        block_id: pageId,
        children: batch,
      }),
      3,
      `append_blocks_batch_${Math.floor(i / batchSize) + 1}`
    );

    // Log progress for large appends
    if (blocks.length > batchSize) {
      console.error(`[Batch Append] ${Math.min(i + batchSize, blocks.length)}/${blocks.length} blocks`);
    }
  }
}

// ============================================================

/**
 * Load database IDs from cache file
 */
function loadDatabaseCache(): { conversationDbId?: string; projectDbId?: string } {
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
      } catch {
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
function parsePageId(input: string): string {
  if (input.includes('notion.so') || input.includes('notion.site')) {
    const match = input.match(/([a-f0-9]{32}|[a-f0-9-]{36})/i);
    if (match) return match[1];
  }
  return input.replace(/-/g, '');
}

/**
 * Resolve database ID shortcuts
 */
function resolveDatabaseId(id: string): string {
  if (id === 'conversations') return conversationDbId;
  if (id === 'projects') return projectDbId;
  return id;
}

/**
 * Convert markdown to Notion blocks
 */
function markdownToBlocks(markdown: string): any[] {
  const blocks: any[] = [];
  const lines = markdown.split('\n');
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Skip empty lines
    if (!line.trim()) continue;
    
    // Headings
    if (line.startsWith('### ')) {
      blocks.push({
        object: 'block',
        type: 'heading_3',
        heading_3: { rich_text: [{ type: 'text', text: { content: line.slice(4) } }] },
      });
    } else if (line.startsWith('## ')) {
      blocks.push({
        object: 'block',
        type: 'heading_2',
        heading_2: { rich_text: [{ type: 'text', text: { content: line.slice(3) } }] },
      });
    } else if (line.startsWith('# ')) {
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
function richTextToPlain(richText: any[]): string {
  return richText?.map(t => t.plain_text || t.text?.content || '').join('') || '';
}

/**
 * Format database results for readability
 */
function formatDatabaseResults(results: any[]): any[] {
  return results.map(page => {
    const formatted: any = { id: page.id };
    
    if (page.properties) {
      for (const [key, prop] of Object.entries(page.properties) as [string, any][]) {
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
            formatted[key] = prop.multi_select?.map((s: any) => s.name);
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
            formatted[key] = prop.relation?.map((r: any) => r.id);
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
  } catch (error: any) {
    console.error('Failed to initialize:', error.message);
    process.exit(1);
  }
}

// Create MCP server
const server = new Server(
  { name: 'notion-sync', version: '2.0.0' },
  { capabilities: { tools: {} } }
);

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }));

// Handle tool execution
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  
  const respond = (data: any) => ({
    content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }],
  });
  
  const error = (msg: string) => ({
    content: [{ type: 'text' as const, text: JSON.stringify({ error: msg }, null, 2) }],
    isError: true,
  });

  try {
    switch (name) {
      // ==================== SEARCH ====================
      case 'notion_search': {
        const filter = args?.filter === 'all' ? undefined : 
          args?.filter ? { property: 'object' as const, value: args.filter as 'page' | 'database' } : undefined;
        
        const results = await withRetry(
          () => notion.search({
            query: args?.query as string,
            filter,
            page_size: (args?.limit as number) || 20,
          }),
          3,
          'notion_search'
        );
        
        const formatted = results.results.map((r: any) => ({
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
        const parent: any = args?.parentDatabaseId 
          ? { database_id: resolveDatabaseId(args.parentDatabaseId as string) }
          : { page_id: parsePageId(args?.parentPageId as string || conversationDbId) };
        
        const properties: any = args?.parentDatabaseId 
          ? { Name: { title: [{ text: { content: args?.title as string } }] }, ...(args?.properties as object || {}) }
          : { title: { title: [{ text: { content: args?.title as string } }] } };
        
        const children = args?.content ? markdownToBlocks(args.content as string) : undefined;
        
        const page = await withRetry(
          () => notion.pages.create({
            parent,
            properties,
            children,
            icon: args?.icon ? (args.icon as string).startsWith('http') 
              ? { type: 'external', external: { url: args.icon as string } }
              : { type: 'emoji', emoji: args.icon as any } : undefined,
            cover: args?.cover ? { type: 'external', external: { url: args.cover as string } } : undefined,
          }),
          3,
          'create_page'
        );
        
        return respond({ id: page.id, url: (page as any).url, message: 'Page created successfully' });
      }

      case 'get_page': {
        const pageId = parsePageId(args?.pageId as string);
        const page = await withRetry(
          () => notion.pages.retrieve({ page_id: pageId }),
          3,
          'get_page'
        );
        
        let content: any[] = [];
        if (args?.includeContent !== false) {
          // Use pagination for large pages
          content = await paginateBlockChildren(pageId, 500);
        }
        
        return respond({ page, content });
      }

      case 'update_page': {
        const pageId = parsePageId(args?.pageId as string);
        const updates: any = {};
        
        if (args?.properties) updates.properties = args.properties;
        if (args?.title) {
          updates.properties = {
            ...updates.properties,
            title: { title: [{ text: { content: args.title as string } }] },
          };
        }
        if (args?.icon) {
          updates.icon = (args.icon as string).startsWith('http')
            ? { type: 'external', external: { url: args.icon as string } }
            : { type: 'emoji', emoji: args.icon };
        }
        if (args?.cover) {
          updates.cover = { type: 'external', external: { url: args.cover as string } };
        }
        if (args?.archived !== undefined) {
          updates.archived = args.archived;
        }
        
        const page = await withRetry(
          () => notion.pages.update({ page_id: pageId, ...updates }),
          3,
          'update_page'
        );
        return respond({ id: page.id, message: 'Page updated successfully' });
      }

      case 'delete_page': {
        const pageId = parsePageId(args?.pageId as string);
        await withRetry(
          () => notion.pages.update({ page_id: pageId, archived: true }),
          3,
          'delete_page'
        );
        return respond({ message: 'Page archived (deleted)' });
      }

      // ==================== DATABASES ====================
      case 'list_databases': {
        const results = await withRetry(
          () => notion.search({
            filter: { property: 'object', value: 'database' },
            page_size: (args?.limit as number) || 50,
          }),
          3,
          'list_databases'
        );
        
        const databases = results.results.map((db: any) => ({
          id: db.id,
          title: richTextToPlain(db.title),
          url: db.url,
          isConversationDb: db.id === conversationDbId,
          isProjectDb: db.id === projectDbId,
        }));
        
        return respond({ count: databases.length, databases });
      }

      case 'query_database': {
        const dbId = resolveDatabaseId(args?.databaseId as string);
        const limit = (args?.limit as number) || 100;
        
        // Process sorts - support both property and timestamp sorts
        let processedSorts = args?.sorts as any;
        if (processedSorts) {
          processedSorts = processedSorts.map((sort: any) => {
            // If it has 'timestamp' field, it's a timestamp sort (last_edited_time, created_time)
            if (sort.timestamp) {
              return { timestamp: sort.timestamp, direction: sort.direction || 'descending' };
            }
            // Otherwise it's a property sort
            return { property: sort.property, direction: sort.direction || 'ascending' };
          });
        }
        
        // Use pagination for large queries (>100 items)
        let results: any[];
        if (limit > 100) {
          results = await paginateQuery(dbId, args?.filter, processedSorts, limit);
        } else {
          const response = await withRetry(
            () => notion.databases.query({
              database_id: dbId,
              filter: args?.filter as any,
              sorts: processedSorts,
              page_size: limit,
            }),
            3,
            'query_database'
          );
          results = response.results;
        }
        
        const formatted = formatDatabaseResults(results);
        return respond({ count: formatted.length, results: formatted });
      }

      case 'create_database': {
        const parentId = parsePageId(args?.parentPageId as string);
        
        const defaultProperties: any = {
          Name: { title: {} },
        };
        
        const db = await withRetry(
          () => notion.databases.create({
            parent: { type: 'page_id', page_id: parentId },
            title: [{ type: 'text', text: { content: args?.title as string } }],
            is_inline: args?.isInline as boolean || false,
            properties: args?.properties as any || defaultProperties,
          }),
          3,
          'create_database'
        );
        
        return respond({ id: db.id, url: (db as any).url, message: 'Database created' });
      }

      case 'add_database_entry': {
        const dbId = resolveDatabaseId(args?.databaseId as string);
        const children = args?.content ? markdownToBlocks(args.content as string) : undefined;
        
        const page = await withRetry(
          () => notion.pages.create({
            parent: { database_id: dbId },
            properties: args?.properties as any,
            children,
          }),
          3,
          'add_database_entry'
        );
        
        return respond({ id: page.id, url: (page as any).url, message: 'Entry added' });
      }

      case 'get_database_schema': {
        const dbId = resolveDatabaseId(args?.databaseId as string);
        const db = await withRetry(
          () => notion.databases.retrieve({ database_id: dbId }),
          3,
          'get_database_schema'
        );
        
        const schema = Object.entries((db as any).properties).map(([name, prop]: [string, any]) => ({
          name,
          type: prop.type,
          options: prop.select?.options || prop.multi_select?.options || undefined,
        }));
        
        return respond({ 
          id: db.id, 
          title: richTextToPlain((db as any).title),
          properties: schema 
        });
      }

      case 'update_database_schema': {
        const dbId = resolveDatabaseId(args?.databaseId as string);
        const updates: any = {};
        
        // Update title
        if (args?.title) {
          updates.title = [{ type: 'text', text: { content: args.title as string } }];
        }
        
        // Build properties update
        const propertyUpdates: any = {};
        
        // Add new properties
        if (args?.addProperties) {
          for (const [name, config] of Object.entries(args.addProperties as Record<string, any>)) {
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
          for (const name of args.removeProperties as string[]) {
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
        const blockId = parsePageId(args?.blockId as string);
        
        const fetchChildren = async (id: string, depth: number = 0): Promise<any[]> => {
          const response = await notion.blocks.children.list({ block_id: id, page_size: 100 });
          const blocks = response.results as any[];
          
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
        const parentId = parsePageId(args?.parentId as string);
        let blocks = args?.blocks as any[] || [];
        
        // Handle large content with auto-chunking
        if (args?.content) {
          const content = args.content as string;
          if (content.length > 50000) {
            // Use chunking for large content
            blocks = createChunkedBlocks(content, 'paragraph');
          } else {
            blocks = markdownToBlocks(content);
          }
        }
        
        if (blocks.length === 0) {
          return error('No content or blocks provided');
        }
        
        // Use batch appending for large block counts
        if (blocks.length > 100) {
          const totalAdded = await appendBlocksInBatches(parentId, blocks);
          return respond({ blocksAdded: totalAdded, message: `Content appended in ${Math.ceil(blocks.length / 100)} batches` });
        }
        
        const result = await withRetry(() => notion.blocks.children.append({
          block_id: parentId,
          children: blocks,
        }), 3, 'append_blocks');
        
        return respond({ blocksAdded: result.results.length, message: 'Content appended' });
      }

      case 'update_block': {
        const blockId = args?.blockId as string;
        const updates: any = {};
        
        if (args?.archived !== undefined) {
          updates.archived = args.archived;
        }
        
        if (args?.content && args?.type) {
          updates[args.type as string] = {
            rich_text: [{ type: 'text', text: { content: args.content as string } }],
          };
        }
        
        const block = await notion.blocks.update({ block_id: blockId, ...updates });
        return respond({ id: block.id, message: 'Block updated' });
      }

      case 'delete_block': {
        await notion.blocks.delete({ block_id: args?.blockId as string });
        return respond({ message: 'Block deleted' });
      }

      // ==================== COMMENTS ====================
      case 'get_comments': {
        const pageId = parsePageId(args?.pageId as string);
        const comments = await notion.comments.list({ block_id: pageId });
        
        const formatted = comments.results.map((c: any) => ({
          id: c.id,
          text: richTextToPlain(c.rich_text),
          createdTime: c.created_time,
          discussionId: c.discussion_id,
        }));
        
        return respond({ count: formatted.length, comments: formatted });
      }

      case 'add_comment': {
        const params: any = {
          rich_text: [{ type: 'text', text: { content: args?.content as string } }],
        };
        
        if (args?.discussionId) {
          params.discussion_id = args.discussionId as string;
        } else {
          params.parent = { page_id: parsePageId(args?.pageId as string) };
        }
        
        const comment = await notion.comments.create(params);
        return respond({ id: comment.id, message: 'Comment added' });
      }

      // ==================== USERS ====================
      case 'list_users': {
        const users = await notion.users.list({ page_size: (args?.limit as number) || 100 });
        
        const formatted = users.results.map((u: any) => ({
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
        if (!projectDbId) return error('No project database configured');
        
        const filter = args?.status 
          ? { property: 'Status', select: { equals: args.status as string } }
          : undefined;
        
        const sorts = args?.sortBy === 'date' 
          ? [{ property: 'Start Date', direction: 'descending' as const }]
          : args?.sortBy === 'status'
          ? [{ property: 'Status', direction: 'ascending' as const }]
          : [{ property: 'Project Name', direction: 'ascending' as const }];
        
        const results = await notion.databases.query({
          database_id: projectDbId,
          filter,
          sorts,
          page_size: (args?.limit as number) || 50,
        });
        
        return respond({ count: results.results.length, projects: formatDatabaseResults(results.results) });
      }

      case 'create_project': {
        if (!projectDbId) return error('No project database configured');
        
        const properties: any = {
          'Project Name': { title: [{ text: { content: args?.name as string } }] },
        };
        
        if (args?.status) {
          properties['Status'] = { select: { name: args.status as string } };
        }
        if (args?.description) {
          properties['Description'] = { rich_text: [{ text: { content: args.description as string } }] };
        }
        if (args?.technologies) {
          properties['Key Technologies'] = { 
            multi_select: (args.technologies as string[]).map(t => ({ name: t })) 
          };
        }
        if (args?.githubRepo) {
          properties['GitHub Repository'] = { url: args.githubRepo as string };
        }
        
        const page = await notion.pages.create({
          parent: { database_id: projectDbId },
          properties,
        });
        
        return respond({ id: page.id, url: (page as any).url, message: 'Project created' });
      }

      case 'update_project': {
        if (!projectDbId) return error('No project database configured');
        
        let pageId = args?.projectId as string;
        
        // If it's a name, find the project
        if (!pageId.match(/^[a-f0-9-]{32,36}$/i)) {
          const search = await notion.databases.query({
            database_id: projectDbId,
            filter: { property: 'Project Name', title: { contains: pageId } },
            page_size: 1,
          });
          if (search.results.length === 0) return error(`Project not found: ${pageId}`);
          pageId = search.results[0].id;
        }
        
        const properties: any = {};
        if (args?.name) properties['Project Name'] = { title: [{ text: { content: args.name as string } }] };
        if (args?.status) properties['Status'] = { select: { name: args.status as string } };
        if (args?.description) properties['Description'] = { rich_text: [{ text: { content: args.description as string } }] };
        if (args?.technologies) properties['Key Technologies'] = { multi_select: (args.technologies as string[]).map(t => ({ name: t })) };
        if (args?.githubRepo) properties['GitHub Repository'] = { url: args.githubRepo as string };
        
        await notion.pages.update({ page_id: pageId, properties });
        return respond({ message: 'Project updated' });
      }

      // ==================== CONVERSATIONS ====================
      case 'export_conversation': {
        if (!conversationDbId) return error('No conversation database configured');
        
        const data = args?.conversationData as any;
        const messages = data?.messages || [];
        
        // Generate title from first user message
        const title = args?.title as string || 
          messages.find((m: any) => m.role === 'user')?.content?.slice(0, 50) + '...' ||
          'Gemini Conversation';
        
        // Convert conversation to blocks
        const blocks: any[] = [];
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
        
        const properties: any = {
          'Title': { title: [{ text: { content: title } }] },
          'Export Date': { date: { start: new Date().toISOString() } },
          'Message Count': { number: messages.length },
        };
        
        if (args?.tags) {
          properties['Tags'] = { multi_select: (args.tags as string[]).map(t => ({ name: t })) };
        }
        
        const page = await notion.pages.create({
          parent: { database_id: conversationDbId },
          properties,
          children: blocks.slice(0, 100), // Notion limit
        });
        
        return respond({ 
          id: page.id, 
          url: (page as any).url,
          title,
          messageCount: messages.length,
          message: 'Conversation exported successfully' 
        });
      }

      case 'link_conversation_to_project': {
        const conversationId = parsePageId(args?.conversationId as string);
        let projectId = args?.projectId as string;
        
        // Find project by name if needed
        if (!projectId.match(/^[a-f0-9-]{32,36}$/i)) {
          const search = await notion.databases.query({
            database_id: projectDbId,
            filter: { property: 'Project Name', title: { contains: projectId } },
            page_size: 1,
          });
          if (search.results.length === 0) return error(`Project not found: ${projectId}`);
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
        const sourceId = parsePageId(args?.pageId as string);
        const source = await notion.pages.retrieve({ page_id: sourceId }) as any;
        const blocks = await notion.blocks.children.list({ block_id: sourceId, page_size: 100 });
        
        const targetParent = args?.targetParentId 
          ? parsePageId(args.targetParentId as string)
          : source.parent.page_id || source.parent.database_id;
        
        const newTitle = args?.newTitle as string || 
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
          children: blocks.results as any[],
        });
        
        return respond({ id: newPage.id, url: (newPage as any).url, message: 'Page duplicated' });
      }

      case 'get_recent_changes': {
        const filter = args?.filter === 'all' ? undefined :
          args?.filter ? { property: 'object' as const, value: args.filter as 'page' | 'database' } : undefined;
        
        const results = await notion.search({
          filter,
          sort: { direction: 'descending', timestamp: 'last_edited_time' },
          page_size: (args?.limit as number) || 20,
        });
        
        const formatted = results.results.map((r: any) => ({
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
  } catch (err: any) {
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
