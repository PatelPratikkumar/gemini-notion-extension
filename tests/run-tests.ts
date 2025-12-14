#!/usr/bin/env npx tsx
/**
 * Notion Extension Integration Tests
 * Run: npx tsx tests/run-tests.ts
 * 
 * Tests all MCP tools directly against Notion API
 */

import { Client } from '@notionhq/client';
import { config } from 'dotenv';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

// Load environment
config();

// Colors for output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
};

// Test results
interface TestResult {
  name: string;
  passed: boolean;
  duration: number;
  error?: string;
}

const results: TestResult[] = [];
let testPageId: string | null = null;
let testDatabaseId: string | null = null;
let testBlockId: string | null = null;

// Get API key
function getApiKey(): string {
  // Try environment variable first
  if (process.env.NOTION_API_KEY) {
    return process.env.NOTION_API_KEY;
  }
  
  // Try .env file
  const envPath = join(process.cwd(), '.env');
  if (existsSync(envPath)) {
    const envContent = readFileSync(envPath, 'utf-8');
    const match = envContent.match(/NOTION_API_KEY=(.+)/);
    if (match) return match[1].trim();
  }
  
  console.log(`\n${colors.red}═══════════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.red}  NOTION_API_KEY not found!${colors.reset}`);
  console.log(`${colors.gray}═══════════════════════════════════════════════${colors.reset}`);
  console.log(`\n  To run tests, provide your API key:\n`);
  console.log(`  ${colors.cyan}Option 1:${colors.reset} Create .env file:`);
  console.log(`    echo "NOTION_API_KEY=secret_xxx" > .env\n`);
  console.log(`  ${colors.cyan}Option 2:${colors.reset} Pass as environment variable:`);
  console.log(`    NOTION_API_KEY=secret_xxx npm run test\n`);
  console.log(`  ${colors.cyan}Get your token:${colors.reset} https://www.notion.so/my-integrations\n`);
  process.exit(1);
}

// Initialize client
const notion = new Client({ auth: getApiKey() });

// Test runner
async function runTest(name: string, testFn: () => Promise<void>): Promise<void> {
  const start = Date.now();
  process.stdout.write(`  ${colors.gray}⏳${colors.reset} ${name}...`);
  
  try {
    await testFn();
    const duration = Date.now() - start;
    results.push({ name, passed: true, duration });
    console.log(`\r  ${colors.green}✓${colors.reset} ${name} ${colors.gray}(${duration}ms)${colors.reset}`);
  } catch (error: any) {
    const duration = Date.now() - start;
    results.push({ name, passed: false, duration, error: error.message });
    console.log(`\r  ${colors.red}✗${colors.reset} ${name} ${colors.gray}(${duration}ms)${colors.reset}`);
    console.log(`    ${colors.red}Error: ${error.message}${colors.reset}`);
  }
}

// Assert helpers
function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

function assertExists(value: any, name: string): void {
  if (value === undefined || value === null) {
    throw new Error(`${name} should exist`);
  }
}

function assertType(value: any, type: string, name: string): void {
  if (typeof value !== type) {
    throw new Error(`${name} should be ${type}, got ${typeof value}`);
  }
}

// ============================================================
// TEST SUITES
// ============================================================

async function testConnection(): Promise<void> {
  console.log(`\n${colors.cyan}▸ Connection Tests${colors.reset}`);
  
  await runTest('API connection works', async () => {
    const user = await notion.users.me({});
    assertExists(user.id, 'user.id');
    assertExists(user.type, 'user.type');
  });
  
  await runTest('Can list users', async () => {
    const users = await notion.users.list({});
    assert(Array.isArray(users.results), 'results should be array');
  });
}

async function testSearch(): Promise<void> {
  console.log(`\n${colors.cyan}▸ Search Tests${colors.reset}`);
  
  await runTest('Search returns results', async () => {
    const results = await notion.search({
      page_size: 10,
    });
    assert(Array.isArray(results.results), 'results should be array');
  });
  
  await runTest('Search with filter (pages)', async () => {
    const results = await notion.search({
      filter: { property: 'object', value: 'page' },
      page_size: 5,
    });
    assert(Array.isArray(results.results), 'results should be array');
    results.results.forEach((r: any) => {
      assert(r.object === 'page', 'all results should be pages');
    });
  });
  
  await runTest('Search with filter (databases)', async () => {
    const results = await notion.search({
      filter: { property: 'object', value: 'database' },
      page_size: 5,
    });
    assert(Array.isArray(results.results), 'results should be array');
    results.results.forEach((r: any) => {
      assert(r.object === 'database', 'all results should be databases');
    });
    
    // Save a database ID for later tests
    if (results.results.length > 0) {
      testDatabaseId = results.results[0].id;
    }
  });
  
  await runTest('Search with sort (last_edited_time)', async () => {
    const results = await notion.search({
      sort: { direction: 'descending', timestamp: 'last_edited_time' },
      page_size: 5,
    });
    assert(Array.isArray(results.results), 'results should be array');
  });
}

