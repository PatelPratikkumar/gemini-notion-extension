// Enhanced Notion API implementation based on comprehensive research
// Implements file uploads, automation, and advanced features
import { readFileSync, statSync, readdirSync } from 'fs';
import { join, extname, basename } from 'path';
import axios from 'axios';
// File watcher management
const activeWatchers = new Map();
const watcherConfigs = new Map();
// API usage tracking
let apiRequestCount = 0;
let lastRequestTime = Date.now();
const requestHistory = [];
// ============================================================
// FILE UPLOAD IMPLEMENTATIONS
// ============================================================
/**
 * Upload file to Notion using the new File Upload API (2024)
 */
export async function uploadFileToNotion(notion, filePath, filename, attachTo) {
    try {
        trackApiUsage();
        // Read file data
        const fileData = readFileSync(filePath);
        const finalFilename = filename || basename(filePath);
        const fileSize = statSync(filePath).size;
        // Check file size limit (20MB for single-part)
        if (fileSize > 20 * 1024 * 1024) {
            throw new Error(`File too large for single-part upload: ${fileSize} bytes. Use multi-part upload for files >20MB.`);
        }
        // Step 1: Create file upload session
        const uploadSession = await axios.post('https://api.notion.com/v1/file_uploads', {
            mode: 'single_part',
            filename: finalFilename,
            content_type: getMimeType(filePath)
        }, {
            headers: {
                'Authorization': `Bearer ${process.env.NOTION_TOKEN}`,
                'Notion-Version': '2024-04-16',
                'Content-Type': 'application/json'
            }
        });
        const { id: uploadId, upload_url } = uploadSession.data;
        // Step 2: Upload file data to provided URL
        await axios.put(upload_url, fileData, {
            headers: {
                'Content-Type': getMimeType(filePath)
            },
            maxContentLength: Infinity,
            maxBodyLength: Infinity
        });
        // Step 3: Attach to specified location
        if (attachTo) {
            await attachUploadedFile(notion, uploadId, attachTo);
        }
        return {
            isError: false,
            result: {
                uploadId,
                filename: finalFilename,
                fileSize,
                message: `File "${finalFilename}" uploaded successfully to Notion`
            }
        };
    }
    catch (error) {
        return {
            isError: true,
            error: error.message || 'Failed to upload file to Notion'
        };
    }
}
/**
 * Upload large files using multi-part upload
 */
export async function uploadLargeFileMultipart(notion, filePath, filename, chunkSizeMB = 10, attachToPageId) {
    try {
        const fileData = readFileSync(filePath);
        const fileSize = fileData.length;
        const chunkSize = chunkSizeMB * 1024 * 1024;
        const totalParts = Math.ceil(fileSize / chunkSize);
        // Step 1: Create multi-part upload session
        const uploadSession = await axios.post('https://api.notion.com/v1/file_uploads', {
            mode: 'multi_part',
            filename,
            content_type: getMimeType(filePath),
            number_of_parts: totalParts
        }, {
            headers: {
                'Authorization': `Bearer ${process.env.NOTION_TOKEN}`,
                'Notion-Version': '2024-04-16',
                'Content-Type': 'application/json'
            }
        });
        const { id: uploadId, upload_urls } = uploadSession.data;
        // Step 2: Upload each part
        for (let partNumber = 1; partNumber <= totalParts; partNumber++) {
            const startByte = (partNumber - 1) * chunkSize;
            const endByte = Math.min(startByte + chunkSize, fileSize);
            const chunk = fileData.subarray(startByte, endByte);
            await axios.put(upload_urls[partNumber - 1], chunk, {
                headers: {
                    'Content-Type': 'application/octet-stream'
                }
            });
            // Rate limiting between parts
            await sleep(200);
        }
        // Step 3: Finalize upload
        await axios.post(`https://api.notion.com/v1/file_uploads/${uploadId}/finish`, {}, {
            headers: {
                'Authorization': `Bearer ${process.env.NOTION_TOKEN}`,
                'Notion-Version': '2024-04-16'
            }
        });
        // Step 4: Attach to page
        await notion.pages.update({
            page_id: attachToPageId,
            properties: {
                'File': {
                    files: [{
                            type: 'file_upload',
                            file_upload: { id: uploadId },
                            name: filename
                        }]
                }
            }
        });
        return {
            isError: false,
            result: {
                uploadId,
                filename,
                fileSize,
                totalParts,
                message: `Large file "${filename}" uploaded successfully in ${totalParts} parts`
            }
        };
    }
    catch (error) {
        return {
            isError: true,
            error: error.message || 'Failed to upload large file'
        };
    }
}
// ============================================================
// FILE MONITORING & AUTOMATION
// ============================================================
/**
 * Start monitoring a folder for new files and auto-upload to Notion
 */
