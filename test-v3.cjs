const { spawn } = require('child_process');
const path = require('path');

// Test v3.0 functionality
async function testV3Enhanced() {
  console.log('🧪 Testing Notion MCP Server v3.0 - Enhanced Edition');
  
  const serverPath = path.join(__dirname, 'dist', 'bundle.js');
  const child = spawn('node', [serverPath], {
    stdio: ['pipe', 'pipe', 'pipe'],
    cwd: __dirname
  });

  let responseReceived = false;

  // Test enhanced tool listing
  const testRequest = {
    jsonrpc: '2.0',
    id: 1,
    method: 'tools/list',
    params: {}
  };

  child.stdout.on('data', (data) => {
    try {
      const response = JSON.parse(data.toString());
      console.log('📋 Server Response:', {
        id: response.id,
        toolCount: response.result?.tools?.length || 0,
        enhancedFeatures: response.result?.tools?.filter(t => 
          ['check_api_health', 'get_usage_statistics', 'create_database_from_template', 
           'bulk_create_pages_from_files', 'upload_file_to_notion', 'start_file_watcher',
           'stop_file_watcher', 'list_active_watchers'].includes(t.name)
        )?.map(t => t.name) || []
      });
      responseReceived = true;
      child.kill();
    } catch (err) {
      console.log('📄 Raw response:', data.toString());
    }
  });

  child.stderr.on('data', (data) => {
    const output = data.toString();
    if (output.includes('Enhanced Notion Server v3.0.0') || output.includes('46 tools')) {
      console.log('✅ Server startup message:', output.trim());
    }
  });

  // Send test request after a brief delay
  setTimeout(() => {
    child.stdin.write(JSON.stringify(testRequest) + '\n');
  }, 1000);

  // Timeout after 5 seconds
  setTimeout(() => {
    if (!responseReceived) {
      console.log('⏱️  Test completed - checking for startup message');
      child.kill();
    }
  }, 5000);

  child.on('close', (code) => {
    console.log('🔍 V3.0 test completed');
    process.exit(0);
  });
}

testV3Enhanced().catch(console.error);