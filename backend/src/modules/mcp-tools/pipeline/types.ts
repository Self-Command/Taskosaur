/** Unique request identifier for correlating all guards and tool calls. */
export type RequestId = string;

/** Entity identifier: type (task/project/workspace) + UUID */
export interface EntityKey {
  type: string;
  id: string;
}

export function formatEntityKey(key: EntityKey): string {
  return `${key.type}:${key.id}`;
}

/** Metadata extracted from any tool call — pipeline operates on this, never on tool names */
export interface ToolCallContext {
  requestId: RequestId;
  toolName: string;
  params: Record<string, any>;
  userId: string;
  meta: {
    isWrite: boolean;
    isRead: boolean;
    entity?: EntityKey;
  };
  /** Per-request state bag — guards store transient data here. Reset per pipeline.execute() call. */
  state: Map<string, any>;
}

/** Returned by a guard to either allow the call or block it with a result */
export interface GuardResult {
  allowed: boolean;
  error?: string;
  /** When blocked, this result is returned to the AI instead of executing the tool */
  fallback?: any;
}

/**
 * Each guard is a composable plugin that can intercept tool execution.
 * - preExecute: runs before the tool, can block the call
 * - postExecute: runs after the tool, can annotate the result (never blocks)
 */
export interface ToolGuard {
  readonly name: string;
  /** Lower numbers execute first */
  readonly priority: number;
  /** Only run this guard when this returns true (e.g. only for write tools) */
  enabled(ctx: ToolCallContext): boolean;
  preExecute?(ctx: ToolCallContext): Promise<GuardResult | void>;
  postExecute?(ctx: ToolCallContext, result: any): Promise<void>;
}

// ── Entity extraction helpers ──────────────────────────────

const ID_FIELDS = [
  'taskId',
  'projectId',
  'workspaceId',
  'sprintId',
  'labelId',
  'organizationId',
  'userId',
  'commentId',
  'timeEntryId',
  'workflowId',
  'notificationId',
  'ruleId',
  'shareId',
  'attachmentId',
  'customFieldId',
  'dependencyId',
];

/**
 * Extract entity metadata from any tool params.
 * Looks for known ID fields (e.g. taskId → { type: 'task', id: '<uuid>' }).
 */
export function extractEntity(params: Record<string, any>): EntityKey | undefined {
  for (const field of ID_FIELDS) {
    const v = params[field];
    if (typeof v === 'string' && v.length > 0) {
      return { type: field.replace(/Id$/, ''), id: v };
    }
  }
  return undefined;
}

const WRITE_PREFIXES = [
  'create_',
  'update_',
  'delete_',
  'add_',
  'remove_',
  'toggle_',
  'mark_',
  'share_',
  'revoke_',
  'disable_',
  'batch_create_',
  'batch_update_',
  'batch_delete_',
];

export function isWriteTool(toolName: string): boolean {
  return WRITE_PREFIXES.some((p) => toolName.startsWith(p));
}

export function isReadTool(toolName: string): boolean {
  return toolName.startsWith('list_') || toolName.startsWith('get_');
}

/** Build a ToolCallContext from raw tool call data */
export function buildContext(
  requestId: RequestId,
  toolName: string,
  params: Record<string, any>,
  userId: string,
  state: Map<string, any>,
): ToolCallContext {
  return {
    requestId,
    toolName,
    params,
    userId,
    state,
    meta: {
      isWrite: isWriteTool(toolName),
      isRead: isReadTool(toolName),
      entity: extractEntity(params),
    },
  };
}