export function startFileWatcher(notion, watchPath, databaseId, options = {}) {
    try {
        const { fileFilter = ['.pdf'], titleProperty = 'Name', fileProperty = 'File', recursive = true, pollInterval = 5 } = options;
        // Stop existing watcher for this path
        if (activeWatchers.has(watchPath)) {
            stopFileWatcher(watchPath);
        }
        // Store configuration
        watcherConfigs.set(watchPath, {
            databaseId,
            fileFilter,
            titleProperty,
            fileProperty,
            recursive
        });
        // Track processed files to avoid duplicates
        const processedFiles = new Set();
        // Initial scan
        scanAndProcessFiles(notion, watchPath, processedFiles, watcherConfigs.get(watchPath));
        // Start polling for changes
        const intervalId = setInterval(() => {
            scanAndProcessFiles(notion, watchPath, processedFiles, watcherConfigs.get(watchPath));
        }, pollInterval * 1000);
        activeWatchers.set(watchPath, intervalId);
        return {
            isError: false,
            result: {
                message: `File watcher started for ${watchPath}`,
                watchPath,
                databaseId,
                fileFilter,
                pollInterval: `${pollInterval}s`
            }
        };
    }
    catch (error) {
        return {
            isError: true,
            error: error.message || 'Failed to start file watcher'
        };
    }
}
/**
 * Stop file monitoring
 */
export function stopFileWatcher(watcherPath) {
    try {
        if (watcherPath) {
            // Stop specific watcher
            if (activeWatchers.has(watcherPath)) {
                clearInterval(activeWatchers.get(watcherPath));
                activeWatchers.delete(watcherPath);
                watcherConfigs.delete(watcherPath);
                return {
                    isError: false,
                    result: { message: `File watcher stopped for ${watcherPath}` }
                };
            }
            else {
                return {
                    isError: true,
                    error: `No active watcher found for ${watcherPath}`
                };
            }
        }
        else {
            // Stop all watchers
            for (const [path, intervalId] of activeWatchers) {
                clearInterval(intervalId);
            }
            const count = activeWatchers.size;
            activeWatchers.clear();
            watcherConfigs.clear();
            return {
                isError: false,
                result: { message: `Stopped ${count} file watchers` }
            };
        }
    }
    catch (error) {
        return {
            isError: true,
            error: error.message || 'Failed to stop file watcher'
        };
    }
}
/**
 * List active file watchers
 */
export function listActiveWatchers() {
    try {
        const watchers = Array.from(activeWatchers.keys()).map(path => ({
            path,
            config: watcherConfigs.get(path),
            status: 'active'
        }));
        return {
            isError: false,
            result: {
                activeWatchers: watchers,
                count: watchers.length
            }
        };
    }
    catch (error) {
        return {
            isError: true,
            error: error.message || 'Failed to list watchers'
        };
    }
}
// ============================================================
// BATCH OPERATIONS
// ============================================================
/**
 * Bulk upload multiple files with rate limiting
 */
