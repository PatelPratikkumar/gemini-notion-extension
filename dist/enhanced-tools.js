// Enhanced Notion API tools based on comprehensive research
// Adds file upload, webhook, and automation capabilities
export const enhancedTools = [
    // ============================================================
    // FILE UPLOAD TOOLS (NEW - Based on 2024 API Updates)
    // ============================================================
    {
        name: "upload_file_to_notion",
        description: "Upload a file directly to Notion using the new File Upload API (2024). Supports files up to 20MB with single-part upload.",
        inputSchema: {
            type: "object",
            properties: {
                filePath: {
                    type: "string",
                    description: "Local file path to upload"
                },
                filename: {
                    type: "string",
                    description: "Name for the file in Notion (optional, defaults to original filename)"
                },
                attachTo: {
                    type: "object",
                    properties: {
                        type: {
                            type: "string",
                            enum: ["page", "database_property", "page_cover", "page_icon"],
                            description: "Where to attach the uploaded file"
                        },
                        pageId: {
                            type: "string",
                            description: "Page ID to attach file to (required for page, page_cover, page_icon)"
                        },
                        databaseId: {
                            type: "string",
                            description: "Database ID (required for database_property)"
                        },
                        propertyName: {
                            type: "string",
                            description: "Property name in database to attach file (required for database_property)"
                        }
                    },
                    required: ["type"]
                }
            },
            required: ["filePath", "attachTo"]
        }
    },
    {
        name: "upload_large_file_multipart",
        description: "Upload large files (>20MB) using multi-part upload. Automatically splits file into chunks and uploads sequentially.",
        inputSchema: {
            type: "object",
            properties: {
                filePath: {
                    type: "string",
                    description: "Local file path to large file"
                },
                filename: {
                    type: "string",
                    description: "Name for the file in Notion"
                },
                chunkSizeMB: {
                    type: "number",
                    description: "Size of each chunk in MB (default: 10MB, max: 20MB)",
                    default: 10
                },
                attachToPageId: {
                    type: "string",
                    description: "Page ID to attach the uploaded large file"
                }
            },
            required: ["filePath", "filename", "attachToPageId"]
        }
    },
    // ============================================================
    // FILE MONITORING & AUTOMATION TOOLS
    // ============================================================
    {
        name: "start_file_watcher",
        description: "Start monitoring a local folder for new files and automatically upload them to a Notion database. Perfect for scanner automation.",
        inputSchema: {
            type: "object",
            properties: {
                watchPath: {
                    type: "string",
                    description: "Local folder path to monitor for new files"
                },
                databaseId: {
                    type: "string",
                    description: "Notion database ID to upload files to"
                },
                fileFilter: {
                    type: "array",
                    items: { type: "string" },
                    description: "File extensions to monitor (e.g., ['.pdf', '.jpg', '.png'])",
                    default: [".pdf"]
                },
                titleProperty: {
                    type: "string",
                    description: "Database property name for the page title",
                    default: "Name"
                },
                fileProperty: {
                    type: "string",
                    description: "Database property name for file attachment",
                    default: "File"
                },
                recursive: {
                    type: "boolean",
                    description: "Monitor subfolders recursively",
                    default: true
                },
                pollInterval: {
                    type: "number",
                    description: "Polling interval in seconds (default: 5)",
                    default: 5
                }
            },
            required: ["watchPath", "databaseId"]
        }
    },
    {
        name: "stop_file_watcher",
        description: "Stop the active file monitoring process",
        inputSchema: {
            type: "object",
            properties: {
                watcherPath: {
                    type: "string",
                    description: "Path of the watcher to stop (optional, stops all if not provided)"
                }
            }
        }
    },
    {
        name: "list_active_watchers",
        description: "List all currently active file monitoring processes",
        inputSchema: {
            type: "object",
            properties: {}
        }
    },
    // ============================================================
    // BATCH & BULK OPERATIONS (Based on Research Rate Limiting)
    // ============================================================
    {
        name: "bulk_upload_files",
        description: "Upload multiple files to Notion with proper rate limiting and retry logic. Respects the 3 requests/second limit.",
        inputSchema: {
            type: "object",
            properties: {
                files: {
                    type: "array",
                    items: {
                        type: "object",
                        properties: {
                            filePath: { type: "string" },
                            filename: { type: "string" },
                            pageId: { type: "string", description: "Target page ID for this file" }
                        },
                        required: ["filePath", "pageId"]
                    },
                    description: "Array of files to upload"
                },
                delayBetweenUploads: {
                    type: "number",
                    description: "Delay between uploads in milliseconds (default: 400ms for rate limiting)",
                    default: 400
                }
            },
            required: ["files"]
        }
    },
    {
        name: "bulk_create_pages_from_files",
        description: "Create multiple database entries from a folder of files. Perfect for processing scanner output.",
        inputSchema: {
            type: "object",
            properties: {
                folderPath: {
                    type: "string",
                    description: "Path to folder containing files to process"
                },
                databaseId: {
                    type: "string",
                    description: "Database ID to create pages in"
                },
                fileExtensions: {
                    type: "array",
                    items: { type: "string" },
                    description: "File extensions to process (e.g., ['.pdf', '.jpg'])",
                    default: [".pdf"]
                },
                pageTemplate: {
                    type: "object",
                    description: "Template properties for created pages. Use {filename} placeholder for dynamic values.",
                    properties: {
                        title: { type: "string", default: "{filename}" },
                        additionalProperties: { type: "object" }
                    }
                },
                processSubfolders: {
                    type: "boolean",
                    description: "Process subfolders recursively",
                    default: false
                }
            },
            required: ["folderPath", "databaseId"]
        }
    },
    // ============================================================
    // WEBHOOK & AUTOMATION TOOLS
    // ============================================================
    {
        name: "setup_notion_webhook",
        description: "Configure webhook endpoint for real-time Notion database changes (requires webhook server setup)",
        inputSchema: {
            type: "object",
            properties: {
                webhookUrl: {
                    type: "string",
                    description: "URL endpoint to receive webhook notifications"
                },
                databaseId: {
                    type: "string",
                    description: "Database ID to monitor for changes"
                },
                events: {
                    type: "array",
                    items: {
                        type: "string",
                        enum: ["page.created", "page.updated", "page.deleted", "database.updated"]
                    },
                    description: "Events to monitor",
                    default: ["page.created", "page.updated"]
                }
            },
            required: ["webhookUrl", "databaseId"]
        }
    },
    // ============================================================
    // ADVANCED DATABASE OPERATIONS 
    // ============================================================
    {
        name: "create_database_from_template",
        description: "Create a new database with predefined schema templates (e.g., Document Scanner, CRM, Project Tracker)",
        inputSchema: {
            type: "object",
            properties: {
                parentPageId: {
                    type: "string",
                    description: "Parent page to create database in"
                },
                templateName: {
                    type: "string",
                    enum: [
                        "document_scanner",
                        "file_manager",
                        "crm_contacts",
                        "project_tracker",
                        "invoice_tracker",
                        "meeting_notes",
                        "custom"
                    ],
                    description: "Pre-built template to use"
                },
                databaseTitle: {
                    type: "string",
                    description: "Title for the new database"
                },
                customProperties: {
                    type: "object",
                    description: "Custom properties if using 'custom' template",
                    additionalProperties: {
                        type: "object",
                        properties: {
                            type: { type: "string" },
                            config: { type: "object" }
                        }
                    }
                }
            },
            required: ["parentPageId", "templateName", "databaseTitle"]
        }
    },
    {
        name: "sync_external_data_to_notion",
        description: "Sync data from external APIs or databases to Notion with conflict resolution and update detection",
        inputSchema: {
            type: "object",
            properties: {
                sourceType: {
                    type: "string",
                    enum: ["csv", "json", "api", "database"],
                    description: "Type of external data source"
                },
                sourceConfig: {
                    type: "object",
                    description: "Configuration for the data source (file path, API endpoint, etc.)",
                    properties: {
                        path: { type: "string" },
                        url: { type: "string" },
                        headers: { type: "object" },
                        query: { type: "string" }
                    }
                },
                targetDatabaseId: {
                    type: "string",
                    description: "Notion database to sync to"
                },
                keyField: {
                    type: "string",
                    description: "Field to use for matching existing records (prevents duplicates)"
                },
                syncMode: {
                    type: "string",
                    enum: ["insert_only", "update_only", "insert_and_update"],
                    description: "How to handle existing records",
                    default: "insert_and_update"
                },
                fieldMapping: {
                    type: "object",
                    description: "Map source fields to Notion properties",
                    additionalProperties: { type: "string" }
                }
            },
            required: ["sourceType", "sourceConfig", "targetDatabaseId", "keyField"]
        }
    },
    // ============================================================
    // FILE PROCESSING & EXTRACTION TOOLS
    // ============================================================
    {
        name: "extract_text_from_uploaded_file",
        description: "Extract text content from uploaded files (PDFs, images) using OCR or text extraction",
        inputSchema: {
            type: "object",
            properties: {
                fileId: {
                    type: "string",
                    description: "Notion file ID from previous upload"
                },
                pageId: {
                    type: "string",
                    description: "Page containing the file"
                },
                extractionType: {
                    type: "string",
                    enum: ["ocr", "pdf_text", "metadata"],
                    description: "Type of extraction to perform",
                    default: "pdf_text"
                },
                saveToProperty: {
                    type: "string",
                    description: "Database property name to save extracted text to"
                }
            },
            required: ["fileId", "pageId"]
        }
    },
    // ============================================================
    // MONITORING & HEALTH CHECK TOOLS
    // ============================================================
    {
        name: "check_notion_api_health",
        description: "Check Notion API connectivity, rate limit status, and integration permissions",
        inputSchema: {
            type: "object",
            properties: {
                includePermissions: {
                    type: "boolean",
                    description: "Include detailed permission check for connected databases",
                    default: true
                }
            }
        }
    },
    {
        name: "get_api_usage_stats",
        description: "Get current API usage statistics including rate limit status and request counts",
        inputSchema: {
            type: "object",
            properties: {
                timeWindow: {
                    type: "string",
                    enum: ["1h", "24h", "7d", "30d"],
                    description: "Time window for usage stats",
                    default: "24h"
                }
            }
        }
    }
];
//# sourceMappingURL=enhanced-tools.js.map