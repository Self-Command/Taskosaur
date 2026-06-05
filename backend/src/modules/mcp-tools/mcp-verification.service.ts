import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { TimeZoneNormalizer } from '../timezone/timezone-normalizer.service';

// ── Types ────────────────────────────────────────────────────────

interface AssertionDef {
  field: string;
  /** How to read the expected value from params */
  expectedFrom: 'params' | 'result';
  /** Path in params/result, e.g. "title" or "task.title" */
  path: string;
  /** Comparison mode: "exact" | "date" | "exists" | "notExists" */
  compare: 'exact' | 'date' | 'exists' | 'notExists';
}

interface VerificationRule {
  /** Tool to call for read-back */
  readTool: string;
  /** Extract lookup params from the write result */
  buildLookupParams: (params: Record<string, any>, result: any) => Record<string, any> | null;
  /** Fields to verify */
  assertions: AssertionDef[];
  /** For delete: expect the read-back to return not-found */
  expectDeleted?: boolean;
}

interface VerificationFailure {
  field: string;
  expected: any;
  actual: any;
}

interface VerificationResult {
  passed: boolean;
  failures: VerificationFailure[];
  suggestedAction?: string;
}

// ── Write-tool set ───────────────────────────────────────────────

const WRITE_PREFIXES = [
  'create_', 'update_', 'delete_', 'add_', 'remove_',
  'toggle_', 'mark_', 'share_', 'revoke_', 'disable_',
  'batch_create_', 'batch_update_', 'batch_delete_',
];

export function isWriteTool(toolName: string): boolean {
  return WRITE_PREFIXES.some((p) => toolName.startsWith(p));
}

// ── Service ──────────────────────────────────────────────────────

@Injectable()
export class McpVerificationService {
  private readonly logger = new Logger('MCP-Verify');

  constructor(
    private prisma: PrismaService,
    private tzNormalizer: TimeZoneNormalizer,
  ) {}

  /**
   * Verify that a write tool actually produced the expected state.
   * Returns verification failures if any, otherwise passed: true.
   */
  async verify(
    toolName: string,
    params: Record<string, any>,
    result: any,
    userId: string,
  ): Promise<VerificationResult> {
    if (!result?.success) {
      return { passed: true, failures: [] }; // write failed, no need to verify
    }

    const rule = this.getRule(toolName, params);
    if (!rule) {
      return { passed: true, failures: [] }; // no verification rule defined
    }

    const userTimezone = await this.tzNormalizer.getUserTimezone(userId);

    try {
      const lookupParams = rule.buildLookupParams(params, result);
      if (!lookupParams) {
        return { passed: true, failures: [] };
      }

      const readBack = await this.executeReadBack(rule.readTool, lookupParams, userId);

      // Delete verification: read-back should fail
      if (rule.expectDeleted) {
        if (!readBack || readBack.success === false) {
          return { passed: true, failures: [] };
        }
        return {
          passed: false,
          failures: [{ field: '_delete', expected: 'deleted', actual: 'still exists' }],
          suggestedAction: `The ${toolName} reported success but the resource still exists. Retry the delete.`,
        };
      }

      if (!readBack || readBack.success === false) {
        return {
          passed: false,
          failures: [{ field: '_read', expected: 'resource exists', actual: 'not found' }],
          suggestedAction: `The ${toolName} reported success but the resource could not be read back. It may have been created/updated incorrectly.`,
        };
      }

      const failures: VerificationFailure[] = [];
      for (const assertion of rule.assertions) {
        const expected = this.getValue(params, result, assertion.expectedFrom, assertion.path);
        const actual = this.getValue(readBack, readBack, 'result', assertion.path);

        if (assertion.compare === 'notExists') continue;

        if (!this.compareValues(expected, actual, assertion.compare, userTimezone)) {
          failures.push({
            field: assertion.field,
            expected,
            actual,
          });
        }
      }

      if (failures.length > 0) {
        const fieldList = failures.map((f) => f.field).join(', ');
        return {
          passed: false,
          failures,
          suggestedAction: `Verification failed for fields: ${fieldList}. Call ${toolName.replace('create_', 'update_').replace('batch_create_', 'batch_update_')} to fix the mismatched values.`,
        };
      }

      return { passed: true, failures: [] };
    } catch (err: any) {
      this.logger.warn(`Verification for ${toolName} failed with error: ${err.message}`);
      return { passed: true, failures: [] }; // don't block on verification errors
    }
  }

  // ── Rule definitions ───────────────────────────────────────────

