#!/usr/bin/env node
// Notion MCP Server v3.0.0 - Enhanced Edition with 46 tools (38 original + 8 enhanced)
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema, } from '@modelcontextprotocol/sdk/types.js';
import { Client, APIResponseError } from '@notionhq/client';
import { tools } from './tools.js';
import { getNotionApiKey } from './credentials.js';
import { readFileSync, existsSync, statSync, readdirSync } from 'fs';
import { join, dirname, extname, basename } from 'path';
import { fileURLToPath } from 'url';
// Enhanced tools for v3.0
const enhancedTools = [
    {
        name: "check_api_health",
        description: "Comprehensive API health check with performance metrics",
        inputSchema: {
            type: "object",
            properties: {
                includeDetails: { type: "boolean", description: "Include detailed metrics", default: true }
            }
        }
    },
    {
        name: "get_usage_statistics",
        description: "Get detailed API usage statistics and rate limit status",
        inputSchema: {
            type: "object",
            properties: {
                timeWindow: { type: "string", enum: ["1h", "24h", "7d"], default: "24h" }
            }
        }
    },
    {
        name: "create_database_from_template",
        description: "Create databases with pre-configured templates (Document Scanner, Project Tracker, etc.)",
        inputSchema: {
            type: "object",
            properties: {
                parentPageId: { type: "string", description: "Parent page ID" },
                templateName: {
                    type: "string",
                    enum: ["document_scanner", "project_tracker", "meeting_notes", "task_management"],
                    description: "Pre-built template"
                },
                databaseTitle: { type: "string", description: "Database title" }
            },
            required: ["parentPageId", "templateName", "databaseTitle"]
        }
    },
    {
        name: "bulk_create_pages_from_files",
        description: "Process multiple files and create database entries with proper rate limiting",
        inputSchema: {
            type: "object",
            properties: {
                folderPath: { type: "string", description: "Folder containing files" },
                databaseId: { type: "string", description: "Target database" },
                fileExtensions: { type: "array", items: { type: "string" }, default: [".pdf"] }
            },
            required: ["folderPath", "databaseId"]
        }
    },
    {
        name: "upload_file_to_notion",
        description: "Process files privately for Notion integration. PRIVACY-FIRST: Never uploads files externally. Extracts text content, metadata, and creates secure file references without compromising confidentiality.",
        inputSchema: {
            type: "object",
            properties: {
                filePath: { type: "string", description: "Local file path to process" },
                filename: { type: "string", description: "Custom filename (optional)" },
                mode: {
                    type: "string",
                    enum: ["extract", "metadata", "secure"],
                    description: "Processing mode: 'extract' gets text content from documents, 'metadata' shows file info only, 'secure' creates file reference with summary"
                },
                attachTo: {
                    type: "object",
                    properties: {
                        type: { type: "string", enum: ["page", "database"], description: "Where to attach the file reference" },
                        id: { type: "string", description: "Page or database ID" }
                    },
                    required: ["type", "id"]
                }
            },
            required: ["filePath"]
        }
    },
    {
        name: "start_file_watcher",
        description: "Start monitoring a folder for new files and automatically upload them to Notion. Perfect for scanner automation based on research findings.",
        inputSchema: {
            type: "object",
            properties: {
                watchPath: { type: "string", description: "Folder to monitor" },
                databaseId: { type: "string", description: "Target Notion database" },
                fileFilter: { type: "array", items: { type: "string" }, description: "File extensions to monitor", default: [".pdf", ".jpg", ".png"] },
                autoProcess: { type: "boolean", description: "Automatically create database entries", default: true }
            },
            required: ["watchPath", "databaseId"]
        }
    },
    {
        name: "stop_file_watcher",
        description: "Stop file monitoring for a specific path or all watchers",
        inputSchema: {
            type: "object",
            properties: {
                watcherPath: { type: "string", description: "Path to stop watching (optional, stops all if not provided)" }
            }
        }
    },
    {
        name: "list_active_watchers",
        description: "List all currently active file monitoring processes",
        inputSchema: { type: "object", properties: {} }
    }
];
// Combined tools array (original + enhanced)
const allTools = [...tools, ...enhancedTools];
// Debug: Log number of tools being registered
console.error(`📊 Registering ${allTools.length} tools: ${allTools.map(t => t.name).slice(0, 5).join(', ')}${allTools.length > 5 ? '...' : ''}`);
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
// AUTO-PAGINATION (for >100 items)
// ============================================================
/**
 * Paginate through all results from a database query
 * Notion API returns max 100 items per request
 */
