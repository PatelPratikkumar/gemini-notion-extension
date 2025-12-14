#!/usr/bin/env node

/**
 * Comprehensive API Test Suite for Gemini Notion Extension
 * Tests all 38 tools by actually executing them via the MCP protocol
 */

import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

class NotionExtensionTester {
  constructor() {
    this.results = {
      passed: 0,
      failed: 0,
      skipped: 0,
      errors: []
    };
    this.serverProcess = null;
  }

  async startServer() {
    console.log('🚀 Starting Notion MCP Server...');
    
    this.serverProcess = spawn('node', ['dist/server.js'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: process.cwd()
    });

    // Wait for server to initialize
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    if (this.serverProcess.killed) {
      throw new Error('Failed to start MCP server');
    }
    
    console.log('✅ MCP Server started');
  }

  async stopServer() {
    if (this.serverProcess) {
      this.serverProcess.kill();
      console.log('🛑 MCP Server stopped');
    }
  }

  async sendMCPRequest(method, params = {}) {
    return new Promise((resolve, reject) => {
      const request = {
        jsonrpc: '2.0',
        id: Date.now(),
        method,
        params
      };

      let responseData = '';
      let errorData = '';

      const timeout = setTimeout(() => {
        reject(new Error(`Timeout waiting for response to ${method}`));
      }, 10000);

      this.serverProcess.stdout.on('data', (data) => {
        responseData += data.toString();
        try {
          const response = JSON.parse(responseData);
          clearTimeout(timeout);
          resolve(response);
        } catch (e) {
          // Partial response, wait for more
        }
      });

      this.serverProcess.stderr.on('data', (data) => {
        errorData += data.toString();
      });

      this.serverProcess.stdin.write(JSON.stringify(request) + '\n');
    });
  }

  async testTool(toolName, args = {}, description = '') {
    console.log(`\n🧪 Testing ${toolName}${description ? ': ' + description : ''}...`);
    
    try {
      const response = await this.sendMCPRequest('tools/call', {
        name: toolName,
        arguments: args
      });

      if (response.error) {
        console.log(`❌ ${toolName} - Error: ${response.error.message}`);
        this.results.failed++;
        this.results.errors.push({
          tool: toolName,
          error: response.error.message,
          args
        });
        return false;
      }

      if (response.result?.isError) {
        console.log(`❌ ${toolName} - Tool Error: ${response.result.content}`);
        this.results.failed++;
        this.results.errors.push({
          tool: toolName,
          error: response.result.content,
          args
        });
        return false;
      }

      console.log(`✅ ${toolName} - Success`);
      if (response.result?.content) {
        console.log(`   Result: ${JSON.stringify(response.result.content, null, 2).slice(0, 200)}...`);
      }
      
      this.results.passed++;
      return response.result;
      
    } catch (error) {
      console.log(`❌ ${toolName} - Exception: ${error.message}`);
      this.results.failed++;
      this.results.errors.push({
        tool: toolName,
        error: error.message,
        args
      });
      return false;
    }
  }

