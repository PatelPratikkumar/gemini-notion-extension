import { Client } from '@notionhq/client';
interface DatabaseCache {
    conversationDbId?: string;
    projectDbId?: string;
    allDatabases: Array<{
        id: string;
        title: string;
    }>;
    lastUpdated: string;
}
/**
 * Discover all accessible databases
 */
export declare function discoverDatabases(client: Client): Promise<DatabaseCache>;
/**
 * Load cached database info
 */
export declare function loadDatabaseCache(): DatabaseCache | null;
export {};
//# sourceMappingURL=database-discovery.d.ts.map