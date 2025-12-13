// Comprehensive MCP tool definitions for full Notion functionality
export const tools = [
  // ==================== SEARCH ====================
  {
    name: 'notion_search',
    description: 'Search across entire Notion workspace for pages, databases, or both. Use this to find anything by name or content.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query text',
        },
        filter: {
          type: 'string',
          enum: ['page', 'database', 'all'],
          description: 'Filter by object type (default: all)',
        },
        limit: {
          type: 'number',
          description: 'Maximum results to return (default: 20)',
        },
      },
      required: ['query'],
    },
  },

  // ==================== PAGES ====================
  {
    name: 'create_page',
    description: 'Create a new page in Notion. Can be standalone or inside another page/database.',
    inputSchema: {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description: 'Page title',
        },
        parentPageId: {
          type: 'string',
          description: 'Parent page ID (creates page inside another page)',
        },
        parentDatabaseId: {
          type: 'string',
          description: 'Parent database ID (creates page as database entry)',
        },
        content: {
          type: 'string',
          description: 'Page content in markdown format',
        },
        icon: {
          type: 'string',
          description: 'Page icon (emoji like "📝" or external URL)',
        },
        cover: {
          type: 'string',
          description: 'Cover image URL',
        },
        properties: {
          type: 'object',
          description: 'Database properties (if creating in a database)',
        },
      },
      required: ['title'],
    },
  },
  {
    name: 'get_page',
    description: 'Retrieve a page by ID with all its properties and content blocks.',
    inputSchema: {
      type: 'object',
      properties: {
        pageId: {
          type: 'string',
          description: 'Page ID or URL',
        },
        includeContent: {
          type: 'boolean',
          description: 'Include page content blocks (default: true)',
        },
      },
      required: ['pageId'],
    },
  },
  {
    name: 'update_page',
    description: 'Update page properties, title, icon, or cover.',
    inputSchema: {
      type: 'object',
      properties: {
        pageId: {
          type: 'string',
          description: 'Page ID to update',
        },
        title: {
          type: 'string',
          description: 'New title',
        },
        icon: {
          type: 'string',
          description: 'New icon (emoji or URL)',
        },
        cover: {
          type: 'string',
          description: 'New cover image URL',
        },
        properties: {
          type: 'object',
          description: 'Properties to update',
        },
        archived: {
          type: 'boolean',
          description: 'Archive or unarchive the page',
        },
      },
      required: ['pageId'],
    },
  },
  {
    name: 'delete_page',
    description: 'Delete (archive) a page. Pages in Notion are never permanently deleted via API.',
    inputSchema: {
      type: 'object',
      properties: {
        pageId: {
          type: 'string',
          description: 'Page ID to delete',
        },
      },
      required: ['pageId'],
    },
  },

  // ==================== DATABASES ====================
  {
    name: 'list_databases',
    description: 'List all databases the integration has access to.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: {
          type: 'number',
          description: 'Maximum databases to return',
        },
      },
    },
  },
  {
    name: 'query_database',
    description: 'Query a database with filters, sorts, and pagination. Use this to find specific entries.',
    inputSchema: {
      type: 'object',
      properties: {
        databaseId: {
          type: 'string',
          description: 'Database ID (or shortcuts: "projects", "conversations")',
        },
        filter: {
          type: 'object',
          description: 'Notion filter object (e.g., {"property": "Status", "select": {"equals": "Active"}})',
        },
        sorts: {
          type: 'array',
          description: 'Sort order array',
          items: {
            type: 'object',
            properties: {
              property: { type: 'string' },
              direction: { type: 'string', enum: ['ascending', 'descending'] },
            },
          },
        },
        limit: {
          type: 'number',
          description: 'Maximum results (default: 100)',
        },
      },
      required: ['databaseId'],
    },
  },
  {
    name: 'create_database',
    description: 'Create a new database inside a page.',
    inputSchema: {
      type: 'object',
      properties: {
        parentPageId: {
          type: 'string',
          description: 'Parent page ID where database will be created',
        },
        title: {
          type: 'string',
          description: 'Database title',
        },
        properties: {
          type: 'object',
          description: 'Database property schema (columns)',
        },
        isInline: {
          type: 'boolean',
          description: 'Create as inline database (default: false)',
        },
      },
      required: ['parentPageId', 'title'],
    },
  },
  {
    name: 'add_database_entry',
    description: 'Add a new entry (row) to a database.',
    inputSchema: {
      type: 'object',
      properties: {
        databaseId: {
          type: 'string',
          description: 'Database ID (or shortcuts: "projects", "conversations")',
        },
        properties: {
          type: 'object',
          description: 'Entry properties matching database schema',
        },
        content: {
          type: 'string',
          description: 'Page content in markdown (optional)',
        },
      },
      required: ['databaseId', 'properties'],
    },
  },

  // ==================== BLOCKS (Content) ====================
  {
    name: 'get_block_children',
    description: 'Get all child blocks of a page or block.',
    inputSchema: {
      type: 'object',
      properties: {
        blockId: {
          type: 'string',
          description: 'Block or page ID',
        },
        recursive: {
          type: 'boolean',
          description: 'Fetch nested children recursively (default: false)',
        },
      },
      required: ['blockId'],
    },
  },
  {
    name: 'append_blocks',
    description: 'Append content blocks to a page or block. Supports markdown conversion.',
    inputSchema: {
      type: 'object',
      properties: {
        parentId: {
          type: 'string',
          description: 'Page or block ID to append to',
        },
        content: {
          type: 'string',
          description: 'Content in markdown format (will be converted to blocks)',
        },
        blocks: {
          type: 'array',
          description: 'Raw Notion block objects (advanced)',
          items: { type: 'object' },
        },
      },
      required: ['parentId'],
    },
  },
  {
    name: 'update_block',
    description: 'Update a specific block content or type.',
    inputSchema: {
      type: 'object',
      properties: {
        blockId: {
          type: 'string',
          description: 'Block ID to update',
        },
        content: {
          type: 'string',
          description: 'New text content',
        },
        type: {
          type: 'string',
          description: 'New block type',
          enum: ['paragraph', 'heading_1', 'heading_2', 'heading_3', 'bulleted_list_item', 'numbered_list_item', 'to_do', 'toggle', 'code', 'quote', 'callout'],
        },
        archived: {
          type: 'boolean',
          description: 'Archive (delete) the block',
        },
      },
      required: ['blockId'],
    },
  },
  {
    name: 'delete_block',
    description: 'Delete a block from a page.',
    inputSchema: {
      type: 'object',
      properties: {
        blockId: {
          type: 'string',
          description: 'Block ID to delete',
        },
      },
      required: ['blockId'],
    },
  },

  // ==================== COMMENTS ====================
  {
    name: 'get_comments',
    description: 'Get all comments on a page or block.',
    inputSchema: {
      type: 'object',
      properties: {
        pageId: {
          type: 'string',
          description: 'Page ID or block ID',
        },
      },
      required: ['pageId'],
    },
  },
  {
    name: 'add_comment',
    description: 'Add a comment to a page or discussion.',
    inputSchema: {
      type: 'object',
      properties: {
        pageId: {
          type: 'string',
          description: 'Page ID to comment on',
        },
        discussionId: {
          type: 'string',
          description: 'Discussion ID to reply to (for threaded comments)',
        },
        content: {
          type: 'string',
          description: 'Comment text',
        },
      },
      required: ['content'],
    },
  },

  // ==================== USERS ====================
  {
    name: 'list_users',
    description: 'List all users in the workspace.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: {
          type: 'number',
          description: 'Maximum users to return',
        },
      },
    },
  },
  {
    name: 'get_current_user',
    description: 'Get information about the current bot user (integration).',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },

  // ==================== PROJECT MANAGEMENT ====================
  {
    name: 'list_projects',
    description: 'List projects from the configured project database.',
    inputSchema: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          description: 'Filter by status',
        },
        sortBy: {
          type: 'string',
          enum: ['name', 'date', 'status'],
          description: 'Sort order',
        },
        limit: {
          type: 'number',
          description: 'Maximum results',
        },
      },
    },
  },
  {
    name: 'create_project',
    description: 'Create a new project in the project database.',
    inputSchema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Project name',
        },
        description: {
          type: 'string',
          description: 'Project description',
        },
        status: {
          type: 'string',
          enum: ['Active', 'Planning', 'On Hold', 'Completed', 'Archived'],
          description: 'Project status',
        },
        technologies: {
          type: 'array',
          items: { type: 'string' },
          description: 'Key technologies used',
        },
        githubRepo: {
          type: 'string',
          description: 'GitHub repository URL',
        },
      },
      required: ['name'],
    },
  },
  {
    name: 'update_project',
    description: 'Update an existing project.',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: {
          type: 'string',
          description: 'Project ID or name',
        },
        name: { type: 'string' },
        description: { type: 'string' },
        status: { type: 'string' },
        technologies: { type: 'array', items: { type: 'string' } },
        githubRepo: { type: 'string' },
      },
      required: ['projectId'],
    },
  },

  // ==================== CONVERSATION EXPORT ====================
  {
    name: 'export_conversation',
    description: 'Export the current Gemini conversation to Notion.',
    inputSchema: {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description: 'Custom title for the conversation',
        },
        tags: {
          type: 'array',
          items: { type: 'string' },
          description: 'Tags for categorization',
        },
        projectId: {
          type: 'string',
          description: 'Project to associate with',
        },
        conversationData: {
          type: 'object',
          description: 'The conversation messages',
          properties: {
            messages: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  role: { type: 'string' },
                  content: { type: 'string' },
                },
              },
            },
          },
        },
      },
      required: ['conversationData'],
    },
  },
  {
    name: 'link_conversation_to_project',
    description: 'Link an exported conversation to a project.',
    inputSchema: {
      type: 'object',
      properties: {
        conversationId: {
          type: 'string',
          description: 'Conversation page ID',
        },
        projectId: {
          type: 'string',
          description: 'Project ID or name',
        },
      },
      required: ['conversationId', 'projectId'],
    },
  },

  // ==================== UTILITY ====================
  {
    name: 'get_database_schema',
    description: 'Get the schema (properties/columns) of a database.',
    inputSchema: {
      type: 'object',
      properties: {
        databaseId: {
          type: 'string',
          description: 'Database ID (or shortcuts)',
        },
      },
      required: ['databaseId'],
    },
  },
  {
    name: 'duplicate_page',
    description: 'Create a copy of an existing page.',
    inputSchema: {
      type: 'object',
      properties: {
        pageId: {
          type: 'string',
          description: 'Page ID to duplicate',
        },
        newTitle: {
          type: 'string',
          description: 'Title for the copy',
        },
        targetParentId: {
          type: 'string',
          description: 'Where to place the copy (page or database ID)',
        },
      },
      required: ['pageId'],
    },
  },
  {
    name: 'get_recent_changes',
    description: 'Get recently modified pages and databases.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: {
          type: 'number',
          description: 'Number of results',
        },
        filter: {
          type: 'string',
          enum: ['page', 'database', 'all'],
          description: 'Filter by type',
        },
      },
    },
  },
];