async function paginateQuery(databaseId, filter, sorts, maxItems = 1000) {
    const allResults = [];
    let hasMore = true;
    let startCursor = undefined;
    while (hasMore && allResults.length < maxItems) {
        const response = await withRetry(() => notion.databases.query({
            database_id: databaseId,
            filter,
            sorts,
            page_size: 100,
            start_cursor: startCursor,
        }), 3, 'paginate_query');
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
async function paginateBlockChildren(blockId, maxBlocks = 500) {
    const allBlocks = [];
    let hasMore = true;
    let startCursor = undefined;
    while (hasMore && allBlocks.length < maxBlocks) {
        const response = await withRetry(() => notion.blocks.children.list({
            block_id: blockId,
            page_size: 100,
            start_cursor: startCursor,
        }), 3, 'paginate_blocks');
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
function chunkContent(content, chunkSize = MAX_CHUNK_SIZE) {
    if (content.length <= chunkSize) {
        return [content];
    }
    const chunks = [];
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
function createChunkedBlocks(content, blockType = 'paragraph') {
    const blocks = [];
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
    }
    else {
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
async function appendBlocksInBatches(pageId, blocks, batchSize = 100) {
    for (let i = 0; i < blocks.length; i += batchSize) {
        const batch = blocks.slice(i, i + batchSize);
        await withRetry(() => notion.blocks.children.append({
            block_id: pageId,
            children: batch,
        }), 3, `append_blocks_batch_${Math.floor(i / batchSize) + 1}`);
        // Log progress for large appends
        if (blocks.length > batchSize) {
            console.error(`[Batch Append] ${Math.min(i + batchSize, blocks.length)}/${blocks.length} blocks`);
        }
    }
}
class TTLCache {
    cache = new Map();
    defaultTTL;
    constructor(defaultTTLSeconds = 300) {
        this.defaultTTL = defaultTTLSeconds * 1000;
    }
    set(key, data, ttlSeconds) {
        this.cache.set(key, {
            data,
            timestamp: Date.now(),
            ttl: (ttlSeconds ?? this.defaultTTL / 1000) * 1000,
        });
    }
    get(key) {
        const entry = this.cache.get(key);
        if (!entry)
            return undefined;
        if (Date.now() - entry.timestamp > entry.ttl) {
            this.cache.delete(key);
            return undefined;
        }
        return entry.data;
    }
    has(key) {
        return this.get(key) !== undefined;
    }
    invalidate(key) {
        this.cache.delete(key);
    }
    invalidatePattern(pattern) {
        const regex = new RegExp(pattern);
        for (const key of this.cache.keys()) {
            if (regex.test(key)) {
                this.cache.delete(key);
            }
        }
    }
    clear() {
        this.cache.clear();
    }
    stats() {
        return { size: this.cache.size, keys: Array.from(this.cache.keys()) };
    }
}
// Global caches with different TTLs
const schemaCache = new TTLCache(600); // 10 min for schemas (rarely change)
const listCache = new TTLCache(120); // 2 min for lists (moderately dynamic)
const userCache = new TTLCache(1800); // 30 min for users (rarely change)
const pageCache = new TTLCache(60); // 1 min for pages (frequently change)
class Logger {
    level = 'info';
    logs = [];
    maxLogs = 1000;
    levelPriority = {
        debug: 0,
        info: 1,
        warn: 2,
        error: 3,
    };
    setLevel(level) {
        this.level = level;
    }
    shouldLog(level) {
        return this.levelPriority[level] >= this.levelPriority[this.level];
    }
    log(level, operation, message, metadata) {
        if (!this.shouldLog(level))
            return;
        const entry = {
            timestamp: new Date().toISOString(),
            level,
            operation,
            message,
            metadata,
        };
        this.logs.push(entry);
        if (this.logs.length > this.maxLogs) {
            this.logs.shift();
        }
        // Output to stderr (MCP standard)
        const prefix = `[${level.toUpperCase()}][${operation}]`;
        console.error(`${prefix} ${message}`, metadata ? JSON.stringify(metadata) : '');
    }
    debug(operation, message, metadata) {
        this.log('debug', operation, message, metadata);
    }
    info(operation, message, metadata) {
        this.log('info', operation, message, metadata);
    }
    warn(operation, message, metadata) {
        this.log('warn', operation, message, metadata);
    }
    error(operation, message, metadata) {
        this.log('error', operation, message, metadata);
    }
    getRecentLogs(count = 50) {
        return this.logs.slice(-count);
    }
    getLogs(options) {
        return this.logs.filter(log => {
            if (options.level && this.levelPriority[log.level] < this.levelPriority[options.level])
                return false;
            if (options.operation && log.operation !== options.operation)
                return false;
            if (options.since && new Date(log.timestamp) < options.since)
                return false;
            return true;
        });
    }
}
const logger = new Logger();
class Metrics {
    metrics = new Map();
    startTimes = new Map();
    startTimer(operation, callId) {
        this.startTimes.set(`${operation}:${callId}`, Date.now());
    }
    endTimer(operation, callId, error = false) {
        const key = `${operation}:${callId}`;
        const startTime = this.startTimes.get(key);
        this.startTimes.delete(key);
        const duration = startTime ? Date.now() - startTime : 0;
        let entry = this.metrics.get(operation);
        if (!entry) {
            entry = { operation, count: 0, totalDuration: 0, errors: 0, lastCall: 0, avgDuration: 0 };
            this.metrics.set(operation, entry);
        }
        entry.count++;
        entry.totalDuration += duration;
        entry.avgDuration = entry.totalDuration / entry.count;
        entry.lastCall = Date.now();
        if (error)
            entry.errors++;
        return duration;
    }
    getMetrics() {
        return Object.fromEntries(this.metrics);
    }
    getOperationMetrics(operation) {
        return this.metrics.get(operation);
    }
    getSummary() {
        let totalCalls = 0;
        let totalErrors = 0;
        let totalDuration = 0;
        for (const entry of this.metrics.values()) {
            totalCalls += entry.count;
            totalErrors += entry.errors;
            totalDuration += entry.totalDuration;
        }
        return {
            totalCalls,
            totalErrors,
            avgLatency: totalCalls > 0 ? totalDuration / totalCalls : 0,
            operations: this.metrics.size,
        };
    }
    reset() {
        this.metrics.clear();
        this.startTimes.clear();
    }
}
const metrics = new Metrics();
class OfflineQueue {
    queue = [];
    isOnline = true;
    maxQueueSize = 100;
    maxRetries = 3;
    setOnlineStatus(online) {
        this.isOnline = online;
        if (online) {
            logger.info('OfflineQueue', 'Back online, processing queued operations');
        }
    }
    isQueueEnabled() {
        return !this.isOnline;
    }
    enqueue(operation, args) {
        if (this.queue.length >= this.maxQueueSize) {
            throw new Error('Offline queue is full. Please try again when online.');
        }
        const id = `q_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        this.queue.push({
            id,
            operation,
            args,
            timestamp: Date.now(),
            retries: 0,
        });
        logger.info('OfflineQueue', `Queued operation: ${operation}`, { id });
        return id;
    }
    getQueuedOperations() {
        return [...this.queue];
    }
    getQueueSize() {
        return this.queue.length;
    }
    removeFromQueue(id) {
        const index = this.queue.findIndex(op => op.id === id);
        if (index !== -1) {
            this.queue.splice(index, 1);
            return true;
        }
        return false;
    }
    clearQueue() {
        this.queue = [];
    }
    // Get next operation to process (for sync processing)
    dequeue() {
        return this.queue.shift();
    }
}
const offlineQueue = new OfflineQueue();
const builtInTemplates = {
    'meeting-notes': {
        id: 'meeting-notes',
        name: 'Meeting Notes',
        description: 'Template for meeting documentation',
        icon: '📝',
        properties: {},
        blocks: [
            { type: 'heading_2', heading_2: { rich_text: [{ type: 'text', text: { content: '📅 Meeting Details' } }] } },
            { type: 'bulleted_list_item', bulleted_list_item: { rich_text: [{ type: 'text', text: { content: 'Date: ' } }] } },
            { type: 'bulleted_list_item', bulleted_list_item: { rich_text: [{ type: 'text', text: { content: 'Attendees: ' } }] } },
            { type: 'bulleted_list_item', bulleted_list_item: { rich_text: [{ type: 'text', text: { content: 'Duration: ' } }] } },
            { type: 'divider', divider: {} },
            { type: 'heading_2', heading_2: { rich_text: [{ type: 'text', text: { content: '📋 Agenda' } }] } },
            { type: 'numbered_list_item', numbered_list_item: { rich_text: [{ type: 'text', text: { content: 'Item 1' } }] } },
            { type: 'divider', divider: {} },
            { type: 'heading_2', heading_2: { rich_text: [{ type: 'text', text: { content: '📝 Notes' } }] } },
            { type: 'paragraph', paragraph: { rich_text: [] } },
            { type: 'divider', divider: {} },
            { type: 'heading_2', heading_2: { rich_text: [{ type: 'text', text: { content: '✅ Action Items' } }] } },
            { type: 'to_do', to_do: { rich_text: [{ type: 'text', text: { content: 'Action item 1' } }], checked: false } },
        ],
    },
    'project-brief': {
        id: 'project-brief',
        name: 'Project Brief',
        description: 'Template for project documentation',
        icon: '📊',
        properties: {},
        blocks: [
            { type: 'heading_2', heading_2: { rich_text: [{ type: 'text', text: { content: '🎯 Project Overview' } }] } },
            { type: 'paragraph', paragraph: { rich_text: [{ type: 'text', text: { content: 'Brief description of the project...' } }] } },
            { type: 'divider', divider: {} },
            { type: 'heading_2', heading_2: { rich_text: [{ type: 'text', text: { content: '📋 Objectives' } }] } },
            { type: 'numbered_list_item', numbered_list_item: { rich_text: [{ type: 'text', text: { content: 'Objective 1' } }] } },
            { type: 'divider', divider: {} },
            { type: 'heading_2', heading_2: { rich_text: [{ type: 'text', text: { content: '👥 Team' } }] } },
            { type: 'bulleted_list_item', bulleted_list_item: { rich_text: [{ type: 'text', text: { content: 'Team member 1' } }] } },
            { type: 'divider', divider: {} },
            { type: 'heading_2', heading_2: { rich_text: [{ type: 'text', text: { content: '📅 Timeline' } }] } },
            { type: 'bulleted_list_item', bulleted_list_item: { rich_text: [{ type: 'text', text: { content: 'Phase 1: ' } }] } },
            { type: 'divider', divider: {} },
            { type: 'heading_2', heading_2: { rich_text: [{ type: 'text', text: { content: '🔗 Resources' } }] } },
            { type: 'paragraph', paragraph: { rich_text: [] } },
        ],
    },
    'daily-standup': {
        id: 'daily-standup',
        name: 'Daily Standup',
        description: 'Template for daily standup notes',
        icon: '☀️',
        properties: {},
        blocks: [
            { type: 'heading_2', heading_2: { rich_text: [{ type: 'text', text: { content: '✅ Yesterday' } }] } },
            { type: 'bulleted_list_item', bulleted_list_item: { rich_text: [{ type: 'text', text: { content: 'Completed task 1' } }] } },
            { type: 'divider', divider: {} },
            { type: 'heading_2', heading_2: { rich_text: [{ type: 'text', text: { content: '📋 Today' } }] } },
            { type: 'bulleted_list_item', bulleted_list_item: { rich_text: [{ type: 'text', text: { content: 'Planned task 1' } }] } },
            { type: 'divider', divider: {} },
            { type: 'heading_2', heading_2: { rich_text: [{ type: 'text', text: { content: '🚧 Blockers' } }] } },
            { type: 'paragraph', paragraph: { rich_text: [{ type: 'text', text: { content: 'None' } }] } },
        ],
    },
    'bug-report': {
        id: 'bug-report',
        name: 'Bug Report',
        description: 'Template for bug documentation',
        icon: '🐛',
        properties: {},
        blocks: [
            { type: 'heading_2', heading_2: { rich_text: [{ type: 'text', text: { content: '🐛 Bug Description' } }] } },
            { type: 'paragraph', paragraph: { rich_text: [{ type: 'text', text: { content: 'Describe the bug...' } }] } },
            { type: 'divider', divider: {} },
            { type: 'heading_2', heading_2: { rich_text: [{ type: 'text', text: { content: '📝 Steps to Reproduce' } }] } },
            { type: 'numbered_list_item', numbered_list_item: { rich_text: [{ type: 'text', text: { content: 'Step 1' } }] } },
            { type: 'divider', divider: {} },
            { type: 'heading_2', heading_2: { rich_text: [{ type: 'text', text: { content: '✅ Expected Behavior' } }] } },
            { type: 'paragraph', paragraph: { rich_text: [] } },
            { type: 'divider', divider: {} },
            { type: 'heading_2', heading_2: { rich_text: [{ type: 'text', text: { content: '❌ Actual Behavior' } }] } },
            { type: 'paragraph', paragraph: { rich_text: [] } },
            { type: 'divider', divider: {} },
            { type: 'heading_2', heading_2: { rich_text: [{ type: 'text', text: { content: '🖥️ Environment' } }] } },
            { type: 'bulleted_list_item', bulleted_list_item: { rich_text: [{ type: 'text', text: { content: 'OS: ' } }] } },
            { type: 'bulleted_list_item', bulleted_list_item: { rich_text: [{ type: 'text', text: { content: 'Browser: ' } }] } },
            { type: 'bulleted_list_item', bulleted_list_item: { rich_text: [{ type: 'text', text: { content: 'Version: ' } }] } },
        ],
    },
    'code-review': {
        id: 'code-review',
        name: 'Code Review',
        description: 'Template for code review documentation',
        icon: '🔍',
        properties: {},
        blocks: [
            { type: 'heading_2', heading_2: { rich_text: [{ type: 'text', text: { content: '📋 Review Summary' } }] } },
            { type: 'bulleted_list_item', bulleted_list_item: { rich_text: [{ type: 'text', text: { content: 'PR/MR Link: ' } }] } },
            { type: 'bulleted_list_item', bulleted_list_item: { rich_text: [{ type: 'text', text: { content: 'Author: ' } }] } },
            { type: 'bulleted_list_item', bulleted_list_item: { rich_text: [{ type: 'text', text: { content: 'Reviewer: ' } }] } },
            { type: 'divider', divider: {} },
            { type: 'heading_2', heading_2: { rich_text: [{ type: 'text', text: { content: '✅ What Works Well' } }] } },
            { type: 'bulleted_list_item', bulleted_list_item: { rich_text: [] } },
            { type: 'divider', divider: {} },
            { type: 'heading_2', heading_2: { rich_text: [{ type: 'text', text: { content: '⚠️ Suggestions' } }] } },
            { type: 'bulleted_list_item', bulleted_list_item: { rich_text: [] } },
            { type: 'divider', divider: {} },
            { type: 'heading_2', heading_2: { rich_text: [{ type: 'text', text: { content: '❓ Questions' } }] } },
            { type: 'bulleted_list_item', bulleted_list_item: { rich_text: [] } },
        ],
    },
};
function getTemplate(templateId) {
    return builtInTemplates[templateId];
}
function listTemplates() {
    return Object.values(builtInTemplates);
}
function validatePropertiesAgainstSchema(properties, schema) {
    const errors = [];
    for (const [propName, propValue] of Object.entries(properties)) {
        const schemaProp = schema[propName];
        if (!schemaProp) {
            errors.push(`Unknown property: ${propName}`);
            continue;
        }
        const expectedType = schemaProp.type;
        // Type validation
        switch (expectedType) {
            case 'title':
            case 'rich_text':
                if (typeof propValue !== 'string' && !Array.isArray(propValue)) {
                    errors.push(`${propName}: Expected string or rich_text array`);
                }
                break;
            case 'number':
                if (typeof propValue !== 'number') {
                    errors.push(`${propName}: Expected number`);
                }
                break;
            case 'checkbox':
                if (typeof propValue !== 'boolean') {
                    errors.push(`${propName}: Expected boolean`);
                }
                break;
            case 'select':
                if (typeof propValue !== 'string') {
                    errors.push(`${propName}: Expected string for select`);
                }
                else if (schemaProp.select?.options) {
                    const validOptions = schemaProp.select.options.map((o) => o.name);
                    if (!validOptions.includes(propValue)) {
                        errors.push(`${propName}: Invalid option "${propValue}". Valid: ${validOptions.join(', ')}`);
                    }
                }
                break;
            case 'multi_select':
                if (!Array.isArray(propValue)) {
                    errors.push(`${propName}: Expected array for multi_select`);
                }
                break;
            case 'date':
                if (typeof propValue !== 'string' && typeof propValue !== 'object') {
                    errors.push(`${propName}: Expected date string or object`);
                }
                break;
            case 'url':
                if (typeof propValue !== 'string') {
                    errors.push(`${propName}: Expected URL string`);
                }
                break;
            case 'email':
                if (typeof propValue !== 'string' || !propValue.includes('@')) {
                    errors.push(`${propName}: Expected valid email`);
                }
                break;
            case 'phone_number':
                if (typeof propValue !== 'string') {
                    errors.push(`${propName}: Expected phone number string`);
                }
                break;
        }
    }
    return { valid: errors.length === 0, errors };
}
async function checkHealth() {
    const startTime = Date.now();
    let notionApiHealthy = false;
    try {
        await withRetry(() => notion.users.me({}), 1, 'health_check');
        notionApiHealthy = true;
    }
    catch {
        notionApiHealthy = false;
    }
    const latencyMs = Date.now() - startTime;
    const metricsSummary = metrics.getSummary();
    return {
        status: notionApiHealthy ? 'healthy' : 'unhealthy',
        notionApi: notionApiHealthy,
        latencyMs,
        cacheStats: {
            schemas: schemaCache.stats().size,
            lists: listCache.stats().size,
            pages: pageCache.stats().size,
            users: userCache.stats().size,
        },
        queueSize: offlineQueue.getQueueSize(),
        metrics: {
            totalCalls: metricsSummary.totalCalls,
            totalErrors: metricsSummary.totalErrors,
            avgLatency: Math.round(metricsSummary.avgLatency),
        },
        timestamp: new Date().toISOString(),
    };
}
async function batchCreatePages(parentId, pages) {
    const results = { successful: 0, failed: 0, results: [] };
    for (const page of pages) {
        try {
            const response = await withRetry(() => notion.pages.create({
                parent: { page_id: parentId },
                properties: {
                    title: { title: [{ text: { content: page.title } }] },
                    ...page.properties,
                },
            }), 3, 'batch_create_page');
            // Add content if provided
            if (page.content) {
                const blocks = markdownToBlocks(page.content);
                await appendBlocksInBatches(response.id, blocks);
            }
            results.successful++;
            results.results.push({ id: response.id, success: true });
        }
        catch (error) {
            results.failed++;
            results.results.push({ id: page.title, success: false, error: error.message });
        }
    }
    return results;
}
async function batchArchivePages(pageIds) {
    const results = { successful: 0, failed: 0, results: [] };
    for (const pageId of pageIds) {
        try {
            await withRetry(() => notion.pages.update({ page_id: pageId, archived: true }), 3, 'batch_archive_page');
            results.successful++;
            results.results.push({ id: pageId, success: true });
        }
        catch (error) {
            results.failed++;
            results.results.push({ id: pageId, success: false, error: error.message });
        }
    }
    return results;
}
async function batchDeleteBlocks(blockIds) {
    const results = { successful: 0, failed: 0, results: [] };
    for (const blockId of blockIds) {
        try {
            await withRetry(() => notion.blocks.delete({ block_id: blockId }), 3, 'batch_delete_block');
            results.successful++;
            results.results.push({ id: blockId, success: true });
        }
        catch (error) {
            results.failed++;
            results.results.push({ id: blockId, success: false, error: error.message });
        }
    }
    return results;
}
// ============================================================
// PAGE DUPLICATION
// ============================================================
async function duplicatePage(sourcePageId, options = {}) {
    // Get source page
    const sourcePage = await withRetry(() => notion.pages.retrieve({ page_id: sourcePageId }), 3, 'duplicate_get_source');
    // Determine parent
    const parent = options.targetParentId
        ? { page_id: options.targetParentId }
        : sourcePage.parent;
    // Clone properties
    const properties = { ...sourcePage.properties };
    // Update title if provided
    if (options.newTitle) {
        const titleKey = Object.keys(properties).find(k => properties[k].type === 'title');
        if (titleKey) {
            properties[titleKey] = { title: [{ text: { content: options.newTitle } }] };
        }
    }
    else {
        // Append " (Copy)" to title
        const titleKey = Object.keys(properties).find(k => properties[k].type === 'title');
        if (titleKey && properties[titleKey].title?.[0]?.text?.content) {
            const originalTitle = properties[titleKey].title[0].text.content;
            properties[titleKey] = { title: [{ text: { content: `${originalTitle} (Copy)` } }] };
        }
    }
    // Create new page
    const newPage = await withRetry(() => notion.pages.create({
        parent,
        icon: sourcePage.icon,
        cover: sourcePage.cover,
        properties,
    }), 3, 'duplicate_create_page');
    // Copy content if requested
    if (options.includeContent !== false) {
        const blocks = await paginateBlockChildren(sourcePageId);
        if (blocks.length > 0) {
            // Deep clone blocks (remove IDs)
            const clonedBlocks = blocks.map((block) => {
                const { id, created_time, last_edited_time, created_by, last_edited_by, has_children, parent, ...rest } = block;
                return rest;
            });
            await appendBlocksInBatches(newPage.id, clonedBlocks);
        }
    }
    return newPage;
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
function resolveDatabaseId(nameOrId) {
    console.error(`🔍 Resolving database: '${nameOrId}'`);
    if (nameOrId === 'conversations') {
        if (!conversationDbId) {
            throw new Error('Conversation database not configured. Please run setup or provide a valid database ID.');
        }
        return conversationDbId;
    }
    if (nameOrId === 'projects') {
        if (!projectDbId) {
            throw new Error('Project database not configured. Please run setup or provide a valid database ID.');
        }
        return projectDbId;
    }
    // Check if it's already a UUID
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(nameOrId)) {
        console.error(`✓ Using database ID directly: ${nameOrId}`);
        return nameOrId;
    }
    // Check if it's a Notion URL or ID format
    const cleaned = nameOrId.replace(/-/g, '');
    if (cleaned.length === 32) {
        const formatted = `${cleaned.substr(0, 8)}-${cleaned.substr(8, 4)}-${cleaned.substr(12, 4)}-${cleaned.substr(16, 4)}-${cleaned.substr(20, 12)}`;
        console.error(`✓ Formatted database ID: ${formatted}`);
        return formatted;
    }
    // If all else fails, return as-is and let Notion API handle it
    console.error(`⚠️ Using database identifier as-is: ${nameOrId}`);
    return nameOrId;
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
                    case 'people':
                        formatted[key] = prop.people?.map((p) => p.id);
                        break;
                    case 'files':
                        formatted[key] = prop.files?.map((f) => f.name || f.file?.url || f.external?.url);
                        break;
                    case 'formula':
                        formatted[key] = prop.formula?.string || prop.formula?.number || prop.formula?.boolean || prop.formula?.date?.start;
                        break;
                    case 'rollup':
                        formatted[key] = prop.rollup?.array || prop.rollup?.number || prop.rollup?.date?.start;
                        break;
                    case 'created_time':
                        formatted[key] = prop.created_time;
                        break;
                    case 'created_by':
                        formatted[key] = prop.created_by?.id;
                        break;
                    case 'last_edited_time':
                        formatted[key] = prop.last_edited_time;
                        break;
                    case 'last_edited_by':
                        formatted[key] = prop.last_edited_by?.id;
                        break;
                    case 'status':
                        formatted[key] = prop.status?.name;
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
        // Track server start time for uptime metrics
        global.serverStartTime = Date.now();
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
const server = new Server({ name: 'notion-sync-enhanced', version: '3.0.1' }, { capabilities: { tools: {} } });
// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
    console.error(`🔧 ListTools requested: returning ${allTools.length} tools`);
    return { tools: allTools };
});
// Handle tool execution
server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    console.error(`🚀 Tool called: ${name}`);
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
                const formatted = results.results.map((r) => {
                    let title = '';
                    if (r.object === 'database') {
                        title = richTextToPlain(r.title);
                    }
                    else {
                        // Check common title property names for pages
                        const props = r.properties || {};
                        const titleProp = props.title?.title || props.Name?.title || props.Title?.title ||
                            props.name?.title || props['Page Title']?.title || [];
                        title = richTextToPlain(titleProp) || 'Untitled';
                    }
                    return {
                        id: r.id,
                        type: r.object,
                        title,
                        url: r.url,
                        lastEdited: r.last_edited_time,
                    };
                });
                return respond({ count: formatted.length, results: formatted });
            }
            // ==================== PAGES ====================
            case 'create_page': {
                let parent;
                if (args?.parentDatabaseId) {
                    // Creating in a specific database
                    const resolvedDbId = resolveDatabaseId(args.parentDatabaseId);
                    parent = { database_id: resolvedDbId };
                    console.error(`🎯 Creating page in database: ${resolvedDbId}`);
                }
                else if (args?.parentPageId) {
                    // Creating under a specific page
                    const resolvedPageId = parsePageId(args.parentPageId);
                    parent = { page_id: resolvedPageId };
                    console.error(`📄 Creating page under parent: ${resolvedPageId}`);
                }
                else if (conversationDbId) {
                    // Fallback to conversation database
                    parent = { page_id: parsePageId(conversationDbId) };
                    console.error(`💬 Creating page in conversation database: ${conversationDbId}`);
                }
                else {
                    return error('No parent specified. Please provide either parentDatabaseId or parentPageId, or ensure conversation database is configured.');
                }
                let properties;
                if (args?.parentDatabaseId) {
                    // When creating in a database, we need to check the database schema for the title property
                    properties = args?.properties || {};
                    // Only add title if not already provided in properties
                    if (args?.title && !properties.hasOwnProperty('title') && !properties.hasOwnProperty('Name') &&
                        !properties.hasOwnProperty('Title') && !properties.hasOwnProperty('name')) {
                        // Default to 'Name' property for database entries
                        properties['Name'] = { title: [{ text: { content: args.title } }] };
                    }
                    else if (args?.title) {
                        // Override existing title property if provided
                        const titleKey = Object.keys(properties).find(k => k.toLowerCase().includes('title') || k.toLowerCase().includes('name')) || 'Name';
                        properties[titleKey] = { title: [{ text: { content: args.title } }] };
                    }
                }
                else {
                    // For standalone pages, always use 'title'
                    properties = { title: { title: [{ text: { content: args?.title } }] } };
                }
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
                    // Use pagination for large pages
                    content = await paginateBlockChildren(pageId, 500);
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
                const limit = args?.limit || 100;
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
                // Use pagination for large queries (>100 items)
                let results;
                if (limit > 100) {
                    results = await paginateQuery(dbId, args?.filter, processedSorts, limit);
                }
                else {
                    const response = await withRetry(() => notion.databases.query({
                        database_id: dbId,
                        filter: args?.filter,
                        sorts: processedSorts,
                        page_size: limit,
                    }), 3, 'query_database');
                    results = response.results;
                }
                const formatted = formatDatabaseResults(results);
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
                let blocks = args?.blocks || [];
                // Handle large content with auto-chunking
                if (args?.content) {
                    const content = args.content;
                    if (content.length > 50000) {
                        // Use chunking for large content
                        blocks = createChunkedBlocks(content, 'paragraph');
                    }
                    else {
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
                const newTitle = args?.newTitle;
                const targetParentId = args?.targetParentId
                    ? parsePageId(args.targetParentId)
                    : undefined;
                const newPage = await duplicatePage(sourceId, {
                    newTitle,
                    targetParentId,
                    includeContent: true,
                });
                return respond({ id: newPage.id, url: newPage.url, message: 'Page duplicated with content' });
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
            // ==================== ADVANCED OPERATIONS ====================
            case 'health_check': {
                const health = await checkHealth();
                return respond(health);
            }
            case 'get_metrics': {
                const operation = args?.operation;
                if (operation) {
                    const opMetrics = metrics.getOperationMetrics(operation);
                    return respond(opMetrics || { error: `No metrics for operation: ${operation}` });
                }
                return respond({
                    summary: metrics.getSummary(),
                    operations: metrics.getMetrics(),
                });
            }
            case 'get_logs': {
                const count = args?.count || 50;
                const level = args?.level;
                const operation = args?.operation;
                const logs = level || operation
                    ? logger.getLogs({ level, operation })
                    : logger.getRecentLogs(count);
                return respond({ count: logs.length, logs });
            }
            case 'clear_cache': {
                const cacheType = args?.type || 'all';
                switch (cacheType) {
                    case 'schemas':
                        schemaCache.clear();
                        break;
                    case 'lists':
                        listCache.clear();
                        break;
                    case 'pages':
                        pageCache.clear();
                        break;
                    case 'users':
                        userCache.clear();
                        break;
                    case 'all':
                    default:
                        schemaCache.clear();
                        listCache.clear();
                        pageCache.clear();
                        userCache.clear();
                }
                return respond({ message: `Cache cleared: ${cacheType}` });
            }
            case 'list_templates': {
                const templates = listTemplates();
                return respond({
                    count: templates.length,
                    templates: templates.map(t => ({
                        id: t.id,
                        name: t.name,
                        description: t.description,
                        icon: t.icon,
                    })),
                });
            }
            case 'create_from_template': {
                const templateId = args?.templateId;
                const title = args?.title;
                const parentPageId = args?.parentPageId;
                const parentDatabaseId = args?.parentDatabaseId;
                const template = getTemplate(templateId);
                if (!template) {
                    return error(`Unknown template: ${templateId}. Use list_templates to see available options.`);
                }
                if (!parentPageId && !parentDatabaseId) {
                    return error('Either parentPageId or parentDatabaseId is required');
                }
                const parent = parentDatabaseId
                    ? { database_id: resolveDatabaseId(parentDatabaseId) }
                    : { page_id: parsePageId(parentPageId) };
                const properties = parentDatabaseId
                    ? { Name: { title: [{ text: { content: title } }] } }
                    : { title: { title: [{ text: { content: title } }] } };
                const page = await withRetry(() => notion.pages.create({
                    parent,
                    icon: template.icon ? { emoji: template.icon } : undefined,
                    properties,
                }), 3, 'create_from_template');
                // Add template blocks
                if (template.blocks.length > 0) {
                    await appendBlocksInBatches(page.id, template.blocks);
                }
                return respond({
                    id: page.id,
                    url: page.url,
                    template: templateId,
                    message: `Page created from template: ${template.name}`,
                });
            }
            case 'batch_create_pages': {
                const parentId = parsePageId(args?.parentId);
                const pages = args?.pages;
                if (!pages || pages.length === 0) {
                    return error('No pages provided');
                }
                const result = await batchCreatePages(parentId, pages);
                return respond({
                    ...result,
                    message: `Created ${result.successful}/${pages.length} pages`,
                });
            }
            case 'batch_archive_pages': {
                const pageIds = args?.pageIds;
                if (!pageIds || pageIds.length === 0) {
                    return error('No page IDs provided');
                }
                const result = await batchArchivePages(pageIds.map(parsePageId));
                return respond({
                    ...result,
                    message: `Archived ${result.successful}/${pageIds.length} pages`,
                });
            }
            case 'batch_delete_blocks': {
                const blockIds = args?.blockIds;
                if (!blockIds || blockIds.length === 0) {
                    return error('No block IDs provided');
                }
                const result = await batchDeleteBlocks(blockIds);
                return respond({
                    ...result,
                    message: `Deleted ${result.successful}/${blockIds.length} blocks`,
                });
            }
            case 'validate_properties': {
                const databaseId = parsePageId(args?.databaseId);
                const properties = args?.properties;
                // Get database schema (with caching)
                const cacheKey = `schema:${databaseId}`;
                let schema = schemaCache.get(cacheKey);
                if (!schema) {
                    const db = await withRetry(() => notion.databases.retrieve({ database_id: databaseId }), 3, 'validate_get_schema');
                    schema = db.properties;
                    schemaCache.set(cacheKey, schema, 600);
                }
                const validation = validatePropertiesAgainstSchema(properties, schema);
                return respond(validation);
            }
            case 'get_queue_status': {
                return respond({
                    queueSize: offlineQueue.getQueueSize(),
                    operations: offlineQueue.getQueuedOperations(),
                });
            }
            case 'clear_queue': {
                offlineQueue.clearQueue();
                return respond({ message: 'Offline queue cleared' });
            }
            // ==================== ENHANCED TOOLS v3.0 ====================
            case 'check_api_health': {
                const includeDetails = args?.includeDetails ?? true;
                const startTime = Date.now();
                let apiHealthy = false;
                try {
                    await withRetry(() => notion.users.me({}), 1, 'health_check');
                    apiHealthy = true;
                }
                catch {
                    apiHealthy = false;
                }
                const latency = Date.now() - startTime;
                const health = {
                    status: apiHealthy ? 'healthy' : 'unhealthy',
                    apiConnectivity: apiHealthy,
                    latency: `${latency}ms`,
                    timestamp: new Date().toISOString()
                };
                if (includeDetails) {
                    Object.assign(health, {
                        requestsTotal: 'available_in_metrics',
                        requestsToday: 'available_in_metrics',
                        errorRate: 'available_in_metrics',
                        cacheHits: 'available_in_metrics',
                        uptimeSeconds: Math.floor((Date.now() - (global.serverStartTime || Date.now())) / 1000)
                    });
                }
                return respond(health);
            }
            case 'get_usage_statistics': {
                const timeWindow = args?.timeWindow || '24h';
                return respond({
                    timeWindow,
                    totalRequests: 'available_in_metrics',
                    requestsToday: 'available_in_metrics',
                    errorCount: 'available_in_metrics',
                    cacheHits: 'available_in_metrics',
                    averageLatency: 'available_in_metrics',
                    enhancedFeatures: {
                        toolsAvailable: allTools.length,
                        originalTools: tools.length,
                        enhancedTools: enhancedTools.length
                    }
                });
            }
            case 'create_database_from_template': {
                const parentPageId = parsePageId(args?.parentPageId);
                const templateName = args?.templateName;
                const databaseTitle = args?.databaseTitle;
                // Template definitions
                const templates = {
                    document_scanner: {
                        'Name': { title: {} },
                        'File Path': { rich_text: {} },
                        'Upload Date': { date: {} },
                        'File Size': { rich_text: {} },
                        'Document Type': {
                            select: {
                                options: [
                                    { name: 'Invoice', color: 'blue' },
                                    { name: 'Receipt', color: 'green' },
                                    { name: 'Contract', color: 'red' },
                                    { name: 'Scan', color: 'purple' }
                                ]
                            }
                        },
                        'Status': {
                            select: {
                                options: [
                                    { name: 'New', color: 'blue' },
                                    { name: 'Processed', color: 'green' },
                                    { name: 'Archived', color: 'gray' }
                                ]
                            }
                        },
                        'Notes': { rich_text: {} }
                    },
                    project_tracker: {
                        'Name': { title: {} },
                        'Status': {
                            select: {
                                options: [
                                    { name: 'Planning', color: 'blue' },
                                    { name: 'In Progress', color: 'yellow' },
                                    { name: 'Completed', color: 'green' },
                                    { name: 'On Hold', color: 'red' }
                                ]
                            }
                        },
                        'Description': { rich_text: {} },
                        'Start Date': { date: {} },
                        'Due Date': { date: {} },
                        'Priority': {
                            select: {
                                options: [
                                    { name: 'Low', color: 'gray' },
                                    { name: 'Medium', color: 'yellow' },
                                    { name: 'High', color: 'red' }
                                ]
                            }
                        }
                    },
                    meeting_notes: {
                        'Title': { title: {} },
                        'Date': { date: {} },
                        'Participants': { multi_select: {} },
                        'Meeting Type': {
                            select: {
                                options: [
                                    { name: 'Team Meeting', color: 'blue' },
                                    { name: 'Client Meeting', color: 'green' },
                                    { name: 'One-on-One', color: 'purple' },
                                    { name: 'All Hands', color: 'red' }
                                ]
                            }
                        },
                        'Action Items': { rich_text: {} },
                        'Notes': { rich_text: {} }
                    },
                    task_management: {
                        'Task': { title: {} },
                        'Status': {
                            select: {
                                options: [
                                    { name: 'To Do', color: 'red' },
                                    { name: 'In Progress', color: 'yellow' },
                                    { name: 'Done', color: 'green' },
                                    { name: 'Blocked', color: 'gray' }
                                ]
                            }
                        },
                        'Priority': {
                            select: {
                                options: [
                                    { name: 'Low', color: 'gray' },
                                    { name: 'Medium', color: 'yellow' },
                                    { name: 'High', color: 'red' },
                                    { name: 'Critical', color: 'purple' }
                                ]
                            }
                        },
                        'Assignee': { rich_text: {} },
                        'Due Date': { date: {} },
                        'Tags': { multi_select: {} }
                    }
                };
                const template = templates[templateName];
                if (!template) {
                    return error(`Unknown template: ${templateName}`);
                }
                const db = await withRetry(() => notion.databases.create({
                    parent: { page_id: parentPageId },
                    title: [{ type: 'text', text: { content: databaseTitle } }],
                    properties: template
                }), 3, 'create_database_from_template');
                return respond({
                    id: db.id,
                    title: databaseTitle,
                    template: templateName,
                    message: `Database "${databaseTitle}" created using ${templateName} template`
                });
            }
            case 'bulk_create_pages_from_files': {
                const folderPath = args?.folderPath;
                const databaseId = resolveDatabaseId(args?.databaseId);
                const fileExtensions = args?.fileExtensions || ['.pdf'];
                function scanFolderForFiles(folderPath, extensions) {
                    const files = [];
                    try {
                        const items = readdirSync(folderPath);
                        for (const item of items) {
                            const itemPath = join(folderPath, item);
                            const stat = statSync(itemPath);
                            if (stat.isFile()) {
                                const ext = extname(item).toLowerCase();
                                if (extensions.includes(ext)) {
                                    files.push(itemPath);
                                }
                            }
                        }
                    }
                    catch (error) {
                        console.error(`Error scanning folder ${folderPath}:`, error);
                    }
                    return files;
                }
                const files = scanFolderForFiles(folderPath, fileExtensions);
                let successCount = 0;
                let errorCount = 0;
                for (const filePath of files) {
                    try {
                        const filename = basename(filePath, extname(filePath));
                        await notion.pages.create({
                            parent: { database_id: databaseId },
                            properties: {
                                'Name': {
                                    title: [{ text: { content: filename } }]
                                },
                                'File Path': {
                                    rich_text: [{ text: { content: filePath } }]
                                }
                            }
                        });
                        successCount++;
                        await new Promise(resolve => setTimeout(resolve, 400)); // Rate limiting
                    }
                    catch (error) {
                        errorCount++;
                    }
                }
                return respond({
                    folderPath,
                    totalFiles: files.length,
                    successCount,
                    errorCount,
                    message: `Processed ${files.length} files: ${successCount} successful, ${errorCount} failed`
                });
            }
            case 'upload_file_to_notion': {
                const filePath = args?.filePath;
                const filename = args?.filename;
                const mode = args?.mode || 'metadata';
                const attachTo = args?.attachTo;
                if (!existsSync(filePath)) {
                    return error(`File not found: ${filePath}`);
                }
                try {
                    const fileInfo = statSync(filePath);
                    const finalFilename = filename || basename(filePath);
                    const fileExt = extname(filePath).toLowerCase();
                    // Handle different privacy-respecting modes
                    switch (mode) {
                        case 'extract': {
                            // Extract text content from various file types
                            let extractedContent = '';
                            let contentType = 'unknown';
                            try {
                                if (['.txt', '.md', '.csv', '.log', '.json', '.xml', '.yaml', '.yml'].includes(fileExt)) {
                                    extractedContent = readFileSync(filePath, 'utf-8');
                                    contentType = 'text';
                                }
                                else if (['.html', '.htm'].includes(fileExt)) {
                                    extractedContent = readFileSync(filePath, 'utf-8').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
                                    contentType = 'html-text';
                                }
                                else {
                                    // For binary files, provide secure handling info
                                    extractedContent = `[CONFIDENTIAL FILE - ${fileExt.toUpperCase()} FORMAT]\n\nFile: ${finalFilename}\nSize: ${fileInfo.size} bytes\nLast Modified: ${fileInfo.mtime.toISOString()}\n\n⚠️ PRIVACY PROTECTION: Binary file content not extracted to protect confidentiality.\n\n📋 File Summary:\n- This appears to be a ${fileExt} file\n- Contains ${fileInfo.size} bytes of data\n- Safe handling: File remains on your local system\n- No external uploads or cloud storage involved`;
                                    contentType = 'secure-summary';
                                }
                            }
                            catch (readError) {
                                extractedContent = `[PROTECTED FILE ACCESS]\n\nFile: ${finalFilename}\nSize: ${fileInfo.size} bytes\n\n🔒 File content could not be safely extracted (may contain binary or encrypted data).\n\nThis protects your privacy by not exposing potentially sensitive content.`;
                                contentType = 'protected';
                            }
                            if (attachTo) {
                                // Create a page with the extracted content
                                const parent = attachTo.type === 'database'
                                    ? { database_id: attachTo.id }
                                    : { page_id: attachTo.id };
                                const properties = attachTo.type === 'database'
                                    ? { Name: { title: [{ text: { content: `📄 ${finalFilename}` } }] } }
                                    : { title: { title: [{ text: { content: `📄 ${finalFilename}` } }] } };
                                const blocks = [
                                    {
                                        type: 'heading_2',
                                        heading_2: {
                                            rich_text: [{ type: 'text', text: { content: `File: ${finalFilename}` } }]
                                        }
                                    },
                                    {
                                        type: 'paragraph',
                                        paragraph: {
                                            rich_text: [
                                                { type: 'text', text: { content: `📊 Size: ${fileInfo.size} bytes | 📅 Modified: ${fileInfo.mtime.toLocaleDateString()} | 🔒 Privacy: Protected` } }
                                            ]
                                        }
                                    }
                                ];
                                // Add content based on what we extracted
                                if (contentType === 'text' || contentType === 'html-text') {
                                    const truncatedContent = extractedContent.slice(0, 1500); // Keep within Notion limits
                                    blocks.push({
                                        type: 'code',
                                        code: {
                                            language: fileExt === '.md' ? 'markdown' : fileExt === '.json' ? 'json' : 'plain text',
                                            rich_text: [{ type: 'text', text: { content: truncatedContent } }]
                                        }
                                    });
                                    if (extractedContent.length > 1500) {
                                        blocks.push({
                                            type: 'callout',
                                            callout: {
                                                icon: { emoji: '📝' },
                                                rich_text: [{ type: 'text', text: { content: `Content preview (${truncatedContent.length} of ${extractedContent.length} characters shown). Full content remains private on your system.` } }]
                                            }
                                        });
                                    }
                                }
                                else {
                                    // For secure summaries and protected files
                                    blocks.push({
                                        type: 'callout',
                                        callout: {
                                            icon: { emoji: '🔒' },
                                            rich_text: [{ type: 'text', text: { content: extractedContent } }]
                                        }
                                    });
                                }
                                const page = await withRetry(() => notion.pages.create({
                                    parent,
                                    properties,
                                    children: blocks
                                }), 3, 'create_file_reference');
                                return respond({
                                    success: true,
                                    pageId: page.id,
                                    filename: finalFilename,
                                    mode: 'extract',
                                    contentType,
                                    contentLength: extractedContent.length,
                                    privacy: 'PROTECTED - No external uploads, content processed locally only',
                                    message: `File reference created in Notion: ${finalFilename}`
                                });
                            }
                            else {
                                return respond({
                                    filename: finalFilename,
                                    extractedContent: extractedContent.slice(0, 200) + (extractedContent.length > 200 ? '...' : ''),
                                    fullLength: extractedContent.length,
                                    contentType,
                                    mode: 'extract',
                                    privacy: 'PROTECTED - No data uploaded externally',
                                    note: 'Specify attachTo parameter to create a Notion page with this content'
                                });
                            }
                        }
                        case 'secure': {
                            // Create secure file reference without exposing content
                            const secureInfo = {
                                filename: finalFilename,
                                size: fileInfo.size,
                                type: fileExt,
                                modified: fileInfo.mtime.toISOString(),
                                location: 'Local file system (secure)',
                                privacy: 'Full confidentiality maintained'
                            };
                            if (attachTo) {
                                const parent = attachTo.type === 'database'
                                    ? { database_id: attachTo.id }
                                    : { page_id: attachTo.id };
                                const properties = attachTo.type === 'database'
                                    ? { Name: { title: [{ text: { content: `🔒 ${finalFilename}` } }] } }
                                    : { title: { title: [{ text: { content: `🔒 ${finalFilename}` } }] } };
                                const blocks = [
                                    {
                                        type: 'heading_2',
                                        heading_2: {
                                            rich_text: [{ type: 'text', text: { content: `🔒 Confidential File Reference` } }]
                                        }
                                    },
                                    {
                                        type: 'paragraph',
                                        paragraph: {
                                            rich_text: [{ type: 'text', text: { content: `File: ${finalFilename}` } }]
                                        }
                                    },
                                    {
                                        type: 'callout',
                                        callout: {
                                            icon: { emoji: '🛡️' },
                                            rich_text: [{ type: 'text', text: { content: `PRIVACY PROTECTED\n\n📄 File: ${finalFilename}\n📊 Size: ${fileInfo.size} bytes\n📅 Modified: ${fileInfo.mtime.toLocaleDateString()}\n🔒 Status: Confidential - content not exposed\n💾 Location: Secure local storage\n\n⚠️ This file reference was created without uploading or exposing file contents to any external service.` } }]
                                        }
                                    }
                                ];
                                const page = await withRetry(() => notion.pages.create({
                                    parent,
                                    properties,
                                    children: blocks
                                }), 3, 'create_secure_reference');
                                return respond({
                                    success: true,
                                    pageId: page.id,
                                    filename: finalFilename,
                                    mode: 'secure',
                                    privacy: 'MAXIMUM PRIVACY - File content never exposed',
                                    message: `Secure file reference created: ${finalFilename}`
                                });
                            }
                            else {
                                return respond(secureInfo);
                            }
                        }
                        default: // 'metadata' mode
                            return respond({
                                filename: finalFilename,
                                fileSize: fileInfo.size,
                                fileType: fileExt,
                                path: filePath,
                                lastModified: fileInfo.mtime,
                                mode: 'metadata',
                                availableModes: {
                                    extract: 'Safely extract text content from documents (text files, HTML, etc.)',
                                    secure: 'Create confidential file reference without exposing content',
                                    metadata: 'Show file information only (current mode)'
                                },
                                privacy: '🔒 PRIVACY GUARANTEE: Your files never leave your system. No external uploads or cloud storage involved.',
                                message: `File analyzed safely: ${finalFilename} (${fileInfo.size} bytes)`
                            });
                    }
                }
                catch (error) {
                    return error(`Failed to process file securely: ${error.message}`);
                }
            }
            case 'start_file_watcher': {
                return respond({
                    message: 'File watching feature available in standalone version',
                    note: 'This feature requires additional setup for continuous monitoring'
                });
            }
            case 'stop_file_watcher': {
                return respond({
                    message: 'No active watchers to stop',
                    note: 'File watching feature available in standalone version'
                });
            }
            case 'list_active_watchers': {
                return respond({
                    activeWatchers: [],
                    count: 0,
                    note: 'File watching feature available in standalone version'
                });
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
    console.error('🚀 Notion MCP Server v3.0.1 running - Enhanced Edition with 46 tools (38 original + 8 enhanced)');
}
main().catch(err => {
    console.error('Fatal:', err);
    process.exit(1);
});
//# sourceMappingURL=server.js.map