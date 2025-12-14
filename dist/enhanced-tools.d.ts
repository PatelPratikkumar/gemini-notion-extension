export declare const enhancedTools: ({
    name: string;
    description: string;
    inputSchema: {
        type: string;
        properties: {
            filePath: {
                type: string;
                description: string;
            };
            filename: {
                type: string;
                description: string;
            };
            attachTo: {
                type: string;
                properties: {
                    type: {
                        type: string;
                        enum: string[];
                        description: string;
                    };
                    pageId: {
                        type: string;
                        description: string;
                    };
                    databaseId: {
                        type: string;
                        description: string;
                    };
                    propertyName: {
                        type: string;
                        description: string;
                    };
                };
                required: string[];
            };
            chunkSizeMB?: undefined;
            attachToPageId?: undefined;
            watchPath?: undefined;
            databaseId?: undefined;
            fileFilter?: undefined;
            titleProperty?: undefined;
            fileProperty?: undefined;
            recursive?: undefined;
            pollInterval?: undefined;
            watcherPath?: undefined;
            files?: undefined;
            delayBetweenUploads?: undefined;
            folderPath?: undefined;
            fileExtensions?: undefined;
            pageTemplate?: undefined;
            processSubfolders?: undefined;
            webhookUrl?: undefined;
            events?: undefined;
            parentPageId?: undefined;
            templateName?: undefined;
            databaseTitle?: undefined;
            customProperties?: undefined;
            sourceType?: undefined;
            sourceConfig?: undefined;
            targetDatabaseId?: undefined;
            keyField?: undefined;
            syncMode?: undefined;
            fieldMapping?: undefined;
            fileId?: undefined;
            pageId?: undefined;
            extractionType?: undefined;
            saveToProperty?: undefined;
            includePermissions?: undefined;
            timeWindow?: undefined;
        };
        required: string[];
    };
} | {
    name: string;
    description: string;
    inputSchema: {
        type: string;
        properties: {
            filePath: {
                type: string;
                description: string;
            };
            filename: {
                type: string;
                description: string;
            };
            chunkSizeMB: {
                type: string;
                description: string;
                default: number;
            };
            attachToPageId: {
                type: string;
                description: string;
            };
            attachTo?: undefined;
            watchPath?: undefined;
            databaseId?: undefined;
            fileFilter?: undefined;
            titleProperty?: undefined;
            fileProperty?: undefined;
            recursive?: undefined;
            pollInterval?: undefined;
            watcherPath?: undefined;
            files?: undefined;
            delayBetweenUploads?: undefined;
            folderPath?: undefined;
            fileExtensions?: undefined;
            pageTemplate?: undefined;
            processSubfolders?: undefined;
            webhookUrl?: undefined;
            events?: undefined;
            parentPageId?: undefined;
            templateName?: undefined;
            databaseTitle?: undefined;
            customProperties?: undefined;
            sourceType?: undefined;
            sourceConfig?: undefined;
            targetDatabaseId?: undefined;
            keyField?: undefined;
            syncMode?: undefined;
            fieldMapping?: undefined;
            fileId?: undefined;
            pageId?: undefined;
            extractionType?: undefined;
            saveToProperty?: undefined;
            includePermissions?: undefined;
            timeWindow?: undefined;
        };
        required: string[];
    };
} | {
    name: string;
    description: string;
    inputSchema: {
        type: string;
        properties: {
            watchPath: {
                type: string;
                description: string;
            };
            databaseId: {
                type: string;
                description: string;
            };
            fileFilter: {
                type: string;
                items: {
                    type: string;
                };
                description: string;
                default: string[];
            };
            titleProperty: {
                type: string;
                description: string;
                default: string;
            };
            fileProperty: {
                type: string;
                description: string;
                default: string;
            };
            recursive: {
                type: string;
                description: string;
                default: boolean;
            };
            pollInterval: {
                type: string;
                description: string;
                default: number;
            };
            filePath?: undefined;
            filename?: undefined;
            attachTo?: undefined;
            chunkSizeMB?: undefined;
            attachToPageId?: undefined;
            watcherPath?: undefined;
            files?: undefined;
            delayBetweenUploads?: undefined;
            folderPath?: undefined;
            fileExtensions?: undefined;
            pageTemplate?: undefined;
            processSubfolders?: undefined;
            webhookUrl?: undefined;
            events?: undefined;
            parentPageId?: undefined;
            templateName?: undefined;
            databaseTitle?: undefined;
            customProperties?: undefined;
            sourceType?: undefined;
            sourceConfig?: undefined;
            targetDatabaseId?: undefined;
            keyField?: undefined;
            syncMode?: undefined;
            fieldMapping?: undefined;
            fileId?: undefined;
            pageId?: undefined;
            extractionType?: undefined;
            saveToProperty?: undefined;
            includePermissions?: undefined;
            timeWindow?: undefined;
        };
        required: string[];
    };
} | {
    name: string;
    description: string;
    inputSchema: {
        type: string;
        properties: {
            watcherPath: {
                type: string;
                description: string;
            };
            filePath?: undefined;
            filename?: undefined;
            attachTo?: undefined;
            chunkSizeMB?: undefined;
            attachToPageId?: undefined;
            watchPath?: undefined;
            databaseId?: undefined;
            fileFilter?: undefined;
            titleProperty?: undefined;
            fileProperty?: undefined;
            recursive?: undefined;
            pollInterval?: undefined;
            files?: undefined;
            delayBetweenUploads?: undefined;
            folderPath?: undefined;
            fileExtensions?: undefined;
            pageTemplate?: undefined;
            processSubfolders?: undefined;
            webhookUrl?: undefined;
            events?: undefined;
            parentPageId?: undefined;
            templateName?: undefined;
            databaseTitle?: undefined;
            customProperties?: undefined;
            sourceType?: undefined;
            sourceConfig?: undefined;
            targetDatabaseId?: undefined;
            keyField?: undefined;
            syncMode?: undefined;
            fieldMapping?: undefined;
            fileId?: undefined;
            pageId?: undefined;
            extractionType?: undefined;
            saveToProperty?: undefined;
            includePermissions?: undefined;
            timeWindow?: undefined;
        };
        required?: undefined;
    };
} | {
    name: string;
    description: string;
    inputSchema: {
        type: string;
        properties: {
            filePath?: undefined;
            filename?: undefined;
            attachTo?: undefined;
            chunkSizeMB?: undefined;
            attachToPageId?: undefined;
            watchPath?: undefined;
            databaseId?: undefined;
            fileFilter?: undefined;
            titleProperty?: undefined;
            fileProperty?: undefined;
            recursive?: undefined;
            pollInterval?: undefined;
            watcherPath?: undefined;
            files?: undefined;
            delayBetweenUploads?: undefined;
            folderPath?: undefined;
            fileExtensions?: undefined;
            pageTemplate?: undefined;
            processSubfolders?: undefined;
            webhookUrl?: undefined;
            events?: undefined;
            parentPageId?: undefined;
            templateName?: undefined;
            databaseTitle?: undefined;
            customProperties?: undefined;
            sourceType?: undefined;
            sourceConfig?: undefined;
            targetDatabaseId?: undefined;
            keyField?: undefined;
            syncMode?: undefined;
            fieldMapping?: undefined;
            fileId?: undefined;
            pageId?: undefined;
            extractionType?: undefined;
            saveToProperty?: undefined;
            includePermissions?: undefined;
            timeWindow?: undefined;
        };
        required?: undefined;
    };
} | {
    name: string;
    description: string;
    inputSchema: {
        type: string;
        properties: {
            files: {
                type: string;
                items: {
                    type: string;
                    properties: {
                        filePath: {
                            type: string;
                        };
                        filename: {
                            type: string;
                        };
                        pageId: {
                            type: string;
                            description: string;
                        };
                    };
                    required: string[];
                };
                description: string;
            };
            delayBetweenUploads: {
                type: string;
                description: string;
                default: number;
            };
            filePath?: undefined;
            filename?: undefined;
            attachTo?: undefined;
            chunkSizeMB?: undefined;
            attachToPageId?: undefined;
            watchPath?: undefined;
            databaseId?: undefined;
            fileFilter?: undefined;
            titleProperty?: undefined;
            fileProperty?: undefined;
            recursive?: undefined;
            pollInterval?: undefined;
            watcherPath?: undefined;
            folderPath?: undefined;
            fileExtensions?: undefined;
            pageTemplate?: undefined;
            processSubfolders?: undefined;
            webhookUrl?: undefined;
            events?: undefined;
            parentPageId?: undefined;
            templateName?: undefined;
            databaseTitle?: undefined;
            customProperties?: undefined;
            sourceType?: undefined;
            sourceConfig?: undefined;
            targetDatabaseId?: undefined;
            keyField?: undefined;
            syncMode?: undefined;
            fieldMapping?: undefined;
            fileId?: undefined;
            pageId?: undefined;
            extractionType?: undefined;
            saveToProperty?: undefined;
            includePermissions?: undefined;
            timeWindow?: undefined;
        };
        required: string[];
    };
} | {
    name: string;
    description: string;
    inputSchema: {
        type: string;
        properties: {
            folderPath: {
                type: string;
                description: string;
            };
            databaseId: {
                type: string;
                description: string;
            };
            fileExtensions: {
                type: string;
                items: {
                    type: string;
                };
                description: string;
                default: string[];
            };
            pageTemplate: {
                type: string;
                description: string;
                properties: {
                    title: {
                        type: string;
                        default: string;
                    };
                    additionalProperties: {
                        type: string;
                    };
                };
            };
            processSubfolders: {
                type: string;
                description: string;
                default: boolean;
            };
            filePath?: undefined;
            filename?: undefined;
            attachTo?: undefined;
            chunkSizeMB?: undefined;
            attachToPageId?: undefined;
            watchPath?: undefined;
            fileFilter?: undefined;
            titleProperty?: undefined;
            fileProperty?: undefined;
            recursive?: undefined;
            pollInterval?: undefined;
            watcherPath?: undefined;
            files?: undefined;
            delayBetweenUploads?: undefined;
            webhookUrl?: undefined;
            events?: undefined;
            parentPageId?: undefined;
            templateName?: undefined;
            databaseTitle?: undefined;
            customProperties?: undefined;
            sourceType?: undefined;
            sourceConfig?: undefined;
            targetDatabaseId?: undefined;
            keyField?: undefined;
            syncMode?: undefined;
            fieldMapping?: undefined;
            fileId?: undefined;
            pageId?: undefined;
            extractionType?: undefined;
            saveToProperty?: undefined;
            includePermissions?: undefined;
            timeWindow?: undefined;
        };
        required: string[];
    };
} | {
    name: string;
    description: string;
    inputSchema: {
        type: string;
        properties: {
            webhookUrl: {
                type: string;
                description: string;
            };
            databaseId: {
                type: string;
                description: string;
            };
            events: {
                type: string;
                items: {
                    type: string;
                    enum: string[];
                };
                description: string;
                default: string[];
            };
            filePath?: undefined;
            filename?: undefined;
            attachTo?: undefined;
            chunkSizeMB?: undefined;
            attachToPageId?: undefined;
            watchPath?: undefined;
            fileFilter?: undefined;
            titleProperty?: undefined;
            fileProperty?: undefined;
            recursive?: undefined;
            pollInterval?: undefined;
            watcherPath?: undefined;
            files?: undefined;
            delayBetweenUploads?: undefined;
            folderPath?: undefined;
            fileExtensions?: undefined;
            pageTemplate?: undefined;
            processSubfolders?: undefined;
            parentPageId?: undefined;
            templateName?: undefined;
            databaseTitle?: undefined;
            customProperties?: undefined;
            sourceType?: undefined;
            sourceConfig?: undefined;
            targetDatabaseId?: undefined;
            keyField?: undefined;
            syncMode?: undefined;
            fieldMapping?: undefined;
            fileId?: undefined;
            pageId?: undefined;
            extractionType?: undefined;
            saveToProperty?: undefined;
            includePermissions?: undefined;
            timeWindow?: undefined;
        };
        required: string[];
    };
} | {
    name: string;
    description: string;
    inputSchema: {
        type: string;
        properties: {
            parentPageId: {
                type: string;
                description: string;
            };
            templateName: {
                type: string;
                enum: string[];
                description: string;
            };
            databaseTitle: {
                type: string;
                description: string;
            };
            customProperties: {
                type: string;
                description: string;
                additionalProperties: {
                    type: string;
                    properties: {
                        type: {
                            type: string;
                        };
                        config: {
                            type: string;
                        };
                    };
                };
            };
            filePath?: undefined;
            filename?: undefined;
            attachTo?: undefined;
            chunkSizeMB?: undefined;
            attachToPageId?: undefined;
            watchPath?: undefined;
            databaseId?: undefined;
            fileFilter?: undefined;
            titleProperty?: undefined;
            fileProperty?: undefined;
            recursive?: undefined;
            pollInterval?: undefined;
            watcherPath?: undefined;
            files?: undefined;
            delayBetweenUploads?: undefined;
            folderPath?: undefined;
            fileExtensions?: undefined;
            pageTemplate?: undefined;
            processSubfolders?: undefined;
            webhookUrl?: undefined;
            events?: undefined;
            sourceType?: undefined;
            sourceConfig?: undefined;
            targetDatabaseId?: undefined;
            keyField?: undefined;
            syncMode?: undefined;
            fieldMapping?: undefined;
            fileId?: undefined;
            pageId?: undefined;
            extractionType?: undefined;
            saveToProperty?: undefined;
            includePermissions?: undefined;
            timeWindow?: undefined;
        };
        required: string[];
    };
} | {
    name: string;
    description: string;
    inputSchema: {
        type: string;
        properties: {
            sourceType: {
                type: string;
                enum: string[];
                description: string;
            };
            sourceConfig: {
                type: string;
                description: string;
                properties: {
                    path: {
                        type: string;
                    };
                    url: {
                        type: string;
                    };
                    headers: {
                        type: string;
                    };
                    query: {
                        type: string;
                    };
                };
            };
            targetDatabaseId: {
                type: string;
                description: string;
            };
            keyField: {
                type: string;
                description: string;
            };
            syncMode: {
                type: string;
                enum: string[];
                description: string;
                default: string;
            };
            fieldMapping: {
                type: string;
                description: string;
                additionalProperties: {
                    type: string;
                };
            };
            filePath?: undefined;
            filename?: undefined;
            attachTo?: undefined;
            chunkSizeMB?: undefined;
            attachToPageId?: undefined;
            watchPath?: undefined;
            databaseId?: undefined;
            fileFilter?: undefined;
            titleProperty?: undefined;
            fileProperty?: undefined;
            recursive?: undefined;
            pollInterval?: undefined;
            watcherPath?: undefined;
            files?: undefined;
            delayBetweenUploads?: undefined;
            folderPath?: undefined;
            fileExtensions?: undefined;
            pageTemplate?: undefined;
            processSubfolders?: undefined;
            webhookUrl?: undefined;
            events?: undefined;
            parentPageId?: undefined;
            templateName?: undefined;
            databaseTitle?: undefined;
            customProperties?: undefined;
            fileId?: undefined;
            pageId?: undefined;
            extractionType?: undefined;
            saveToProperty?: undefined;
            includePermissions?: undefined;
            timeWindow?: undefined;
        };
        required: string[];
    };
} | {
    name: string;
    description: string;
    inputSchema: {
        type: string;
        properties: {
            fileId: {
                type: string;
                description: string;
            };
            pageId: {
                type: string;
                description: string;
            };
            extractionType: {
                type: string;
                enum: string[];
                description: string;
                default: string;
            };
            saveToProperty: {
                type: string;
                description: string;
            };
            filePath?: undefined;
            filename?: undefined;
            attachTo?: undefined;
            chunkSizeMB?: undefined;
            attachToPageId?: undefined;
            watchPath?: undefined;
            databaseId?: undefined;
            fileFilter?: undefined;
            titleProperty?: undefined;
            fileProperty?: undefined;
            recursive?: undefined;
            pollInterval?: undefined;
            watcherPath?: undefined;
            files?: undefined;
            delayBetweenUploads?: undefined;
            folderPath?: undefined;
            fileExtensions?: undefined;
            pageTemplate?: undefined;
            processSubfolders?: undefined;
            webhookUrl?: undefined;
            events?: undefined;
            parentPageId?: undefined;
            templateName?: undefined;
            databaseTitle?: undefined;
            customProperties?: undefined;
            sourceType?: undefined;
            sourceConfig?: undefined;
            targetDatabaseId?: undefined;
            keyField?: undefined;
            syncMode?: undefined;
            fieldMapping?: undefined;
            includePermissions?: undefined;
            timeWindow?: undefined;
        };
        required: string[];
    };
} | {
    name: string;
    description: string;
    inputSchema: {
        type: string;
        properties: {
            includePermissions: {
                type: string;
                description: string;
                default: boolean;
            };
            filePath?: undefined;
            filename?: undefined;
            attachTo?: undefined;
            chunkSizeMB?: undefined;
            attachToPageId?: undefined;
            watchPath?: undefined;
            databaseId?: undefined;
            fileFilter?: undefined;
            titleProperty?: undefined;
            fileProperty?: undefined;
            recursive?: undefined;
            pollInterval?: undefined;
            watcherPath?: undefined;
            files?: undefined;
            delayBetweenUploads?: undefined;
            folderPath?: undefined;
            fileExtensions?: undefined;
            pageTemplate?: undefined;
            processSubfolders?: undefined;
            webhookUrl?: undefined;
            events?: undefined;
            parentPageId?: undefined;
            templateName?: undefined;
            databaseTitle?: undefined;
            customProperties?: undefined;
            sourceType?: undefined;
            sourceConfig?: undefined;
            targetDatabaseId?: undefined;
            keyField?: undefined;
            syncMode?: undefined;
            fieldMapping?: undefined;
            fileId?: undefined;
            pageId?: undefined;
            extractionType?: undefined;
            saveToProperty?: undefined;
            timeWindow?: undefined;
        };
        required?: undefined;
    };
} | {
    name: string;
    description: string;
    inputSchema: {
        type: string;
        properties: {
            timeWindow: {
                type: string;
                enum: string[];
                description: string;
                default: string;
            };
            filePath?: undefined;
            filename?: undefined;
            attachTo?: undefined;
            chunkSizeMB?: undefined;
            attachToPageId?: undefined;
            watchPath?: undefined;
            databaseId?: undefined;
            fileFilter?: undefined;
            titleProperty?: undefined;
            fileProperty?: undefined;
            recursive?: undefined;
            pollInterval?: undefined;
            watcherPath?: undefined;
            files?: undefined;
            delayBetweenUploads?: undefined;
            folderPath?: undefined;
            fileExtensions?: undefined;
            pageTemplate?: undefined;
            processSubfolders?: undefined;
            webhookUrl?: undefined;
            events?: undefined;
            parentPageId?: undefined;
            templateName?: undefined;
            databaseTitle?: undefined;
            customProperties?: undefined;
            sourceType?: undefined;
            sourceConfig?: undefined;
            targetDatabaseId?: undefined;
            keyField?: undefined;
            syncMode?: undefined;
            fieldMapping?: undefined;
            fileId?: undefined;
            pageId?: undefined;
            extractionType?: undefined;
            saveToProperty?: undefined;
            includePermissions?: undefined;
        };
        required?: undefined;
    };
})[];
//# sourceMappingURL=enhanced-tools.d.ts.map