import { Injectable, Logger } from '@nestjs/common';
import { ToolGuard, ToolCallContext, GuardResult } from '../types';

@Injectable()
export class EmptyParamsGuard implements ToolGuard {
  readonly name = 'EmptyParams';
  readonly priority = 20;
  private readonly logger = new Logger('Pipe:EmptyParams');

  private static readonly ID_FIELDS = new Set([
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
    'dependentTaskId',
    'blockingTaskId',
    'parentCommentId',
    'confirmation',
  ]);

  enabled(ctx: ToolCallContext): boolean {
    return ctx.meta.isWrite && !ctx.toolName.startsWith('delete_');
  }

  async preExecute(ctx: ToolCallContext): Promise<GuardResult | void> {
    const dataFields = Object.keys(ctx.params).filter((k) => !EmptyParamsGuard.ID_FIELDS.has(k));

    if (dataFields.length === 0) {
      this.logger.warn(`[${ctx.requestId}] BLOCKED ${ctx.toolName} — no data fields in params`);
      return {
        allowed: false,
        error: 'No fields to change. Specify at least one field to update.',
        fallback: {
          success: false,
          _guard: this.name,
          error: 'No fields to update.',
        },
      };
    }
    this.logger.debug(`[${ctx.requestId}] data fields: ${dataFields.join(', ')}`);
  }
}
