#!/usr/bin/env node
// Database setup utility
import { Client } from '@notionhq/client';
import { getNotionApiKey } from './credentials.js';
import { discoverDatabases } from './database-discovery.js';
async function main() {
    console.log('=================================');
    console.log('  Notion Database Setup');
    console.log('=================================\n');
    try {
        // Get API key
        console.log('Loading credentials...');
        const apiKey = getNotionApiKey();
        console.log('✓ Credentials loaded\n');
        // Initialize client
        const client = new Client({ auth: apiKey });
        // Test connection
        console.log('Testing Notion connection...');
        const user = await client.users.me({});
        console.log(`✓ Connected as: ${user.name || 'User'}\n`);
        // Discover and setup databases
        const cache = await discoverDatabases(client);
        console.log('\n✓ Setup complete!\n');
        console.log('Database IDs:');
        console.log(`  Conversation: ${cache.conversationDbId}`);
        console.log(`  Project: ${cache.projectDbId}`);
        console.log('\nYou can now use the extension!');
    }
    catch (error) {
        console.error('\n✗ Setup failed:', error.message);
        process.exit(1);
    }
}
main();
//# sourceMappingURL=setup-databases.js.map