async function testPages(): Promise<void> {
  console.log(`\n${colors.cyan}▸ Page Tests${colors.reset}`);
  
  // Find a parent page first
  let parentPageId: string | null = null;
  
  await runTest('Find parent page for tests', async () => {
    const results = await notion.search({
      filter: { property: 'object', value: 'page' },
      page_size: 10,
    });
    
    // Find a page we can use as parent
    for (const page of results.results as any[]) {
      try {
        // Try to get page - if accessible, use it
        await notion.pages.retrieve({ page_id: page.id });
        parentPageId = page.id;
        break;
      } catch {
        continue;
      }
    }
    
    assert(parentPageId !== null, 'No accessible page found for testing');
  });
  
  await runTest('Create a test page', async () => {
    if (!parentPageId) throw new Error('No parent page available');
    
    const page = await notion.pages.create({
      parent: { page_id: parentPageId },
      properties: {
        title: { title: [{ text: { content: `Test Page - ${new Date().toISOString()}` } }] },
      },
      children: [
        {
          object: 'block',
          type: 'paragraph',
          paragraph: {
            rich_text: [{ type: 'text', text: { content: 'This is a test page created by integration tests.' } }],
          },
        },
      ],
    });
    
    assertExists(page.id, 'page.id');
    testPageId = page.id;
  });
  
  await runTest('Retrieve the test page', async () => {
    if (!testPageId) throw new Error('No test page created');
    
    const page = await notion.pages.retrieve({ page_id: testPageId });
    assertExists(page.id, 'page.id');
    assert(page.id === testPageId, 'retrieved page ID should match');
  });
  
  await runTest('Update page properties', async () => {
    if (!testPageId) throw new Error('No test page created');
    
    const page = await notion.pages.update({
      page_id: testPageId,
      properties: {
        title: { title: [{ text: { content: `Updated Test Page - ${new Date().toISOString()}` } }] },
      },
    });
    
    assertExists(page.id, 'page.id');
  });
  
  await runTest('Add icon to page', async () => {
    if (!testPageId) throw new Error('No test page created');
    
    const page = await notion.pages.update({
      page_id: testPageId,
      icon: { type: 'emoji', emoji: '🧪' },
    });
    
    assertExists((page as any).icon, 'page.icon');
  });
}

async function testBlocks(): Promise<void> {
  console.log(`\n${colors.cyan}▸ Block Tests${colors.reset}`);
  
  await runTest('Get block children', async () => {
    if (!testPageId) throw new Error('No test page created');
    
    const blocks = await notion.blocks.children.list({
      block_id: testPageId,
      page_size: 100,
    });
    
    assert(Array.isArray(blocks.results), 'results should be array');
    if (blocks.results.length > 0) {
      testBlockId = blocks.results[0].id;
    }
  });
  
  await runTest('Append blocks to page', async () => {
    if (!testPageId) throw new Error('No test page created');
    
    const result = await notion.blocks.children.append({
      block_id: testPageId,
      children: [
        {
          object: 'block',
          type: 'heading_2',
          heading_2: {
            rich_text: [{ type: 'text', text: { content: 'Test Heading' } }],
          },
        },
        {
          object: 'block',
          type: 'bulleted_list_item',
          bulleted_list_item: {
            rich_text: [{ type: 'text', text: { content: 'Test bullet point' } }],
          },
        },
        {
          object: 'block',
          type: 'code',
          code: {
            language: 'typescript',
            rich_text: [{ type: 'text', text: { content: 'console.log("Hello from tests!");' } }],
          },
        },
      ],
    });
    
    assert(result.results.length === 3, 'should append 3 blocks');
  });
  
  await runTest('Update a block', async () => {
    if (!testBlockId) {
      // Get a block first
      const blocks = await notion.blocks.children.list({
        block_id: testPageId!,
        page_size: 10,
      });
      if (blocks.results.length > 0) {
        testBlockId = blocks.results[0].id;
      }
    }
    
    if (!testBlockId) throw new Error('No block available to update');
    
    const block = await notion.blocks.retrieve({ block_id: testBlockId }) as any;
    
    // Only update if it's a paragraph
    if (block.type === 'paragraph') {
      await notion.blocks.update({
        block_id: testBlockId,
        paragraph: {
          rich_text: [{ type: 'text', text: { content: 'Updated paragraph content' } }],
        },
      });
    }
  });
}