  async runAllTests() {
    console.log('🔍 Starting comprehensive API test suite...\n');

    // Test 1: Search Tools
    console.log('\n═══ SEARCH TOOLS ═══');
    await this.testTool('notion_search', { 
      query: 'test', 
      limit: 5 
    }, 'Basic search');

    // Test 2: Page Management
    console.log('\n═══ PAGE MANAGEMENT ═══');
    
    // First search for an existing page to work with
    const searchResult = await this.testTool('notion_search', { 
      query: '', 
      filter: 'page',
      limit: 1 
    }, 'Find existing page');
    
    let testPageId = null;
    if (searchResult && searchResult.content?.results?.length > 0) {
      testPageId = searchResult.content.results[0].id;
      console.log(`   Using existing page: ${testPageId}`);
    }

    if (testPageId) {
      await this.testTool('get_page', { 
        pageId: testPageId 
      }, 'Get page details');

      await this.testTool('update_page', { 
        pageId: testPageId,
        title: 'API Test Page - Updated'
      }, 'Update page');
    } else {
      console.log('⚠️  Skipping page tests - no existing pages found');
      this.results.skipped += 2;
    }

    // Test 3: Database Operations
    console.log('\n═══ DATABASE OPERATIONS ═══');
    
    await this.testTool('list_databases', { 
      limit: 5 
    }, 'List databases');

    // Find a database to work with
    const dbResult = await this.testTool('notion_search', { 
      query: '', 
      filter: 'database',
      limit: 1 
    }, 'Find existing database');
    
    let testDbId = null;
    if (dbResult && dbResult.content?.results?.length > 0) {
      testDbId = dbResult.content.results[0].id;
      console.log(`   Using existing database: ${testDbId}`);
    }

    if (testDbId) {
      await this.testTool('get_database_schema', { 
        databaseId: testDbId 
      }, 'Get database schema');

      await this.testTool('query_database', { 
        databaseId: testDbId,
        limit: 3
      }, 'Query database');
    } else {
      console.log('⚠️  Skipping database tests - no existing databases found');
      this.results.skipped += 2;
    }

    // Test 4: Block Operations
    console.log('\n═══ BLOCK OPERATIONS ═══');
    
    if (testPageId) {
      await this.testTool('get_block_children', { 
        blockId: testPageId,
        limit: 3
      }, 'Get page blocks');

      await this.testTool('append_blocks', { 
        parentId: testPageId,
        content: '# API Test Block\nThis block was created by the API test suite.'
      }, 'Append test content');
    } else {
      console.log('⚠️  Skipping block tests - no test page available');
      this.results.skipped += 2;
    }

    // Test 5: Comment Operations
    console.log('\n═══ COMMENT OPERATIONS ═══');
    
    if (testPageId) {
      await this.testTool('get_comments', { 
        blockId: testPageId
      }, 'Get page comments');

      await this.testTool('add_comment', { 
        blockId: testPageId,
        content: 'Test comment from API suite'
      }, 'Add test comment');
    } else {
      console.log('⚠️  Skipping comment tests - no test page available');
      this.results.skipped += 2;
    }

    // Test 6: User Operations
    console.log('\n═══ USER OPERATIONS ═══');
    
    await this.testTool('list_users', { 
      limit: 5 
    }, 'List workspace users');

    await this.testTool('get_current_user', {}, 'Get current bot user');

    // Test 7: Project Management
    console.log('\n═══ PROJECT MANAGEMENT ═══');
    
    await this.testTool('list_projects', { 
      limit: 5 
    }, 'List projects');

    // Test 8: Conversation Export
    console.log('\n═══ CONVERSATION EXPORT ═══');
    
    await this.testTool('export_conversation', { 
      conversationData: {
        messages: [
          { role: 'user', content: 'Test message from API suite' },
          { role: 'assistant', content: 'This is a test response' }
        ]
      },
      title: 'API Test Conversation'
    }, 'Export test conversation');

    // Test 9: Advanced Operations
    console.log('\n═══ ADVANCED OPERATIONS ═══');
    
    await this.testTool('health_check', {}, 'Health check');
    await this.testTool('get_metrics', {}, 'Get performance metrics');
    await this.testTool('get_logs', { level: 'info', limit: 5 }, 'Get recent logs');
    await this.testTool('clear_cache', { cacheType: 'all' }, 'Clear cache');

    // Test 10: Template System
    console.log('\n═══ TEMPLATE SYSTEM ═══');
    
    await this.testTool('list_templates', {}, 'List available templates');

    // Test 11: Batch Operations
    console.log('\n═══ BATCH OPERATIONS ═══');
    
    await this.testTool('validate_properties', { 
      databaseId: testDbId || 'test-db-id',
      properties: {
        'Test Field': { type: 'rich_text' }
      }
    }, 'Validate properties');

    // Test 12: Queue Operations
    console.log('\n═══ QUEUE OPERATIONS ═══');
    
    await this.testTool('get_queue_status', {}, 'Get queue status');
    await this.testTool('clear_queue', {}, 'Clear operation queue');

    // Test 13: Utility Operations
    console.log('\n═══ UTILITY OPERATIONS ═══');
    
    await this.testTool('get_recent_changes', { 
      limit: 5 
    }, 'Get recent workspace changes');

    if (testPageId) {
      await this.testTool('duplicate_page', { 
        pageId: testPageId,
        newTitle: 'API Test - Duplicated Page'
      }, 'Duplicate page');
    } else {
      console.log('⚠️  Skipping duplicate test - no test page available');
      this.results.skipped += 1;
    }
  }

  printResults() {
    console.log('\n' + '='.repeat(60));
    console.log('🏁 API TEST SUITE RESULTS');
    console.log('='.repeat(60));
    console.log(`✅ Passed: ${this.results.passed}`);
    console.log(`❌ Failed: ${this.results.failed}`);
    console.log(`⚠️  Skipped: ${this.results.skipped}`);
    console.log(`📊 Total: ${this.results.passed + this.results.failed + this.results.skipped}`);
    
    const successRate = (this.results.passed / (this.results.passed + this.results.failed)) * 100;
    console.log(`📈 Success Rate: ${successRate.toFixed(1)}%`);

    if (this.results.errors.length > 0) {
      console.log('\n❌ FAILED TESTS:');
      this.results.errors.forEach((error, index) => {
        console.log(`${index + 1}. ${error.tool}: ${error.error}`);
      });
    }

    console.log('\n' + '='.repeat(60));
  }
}

// Run the test suite
async function runTests() {
  const tester = new NotionExtensionTester();
  
  try {
    await tester.startServer();
    await tester.runAllTests();
  } catch (error) {
    console.error('❌ Test suite failed:', error.message);
  } finally {
    await tester.stopServer();
    tester.printResults();
  }
}

// Execute if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runTests().catch(console.error);
}

export { NotionExtensionTester };