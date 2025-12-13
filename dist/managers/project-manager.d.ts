import type { NotionClient } from '../notion-client.js';
import type { Project, ProjectCreateInput, ProjectUpdateInput, ProjectQueryOptions, ProjectSyncResult } from '../types/project.js';
export declare class ProjectManager {
    private client;
    constructor(client: NotionClient);
    /**
     * Create a new project
     */
    createProject(input: ProjectCreateInput): Promise<Project>;
    /**
     * Update an existing project
     */
    updateProject(input: ProjectUpdateInput): Promise<Project>;
    /**
     * Get a project by name or ID
     */
    getProject(nameOrId: string, includeConversations?: boolean): Promise<Project>;
    /**
     * List projects with optional filters
     */
    listProjects(options?: ProjectQueryOptions): Promise<Project[]>;
    /**
     * Link a conversation to a project
     */
    linkConversationToProject(conversationId: string, projectNameOrId: string, notes?: string): Promise<ProjectSyncResult>;
    /**
     * Parse project data from Notion page response
     */
    private parseProjectFromPage;
}
//# sourceMappingURL=project-manager.d.ts.map