export async function bulkUploadFiles(notion, files, delayBetweenUploads = 400) {
    try {
        const results = [];
        let successCount = 0;
        let errorCount = 0;
        for (const file of files) {
            try {
                const result = await uploadFileToNotion(notion, file.filePath, file.filename, { type: 'page', pageId: file.pageId });
                if (result.isError) {
                    errorCount++;
                    results.push({
                        file: file.filePath,
                        status: 'error',
                        error: result.error
                    });
                }
                else {
                    successCount++;
                    results.push({
                        file: file.filePath,
                        status: 'success',
                        uploadId: result.result.uploadId
                    });
                }
                // Rate limiting delay
                await sleep(delayBetweenUploads);
            }
            catch (error) {
                errorCount++;
                results.push({
                    file: file.filePath,
                    status: 'error',
                    error: error.message
                });
            }
        }
        return {
            isError: false,
            result: {
                totalFiles: files.length,
                successCount,
                errorCount,
                results,
                message: `Bulk upload completed: ${successCount} successful, ${errorCount} failed`
            }
        };
    }
    catch (error) {
        return {
            isError: true,
            error: error.message || 'Bulk upload failed'
        };
    }
}
/**
 * Create database pages from files in a folder
 */
export async function bulkCreatePagesFromFiles(notion, folderPath, databaseId, options = {}) {
    try {
        const { fileExtensions = ['.pdf'], pageTemplate = { title: '{filename}' }, processSubfolders = false } = options;
        // Scan folder for files
        const files = scanFolderForFiles(folderPath, fileExtensions, processSubfolders);
        const results = [];
        let successCount = 0;
        let errorCount = 0;
        for (const filePath of files) {
            try {
                const filename = basename(filePath, extname(filePath));
                // Upload file first
                const uploadResult = await uploadFileToNotion(notion, filePath, basename(filePath));
                if (uploadResult.isError) {
                    throw new Error(uploadResult.error);
                }
                // Create database page with file
                const pageProperties = {};
                // Process template properties
                if (pageTemplate.title) {
                    pageProperties[getTitleProperty(databaseId)] = {
                        title: [{ text: { content: pageTemplate.title.replace('{filename}', filename) } }]
                    };
                }
                // Add file attachment
                pageProperties['File'] = {
                    files: [{
                            type: 'file_upload',
                            file_upload: { id: uploadResult.result.uploadId },
                            name: basename(filePath)
                        }]
                };
                const page = await notion.pages.create({
                    parent: { database_id: databaseId },
                    properties: pageProperties
                });
                successCount++;
                results.push({
                    file: filePath,
                    pageId: page.id,
                    status: 'success'
                });
                // Rate limiting
                await sleep(500);
            }
            catch (error) {
                errorCount++;
                results.push({
                    file: filePath,
                    status: 'error',
                    error: error.message
                });
            }
        }
        return {
            isError: false,
            result: {
                folderPath,
                totalFiles: files.length,
                successCount,
                errorCount,
                results,
                message: `Processed ${files.length} files: ${successCount} successful, ${errorCount} failed`
            }
        };
    }
    catch (error) {
        return {
            isError: true,
            error: error.message || 'Failed to create pages from files'
        };
    }
}
// ============================================================
// DATABASE TEMPLATES
// ============================================================
/**
 * Create database with predefined templates
 */