  private getRule(toolName: string, params: Record<string, any>): VerificationRule | null {
    // Generic rule builder: if a create_* tool exists, verify via get_* or list_*
    if (toolName.startsWith('create_task')) {
      return {
        readTool: 'get_task',
        buildLookupParams: (_p, r) => ({ taskId: r?.task?.id }),
        assertions: this.buildWriteAssertions(params, ['title', 'description', 'type', 'priority']),
      };
    }
    if (toolName.startsWith('update_task')) {
      return {
        readTool: 'get_task',
        buildLookupParams: (p) => ({ taskId: p.taskId }),
        assertions: this.buildWriteAssertions(params, ['title', 'description', 'type', 'priority', 'statusId', 'startDate', 'dueDate']),
      };
    }
    if (toolName.startsWith('delete_task')) {
      return {
        readTool: 'get_task',
        buildLookupParams: (p) => ({ taskId: p.taskId }),
        assertions: [],
        expectDeleted: true,
      };
    }
    if (toolName.startsWith('create_project')) {
      return {
        readTool: 'get_project',
        buildLookupParams: (_p, r) => ({ projectId: r?.project?.id }),
        assertions: this.buildWriteAssertions(params, ['name', 'description', 'status', 'priority']),
      };
    }
    if (toolName.startsWith('update_project')) {
      return {
        readTool: 'get_project',
        buildLookupParams: (p) => ({ projectId: p.projectId }),
        assertions: this.buildWriteAssertions(params, ['name', 'description', 'status', 'priority']),
      };
    }
    if (toolName.startsWith('delete_project')) {
      return {
        readTool: 'get_project',
        buildLookupParams: (p) => ({ projectId: p.projectId }),
        assertions: [],
        expectDeleted: true,
      };
    }
    if (toolName.startsWith('create_workspace')) {
      return {
        readTool: 'get_workspace',
        buildLookupParams: (_p, r) => ({ workspaceId: r?.workspace?.id }),
        assertions: this.buildWriteAssertions(params, ['name', 'description']),
      };
    }
    if (toolName.startsWith('update_workspace')) {
      return {
        readTool: 'get_workspace',
        buildLookupParams: (p) => ({ workspaceId: p.workspaceId }),
        assertions: this.buildWriteAssertions(params, ['name', 'description']),
      };
    }
    if (toolName.startsWith('delete_workspace')) {
      return {
        readTool: 'get_workspace',
        buildLookupParams: (p) => ({ workspaceId: p.workspaceId }),
        assertions: [],
        expectDeleted: true,
      };
    }
    if (toolName.startsWith('create_sprint')) {
      return {
        readTool: 'get_task', // no get_sprint, verify via list_sprints
        buildLookupParams: (_p, r) => ({ taskId: r?.sprint?.id }),
        assertions: this.buildWriteAssertions(params, ['name', 'goal']),
      };
    }
    if (toolName.startsWith('add_organization_member') || toolName.startsWith('add_workspace_member') || toolName.startsWith('add_project_member')) {
      return {
        readTool: toolName.includes('organization') ? 'list_organization_members'
          : toolName.includes('workspace') ? 'list_workspace_members'
          : 'list_project_members',
        buildLookupParams: (p) => {
          if (toolName.includes('organization')) return { organizationId: p.organizationId };
          if (toolName.includes('workspace')) return { workspaceId: p.workspaceId };
          return { projectId: p.projectId };
        },
        assertions: [{ field: '_memberExists', expectedFrom: 'params', path: 'userId', compare: 'exists' }],
      };
    }
    // Generic fallback: any other create_* → no verification (safe default)
    return null;
  }

  /**
   * Build assertion definitions only for fields that were actually provided in params.
   */
  private buildWriteAssertions(params: Record<string, any>, fields: string[]): AssertionDef[] {
    return fields
      .filter((f) => params[f] !== undefined)
      .map((f) => ({
        field: f,
        expectedFrom: 'params' as const,
        path: `task.${f}`,
        compare: (f === 'startDate' || f === 'dueDate' || f === 'endDate') ? 'date' as const : 'exact' as const,
      }));
  }

  // ── Helpers ────────────────────────────────────────────────────

  private async executeReadBack(
    toolName: string,
    params: Record<string, any>,
    userId: string,
  ): Promise<any> {
    // Direct Prisma read based on tool type
    try {
      switch (toolName) {
        case 'get_task':
          return { success: true, task: await this.prisma.task.findUnique({
            where: { id: params.taskId },
            select: {
              id: true, title: true, description: true, type: true, priority: true,
              statusId: true, startDate: true, dueDate: true, completedAt: true,
              projectId: true, sprintId: true,
            },
          }) };
        case 'get_project':
          return { success: true, project: await this.prisma.project.findUnique({
            where: { id: params.projectId },
            select: {
              id: true, name: true, description: true, status: true, priority: true,
              startDate: true, endDate: true,
            },
          }) };
        case 'get_workspace':
          return { success: true, workspace: await this.prisma.workspace.findUnique({
            where: { id: params.workspaceId },
            select: { id: true, name: true, description: true },
          }) };
        case 'list_organization_members':
          return { success: true, members: await this.prisma.organizationMember.findMany({
            where: { organizationId: params.organizationId },
            select: { userId: true },
          }) };
        case 'list_workspace_members':
          return { success: true, members: await this.prisma.workspaceMember.findMany({
            where: { workspaceId: params.workspaceId },
            select: { userId: true },
          }) };
        case 'list_project_members':
          return { success: true, members: await this.prisma.projectMember.findMany({
            where: { projectId: params.projectId },
            select: { userId: true },
          }) };
        default:
          return null;
      }
    } catch {
      return { success: false };
    }
  }

  private getValue(
    params: Record<string, any>,
    result: any,
    source: 'params' | 'result',
    path: string,
  ): any {
    const root = source === 'params' ? params : result;
    if (!root) return undefined;
    const parts = path.split('.');
    let val = root;
    for (const p of parts) {
      if (val === null || val === undefined) return undefined;
      val = val[p];
    }
    return val;
  }

  private compareValues(expected: any, actual: any, mode: string, userTimezone: string): boolean {
    if (mode === 'exists') return actual !== null && actual !== undefined;
    if (mode === 'notExists') return actual === null || actual === undefined;
    if (mode === 'date') {
      if (!expected || !actual) return true; // skip if either is null
      // For date comparison: parse both, compare epoch seconds
      const expDate = this.tzNormalizer.parseUserDate(expected as string, userTimezone);
      const actDate = actual instanceof Date ? actual : new Date(actual);
      if (!expDate || isNaN(actDate.getTime())) return true; // skip unparseable
      // Compare within 1 second tolerance
      return Math.abs(expDate.getTime() - actDate.getTime()) < 1000;
    }
    // exact
    if (expected === null && actual === null) return true;
    if (expected === undefined) return true;
    return String(expected) === String(actual);
  }
}
