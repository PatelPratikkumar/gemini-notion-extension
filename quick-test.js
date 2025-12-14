#!/usr/bin/env node

/**
 * Simple tool test using Node.js directly with the MCP server
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function testSingleTool() {
  console.log('🧪 Testing individual tool: notion_search');
  
  // Start the MCP server
  const serverProcess = spawn('node', ['dist/server.js'], {
    stdio: ['pipe', 'pipe', 'pipe'],
    cwd: process.cwd()
  });

  let output = '';
  let error = '';

  serverProcess.stdout.on('data', (data) => {
    output += data.toString();
    console.log('Server output:', data.toString());
  });

  serverProcess.stderr.on('data', (data) => {
    error += data.toString();
    console.log('Server error:', data.toString());
  });

  // Wait a bit for server to start
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Send a tools/list request
  const listRequest = JSON.stringify({
    jsonrpc: '2.0',
    id: 1,
    method: 'tools/list'
  }) + '\n';

  console.log('📤 Sending tools/list request...');
  serverProcess.stdin.write(listRequest);

  // Wait for response
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Send a tool call request
  const toolRequest = JSON.stringify({
    jsonrpc: '2.0',
    id: 2,
    method: 'tools/call',
    params: {
      name: 'notion_search',
      arguments: {
        query: 'test',
        limit: 3
      }
    }
  }) + '\n';

  console.log('📤 Sending notion_search request...');
  serverProcess.stdin.write(toolRequest);

  // Wait for response
  await new Promise(resolve => setTimeout(resolve, 5000));

  console.log('🏁 Test completed');
  console.log('Output:', output);
  if (error) console.log('Errors:', error);

  serverProcess.kill();
}

testSingleTool().catch(console.error);