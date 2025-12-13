import { writeFileSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { createRichText } from './types/notion.js';
const CACHE_FILE = join(process.cwd(), '.notion-cache.json');
/**
 * Discover all accessible databases
 */
export async function discoverDatabases(client) {
    console.error('Discovering Notion databases...');
    const allDatabases = [];
    let conversationDbId;
    let projectDbId;
    let projectDbParent;
    try {
        // Search for all databases
        const response = await client.search({
            filter: { property: 'object', value: 'database' },
            page_size: 100,
        });
        for (const result of response.results) {
            if (result.object === 'database' && 'title' in result) {
                const title = result.title[0]?.plain_text || 'Untitled';
                allDatabases.push({ id: result.id, title });
                // Identify our databases by name
                if (title.toLowerCase().includes('conversation') || title.toLowerCase().includes('gemini conversations')) {
                    conversationDbId = result.id;
                    console.error(`  Found Conversation database: ${title}`);
                }
                // Match "CLI Project Tracker" or any project database
                if (title.toLowerCase().includes('project') || title === 'CLI Project Tracker') {
                    if (!projectDbId) {
                        projectDbId = result.id;
                        // Get parent of project database for creating conversation database
                        if ('parent' in result && result.parent.type === 'page_id') {
                            projectDbParent = result.parent.page_id;
                        }
                        console.error(`  Found Project database: ${title}`);
                    }
                }
            }
        }
        console.error(`  Total databases found: ${allDatabases.length}`);
        // If we found a project database but don't have its parent, retrieve it
        if (projectDbId && !projectDbParent) {
            console.error(`  Retrieving parent page for CLI Project Tracker...`);
            try {
                const db = await client.databases.retrieve({ database_id: projectDbId });
                console.error(`  Database parent type: ${db.parent.type}`);
                if (db.parent.type === 'page_id') {
                    projectDbParent = db.parent.page_id;
                    console.error(`  ✓ Found parent page: ${projectDbParent}`);
                }
                else if (db.parent.type === 'workspace') {
                    console.error(`  Database is at workspace root, need a page parent`);
                }
            }
            catch (error) {
                console.error(`  Warning: Could not retrieve project database parent: ${error.message}`);
            }
        }
        // Create missing databases
        if (!conversationDbId) {
            console.error('  Creating Conversation database...');
            if (projectDbParent) {
                conversationDbId = await createConversationDatabase(client, projectDbParent);
            }
            else {
                conversationDbId = await createConversationDatabase(client);
            }
        }
        if (!projectDbId) {
            console.error('  Creating Project database...');
            projectDbId = await createProjectDatabase(client);
        }
        const cache = {
            conversationDbId,
            projectDbId,
            allDatabases,
            lastUpdated: new Date().toISOString(),
        };
        // Save cache
        writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
        console.error('✓ Database discovery complete');
        return cache;
    }
    catch (error) {
        throw new Error(`Database discovery failed: ${error.message}`);
    }
}
/**
 * Load cached database info
 */
export function loadDatabaseCache() {
    if (!existsSync(CACHE_FILE)) {
        return null;
    }
    try {
        const data = readFileSync(CACHE_FILE, 'utf-8');
        return JSON.parse(data);
    }
    catch {
        return null;
    }
}
/**
 * Create Conversation database
 */
async function createConversationDatabase(client, parentPageId) {
    const pageId = parentPageId || await getOrCreateRootPage(client);
    const response = await client.databases.create({
        parent: { type: 'page_id', page_id: pageId },
        title: [createRichText('Gemini Conversations')],
        properties: {
            'title': { title: {} },
            'Conversation ID': { rich_text: {} },
            'Export Date': { date: {} },
            'Message Count': { number: {} },
            'Tags': {
                multi_select: {
                    options: [
                        { name: 'development', color: 'blue' },
                        { name: 'documentation', color: 'green' },
                        { name: 'debugging', color: 'red' },
                        { name: 'learning', color: 'purple' },
                    ],
                },
            },
            'Code Snippets Present': { checkbox: {} },
            'Languages Mentioned': {
                multi_select: {
                    options: [
                        { name: 'TypeScript', color: 'blue' },
                        { name: 'JavaScript', color: 'yellow' },
                        { name: 'Python', color: 'blue' },
                        { name: 'Java', color: 'red' },
                    ],
                },
            },
            'Associated Project': { relation: { database_id: '', single_property: {} } },
        },
    });
    console.error(`    ✓ Created: ${response.id}`);
    return response.id;
}
/**
 * Create Project database
 */
async function createProjectDatabase(client) {
    const response = await client.databases.create({
        parent: { type: 'page_id', page_id: await getOrCreateRootPage(client) },
        title: [createRichText('Projects')],
        properties: {
            'Project Name': { title: {} },
            'Status': {
                select: {
                    options: [
                        { name: 'Active', color: 'green' },
                        { name: 'Planning', color: 'blue' },
                        { name: 'On Hold', color: 'yellow' },
                        { name: 'Completed', color: 'gray' },
                        { name: 'Archived', color: 'red' },
                    ],
                },
            },
            'Description': { rich_text: {} },
            'Start Date': { date: {} },
            'Target Completion': { date: {} },
            'Key Technologies': { multi_select: { options: [] } },
            'GitHub Repository': { url: {} },
            'Last Activity': { date: {} },
        },
    });
    console.error(`    ✓ Created: ${response.id}`);
    return response.id;
}
/**
 * Get or create a root page for databases
 */
async function getOrCreateRootPage(client) {
    // Search for existing "Gemini Extension" page
    const search = await client.search({
        query: 'Gemini Extension',
        filter: { property: 'object', value: 'page' },
    });
    if (search.results.length > 0) {
        return search.results[0].id;
    }
    // Create root page - need to use a parent (workspace doesn't work directly)
    // Instead, we'll throw an error asking user to create a parent page
    throw new Error('Please create a page in Notion titled "Gemini Extension" and share it with your integration.\n' +
        'Then run this setup again.');
}
//# sourceMappingURL=database-discovery.js.map