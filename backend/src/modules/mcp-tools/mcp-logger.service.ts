import { Injectable, Logger } from '@nestjs/common';

const WRITE_TOOLS = new Set([
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
]);

function redactParams(params: Record<string, any>): Record<string, any> {
  const r: Record<string, any> = {};
  for (const [k, v] of Object.entries(params)) {
    if (k === 'api_key' || k === 'apiKey' || k === 'password' || k === 'token') {
      r[k] = '***';
    } else if (typeof v === 'string' && v.length > 200) {
      r[k] = v.substring(0, 200) + '...';
    } else {
      r[k] = v;
    }
  }
  return r;
}

@Injectable()
export class McpLoggerService {
  private readonly logger = new Logger('MCP');

  private isWrite(toolName: string): boolean {
    for (const prefix of WRITE_TOOLS) {
      if (toolName.startsWith(prefix)) return true;
    }
    return false;
  }

  logToolCall(toolName: string, userId: string, params: Record<string, any>) {
    if (this.isWrite(toolName)) {
      this.logger.log(
        `[WRITE] ${toolName} | user=${userId} | params=${JSON.stringify(redactParams(params))}`,
      );
    } else {
      this.logger.debug(
        `[READ]  ${toolName} | user=${userId} | params=${JSON.stringify(redactParams(params))}`,
      );
    }
  }

  logToolSuccess(toolName: string, userId: string, durationMs: number) {
    this.logger.log(`[OK]    ${toolName} | user=${userId} | ${durationMs}ms`);
  }

  logToolError(toolName: string, userId: string, error: any, durationMs: number) {
    const msg = error?.message || String(error);
    this.logger.error(
      `[FAIL]  ${toolName} | user=${userId} | ${durationMs}ms | ${msg}`,
      error?.stack,
    );
  }

  logAiChat(userId: string, provider: string, model: string, messageLen: number) {
    this.logger.log(
      `[CHAT]  user=${userId} provider=${provider} model=${model} msgLen=${messageLen}`,
    );
  }

  logAiResponse(userId: string, hasTools: boolean, textLen: number, durationMs: number) {
    this.logger.log(
      `[CHAT-RESP] user=${userId} tools=${hasTools} textLen=${textLen} ${durationMs}ms`,
    );
  }

  logAiError(userId: string, error: any) {
    const msg = error?.message || String(error);
    this.logger.error(`[CHAT-ERR] user=${userId} | ${msg}`, error?.stack);
  }
}