export async function createDatabaseFromTemplate(notion, parentPageId, templateName, databaseTitle, customProperties) {
    try {
        const templates = {
            document_scanner: {
                'Name': { title: {} },
                'File': { files: {} },
                'Upload Date': { date: {} },
                'File Size': { rich_text: {} },
                'Document Type': { select: {
                        options: [
                            { name: 'Invoice', color: 'blue' },
                            { name: 'Receipt', color: 'green' },
                            { name: 'Contract', color: 'red' },
                            { name: 'Letter', color: 'yellow' },
                            { name: 'Other', color: 'gray' }
                        ]
                    } },
                'Status': { select: {
                        options: [
                            { name: 'New', color: 'blue' },
                            { name: 'Processed', color: 'green' },
                            { name: 'Archived', color: 'gray' }
                        ]
                    } },
                'Notes': { rich_text: {} }
            },
            file_manager: {
                'Name': { title: {} },
                'File': { files: {} },
                'Category': { select: {
                        options: [
                            { name: 'Documents', color: 'blue' },
                            { name: 'Images', color: 'green' },
                            { name: 'Videos', color: 'red' },
                            { name: 'Audio', color: 'yellow' },
                            { name: 'Archive', color: 'gray' }
                        ]
                    } },
                'Tags': { multi_select: {
                        options: [
                            { name: 'Important', color: 'red' },
                            { name: 'Work', color: 'blue' },
                            { name: 'Personal', color: 'green' },
                            { name: 'Archive', color: 'gray' }
                        ]
                    } },
                'Upload Date': { date: {} },
                'File Size': { rich_text: {} },
                'Description': { rich_text: {} }
            },
            custom: customProperties || {}
        };
        const properties = templates[templateName] || templates.custom;
        const database = await notion.databases.create({
            parent: { page_id: parentPageId },
            title: [{ text: { content: databaseTitle } }],
            properties
        });
        return {
            isError: false,
            result: {
                databaseId: database.id,
                title: databaseTitle,
                template: templateName,
                properties: Object.keys(properties),
                message: `Database "${databaseTitle}" created successfully using ${templateName} template`
            }
        };
    }
    catch (error) {
        return {
            isError: true,
            error: error.message || 'Failed to create database from template'
        };
    }
}
// ============================================================
// MONITORING & HEALTH CHECKS
// ============================================================
/**
 * Check Notion API health and permissions
 */
export async function checkNotionApiHealth(notion, includePermissions = true) {
    try {
        const healthCheck = {
            timestamp: new Date().toISOString(),
            apiConnectivity: false,
            integrationInfo: null,
            permissions: [],
            rateLimitStatus: getRateLimitStatus()
        };
        // Test basic connectivity
        try {
            const users = await notion.users.list({});
            healthCheck.apiConnectivity = true;
            healthCheck.integrationInfo = {
                canAccessUsers: true,
                userCount: users.results.length
            };
        }
        catch (error) {
            healthCheck.apiConnectivity = false;
            healthCheck.error = error.message;
        }
        // Check database permissions if requested
        if (includePermissions && healthCheck.apiConnectivity) {
            try {
                // This would need to be enhanced with specific database IDs to check
                healthCheck.permissions.push({
                    resource: 'users',
                    access: 'read',
                    status: 'granted'
                });
            }
            catch (error) {
                healthCheck.permissions.push({
                    resource: 'unknown',
                    status: 'error',
                    error: error.message
                });
            }
        }
        return {
            isError: false,
            result: healthCheck
        };
    }
    catch (error) {
        return {
            isError: true,
            error: error.message || 'Health check failed'
        };
    }
}
/**
 * Get API usage statistics
 */
