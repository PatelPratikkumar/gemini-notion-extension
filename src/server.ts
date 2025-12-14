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
// TTL-BASED CACHING LAYER
// ============================================================

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

class TTLCache<T> {
  private cache: Map<string, CacheEntry<T>> = new Map();
  private readonly defaultTTL: number;
  
  constructor(defaultTTLSeconds: number = 300) { // 5 min default
    this.defaultTTL = defaultTTLSeconds * 1000;
  }
  
  set(key: string, data: T, ttlSeconds?: number): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: (ttlSeconds ?? this.defaultTTL / 1000) * 1000,
    });
  }
  
  get(key: string): T | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;
    
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return undefined;
    }
    
    return entry.data;
  }
  
  has(key: string): boolean {
    return this.get(key) !== undefined;
  }
  
  invalidate(key: string): void {
    this.cache.delete(key);
  }
  
  invalidatePattern(pattern: string): void {
    const regex = new RegExp(pattern);
    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
      }
    }
  }
  
  clear(): void {
    this.cache.clear();
  }
  
  stats(): { size: number; keys: string[] } {
    return { size: this.cache.size, keys: Array.from(this.cache.keys()) };
  }
}

// Global caches with different TTLs
const schemaCache = new TTLCache<any>(600);     // 10 min for schemas (rarely change)
const listCache = new TTLCache<any>(120);       // 2 min for lists (moderately dynamic)
const userCache = new TTLCache<any>(1800);      // 30 min for users (rarely change)
const pageCache = new TTLCache<any>(60);        // 1 min for pages (frequently change)

// ============================================================
// ENHANCED LOGGING SYSTEM
// ============================================================

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  operation: string;
  message: string;
  duration?: number;
  metadata?: Record<string, any>;
}

class Logger {
  private level: LogLevel = 'info';
  private logs: LogEntry[] = [];
  private readonly maxLogs: number = 1000;
  