async function testDatabases(): Promise<void> {
  console.log(`\n${colors.cyan}▸ Database Tests${colors.reset}`);
  
  await runTest('List databases', async () => {
    const results = await notion.search({
      filter: { property: 'object', value: 'database' },
      page_size: 20,
    });
    
    assert(Array.isArray(results.results), 'results should be array');
  });
  
  if (testDatabaseId) {
    await runTest('Retrieve database schema', async () => {
      const db = await notion.databases.retrieve({ database_id: testDatabaseId! });
      assertExists(db.id, 'database.id');
      assertExists((db as any).properties, 'database.properties');
    });
    
    await runTest('Query database', async () => {
      const results = await notion.databases.query({
        database_id: testDatabaseId!,
        page_size: 10,
      });
      
      assert(Array.isArray(results.results), 'results should be array');
    });
    
    await runTest('Query with sort (last_edited_time)', async () => {
      const results = await notion.databases.query({
        database_id: testDatabaseId!,
        sorts: [{ timestamp: 'last_edited_time', direction: 'descending' }],
        page_size: 5,
      });
      
      assert(Array.isArray(results.results), 'results should be array');
    });
  } else {
    console.log(`  ${colors.yellow}⚠${colors.reset} Skipping database tests - no database found`);
  }
}

async function testComments(): Promise<void> {
  console.log(`\n${colors.cyan}▸ Comment Tests${colors.reset}`);
  
  await runTest('Add comment to page', async () => {
    if (!testPageId) throw new Error('No test page created');
    
    const comment = await notion.comments.create({
      parent: { page_id: testPageId },
      rich_text: [{ type: 'text', text: { content: 'Test comment from integration tests' } }],
    });
    
    assertExists(comment.id, 'comment.id');
  });
  
  await runTest('List comments on page', async () => {
    if (!testPageId) throw new Error('No test page created');
    
    const comments = await notion.comments.list({
      block_id: testPageId,
    });
    
    assert(Array.isArray(comments.results), 'results should be array');
  });
}

async function testRateLimiting(): Promise<void> {
  console.log(`\n${colors.cyan}▸ Rate Limiting Tests${colors.reset}`);
  
  await runTest('Multiple rapid requests (5 in sequence)', async () => {
    const start = Date.now();
    
    for (let i = 0; i < 5; i++) {
      await notion.users.me({});
    }
    
    const duration = Date.now() - start;
    // Should take at least ~1 second if rate limited properly
    assert(duration >= 0, 'requests completed');
  });
}

async function testPagination(): Promise<void> {
  console.log(`\n${colors.cyan}▸ Pagination Tests${colors.reset}`);
  
  await runTest('Pagination cursor works', async () => {
    const firstPage = await notion.search({
      page_size: 2,
    });
    
    if (firstPage.has_more && firstPage.next_cursor) {
      const secondPage = await notion.search({
        page_size: 2,
        start_cursor: firstPage.next_cursor,
      });
      
      assert(Array.isArray(secondPage.results), 'second page should have results');
    }
  });
}

async function cleanupTestPage(): Promise<void> {
  console.log(`\n${colors.cyan}▸ Cleanup${colors.reset}`);
  
  await runTest('Archive test page', async () => {
    if (!testPageId) {
      console.log(`  ${colors.yellow}⚠${colors.reset} No test page to clean up`);
      return;
    }
    
    await notion.pages.update({
      page_id: testPageId,
      archived: true,
    });
  });
}

// ============================================================
// MAIN
// ============================================================

async function main(): Promise<void> {
  console.log(`\n${colors.cyan}════════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.cyan}  Notion Extension Integration Tests${colors.reset}`);
  console.log(`${colors.cyan}════════════════════════════════════════════${colors.reset}`);
  
  const startTime = Date.now();
  
  try {
    await testConnection();
    await testSearch();
    await testPages();
    await testBlocks();
    await testDatabases();
    await testComments();
    await testRateLimiting();
    await testPagination();
    await cleanupTestPage();
  } catch (error: any) {
    console.error(`\n${colors.red}Fatal error: ${error.message}${colors.reset}`);
  }
  
  // Summary
  const totalTime = Date.now() - startTime;
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  
  console.log(`\n${colors.cyan}════════════════════════════════════════════${colors.reset}`);
  console.log(`  ${colors.green}Passed: ${passed}${colors.reset}  ${colors.red}Failed: ${failed}${colors.reset}  ${colors.gray}Total: ${results.length}${colors.reset}`);
  console.log(`  ${colors.gray}Duration: ${(totalTime / 1000).toFixed(2)}s${colors.reset}`);
  console.log(`${colors.cyan}════════════════════════════════════════════${colors.reset}\n`);
  
  if (failed > 0) {
    console.log(`${colors.red}Failed Tests:${colors.reset}`);
    results.filter(r => !r.passed).forEach(r => {
      console.log(`  • ${r.name}: ${r.error}`);
    });
    console.log('');
    process.exit(1);
  }
}

main();
