import { Injectable, Logger } from '@nestjs/common';
import { ToolGuard, ToolCallContext, GuardResult, formatEntityKey } from '../types';

const LEDGER_KEY = '_entityWriteLedger';

@Injectable()
export class EntityWriteLockGuard implements ToolGuard {
  readonly name = 'EntityWriteLock';
  readonly priority = 10;
  private readonly logger = new Logger('Pipe:EntityLock');

  enabled(ctx: ToolCallContext): boolean {
    return ctx.meta.isWrite && !!ctx.meta.entity;
  }

  async preExecute(ctx: ToolCallContext): Promise<GuardResult | void> {
    if (!ctx.state.has(LEDGER_KEY)) {
      ctx.state.set(LEDGER_KEY, new Map<string, { tool: string; at: number }>());
    }
    const ledger: Map<string, { tool: string; at: number }> = ctx.state.get(LEDGER_KEY);
    const key = formatEntityKey(ctx.meta.entity!);
    const existing = ledger.get(key);

    if (existing) {
      this.logger.warn(
        `[${ctx.requestId}] LOCKED ${key} — already written by "${existing.tool}" ${Date.now() - existing.at}ms ago`,
      );
      return {
        allowed: false,
        error: `ENTITY LOCKED: ${ctx.meta.entity!.type} "${ctx.meta.entity!.id}" was already modified in this request by "${existing.tool}".`,
        fallback: {
          success: false,
          _guard: this.name,
          error: `Entity "${ctx.meta.entity!.type}" already written in this request. Previous write by "${existing.tool}" stands.`,
        },
      };
    }

    ledger.set(key, { tool: ctx.toolName, at: Date.now() });
    this.logger.log(`[${ctx.requestId}] LOCK acquired: ${key} by ${ctx.toolName}`);
  }
}