  private readonly levelPriority: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
  };
  
  setLevel(level: LogLevel): void {
    this.level = level;
  }
  
  private shouldLog(level: LogLevel): boolean {
    return this.levelPriority[level] >= this.levelPriority[this.level];
  }
  
  private log(level: LogLevel, operation: string, message: string, metadata?: Record<string, any>): void {
    if (!this.shouldLog(level)) return;
    
    const entry: LogEntry = {
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
  
  debug(operation: string, message: string, metadata?: Record<string, any>): void {
    this.log('debug', operation, message, metadata);
  }
  
  info(operation: string, message: string, metadata?: Record<string, any>): void {
    this.log('info', operation, message, metadata);
  }
  
  warn(operation: string, message: string, metadata?: Record<string, any>): void {
    this.log('warn', operation, message, metadata);
  }
  
  error(operation: string, message: string, metadata?: Record<string, any>): void {
    this.log('error', operation, message, metadata);
  }
  
  getRecentLogs(count: number = 50): LogEntry[] {
    return this.logs.slice(-count);
  }
  
  getLogs(options: { level?: LogLevel; operation?: string; since?: Date }): LogEntry[] {
    return this.logs.filter(log => {
      if (options.level && this.levelPriority[log.level] < this.levelPriority[options.level]) return false;
      if (options.operation && log.operation !== options.operation) return false;
      if (options.since && new Date(log.timestamp) < options.since) return false;
      return true;
    });
  }
}

const logger = new Logger();

// ============================================================
// METRICS COLLECTION
// ============================================================

interface MetricEntry {
  operation: string;
  count: number;
  totalDuration: number;
  errors: number;
  lastCall: number;
  avgDuration: number;
}

class Metrics {
  private metrics: Map<string, MetricEntry> = new Map();
  private startTimes: Map<string, number> = new Map();
  
  startTimer(operation: string, callId: string): void {
    this.startTimes.set(`${operation}:${callId}`, Date.now());
  }
  
  endTimer(operation: string, callId: string, error: boolean = false): number {
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
    if (error) entry.errors++;
    
    return duration;
  }
  
  getMetrics(): Record<string, MetricEntry> {
    return Object.fromEntries(this.metrics);
  }
  
  getOperationMetrics(operation: string): MetricEntry | undefined {
    return this.metrics.get(operation);
  }
  
  getSummary(): { totalCalls: number; totalErrors: number; avgLatency: number; operations: number } {
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
  
  reset(): void {
    this.metrics.clear();
    this.startTimes.clear();
  }
}

const metrics = new Metrics();

// ============================================================
// OFFLINE QUEUE
// ============================================================

interface QueuedOperation {
  id: string;
  operation: string;
  args: Record<string, any>;
  timestamp: number;
  retries: number;
}

class OfflineQueue {
  private queue: QueuedOperation[] = [];
  private isOnline: boolean = true;
  private readonly maxQueueSize: number = 100;
  private readonly maxRetries: number = 3;
  
  setOnlineStatus(online: boolean): void {
    this.isOnline = online;
    if (online) {
      logger.info('OfflineQueue', 'Back online, processing queued operations');
    }
  }
  
  isQueueEnabled(): boolean {
    return !this.isOnline;
  }
  
  enqueue(operation: string, args: Record<string, any>): string {
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
  
  getQueuedOperations(): QueuedOperation[] {
    return [...this.queue];
  }
  
  getQueueSize(): number {
    return this.queue.length;
  }
  
  removeFromQueue(id: string): boolean {
    const index = this.queue.findIndex(op => op.id === id);
    if (index !== -1) {
      this.queue.splice(index, 1);
      return true;
    }
    return false;
  }
  
  clearQueue(): void {
    this.queue = [];
  }
  
  // Get next operation to process (for sync processing)
  dequeue(): QueuedOperation | undefined {
    return this.queue.shift();
  }
}

const offlineQueue = new OfflineQueue();

// ============================================================
// TEMPLATE SYSTEM
// ============================================================

interface PageTemplate {
  id: string;
  name: string;
  description: string;
  icon?: string;
  properties: Record<string, any>;
  blocks: any[];
}

const builtInTemplates: Record<string, PageTemplate> = {
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

function getTemplate(templateId: string): PageTemplate | undefined {
  return builtInTemplates[templateId];
}

function listTemplates(): PageTemplate[] {
  return Object.values(builtInTemplates);
}

// ============================================================
// SCHEMA VALIDATION
// ============================================================

interface ValidationResult {
  valid: boolean;
  errors: string[];
}

function validatePropertiesAgainstSchema(
  properties: Record<string, any>,
  schema: Record<string, any>
): ValidationResult {
  const errors: string[] = [];
  
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
        } else if (schemaProp.select?.options) {
          const validOptions = schemaProp.select.options.map((o: any) => o.name);
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

// ============================================================
// HEALTH CHECK
// ============================================================

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  notionApi: boolean;
  latencyMs: number;
  cacheStats: { schemas: number; lists: number; pages: number; users: number };
  queueSize: number;
  metrics: { totalCalls: number; totalErrors: number; avgLatency: number };
  timestamp: string;
}

async function checkHealth(): Promise<HealthStatus> {
  const startTime = Date.now();
  let notionApiHealthy = false;
  
  try {
    await withRetry(() => notion.users.me({}), 1, 'health_check');
    notionApiHealthy = true;
  } catch {
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

// ============================================================
// BATCH OPERATIONS
// ============================================================

interface BatchResult {
  successful: number;
  failed: number;
  results: Array<{ id: string; success: boolean; error?: string }>;
}

async function batchCreatePages(
  parentId: string,
  pages: Array<{ title: string; properties?: Record<string, any>; content?: string }>
): Promise<BatchResult> {
  const results: BatchResult = { successful: 0, failed: 0, results: [] };
  
  for (const page of pages) {
    try {
      const response = await withRetry(
        () => notion.pages.create({
          parent: { page_id: parentId },
          properties: {
            title: { title: [{ text: { content: page.title } }] },
            ...page.properties,
          },
        }),
        3,
        'batch_create_page'
      );
      
      // Add content if provided
      if (page.content) {
        const blocks = markdownToBlocks(page.content);
        await appendBlocksInBatches(response.id, blocks);
      }
      
      results.successful++;
      results.results.push({ id: response.id, success: true });
    } catch (error: any) {
      results.failed++;
      results.results.push({ id: page.title, success: false, error: error.message });
    }
  }
  
  return results;
}

async function batchArchivePages(pageIds: string[]): Promise<BatchResult> {
  const results: BatchResult = { successful: 0, failed: 0, results: [] };
  
  for (const pageId of pageIds) {
    try {
      await withRetry(
        () => notion.pages.update({ page_id: pageId, archived: true }),
        3,
        'batch_archive_page'
      );
      results.successful++;
      results.results.push({ id: pageId, success: true });
    } catch (error: any) {
      results.failed++;
      results.results.push({ id: pageId, success: false, error: error.message });
    }
  }
  
  return results;
}

async function batchDeleteBlocks(blockIds: string[]): Promise<BatchResult> {
  const results: BatchResult = { successful: 0, failed: 0, results: [] };
  
  for (const blockId of blockIds) {
    try {
      await withRetry(
        () => notion.blocks.delete({ block_id: blockId }),
        3,
        'batch_delete_block'
      );
      results.successful++;
      results.results.push({ id: blockId, success: true });
    } catch (error: any) {
      results.failed++;
      results.results.push({ id: blockId, success: false, error: error.message });
    }
  }
  
  return results;
}

// ============================================================
// PAGE DUPLICATION
// ============================================================

async function duplicatePage(
  sourcePageId: string,
  options: { newTitle?: string; targetParentId?: string; includeContent?: boolean } = {}
): Promise<any> {
  // Get source page
  const sourcePage = await withRetry(
    () => notion.pages.retrieve({ page_id: sourcePageId }),
    3,
    'duplicate_get_source'
  ) as any;
  
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
  } else {
    // Append " (Copy)" to title
    const titleKey = Object.keys(properties).find(k => properties[k].type === 'title');
    if (titleKey && properties[titleKey].title?.[0]?.text?.content) {
      const originalTitle = properties[titleKey].title[0].text.content;
      properties[titleKey] = { title: [{ text: { content: `${originalTitle} (Copy)` } }] };
    }
  }
  
  // Create new page
  const newPage = await withRetry(
    () => notion.pages.create({
      parent,
      icon: sourcePage.icon,
      cover: sourcePage.cover,
      properties,
    }),
    3,
    'duplicate_create_page'
  );
  
  // Copy content if requested
  if (options.includeContent !== false) {
    const blocks = await paginateBlockChildren(sourcePageId);
    if (blocks.length > 0) {
      // Deep clone blocks (remove IDs)
      const clonedBlocks = blocks.map((block: any) => {
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
        const newTitle = args?.newTitle as string | undefined;
        const targetParentId = args?.targetParentId 
          ? parsePageId(args.targetParentId as string)
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

      // ==================== ADVANCED OPERATIONS ====================
      case 'health_check': {
        const health = await checkHealth();
        return respond(health);
      }

      case 'get_metrics': {
        const operation = args?.operation as string | undefined;
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
        const count = (args?.count as number) || 50;
        const level = args?.level as LogLevel | undefined;
        const operation = args?.operation as string | undefined;
        
        const logs = level || operation
          ? logger.getLogs({ level, operation })
          : logger.getRecentLogs(count);
        
        return respond({ count: logs.length, logs });
      }

      case 'clear_cache': {
        const cacheType = (args?.type as string) || 'all';
        
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
        const templateId = args?.templateId as string;
        const title = args?.title as string;
        const parentPageId = args?.parentPageId as string | undefined;
        const parentDatabaseId = args?.parentDatabaseId as string | undefined;
        
        const template = getTemplate(templateId);
        if (!template) {
          return error(`Unknown template: ${templateId}. Use list_templates to see available options.`);
        }
        
        if (!parentPageId && !parentDatabaseId) {
          return error('Either parentPageId or parentDatabaseId is required');
        }
        
        const parent = parentDatabaseId 
          ? { database_id: parsePageId(parentDatabaseId) }
          : { page_id: parsePageId(parentPageId!) };
        
        const properties = parentDatabaseId
          ? { title: { title: [{ text: { content: title } }] } }
          : { title: { title: [{ text: { content: title } }] } };
        
        const page = await withRetry(
          () => notion.pages.create({
            parent,
            icon: template.icon ? { emoji: template.icon as any } : undefined,
            properties,
          }),
          3,
          'create_from_template'
        );
        
        // Add template blocks
        if (template.blocks.length > 0) {
          await appendBlocksInBatches(page.id, template.blocks);
        }
        
        return respond({
          id: page.id,
          url: (page as any).url,
          template: templateId,
          message: `Page created from template: ${template.name}`,
        });
      }

      case 'batch_create_pages': {
        const parentId = parsePageId(args?.parentId as string);
        const pages = args?.pages as Array<{ title: string; content?: string; properties?: Record<string, any> }>;
        
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
        const pageIds = args?.pageIds as string[];
        
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
        const blockIds = args?.blockIds as string[];
        
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
        const databaseId = parsePageId(args?.databaseId as string);
        const properties = args?.properties as Record<string, any>;
        
        // Get database schema (with caching)
        const cacheKey = `schema:${databaseId}`;
        let schema = schemaCache.get(cacheKey);
        
        if (!schema) {
          const db = await withRetry(
            () => notion.databases.retrieve({ database_id: databaseId }),
            3,
            'validate_get_schema'
          );
          schema = (db as any).properties;
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
  console.error('Notion MCP Server v2.8 running - Full-featured with caching, metrics, templates');
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
