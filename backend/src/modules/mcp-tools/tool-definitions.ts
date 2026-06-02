import { TaskType } from '@prisma/client';

export type MCPToolScope = 'organization' | 'workspace' | 'project' | 'cross';

export interface MCPToolDefinition {
  name: string;
  description: string;
  input_schema: Record<string, any>;
  scope: MCPToolScope;
}

const TASK_TYPES = Object.values(TaskType);
const TASK_TYPES_STR = TASK_TYPES.join(',');

export const MCP_TOOL_DEFINITIONS: MCPToolDefinition[] = [
  // ================================================================
  // ORGANIZATION TOOLS (scope: organization)
  // ================================================================
  {
    name: 'list_organizations',
    description:
      'List all organizations the user belongs to. ORGANIZATION-level operation. / 列出用户所属的所有组织。组织级别操作。',
    input_schema: { type: 'object', properties: {} },
    scope: 'organization',
  },
  {
    name: 'get_organization',
    description:
      'Get organization details by ID. ORGANIZATION-level operation — use this for organization info, NOT workspace or project tools. / 根据ID获取组织详情。组织级别操作——不要用工作区或项目工具。',
    input_schema: {
      type: 'object',
      properties: {
        organizationId: { type: 'string', description: 'Organization ID (UUID) / 组织 ID' },
      },
      required: ['organizationId'],
    },
    scope: 'organization',
  },
  {
    name: 'create_organization',
    description:
      'Create a new organization. ORGANIZATION-level operation. The creator becomes OWNER. A default workflow and workspace are automatically created. / 创建新组织。组织级别操作。创建者成为所有者。自动创建默认工作流和工作区。',
    input_schema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Organization name / 组织名称' },
        slug: {
          type: 'string',
          description: 'URL-friendly slug (auto-generated if omitted) / URL slug（留空自动生成）',
        },
        description: { type: 'string', description: 'Organization description / 组织描述' },
        website: { type: 'string', description: 'Organization website URL / 组织网站' },
        avatar: { type: 'string', description: 'Avatar URL / 头像 URL' },
      },
      required: ['name'],
    },
    scope: 'organization',
  },
  {
    name: 'update_organization',
    description:
      'Update an organization name, description, website, avatar, or slug. ORGANIZATION-level operation. / 更新组织名称、描述、网站、头像或 slug。组织级别操作。',
    input_schema: {
      type: 'object',
      properties: {
        organizationId: { type: 'string', description: 'Organization ID (UUID) / 组织 ID' },
        name: { type: 'string', description: 'New name / 新名称' },
        description: { type: 'string', description: 'New description / 新描述' },
        website: { type: 'string', description: 'New website URL / 新网站 URL' },
        avatar: { type: 'string', description: 'New avatar URL / 新头像 URL' },
        slug: { type: 'string', description: 'New slug / 新 slug' },
      },
      required: ['organizationId'],
    },
    scope: 'organization',
  },
  {
    name: 'delete_organization',
    description:
      '⚠️ DESTRUCTIVE: Permanently delete an entire organization and ALL its workspaces, projects, tasks, and data. Cannot be undone. Must confirm with organization name. ORGANIZATION-level operation. / ⚠️ 危险操作：永久删除整个组织及其所有工作区、项目、任务和数据。不可撤销。必须确认组织名称。组织级别操作。',
    input_schema: {
      type: 'object',
      properties: {
        organizationId: { type: 'string', description: 'Organization ID (UUID) / 组织 ID' },
        confirmation: {
          type: 'string',
          description:
            'Type the EXACT organization name to confirm deletion / 输入精确的组织名称以确认删除',
        },
      },
      required: ['organizationId', 'confirmation'],
    },
    scope: 'organization',
  },

  // ================================================================
  // ORGANIZATION MEMBER TOOLS (scope: organization)
  //   THESE are for managing team members at the org level.
  //   When user says "list team members" / "列出团队成员" → use THESE.
  //   Do NOT use workspace_member or project_member tools for org members.
  // ================================================================
  {
    name: 'list_organization_members',
    description:
      'List ALL members of an organization. This is an ORGANIZATION-level operation — use this when the user asks about "team members" or "团队成员". Do NOT use workspace or project member tools for organization-wide member queries. / 列出组织所有成员。组织级别操作——当用户询问"团队成员"时使用此工具，不要使用工作区/项目成员工具。',
    input_schema: {
      type: 'object',
      properties: {
        organizationId: { type: 'string', description: 'Organization ID (UUID) / 组织 ID' },
        search: { type: 'string', description: 'Search by name or email / 按名称或邮箱搜索' },
      },
      required: ['organizationId'],
    },
    scope: 'organization',
  },
  {
    name: 'add_organization_member',
    description:
      'Add a user to an organization with a role. ORGANIZATION-level operation. The user must already exist in the system. Use list_users to find user IDs. / 将用户添加到组织。组织级别操作。用户必须已存在于系统中。使用 list_users 查找用户 ID。',
    input_schema: {
      type: 'object',
      properties: {
        organizationId: { type: 'string', description: 'Organization ID (UUID) / 组织 ID' },
        userId: { type: 'string', description: 'User ID (UUID) / 用户 ID' },
        role: {
          type: 'string',
          enum: ['OWNER', 'MANAGER', 'MEMBER', 'VIEWER'],
          description: 'Role to assign (default MEMBER) / 分配的角色（默认 MEMBER）',
        },
      },
      required: ['organizationId', 'userId'],
    },
    scope: 'organization',
  },
  {
    name: 'remove_organization_member',
    description:
      'Remove a user from an organization. ORGANIZATION-level operation. This also removes them from all workspaces and projects within the org. / 从组织移除用户。组织级别操作。这将同时从组织内的所有工作区和项目中移除该用户。',
    input_schema: {
      type: 'object',
      properties: {
        organizationId: { type: 'string', description: 'Organization ID (UUID) / 组织 ID' },
        userId: { type: 'string', description: 'User ID (UUID) to remove / 要移除的用户 ID' },
      },
      required: ['organizationId', 'userId'],
    },
    scope: 'organization',
  },
  {
    name: 'update_organization_member_role',
    description:
      'Change a member role within an organization. ORGANIZATION-level operation. Valid roles: OWNER, MANAGER, MEMBER, VIEWER. / 更改组织成员角色。组织级别操作。有效角色：OWNER, MANAGER, MEMBER, VIEWER。',
    input_schema: {
      type: 'object',
      properties: {
        organizationId: { type: 'string', description: 'Organization ID (UUID) / 组织 ID' },
        userId: { type: 'string', description: 'User ID (UUID) / 用户 ID' },
        role: {
          type: 'string',
          enum: ['OWNER', 'MANAGER', 'MEMBER', 'VIEWER'],
          description: 'New role / 新角色',
        },
      },
      required: ['organizationId', 'userId', 'role'],
    },
    scope: 'organization',
  },

  // ================================================================
  // WORKSPACE TOOLS (scope: workspace)
  // ================================================================
  {
    name: 'list_workspaces',
    description:
      'List all workspaces in an organization. WORKSPACE-level operation. Use this to find workspace IDs and names. / 列出组织中所有工作区。工作区级别操作。',
    input_schema: {
      type: 'object',
      properties: {
        organizationId: { type: 'string', description: 'Organization ID (UUID) / 组织 ID' },
        search: { type: 'string', description: 'Search by workspace name / 按名称搜索' },
      },
      required: ['organizationId'],
    },
    scope: 'workspace',
  },
  {
    name: 'get_workspace',
    description:
      'Get details of a specific workspace by ID or slug. WORKSPACE-level operation. / 通过 ID 或 slug 获取工作区详情。工作区级别操作。',
    input_schema: {
      type: 'object',
      properties: {
        workspaceId: { type: 'string', description: 'Workspace ID (UUID) / 工作区 ID' },
        organizationId: {
          type: 'string',
          description: 'Organization ID (required if using slug) / 组织 ID',
        },
        slug: { type: 'string', description: 'Workspace slug (alternative to ID) / 工作区 slug' },
      },
    },
    scope: 'workspace',
  },
  {
    name: 'create_workspace',
    description:
      'Create a new workspace. WORKSPACE-level operation. Name, slug, and organizationId are required. / 创建新工作区。工作区级别操作。',
    input_schema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Workspace name / 工作区名称' },
        slug: { type: 'string', description: 'URL-friendly slug / URL slug' },
        description: { type: 'string', description: 'Description / 描述' },
        color: { type: 'string', description: 'Hex color, e.g. #3B82F6 / 颜色' },
        avatar: { type: 'string', description: 'Avatar URL / 头像 URL' },
        organizationId: { type: 'string', description: 'Organization ID (UUID) / 组织 ID' },
        parentWorkspaceId: { type: 'string', description: 'Parent workspace ID / 父工作区 ID' },
      },
      required: ['name', 'slug', 'organizationId'],
    },
    scope: 'workspace',
  },
  {
    name: 'update_workspace',
    description:
      'Update an existing workspace. WORKSPACE-level operation. / 更新工作区。工作区级别操作。',
    input_schema: {
      type: 'object',
      properties: {
        workspaceId: { type: 'string', description: 'Workspace ID (UUID) / 工作区 ID' },
        name: { type: 'string', description: 'New name / 新名称' },
        description: { type: 'string', description: 'New description / 新描述' },
        color: { type: 'string', description: 'New color / 新颜色' },
        avatar: { type: 'string', description: 'Avatar URL / 头像 URL' },
      },
      required: ['workspaceId'],
    },
    scope: 'workspace',
  },
  {
    name: 'delete_workspace',
    description:
      'Delete a workspace permanently. This cannot be undone. WORKSPACE-level operation. / 永久删除工作区。工作区级别操作。',
    input_schema: {
      type: 'object',
      properties: {
        workspaceId: { type: 'string', description: 'Workspace ID (UUID) / 工作区 ID' },
      },
      required: ['workspaceId'],
    },
    scope: 'workspace',
  },

  // ================================================================
  // WORKSPACE MEMBER TOOLS (scope: workspace)
  //   Use these ONLY when the user specifically asks about
  //   "workspace members" / "工作区成员". Not for "team members".
  // ================================================================
  {
    name: 'list_workspace_members',
    description:
      'List members of a specific WORKSPACE. WORKSPACE-level operation — use ONLY when user asks about workspace-specific members ("工作区成员"). For organization-wide team members, use list_organization_members instead. / 列出特定工作区成员。工作区级别操作——仅在用户明确询问工作区成员时使用。',
    input_schema: {
      type: 'object',
      properties: {
        workspaceId: { type: 'string', description: 'Workspace ID (UUID) / 工作区 ID' },
      },
      required: ['workspaceId'],
    },
    scope: 'workspace',
  },
  {
    name: 'add_workspace_member',
    description:
      'Add a user to a workspace with a role. WORKSPACE-level operation. / 将用户添加到工作区。工作区级别操作。',
    input_schema: {
      type: 'object',
      properties: {
        workspaceId: { type: 'string', description: 'Workspace ID (UUID) / 工作区 ID' },
        userId: { type: 'string', description: 'User ID (UUID) / 用户 ID' },
        role: {
          type: 'string',
          enum: ['OWNER', 'MANAGER', 'MEMBER', 'VIEWER'],
          description: 'Role / 角色',
        },
      },
      required: ['workspaceId', 'userId'],
    },
    scope: 'workspace',
  },
  {
    name: 'remove_workspace_member',
    description:
      'Remove a user from a workspace. WORKSPACE-level operation. / 从工作区移除用户。工作区级别操作。',
    input_schema: {
      type: 'object',
      properties: {
        workspaceId: { type: 'string', description: 'Workspace ID (UUID) / 工作区 ID' },
        userId: { type: 'string', description: 'User ID (UUID) / 用户 ID' },
      },
      required: ['workspaceId', 'userId'],
    },
    scope: 'workspace',
  },
  {
    name: 'update_workspace_member_role',
    description:
      'Change a workspace member role. WORKSPACE-level operation. / 更改工作区成员角色。工作区级别操作。',
    input_schema: {
      type: 'object',
      properties: {
        workspaceId: { type: 'string', description: 'Workspace ID (UUID) / 工作区 ID' },
        userId: { type: 'string', description: 'User ID (UUID) / 用户 ID' },
        role: {
          type: 'string',
          enum: ['OWNER', 'MANAGER', 'MEMBER', 'VIEWER'],
          description: 'New role / 新角色',
        },
      },
      required: ['workspaceId', 'userId', 'role'],
    },
    scope: 'workspace',
  },

  // ================================================================
  // PROJECT TOOLS (scope: project)
  // ================================================================
  {
    name: 'list_projects',
    description:
      'List all projects in a workspace or organization. PROJECT-level operation. / 列出工作区或组织中的项目。项目级别操作。',
    input_schema: {
      type: 'object',
      properties: {
        workspaceId: { type: 'string', description: 'Filter by workspace ID / 按工作区筛选' },
        organizationId: { type: 'string', description: 'Organization ID / 组织 ID' },
        search: { type: 'string', description: 'Search by project name / 按名称搜索' },
      },
    },
    scope: 'project',
  },
  {
    name: 'get_project',
    description:
      'Get details of a specific project by ID or slug. PROJECT-level operation. / 通过 ID 或 slug 获取项目详情。项目级别操作。',
    input_schema: {
      type: 'object',
      properties: {
        projectId: { type: 'string', description: 'Project ID (UUID) / 项目 ID' },
        slug: { type: 'string', description: 'Project slug / 项目 slug' },
      },
    },
    scope: 'project',
  },
  {
    name: 'create_project',
    description:
      'Create a new project in a workspace. PROJECT-level operation. / 在工作区中创建新项目。项目级别操作。',
    input_schema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Project name / 项目名称' },
        slug: { type: 'string', description: 'URL-friendly slug / URL slug' },
        workspaceId: { type: 'string', description: 'Workspace ID (UUID) / 工作区 ID' },
        description: { type: 'string', description: 'Project description / 项目描述' },
        color: { type: 'string', description: 'Hex color, e.g. #3498db / 颜色' },
        avatar: { type: 'string', description: 'Avatar URL / 头像 URL' },
        taskPrefix: { type: 'string', description: 'Task prefix, e.g. PROJ / 任务前缀' },
        status: {
          type: 'string',
          enum: ['PLANNING', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELLED'],
          description: 'Project status / 状态',
        },
        priority: {
          type: 'string',
          enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'],
          description: 'Priority / 优先级',
        },
        visibility: {
          type: 'string',
          enum: ['PRIVATE', 'INTERNAL', 'PUBLIC'],
          description: 'Visibility / 可见性',
        },
        startDate: { type: 'string', description: 'Start date (ISO 8601) / 开始日期' },
        endDate: { type: 'string', description: 'End date (ISO 8601) / 结束日期' },
        workflowId: { type: 'string', description: 'Workflow ID (UUID) / 工作流 ID' },
      },
      required: ['name', 'slug', 'workspaceId'],
    },
    scope: 'project',
  },
  {
    name: 'update_project',
    description: 'Update an existing project. PROJECT-level operation. / 更新项目。项目级别操作。',
    input_schema: {
      type: 'object',
      properties: {
        projectId: { type: 'string', description: 'Project ID (UUID) / 项目 ID' },
        name: { type: 'string', description: 'New name / 新名称' },
        description: { type: 'string', description: 'New description / 新描述' },
        color: { type: 'string', description: 'New color / 新颜色' },
        avatar: { type: 'string', description: 'New avatar URL / 新头像 URL' },
        status: {
          type: 'string',
          enum: ['PLANNING', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELLED'],
        },
        priority: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] },
        visibility: { type: 'string', enum: ['PRIVATE', 'INTERNAL', 'PUBLIC'] },
        startDate: { type: 'string' },
        endDate: { type: 'string' },
      },
      required: ['projectId'],
    },
    scope: 'project',
  },
  {
    name: 'delete_project',
    description:
      'Delete a project permanently. PROJECT-level operation. / 永久删除项目。项目级别操作。',
    input_schema: {
      type: 'object',
      properties: { projectId: { type: 'string', description: 'Project ID (UUID) / 项目 ID' } },
      required: ['projectId'],
    },
    scope: 'project',
  },

  // ================================================================
  // PROJECT MEMBER TOOLS (scope: project)
  //   Use ONLY for project-specific member queries.
  // ================================================================
  {
    name: 'list_project_members',
    description:
      'List members of a specific PROJECT. PROJECT-level operation — use when assigning tasks or checking project access. For organization-wide team members, use list_organization_members. / 列出特定项目成员。项目级别操作——用于分配任务或检查项目访问权限。',
    input_schema: {
      type: 'object',
      properties: { projectId: { type: 'string', description: 'Project ID (UUID) / 项目 ID' } },
      required: ['projectId'],
    },
    scope: 'project',
  },
  {
    name: 'add_project_member',
    description:
      'Add a user to a project with a role. PROJECT-level operation. / 将用户添加到项目。项目级别操作。',
    input_schema: {
      type: 'object',
      properties: {
        projectId: { type: 'string', description: 'Project ID (UUID) / 项目 ID' },
        userId: { type: 'string', description: 'User ID (UUID) / 用户 ID' },
        role: {
          type: 'string',
          enum: ['OWNER', 'MANAGER', 'MEMBER', 'VIEWER'],
          description: 'Role / 角色',
        },
      },
      required: ['projectId', 'userId'],
    },
    scope: 'project',
  },
  {
    name: 'remove_project_member',
    description:
      'Remove a user from a project. PROJECT-level operation. / 从项目移除用户。项目级别操作。',
    input_schema: {
      type: 'object',
      properties: {
        projectId: { type: 'string', description: 'Project ID (UUID) / 项目 ID' },
        userId: { type: 'string', description: 'User ID (UUID) / 用户 ID' },
      },
      required: ['projectId', 'userId'],
    },
    scope: 'project',
  },
  {
    name: 'update_project_member_role',
    description:
      'Change a project member role. PROJECT-level operation. / 更改项目成员角色。项目级别操作。',
    input_schema: {
      type: 'object',
      properties: {
        projectId: { type: 'string', description: 'Project ID (UUID) / 项目 ID' },
        userId: { type: 'string', description: 'User ID (UUID) / 用户 ID' },
        role: {
          type: 'string',
          enum: ['OWNER', 'MANAGER', 'MEMBER', 'VIEWER'],
          description: 'New role / 新角色',
        },
      },
      required: ['projectId', 'userId', 'role'],
    },
    scope: 'project',
  },

  // ================================================================
  // TASK TOOLS (scope: project)
  // ================================================================
  {
    name: 'list_tasks',
    description:
      'List tasks with filters (project, workspace, priority, status, type, search). PROJECT-level operation. Requires organizationId. / 带筛选的任务列表。项目级别操作。',
    input_schema: {
      type: 'object',
      properties: {
        organizationId: { type: 'string', description: 'Organization ID (required) / 组织 ID' },
        projectId: { type: 'string', description: 'Filter by project ID / 按项目筛选' },
        workspaceId: { type: 'string', description: 'Filter by workspace ID / 按工作区筛选' },
        priorities: {
          type: 'string',
          description: 'Comma-separated: LOWEST,LOW,MEDIUM,HIGH,HIGHEST',
        },
        statuses: { type: 'string', description: 'Comma-separated status IDs' },
        types: { type: 'string', description: `Comma-separated: ${TASK_TYPES_STR}` },
        search: { type: 'string', description: 'Search in title/description' },
        page: { type: 'number', description: 'Page number (default 1)' },
        limit: { type: 'number', description: 'Items per page (default 20)' },
        sortBy: { type: 'string', description: 'Sort field' },
        sortOrder: { type: 'string', enum: ['asc', 'desc'], description: 'Sort order' },
      },
      required: ['organizationId'],
    },
    scope: 'project',
  },
  {
    name: 'get_task',
    description:
      'Get full details of a task. PROJECT-level operation. / 获取任务完整详情。项目级别操作。',
    input_schema: {
      type: 'object',
      properties: {
        taskId: { type: 'string', description: 'Task ID (UUID) / 任务 ID' },
        slug: { type: 'string', description: 'Task slug (e.g. PROJ-123) / 任务 slug' },
      },
    },
    scope: 'project',
  },
  {
    name: 'create_task',
    description:
      'Create a new task in a project. PROJECT-level operation. Title, projectId, and statusId are required. / 创建新任务。项目级别操作。',
    input_schema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Task title / 任务标题' },
        description: { type: 'string', description: 'Description (Markdown) / 描述' },
        projectId: { type: 'string', description: 'Project ID (UUID) / 项目 ID' },
        statusId: { type: 'string', description: 'Status ID (UUID) / 状态 ID' },
        type: { type: 'string', enum: TASK_TYPES, description: 'Task type / 任务类型' },
        priority: {
          type: 'string',
          enum: ['LOWEST', 'LOW', 'MEDIUM', 'HIGH', 'HIGHEST'],
          description: 'Priority',
        },
        startDate: {
          type: 'string',
          description:
            'Start date (ISO 8601). Supports time: "2024-01-15" or "2024-01-15T09:00:00Z"',
        },
        dueDate: {
          type: 'string',
          description: 'Due date (ISO 8601). Supports time: "2024-01-30" or "2024-01-30T17:00:00Z"',
        },
        storyPoints: { type: 'number', description: 'Story points' },
        originalEstimate: { type: 'number', description: 'Time estimate in minutes' },
        remainingEstimate: { type: 'number', description: 'Remaining estimate in minutes' },
        sprintId: { type: 'string', description: 'Sprint ID (UUID)' },
        parentTaskId: { type: 'string', description: 'Parent task ID for subtasks' },
        assigneeIds: { type: 'array', items: { type: 'string' }, description: 'Assignee user IDs' },
        reporterIds: { type: 'array', items: { type: 'string' }, description: 'Reporter user IDs' },
        customFields: { type: 'object', description: 'Custom fields JSON' },
      },
      required: ['title', 'projectId', 'statusId'],
    },
    scope: 'project',
  },
  {
    name: 'update_task',
    description:
      'Update any field of an existing task. PROJECT-level operation. / 更新任务。项目级别操作。',
    input_schema: {
      type: 'object',
      properties: {
        taskId: { type: 'string', description: 'Task ID (UUID) / 任务 ID' },
        title: { type: 'string', description: 'New title / 新标题' },
        description: { type: 'string', description: 'New description / 新描述' },
        type: {
          type: 'string',
          enum: [
            'TASK',
            'HABIT',
            'STUDY',
            'WORK',
            'LIFE',
            'GOAL',
            'EVENT',
            'NOTE',
            'PROJECT',
            'SUBTASK',
          ],
        },
        priority: { type: 'string', enum: ['LOWEST', 'LOW', 'MEDIUM', 'HIGH', 'HIGHEST'] },
        statusId: { type: 'string', description: 'New status ID / 新状态 ID' },
        startDate: {
          type: 'string',
          description:
            'Start date (ISO 8601). Supports time: "2024-01-15" or "2024-01-15T09:00:00Z"',
        },
        dueDate: {
          type: 'string',
          description: 'Due date (ISO 8601). Supports time: "2024-01-30" or "2024-01-30T17:00:00Z"',
        },
        completedAt: { type: 'string', description: 'Set to mark as done' },
        storyPoints: { type: 'number' },
        originalEstimate: { type: 'number' },
        remainingEstimate: { type: 'number' },
        sprintId: { type: 'string' },
        parentTaskId: { type: 'string' },
        assigneeIds: { type: 'array', items: { type: 'string' } },
        reporterIds: { type: 'array', items: { type: 'string' } },
        labelIds: {
          type: 'array',
          items: { type: 'string' },
          description: 'Label IDs to set (replaces all)',
        },
        customFields: { type: 'object' },
      },
      required: ['taskId'],
    },
    scope: 'project',
  },
  {
    name: 'delete_task',
    description:
      'Delete a task permanently. PROJECT-level operation. / 永久删除任务。项目级别操作。',
    input_schema: {
      type: 'object',
      properties: { taskId: { type: 'string', description: 'Task ID (UUID) / 任务 ID' } },
      required: ['taskId'],
    },
    scope: 'project',
  },
  {
    name: 'update_task_status',
    description: 'Change a task status. PROJECT-level operation. / 更新任务状态。项目级别操作。',
    input_schema: {
      type: 'object',
      properties: {
        taskId: { type: 'string', description: 'Task ID (UUID)' },
        statusId: { type: 'string', description: 'New status ID (UUID)' },
      },
      required: ['taskId', 'statusId'],
    },
    scope: 'project',
  },
  {
    name: 'update_task_priority',
    description:
      'Change a task priority. PROJECT-level operation. / 更新任务优先级。项目级别操作。',
    input_schema: {
      type: 'object',
      properties: {
        taskId: { type: 'string', description: 'Task ID (UUID)' },
        priority: {
          type: 'string',
          enum: ['LOWEST', 'LOW', 'MEDIUM', 'HIGH', 'HIGHEST'],
          description: 'New priority',
        },
      },
      required: ['taskId', 'priority'],
    },
    scope: 'project',
  },

  // ================================================================
  // TASK COMMENT TOOLS (scope: project)
  // ================================================================
  {
    name: 'list_task_comments',
    description:
      'List comments for a task. PROJECT-level operation. / 列出任务评论。项目级别操作。',
    input_schema: {
      type: 'object',
      properties: {
        taskId: { type: 'string', description: 'Task ID (UUID)' },
        page: { type: 'number', description: 'Page number (default 1)' },
        limit: { type: 'number', description: 'Items per page (default 20)' },
      },
      required: ['taskId'],
    },
    scope: 'project',
  },
  {
    name: 'create_task_comment',
    description:
      'Add a comment to a task. PROJECT-level operation. / 为任务添加评论。项目级别操作。',
    input_schema: {
      type: 'object',
      properties: {
        taskId: { type: 'string', description: 'Task ID (UUID)' },
        content: { type: 'string', description: 'Comment content (Markdown)' },
        parentCommentId: { type: 'string', description: 'Parent comment ID for replies' },
      },
      required: ['taskId', 'content'],
    },
    scope: 'project',
  },

  // ================================================================
  // TASK DEPENDENCY TOOLS (scope: project)
  // ================================================================
  {
    name: 'list_task_dependencies',
    description: 'List all dependencies for a task. PROJECT-level operation. / 列出任务依赖关系。',
    input_schema: {
      type: 'object',
      properties: { taskId: { type: 'string', description: 'Task ID (UUID)' } },
      required: ['taskId'],
    },
    scope: 'project',
  },
  {
    name: 'add_task_dependency',
    description: 'Create a dependency between two tasks. PROJECT-level operation. / 创建任务依赖。',
    input_schema: {
      type: 'object',
      properties: {
        dependentTaskId: { type: 'string', description: 'The task being blocked (UUID)' },
        blockingTaskId: { type: 'string', description: 'The task that blocks it (UUID)' },
        type: {
          type: 'string',
          enum: ['BLOCKS', 'FINISH_START', 'START_START', 'FINISH_FINISH', 'START_FINISH'],
          description: 'Dependency type',
        },
      },
      required: ['dependentTaskId', 'blockingTaskId'],
    },
    scope: 'project',
  },
  {
    name: 'remove_task_dependency',
    description: 'Remove a dependency between tasks. PROJECT-level operation. / 移除任务依赖。',
    input_schema: {
      type: 'object',
      properties: {
        dependentTaskId: { type: 'string', description: 'The blocked task ID' },
        blockingTaskId: { type: 'string', description: 'The blocking task ID' },
      },
      required: ['dependentTaskId', 'blockingTaskId'],
    },
    scope: 'project',
  },

  // ================================================================
  // SPRINT TOOLS (scope: project)
  // ================================================================
  {
    name: 'list_sprints',
    description: 'List sprints for a project. PROJECT-level operation. / 列出项目迭代。',
    input_schema: {
      type: 'object',
      properties: { projectId: { type: 'string', description: 'Project ID (UUID)' } },
      required: ['projectId'],
    },
    scope: 'project',
  },
  {
    name: 'create_sprint',
    description: 'Create a new sprint in a project. PROJECT-level operation. / 创建迭代。',
    input_schema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Sprint name' },
        goal: { type: 'string', description: 'Sprint goal' },
        startDate: { type: 'string', description: 'Start date (ISO 8601)' },
        endDate: { type: 'string', description: 'End date (ISO 8601)' },
        projectId: { type: 'string', description: 'Project ID (UUID)' },
      },
      required: ['name', 'projectId'],
    },
    scope: 'project',
  },
  {
    name: 'update_sprint',
    description: 'Update an existing sprint. PROJECT-level operation. / 更新迭代。',
    input_schema: {
      type: 'object',
      properties: {
        sprintId: { type: 'string', description: 'Sprint ID (UUID)' },
        name: { type: 'string' },
        goal: { type: 'string' },
        status: { type: 'string', enum: ['PLANNING', 'ACTIVE', 'COMPLETED', 'CANCELLED'] },
        startDate: { type: 'string' },
        endDate: { type: 'string' },
      },
      required: ['sprintId'],
    },
    scope: 'project',
  },
  {
    name: 'delete_sprint',
    description: 'Delete a sprint permanently. PROJECT-level operation. / 永久删除迭代。',
    input_schema: {
      type: 'object',
      properties: { sprintId: { type: 'string', description: 'Sprint ID (UUID)' } },
      required: ['sprintId'],
    },
    scope: 'project',
  },

  // ================================================================
  // LABEL TOOLS (scope: project)
  // ================================================================
  {
    name: 'list_labels',
    description: 'List labels for a project. PROJECT-level operation. / 列出项目标签。',
    input_schema: {
      type: 'object',
      properties: { projectId: { type: 'string', description: 'Project ID (UUID)' } },
      required: ['projectId'],
    },
    scope: 'project',
  },
  {
    name: 'create_label',
    description: 'Create a new label in a project. PROJECT-level operation. / 创建标签。',
    input_schema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Label name' },
        color: { type: 'string', description: 'Hex color, e.g. #EF4444' },
        description: { type: 'string', description: 'Label description' },
        projectId: { type: 'string', description: 'Project ID (UUID)' },
      },
      required: ['name', 'color', 'projectId'],
    },
    scope: 'project',
  },
  {
    name: 'update_label',
    description: 'Update an existing label. PROJECT-level operation. / 更新标签。',
    input_schema: {
      type: 'object',
      properties: {
        labelId: { type: 'string', description: 'Label ID (UUID)' },
        name: { type: 'string' },
        color: { type: 'string' },
        description: { type: 'string' },
      },
      required: ['labelId'],
    },
    scope: 'project',
  },
  {
    name: 'delete_label',
    description: 'Delete a label permanently. PROJECT-level operation. / 永久删除标签。',
    input_schema: {
      type: 'object',
      properties: { labelId: { type: 'string', description: 'Label ID (UUID)' } },
      required: ['labelId'],
    },
    scope: 'project',
  },

  // ================================================================
  // WORKFLOW TOOLS (scope: cross — referenced by project but defined at org level)
  // ================================================================
  {
    name: 'list_workflows',
    description: 'List all workflows in an organization. / 列出组织中所有工作流。',
    input_schema: {
      type: 'object',
      properties: { organizationId: { type: 'string', description: 'Organization ID (UUID)' } },
      required: ['organizationId'],
    },
    scope: 'cross',
  },
  {
    name: 'get_workflow',
    description: 'Get workflow details including its statuses. / 获取工作流详情（含状态列表）。',
    input_schema: {
      type: 'object',
      properties: { workflowId: { type: 'string', description: 'Workflow ID (UUID)' } },
      required: ['workflowId'],
    },
    scope: 'cross',
  },
  {
    name: 'list_status_transitions',
    description: 'List allowed status transitions in a workflow. / 列出工作流中允许的状态转换。',
    input_schema: {
      type: 'object',
      properties: { workflowId: { type: 'string', description: 'Workflow ID (UUID)' } },
      required: ['workflowId'],
    },
    scope: 'cross',
  },
  {
    name: 'list_task_statuses',
    description: 'List available task statuses for a workflow. / 列出工作流中可用的任务状态。',
    input_schema: {
      type: 'object',
      properties: { workflowId: { type: 'string', description: 'Workflow ID (UUID)' } },
      required: ['workflowId'],
    },
    scope: 'cross',
  },

  // ================================================================
  // CUSTOM FIELD TOOLS (scope: organization)
  // ================================================================
  {
    name: 'list_custom_fields',
    description:
      'List custom fields defined for an organization. ORGANIZATION-level operation. / 列出组织定义的自定义字段。',
    input_schema: {
      type: 'object',
      properties: { organizationId: { type: 'string', description: 'Organization ID (UUID)' } },
      required: ['organizationId'],
    },
    scope: 'organization',
  },
  {
    name: 'get_custom_field',
    description: 'Get details of a specific custom field. / 获取自定义字段详情。',
    input_schema: {
      type: 'object',
      properties: { customFieldId: { type: 'string', description: 'Custom Field ID (UUID)' } },
      required: ['customFieldId'],
    },
    scope: 'organization',
  },

  // ================================================================
  // TIME ENTRY TOOLS (scope: project)
  // ================================================================
  {
    name: 'list_time_entries',
    description:
      'List time entries for a task or project. PROJECT-level operation. / 列出时间记录。',
    input_schema: {
      type: 'object',
      properties: {
        taskId: { type: 'string', description: 'Filter by task ID (UUID)' },
        projectId: { type: 'string', description: 'Filter by project ID' },
        page: { type: 'number' },
        limit: { type: 'number' },
      },
    },
    scope: 'project',
  },
  {
    name: 'create_time_entry',
    description: 'Log time spent on a task (in minutes). PROJECT-level operation. / 记录任务耗时。',
    input_schema: {
      type: 'object',
      properties: {
        taskId: { type: 'string', description: 'Task ID (UUID)' },
        description: { type: 'string', description: 'Work description' },
        timeSpent: { type: 'number', description: 'Time spent in minutes' },
        startTime: { type: 'string', description: 'Start time (ISO 8601)' },
        endTime: { type: 'string', description: 'End time (ISO 8601)' },
        date: { type: 'string', description: 'Date of work (default today)' },
      },
      required: ['taskId', 'timeSpent'],
    },
    scope: 'project',
  },
  {
    name: 'delete_time_entry',
    description: 'Delete a time entry permanently. / 永久删除时间记录。',
    input_schema: {
      type: 'object',
      properties: { timeEntryId: { type: 'string', description: 'Time Entry ID (UUID)' } },
      required: ['timeEntryId'],
    },
    scope: 'project',
  },

  // ================================================================
  // RECURRING TASK TOOLS (scope: project)
  // ================================================================
  {
    name: 'get_task_recurrence',
    description: 'Get recurrence configuration for a task. / 获取任务重复配置。',
    input_schema: {
      type: 'object',
      properties: { taskId: { type: 'string', description: 'Task ID (UUID)' } },
      required: ['taskId'],
    },
    scope: 'project',
  },
  {
    name: 'create_task_recurrence',
    description: 'Set a task to recur (daily, weekly, monthly, yearly). / 设置任务重复规则。',
    input_schema: {
      type: 'object',
      properties: {
        taskId: { type: 'string', description: 'Task ID (UUID)' },
        recurrenceType: {
          type: 'string',
          enum: ['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'],
          description: 'DAILY/WEEKLY/MONTHLY/YEARLY',
        },
        interval: { type: 'number', description: 'Interval (default 1). 2=every other' },
        daysOfWeek: {
          type: 'array',
          items: { type: 'number' },
          description: 'For WEEKLY: 0=Sun...6=Sat',
        },
        endDate: { type: 'string', description: 'End date (ISO 8601)' },
      },
      required: ['taskId', 'recurrenceType'],
    },
    scope: 'project',
  },
  {
    name: 'disable_task_recurrence',
    description: 'Stop a task from recurring. / 停止任务重复。',
    input_schema: {
      type: 'object',
      properties: { taskId: { type: 'string', description: 'Task ID (UUID)' } },
      required: ['taskId'],
    },
    scope: 'project',
  },
  {
    name: 'update_task_recurrence',
    description: 'Update an existing recurrence configuration. / 更新任务重复配置。',
    input_schema: {
      type: 'object',
      properties: {
        taskId: { type: 'string' },
        recurrenceType: { type: 'string', enum: ['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'] },
        interval: { type: 'number' },
        daysOfWeek: { type: 'array', items: { type: 'number' } },
        endDate: { type: 'string' },
      },
      required: ['taskId'],
    },
    scope: 'project',
  },

  // ================================================================
  // PUBLIC TASK SHARE TOOLS (scope: project)
  // ================================================================
  {
    name: 'list_task_shares',
    description: 'List public share links for a task. / 列出任务公开分享链接。',
    input_schema: {
      type: 'object',
      properties: { taskId: { type: 'string', description: 'Task ID (UUID)' } },
      required: ['taskId'],
    },
    scope: 'project',
  },
  {
    name: 'share_task_publicly',
    description: 'Create a public share link for a task. / 创建任务公开分享链接。',
    input_schema: {
      type: 'object',
      properties: {
        taskId: { type: 'string', description: 'Task ID (UUID)' },
        expiresAt: { type: 'string', description: 'Expiration date (ISO 8601, default 30 days)' },
      },
      required: ['taskId'],
    },
    scope: 'project',
  },
  {
    name: 'revoke_task_share',
    description: 'Revoke a public task share link. / 撤销公开任务分享链接。',
    input_schema: {
      type: 'object',
      properties: { shareId: { type: 'string', description: 'Share ID (UUID)' } },
      required: ['shareId'],
    },
    scope: 'project',
  },

  // ================================================================
  // TASK ATTACHMENT TOOLS (scope: project)
  // ================================================================
  {
    name: 'list_task_attachments',
    description:
      'List all file attachments for a task. Returns name, URL, size, and MIME type for each file. ' +
      'Use this to check what files are already attached before adding or removing. / 列出任务文件附件。',
    input_schema: {
      type: 'object',
      properties: { taskId: { type: 'string', description: 'Task ID (UUID)' } },
      required: ['taskId'],
    },
    scope: 'project',
  },
  {
    name: 'upload_task_attachment',
    description:
      'Add a file attachment to a task. Use this when a user asks to attach a file, image, PDF, ' +
      'or document to a task. Accepts a URL from a previously uploaded chat file, or any accessible file URL. ' +
      'The file will be saved to the task and appear in its attachment list. / 上传文件附件到任务。',
    input_schema: {
      type: 'object',
      properties: {
        taskId: { type: 'string', description: 'Target task ID (UUID)' },
        fileUrl: {
          type: 'string',
          description: 'URL of the file to attach (from chat upload or any accessible URL)',
        },
        fileName: {
          type: 'string',
          description: 'Original file name (e.g. report.pdf, photo.png)',
        },
        mimeType: {
          type: 'string',
          description: 'MIME type (e.g. image/png, application/pdf, text/plain)',
        },
      },
      required: ['taskId', 'fileUrl', 'fileName'],
    },
    scope: 'project',
  },
  {
    name: 'delete_task_attachment',
    description:
      'Remove a file attachment from a task. Use this when a user asks to delete or remove an attached file. ' +
      'Requires the attachment ID which can be obtained from list_task_attachments. / 删除任务文件附件。',
    input_schema: {
      type: 'object',
      properties: {
        attachmentId: {
          type: 'string',
          description: 'Attachment ID (UUID) from list_task_attachments',
        },
      },
      required: ['attachmentId'],
    },
    scope: 'project',
  },

  // ================================================================
  // CROSS-SCOPE TOOLS (scope: cross)
  //   Invitations, notifications, settings, users, activity logs,
  //   automation rules, inbox, navigation.
  // ================================================================
  {
    name: 'list_invitations',
    description:
      'List pending invitations for an organization, workspace, or project. / 列出待处理的邀请。',
    input_schema: {
      type: 'object',
      properties: {
        organizationId: { type: 'string', description: 'Filter by organization' },
        workspaceId: { type: 'string', description: 'Filter by workspace' },
        projectId: { type: 'string', description: 'Filter by project' },
        status: {
          type: 'string',
          enum: ['PENDING', 'ACCEPTED', 'DECLINED', 'EXPIRED'],
          description: 'Filter by status',
        },
      },
    },
    scope: 'cross',
  },
  {
    name: 'create_invitation',
    description:
      'Invite a user by email to an organization, workspace, or project. / 通过电子邮件邀请用户。',
    input_schema: {
      type: 'object',
      properties: {
        inviteeEmail: { type: 'string', description: 'Email to invite' },
        role: { type: 'string', description: 'Role to assign' },
        organizationId: { type: 'string', description: 'Organization ID (UUID)' },
        workspaceId: { type: 'string', description: 'Workspace ID (UUID)' },
        projectId: { type: 'string', description: 'Project ID (UUID)' },
      },
      required: ['inviteeEmail', 'role'],
    },
    scope: 'cross',
  },
  {
    name: 'list_notifications',
    description: 'List notifications for the current user. / 列出当前用户的通知。',
    input_schema: {
      type: 'object',
      properties: {
        isRead: { type: 'boolean', description: 'Filter read/unread' },
        page: { type: 'number' },
        limit: { type: 'number' },
      },
    },
    scope: 'cross',
  },
  {
    name: 'mark_notification_read',
    description: 'Mark a notification as read. / 将通知标记为已读。',
    input_schema: {
      type: 'object',
      properties: { notificationId: { type: 'string', description: 'Notification ID (UUID)' } },
      required: ['notificationId'],
    },
    scope: 'cross',
  },
  {
    name: 'list_automation_rules',
    description:
      'List automation rules. Filter by project, workspace, or organization. / 列出自动化规则。',
    input_schema: {
      type: 'object',
      properties: {
        projectId: { type: 'string' },
        workspaceId: { type: 'string' },
        organizationId: { type: 'string' },
      },
    },
    scope: 'cross',
  },
  {
    name: 'create_automation_rule',
    description: 'Create a new automation rule. / 创建自动化规则。',
    input_schema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Rule name' },
        triggerType: {
          type: 'string',
          enum: [
            'TASK_CREATED',
            'TASK_UPDATED',
            'TASK_STATUS_CHANGED',
            'TASK_ASSIGNED',
            'TASK_DUE_DATE_APPROACHING',
            'TASK_OVERDUE',
            'SPRINT_STARTED',
            'SPRINT_COMPLETED',
            'PROJECT_CREATED',
            'COMMENT_ADDED',
          ],
        },
        actionType: {
          type: 'string',
          enum: [
            'ASSIGN_TASK',
            'CHANGE_STATUS',
            'ADD_LABEL',
            'REMOVE_LABEL',
            'SET_DUE_DATE',
            'SEND_NOTIFICATION',
            'SEND_EMAIL',
            'ADD_COMMENT',
            'MOVE_TO_SPRINT',
            'CHANGE_PRIORITY',
          ],
        },
        projectId: { type: 'string' },
        workspaceId: { type: 'string' },
        organizationId: { type: 'string' },
        triggerConfig: { type: 'object' },
        actionConfig: { type: 'object' },
      },
      required: ['name', 'triggerType', 'actionType'],
    },
    scope: 'cross',
  },
  {
    name: 'toggle_automation_rule',
    description: 'Enable or disable an automation rule. / 启用或禁用自动化规则。',
    input_schema: {
      type: 'object',
      properties: {
        ruleId: { type: 'string', description: 'Rule ID (UUID)' },
        enabled: { type: 'boolean', description: 'true=enable, false=disable' },
      },
      required: ['ruleId', 'enabled'],
    },
    scope: 'cross',
  },
  {
    name: 'list_settings',
    description: 'List system settings. / 列出系统设置。',
    input_schema: {
      type: 'object',
      properties: { category: { type: 'string', description: 'Filter by category' } },
    },
    scope: 'cross',
  },
  {
    name: 'get_setting',
    description: 'Get a specific setting value by key. / 通过键获取设置值。',
    input_schema: {
      type: 'object',
      properties: { key: { type: 'string', description: 'Setting key' } },
      required: ['key'],
    },
    scope: 'cross',
  },
  {
    name: 'update_setting',
    description: 'Update a setting value by key. / 更新设置值。',
    input_schema: {
      type: 'object',
      properties: {
        key: { type: 'string', description: 'Setting key' },
        value: { type: 'string', description: 'New value' },
      },
      required: ['key', 'value'],
    },
    scope: 'cross',
  },
  {
    name: 'list_users',
    description: 'List users in an organization or workspace. / 列出组织或工作区中的用户。',
    input_schema: {
      type: 'object',
      properties: {
        organizationId: { type: 'string' },
        workspaceId: { type: 'string' },
        search: { type: 'string', description: 'Search by name or email' },
      },
    },
    scope: 'cross',
  },
  {
    name: 'get_user',
    description: 'Get basic user profile by ID. / 获取用户基本信息。',
    input_schema: {
      type: 'object',
      properties: { userId: { type: 'string', description: 'User ID (UUID)' } },
      required: ['userId'],
    },
    scope: 'cross',
  },
  {
    name: 'update_user_profile',
    description: 'Update the current user profile (language, timezone). / 更新当前用户资料。',
    input_schema: {
      type: 'object',
      properties: {
        language: {
          type: 'string',
          enum: ['en', 'zh', 'es', 'fr', 'pt'],
          description: 'Language code',
        },
        timezone: { type: 'string', description: 'Timezone, e.g. "Asia/Shanghai"' },
      },
    },
    scope: 'cross',
  },
  {
    name: 'get_user_profile',
    description: 'Get the current user profile. / 获取当前用户资料。',
    input_schema: { type: 'object', properties: {} },
    scope: 'cross',
  },
  {
    name: 'get_project_inbox',
    description: 'Get the inbox configuration for a project. / 获取项目收件箱配置。',
    input_schema: {
      type: 'object',
      properties: { projectId: { type: 'string', description: 'Project ID (UUID)' } },
      required: ['projectId'],
    },
    scope: 'cross',
  },
  {
    name: 'list_inbox_rules',
    description: 'List inbox processing rules. / 列出收件箱处理规则。',
    input_schema: {
      type: 'object',
      properties: { projectInboxId: { type: 'string', description: 'Project Inbox ID (UUID)' } },
      required: ['projectInboxId'],
    },
    scope: 'cross',
  },
  {
    name: 'list_inbox_messages',
    description: 'List incoming email messages for a project inbox. / 列出收件箱邮件。',
    input_schema: {
      type: 'object',
      properties: {
        projectInboxId: { type: 'string', description: 'Project Inbox ID (UUID)' },
        status: {
          type: 'string',
          enum: ['PENDING', 'PROCESSING', 'CONVERTED', 'IGNORED', 'FAILED'],
        },
        page: { type: 'number' },
        limit: { type: 'number' },
      },
      required: ['projectInboxId'],
    },
    scope: 'cross',
  },
  {
    name: 'list_activity_logs',
    description: 'List activity/audit logs. Read-only. / 列出活动日志（只读）。',
    input_schema: {
      type: 'object',
      properties: {
        organizationId: { type: 'string' },
        projectId: { type: 'string' },
        entityType: { type: 'string', description: 'Filter by entity type' },
        page: { type: 'number' },
        limit: { type: 'number' },
      },
    },
    scope: 'cross',
  },
  {
    name: 'navigate',
    description:
      'Tell the frontend to navigate to a page. Use structured params — do NOT guess URL patterns. / 前端导航。使用结构化参数。',
    input_schema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'DEPRECATED. Raw URL path.' },
        workspaceSlug: { type: 'string', description: 'Workspace slug' },
        projectSlug: { type: 'string', description: 'Project slug (requires workspaceSlug)' },
        taskSlug: {
          type: 'string',
          description: 'Task slug (requires projectSlug + workspaceSlug)',
        },
      },
      required: [],
    },
    scope: 'cross',
  },
];

export function getToolDefinitions(): MCPToolDefinition[] {
  return MCP_TOOL_DEFINITIONS;
}

export function getToolByName(name: string): MCPToolDefinition | undefined {
  return MCP_TOOL_DEFINITIONS.find((t) => t.name === name);
}
