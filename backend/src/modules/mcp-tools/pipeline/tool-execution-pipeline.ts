import { Injectable, Logger } from '@nestjs/common';
import { ToolGuard, ToolCallContext, buildContext } from './types';

interface GuardEntry {
  guard: ToolGuard;
  priority: number;
}

@Injectable()
export class ToolExecutionPipeline {
  private readonly logger = new Logger(ToolExecutionPipeline.name);
  private guards: GuardEntry[] = [];

  register(guard: ToolGuard): void {
    this.guards.push({ guard, priority: guard.priority });
    this.guards.sort((a, b) => a.priority - b.priority);
    this.logger.log(`[INIT] Guard "${guard.name}" priority=${guard.priority}`);
  }

  async execute(
    toolName: string,
    params: Record<string, any>,
    userId: string,
    executor: () => Promise<any>,
    requestId: string = `req_${Date.now()}`,
  ): Promise<any> {
    const ctx = buildContext(requestId, toolName, params, userId, new Map());
    const startMs = Date.now();
    const writeTag = ctx.meta.isWrite ? 'WRITE' : 'READ';
    const entityInfo = ctx.meta.entity
      ? ` entity=${ctx.meta.entity.type}:${ctx.meta.entity.id.slice(0, 8)}`
      : '';

    this.logger.log(`[${requestId}] ▶ ${writeTag} ${toolName}${entityInfo}`);

    // ── Phase 1: Pre-guards ──
    for (const { guard } of this.guards) {
      if (!guard.enabled(ctx)) {
        this.logger.debug(`[${requestId}]   ∘ ${guard.name}: disabled`);
        continue;
      }
      if (!guard.preExecute) continue;
      try {
        const result = await guard.preExecute(ctx);
        if (result && !result.allowed) {
          this.logger.warn(`[${requestId}]   ✗ ${guard.name}: BLOCKED — ${result.error}`);
          return (
            result.fallback ?? {
              success: false,
              _guard: guard.name,
              error: result.error,
            }
          );
        }
        this.logger.debug(`[${requestId}]   ✓ ${guard.name}: passed`);
      } catch (err: any) {
        this.logger.error(`[${requestId}]   ✗ ${guard.name}: ERROR ${err.message}`);
      }
    }

    // ── Phase 2: Execute ──
    let result: any;
    try {
      result = await executor();
      this.logger.log(
        `[${requestId}]   → executed (${Date.now() - startMs}ms) ok=${result?.success !== false}`,
      );
    } catch (err: any) {
      result = { success: false, error: err.message || 'Tool execution failed' };
      this.logger.error(`[${requestId}]   → execution ERROR: ${err.message}`);
    }

    // ── Phase 3: Post-guards ──
    for (const { guard } of this.guards) {
      if (!guard.enabled(ctx)) continue;
      if (!guard.postExecute) continue;
      try {
        await guard.postExecute(ctx, result);
        this.logger.debug(`[${requestId}]   ✓ ${guard.name}: post done`);
      } catch (err: any) {
        this.logger.error(`[${requestId}]   ✗ ${guard.name}: post ERROR ${err.message}`);
      }
    }

    const elapsed = Date.now() - startMs;
    this.logger.log(`[${requestId}] ◀ ${writeTag} ${toolName} done (${elapsed}ms)`);
    return result;
  }
}
