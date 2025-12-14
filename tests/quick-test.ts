#!/usr/bin/env npx tsx
/**
 * Quick Sanity Tests - Fast verification that API is working
 * Run: npx tsx tests/quick-test.ts
 * Or: npm run test:quick
 */

import { Client } from '@notionhq/client';
import { config } from 'dotenv';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

// Load environment
config();

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
};

// Get API key
function getApiKey(): string {
  if (process.env.NOTION_API_KEY) return process.env.NOTION_API_KEY;
  
  const envPath = join(process.cwd(), '.env');
  if (existsSync(envPath)) {
    const match = readFileSync(envPath, 'utf-8').match(/NOTION_API_KEY=(.+)/);
    if (match) return match[1].trim();
  }
  
  console.log(`${colors.red}═══════════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.red}  NOTION_API_KEY not found!${colors.reset}`);
  console.log(`${colors.gray}═══════════════════════════════════════════════${colors.reset}`);
  console.log(`\n  To run tests, provide your API key:\n`);
  console.log(`  ${colors.cyan}Option 1:${colors.reset} Create .env file:`);
  console.log(`    echo "NOTION_API_KEY=secret_xxx" > .env\n`);
  console.log(`  ${colors.cyan}Option 2:${colors.reset} Pass as environment variable:`);
  console.log(`    NOTION_API_KEY=secret_xxx npm run test:quick\n`);
  console.log(`  ${colors.cyan}Get your token:${colors.reset} https://www.notion.so/my-integrations\n`);
  process.exit(1);
}

async function quickTest(): Promise<void> {
  console.log(`\n${colors.cyan}═══ Quick Notion API Test ═══${colors.reset}\n`);
  
  const notion = new Client({ auth: getApiKey() });
  let passed = 0;
  let failed = 0;
  
  // Test 1: Connection
  process.stdout.write('1. API Connection... ');
  try {
    const user = await notion.users.me({});
    console.log(`${colors.green}✓${colors.reset} Connected as: ${user.name || user.id}`);
    passed++;
  } catch (e: any) {
    console.log(`${colors.red}✗${colors.reset} ${e.message}`);
    failed++;
  }
  
  // Test 2: Search
  process.stdout.write('2. Search API... ');
  try {
    const results = await notion.search({ page_size: 5 });
    console.log(`${colors.green}✓${colors.reset} Found ${results.results.length} items`);
    passed++;
  } catch (e: any) {
    console.log(`${colors.red}✗${colors.reset} ${e.message}`);
    failed++;
  }
  
  // Test 3: Databases
  process.stdout.write('3. Database List... ');
  try {
    const dbs = await notion.search({ 
      filter: { property: 'object', value: 'database' },
      page_size: 5 
    });
    console.log(`${colors.green}✓${colors.reset} Found ${dbs.results.length} databases`);
    passed++;
  } catch (e: any) {
    console.log(`${colors.red}✗${colors.reset} ${e.message}`);
    failed++;
  }
  
  // Test 4: Pages
  process.stdout.write('4. Page List... ');
  try {
    const pages = await notion.search({ 
      filter: { property: 'object', value: 'page' },
      page_size: 5 
    });
    console.log(`${colors.green}✓${colors.reset} Found ${pages.results.length} pages`);
    passed++;
  } catch (e: any) {
    console.log(`${colors.red}✗${colors.reset} ${e.message}`);
    failed++;
  }
  
  // Test 5: Users
  process.stdout.write('5. User List... ');
  try {
    const users = await notion.users.list({});
    console.log(`${colors.green}✓${colors.reset} Found ${users.results.length} users`);
    passed++;
  } catch (e: any) {
    console.log(`${colors.red}✗${colors.reset} ${e.message}`);
    failed++;
  }
  
  // Summary
  console.log(`\n${colors.cyan}═══════════════════════════════${colors.reset}`);
  console.log(`${colors.green}Passed: ${passed}${colors.reset} | ${colors.red}Failed: ${failed}${colors.reset}`);
  console.log(`${colors.cyan}═══════════════════════════════${colors.reset}\n`);
  
  if (failed > 0) process.exit(1);
}

quickTest();
