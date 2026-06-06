import { Injectable, Logger } from '@nestjs/common';
import { ToolGuard, ToolCallContext } from '../types';

/**
 * Lightweight structured audit logging for every tool execution.
 * Logs WRITE operations at 'log' level, READ at 'debug' level.
 * Redacts sensitive fields like api_key, password, token.
 */
@Injectable()
export class AuditLogGuard implements ToolGuard {
  readonly name = 'AuditLog';
  readonly priority = 100;

  private readonly logger = new Logger('ToolPipeline');

  enabled(_ctx: ToolCallContext): boolean {
    return true; // always on
  }

  async preExecute(ctx: ToolCallContext): Promise<void> {
    const params = this.redact(ctx.params);
    const level = ctx.meta.isWrite ? 'log' : 'debug';
    const tag = ctx.meta.isWrite ? 'WRITE' : 'READ';
    this.logger[level](
      `[${ctx.requestId}][${tag}] ${ctx.toolName} | user=${ctx.userId} | params=${JSON.stringify(params)}`,
    );
  }

  async postExecute(ctx: ToolCallContext, result: any): Promise<void> {
    const ok = result?.success !== false;
    const tag = ok ? 'OK' : 'FAIL';
    const level = ok ? 'log' : 'error';
    this.logger[level](`[${ctx.requestId}][${tag}] ${ctx.toolName} | user=${ctx.userId}`);
  }

  private redact(params: Record<string, any>): Record<string, any> {
    const sensitive = new Set(['api_key', 'apiKey', 'password', 'token']);
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(params)) {
      if (sensitive.has(k)) {
        out[k] = '***';
      } else if (typeof v === 'string' && v.length > 200) {
        out[k] = v.slice(0, 200) + '...';
      } else {
        out[k] = v;
      }
    }
    return out;
  }
}
