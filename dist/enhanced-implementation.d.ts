import { Client } from '@notionhq/client';
/**
 * Upload file to Notion using the new File Upload API (2024)
 */
export declare function uploadFileToNotion(notion: Client, filePath: string, filename?: string, attachTo?: any): Promise<any>;
/**
 * Upload large files using multi-part upload
 */
export declare function uploadLargeFileMultipart(notion: Client, filePath: string, filename: string, chunkSizeMB: number | undefined, attachToPageId: string): Promise<any>;
/**
 * Start monitoring a folder for new files and auto-upload to Notion
 */
export declare function startFileWatcher(notion: Client, watchPath: string, databaseId: string, options?: any): any;
/**
 * Stop file monitoring
 */
export declare function stopFileWatcher(watcherPath?: string): any;
/**
 * List active file watchers
 */
export declare function listActiveWatchers(): any;
/**
 * Bulk upload multiple files with rate limiting
 */
export declare function bulkUploadFiles(notion: Client, files: any[], delayBetweenUploads?: number): Promise<any>;
/**
 * Create database pages from files in a folder
 */
export declare function bulkCreatePagesFromFiles(notion: Client, folderPath: string, databaseId: string, options?: any): Promise<any>;
/**
 * Create database with predefined templates
 */
export declare function createDatabaseFromTemplate(notion: Client, parentPageId: string, templateName: string, databaseTitle: string, customProperties?: any): Promise<any>;
/**
 * Check Notion API health and permissions
 */
export declare function checkNotionApiHealth(notion: Client, includePermissions?: boolean): Promise<any>;
/**
 * Get API usage statistics
 */
export declare function getApiUsageStats(timeWindow?: string): any;
//# sourceMappingURL=enhanced-implementation.d.ts.map