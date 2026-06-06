import { Injectable, Logger } from '@nestjs/common';
import { ToolGuard, ToolCallContext } from '../types';
import { McpVerificationService } from '../../mcp-verification.service';

@Injectable()
export class WriteVerificationGuard implements ToolGuard {
  readonly name = 'WriteVerification';
  readonly priority = 10;
  private readonly logger = new Logger('Pipe:Verify');

  constructor(private readonly verification: McpVerificationService) {}

  enabled(ctx: ToolCallContext): boolean {
    return ctx.meta.isWrite;
  }

  async postExecute(ctx: ToolCallContext, result: any): Promise<void> {
    if (!result || result.success === false) {
      this.logger.debug(`[${ctx.requestId}] skip — result.success=${result?.success}`);
      return;
    }
    try {
      const v = await this.verification.verify(ctx.toolName, ctx.params, result, ctx.userId);
      if (!v.passed) {
        result._verification = v;
        this.logger.warn(
          `[${ctx.requestId}] VERIFY FAILED: ${v.failures?.map((f: any) => `${f.field}: expected=${f.expected} actual=${f.actual}`).join('; ') || 'N/A'}`,
        );
      } else {
        this.logger.debug(`[${ctx.requestId}] verify passed`);
      }
    } catch (err: any) {
      this.logger.error(`[${ctx.requestId}] verify error: ${err.message}`);
    }
  }
}
