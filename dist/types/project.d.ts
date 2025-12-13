export interface Project {
    id: string;
    name: string;
    description?: string;
    status: ProjectStatus;
    startDate?: Date;
    targetCompletion?: Date;
    technologies?: string[];
    githubRepo?: string;
    owner?: string;
    conversationCount?: number;
    lastActivity?: Date;
}
export type ProjectStatus = 'Active' | 'Planning' | 'On Hold' | 'Completed' | 'Archived';
export interface ProjectCreateInput {
    name: string;
    description?: string;
    status?: ProjectStatus;
    startDate?: Date;
    targetCompletion?: Date;
    technologies?: string[];
    githubRepo?: string;
}
export interface ProjectUpdateInput extends Partial<ProjectCreateInput> {
    id: string;
}
export interface ProjectQueryOptions {
    status?: ProjectStatus;
    technologies?: string[];
    sortBy?: 'name' | 'startDate' | 'lastActivity';
    sortDirection?: 'ascending' | 'descending';
}
export interface ProjectSyncResult {
    project: Project;
    conversationsLinked: number;
    success: boolean;
    error?: string;
}
//# sourceMappingURL=project.d.ts.map