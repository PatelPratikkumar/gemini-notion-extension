import { createRichText } from '../types/notion.js';
export class ProjectManager {
    client;
    constructor(client) {
        this.client = client;
    }
    /**
     * Create a new project
     */
    async createProject(input) {
        const databaseId = this.client.getProjectDatabaseId();
        const properties = {
            'Project Name': {
                title: [createRichText(input.name)],
            },
            'Status': {
                select: { name: input.status || 'Planning' },
            },
        };
        // Add optional properties
        if (input.description) {
            properties['Description'] = {
                rich_text: [createRichText(input.description)],
            };
        }
        if (input.startDate) {
            properties['Start Date'] = {
                date: { start: input.startDate.toISOString().split('T')[0] },
            };
        }
        if (input.targetCompletion) {
            properties['Target Completion'] = {
                date: { start: input.targetCompletion.toISOString().split('T')[0] },
            };
        }
        if (input.technologies && input.technologies.length > 0) {
            properties['Key Technologies'] = {
                multi_select: input.technologies.map((tech) => ({ name: tech })),
            };
        }
        if (input.githubRepo) {
            properties['GitHub Repository'] = {
                url: input.githubRepo,
            };
        }
        const page = await this.client.createPage({
            parent: { database_id: databaseId },
            properties,
        });
        return this.parseProjectFromPage(page);
    }
    /**
     * Update an existing project
     */
    async updateProject(input) {
        const properties = {};
        if (input.name) {
            properties['Project Name'] = {
                title: [createRichText(input.name)],
            };
        }
        if (input.status) {
            properties['Status'] = {
                select: { name: input.status },
            };
        }
        if (input.description) {
            properties['Description'] = {
                rich_text: [createRichText(input.description)],
            };
        }
        if (input.startDate) {
            properties['Start Date'] = {
                date: { start: input.startDate.toISOString().split('T')[0] },
            };
        }
        if (input.targetCompletion) {
            properties['Target Completion'] = {
                date: { start: input.targetCompletion.toISOString().split('T')[0] },
            };
        }
        if (input.technologies) {
            properties['Key Technologies'] = {
                multi_select: input.technologies.map((tech) => ({ name: tech })),
            };
        }
        if (input.githubRepo) {
            properties['GitHub Repository'] = {
                url: input.githubRepo,
            };
        }
        const page = await this.client.updatePage({
            page_id: input.id,
            properties,
        });
        return this.parseProjectFromPage(page);
    }
    /**
     * Get a project by name or ID
     */
    async getProject(nameOrId, includeConversations = true) {
        // Try to get by ID first
        if (nameOrId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
            const page = await this.client.getPage(nameOrId);
            return this.parseProjectFromPage(page);
        }
        // Search by name
        const databaseId = this.client.getProjectDatabaseId();
        const response = await this.client.queryDatabase({
            database_id: databaseId,
            filter: {
                property: 'Project Name',
                title: {
                    equals: nameOrId,
                },
            },
        });
        if (response.results.length === 0) {
            throw new Error(`Project not found: ${nameOrId}`);
        }
        return this.parseProjectFromPage(response.results[0]);
    }
    /**
     * List projects with optional filters
     */
    async listProjects(options = {}) {
        const databaseId = this.client.getProjectDatabaseId();
        const queryParams = {
            database_id: databaseId,
        };
        // Add filters
        if (options.status) {
            queryParams.filter = {
                property: 'Status',
                select: {
                    equals: options.status,
                },
            };
        }
        // Add sorts
        if (options.sortBy) {
            const propertyMap = {
                name: 'Project Name',
                startDate: 'Start Date',
                lastActivity: 'Last Activity',
            };
            queryParams.sorts = [
                {
                    property: propertyMap[options.sortBy],
                    direction: options.sortDirection || 'descending',
                },
            ];
        }
        const response = await this.client.queryDatabase(queryParams);
        return response.results.map((page) => this.parseProjectFromPage(page));
    }
    /**
     * Link a conversation to a project
     */
    async linkConversationToProject(conversationId, projectNameOrId, notes) {
        try {
            // Get project
            const project = await this.getProject(projectNameOrId);
            // Update conversation with project relation
            await this.client.updatePage({
                page_id: conversationId,
                properties: {
                    'Associated Project': {
                        relation: [{ id: project.id }],
                    },
                },
            });
            // Add notes as comment if provided
            if (notes) {
                await this.client.createComment({
                    parent: { page_id: conversationId },
                    rich_text: [createRichText(notes)],
                });
            }
            return {
                project,
                conversationsLinked: 1,
                success: true,
            };
        }
        catch (error) {
            return {
                project: {},
                conversationsLinked: 0,
                success: false,
                error: error.message,
            };
        }
    }
    /**
     * Parse project data from Notion page response
     */
    parseProjectFromPage(page) {
        const props = page.properties;
        return {
            id: page.id,
            name: props['Project Name']?.title?.[0]?.plain_text || 'Untitled',
            description: props['Description']?.rich_text?.[0]?.plain_text,
            status: props['Status']?.select?.name,
            startDate: props['Start Date']?.date?.start
                ? new Date(props['Start Date'].date.start)
                : undefined,
            targetCompletion: props['Target Completion']?.date?.start
                ? new Date(props['Target Completion'].date.start)
                : undefined,
            technologies: props['Key Technologies']?.multi_select?.map((t) => t.name) || [],
            githubRepo: props['GitHub Repository']?.url,
            owner: props['Owner']?.people?.[0]?.name,
            conversationCount: props['Conversation Count']?.rollup?.number || 0,
            lastActivity: props['Last Activity']?.date?.start
                ? new Date(props['Last Activity'].date.start)
                : undefined,
        };
    }
}
//# sourceMappingURL=project-manager.js.map