export function getApiUsageStats(timeWindow = '24h') {
    try {
        const now = Date.now();
        const windowMs = parseTimeWindow(timeWindow);
        const cutoffTime = now - windowMs;
        // Filter requests within time window
        const relevantRequests = requestHistory.filter(time => time > cutoffTime);
        const stats = {
            timeWindow,
            requestCount: relevantRequests.length,
            averageRequestsPerMinute: relevantRequests.length / (windowMs / 60000),
            rateLimitStatus: getRateLimitStatus(),
            lastRequestTime: new Date(lastRequestTime).toISOString(),
            currentTime: new Date(now).toISOString()
        };
        return {
            isError: false,
            result: stats
        };
    }
    catch (error) {
        return {
            isError: true,
            error: error.message || 'Failed to get usage stats'
        };
    }
}
// ============================================================
// HELPER FUNCTIONS
// ============================================================
async function attachUploadedFile(notion, uploadId, attachTo) {
    switch (attachTo.type) {
        case 'page':
            // Add file as a block to the page
            await notion.blocks.children.append({
                block_id: attachTo.pageId,
                children: [{
                        object: 'block',
                        type: 'file',
                        file: {
                            type: 'file_upload',
                            file_upload: { id: uploadId }
                        }
                    }]
            });
            break;
        case 'page_cover':
            await notion.pages.update({
                page_id: attachTo.pageId,
                cover: {
                    type: 'file_upload',
                    file_upload: { id: uploadId }
                }
            });
            break;
        case 'database_property':
            // This would require creating a page first, then updating the property
            throw new Error('Database property attachment requires page creation first');
        default:
            throw new Error(`Unsupported attachment type: ${attachTo.type}`);
    }
}
function getMimeType(filePath) {
    const ext = extname(filePath).toLowerCase();
    const mimeTypes = {
        '.pdf': 'application/pdf',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.gif': 'image/gif',
        '.txt': 'text/plain',
        '.doc': 'application/msword',
        '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        '.xls': 'application/vnd.ms-excel',
        '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        '.zip': 'application/zip'
    };
    return mimeTypes[ext] || 'application/octet-stream';
}
async function scanAndProcessFiles(notion, watchPath, processedFiles, config) {
    try {
        const files = scanFolderForFiles(watchPath, config.fileFilter, config.recursive);
        for (const filePath of files) {
            if (!processedFiles.has(filePath)) {
                processedFiles.add(filePath);
                // Process new file
                const filename = basename(filePath, extname(filePath));
                // Upload file and create database entry
                try {
                    const uploadResult = await uploadFileToNotion(notion, filePath, basename(filePath));
                    if (!uploadResult.isError) {
                        const pageProperties = {};
                        pageProperties[config.titleProperty] = {
                            title: [{ text: { content: filename } }]
                        };
                        pageProperties[config.fileProperty] = {
                            files: [{
                                    type: 'file_upload',
                                    file_upload: { id: uploadResult.result.uploadId },
                                    name: basename(filePath)
                                }]
                        };
                        await notion.pages.create({
                            parent: { database_id: config.databaseId },
                            properties: pageProperties
                        });
                        console.log(`✅ Processed: ${filePath}`);
                    }
                }
                catch (error) {
                    console.error(`❌ Failed to process ${filePath}:`, error);
                }
                // Rate limiting
                await sleep(500);
            }
        }
    }
    catch (error) {
        console.error('Error in file scanning:', error);
    }
}
function scanFolderForFiles(folderPath, extensions, recursive) {
    const files = [];
    try {
        const items = readdirSync(folderPath);
        for (const item of items) {
            const itemPath = join(folderPath, item);
            const stat = statSync(itemPath);
            if (stat.isFile()) {
                const ext = extname(item).toLowerCase();
                if (extensions.includes(ext)) {
                    files.push(itemPath);
                }
            }
            else if (stat.isDirectory() && recursive) {
                files.push(...scanFolderForFiles(itemPath, extensions, recursive));
            }
        }
    }
    catch (error) {
        console.error(`Error scanning folder ${folderPath}:`, error);
    }
    return files;
}
function trackApiUsage() {
    apiRequestCount++;
    lastRequestTime = Date.now();
    requestHistory.push(lastRequestTime);
    // Keep only recent requests (last hour)
    const oneHourAgo = lastRequestTime - 3600000;
    while (requestHistory.length > 0 && requestHistory[0] < oneHourAgo) {
        requestHistory.shift();
    }
}
function getRateLimitStatus() {
    const now = Date.now();
    const oneSecondAgo = now - 1000;
    const recentRequests = requestHistory.filter(time => time > oneSecondAgo);
    return {
        requestsInLastSecond: recentRequests.length,
        requestsInLastHour: requestHistory.length,
        rateLimitApproaching: recentRequests.length >= 2,
        recommendation: recentRequests.length >= 2 ? 'Slow down requests' : 'Normal operation'
    };
}
function parseTimeWindow(timeWindow) {
    const windowMap = {
        '1h': 3600000,
        '24h': 86400000,
        '7d': 604800000,
        '30d': 2592000000
    };
    return windowMap[timeWindow] || 86400000; // Default to 24h
}
function getTitleProperty(databaseId) {
    // This would need to query the database schema to find the title property
    // For now, using common defaults
    return 'Name';
}
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
//# sourceMappingURL=enhanced-implementation.js.map