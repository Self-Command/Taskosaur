import { Controller, Get, Post, Delete, Body, Req, Res, Logger } from '@nestjs/common';
import { Request, Response } from 'express';
import { Public } from '../auth/decorators/public.decorator';
import { McpServerService } from './mcp-server.service';
import { McpSessionService } from './mcp-session.service';
import { PrismaService } from '../../prisma/prisma.service';
import { JsonRpcRequest, JSONRPC_ERRORS } from './types';

function maskKey(key: string): string {
  if (!key || key.length < 12) return '***';
  return key.slice(0, 10) + '...' + key.slice(-4);
}

@Public()
@Controller('mcp')
export class McpServerController {
  private readonly logger = new Logger(McpServerController.name);
  private requestCounter = 0;

  constructor(
    private readonly mcpServerService: McpServerService,
    private readonly sessionService: McpSessionService,
    private readonly prisma: PrismaService,
  ) {}

  // Catch-all: log ALL requests to /mcp/* BEFORE NestJS routing rejects them
  @Get()
  health(@Req() req: Request, @Res() res: Response) {
    const accept = req.headers.accept || '';
    // MCP SDK sends GET with Accept: text/event-stream to probe for SSE support.
    // We don't support SSE → must return 405 so the SDK falls back to POST-only mode.
    if (accept.includes('text/event-stream')) {
      this.logger.log(`[HEALTH] SSE probe from ${req.ip} → 405`);
      return res.status(405).send();
    }
    this.logger.log(`[HEALTH] ${req.ip}`);
    return res.status(200).json({ status: 'ok', protocol: 'mcp', version: '2025-03-26' });
  }

  @Post('*')
  catchAllPost(@Body() body: any, @Req() req: Request, @Res() res: Response) {
    this.logger.warn(
      `[CATCH-ALL] POST ${req.url} from ${req.ip} — body=${JSON.stringify(body).slice(0, 300)}`,
    );
    return res.status(404).json({
      jsonrpc: '2.0',
      id: body?.id || null,
      error: {
        code: -32601,
        message: `Unknown MCP path: ${req.url}. Use POST /mcp for all JSON-RPC methods.`,
      },
    });
  }

  @Post()
  async handlePost(@Body() body: any, @Req() req: Request, @Res() res: Response) {
    const reqId = ++this.requestCounter;
    const ip = req.ip;
    const method = body?.method || '<missing>';
    const jsonRpcId = body?.id;
    const startMs = Date.now();

    // Log raw body for debugging — shows exactly what LobeHub sends
    const bodyStr = JSON.stringify(body);
    this.logger.log(
      `[#${reqId}] RAW ${method} from ${ip} — body=${bodyStr.length > 500 ? bodyStr.slice(0, 500) + '...' : bodyStr}`,
    );

    // ── Auth ──
    const authHeader = req.headers.authorization || '';
    const apiKey = authHeader.replace('Bearer ', '').trim();
    const userId = await this.authenticate(apiKey, reqId);

    if (!userId) {
      const maskedKey = maskKey(apiKey);
      this.logger.warn(
        `[#${reqId}] AUTH FAIL — key=${maskedKey} ip=${ip} method=${method}`,
      );
      return res.status(401).json({
        jsonrpc: '2.0',
        id: jsonRpcId || null,
        error: {
          code: JSONRPC_ERRORS.INVALID_REQUEST,
          message: `Unauthorized. Use Bearer <MCP API Key> from Settings → MCP Server. Provided: ${maskedKey}`,
        },
      });
    }
    this.logger.log(`[#${reqId}] auth ok — userId=${userId.slice(0,8)}...`);

    // ── Parse JSON-RPC ──
    const request: JsonRpcRequest = {
      jsonrpc: body.jsonrpc || '2.0',
      id: jsonRpcId,
      method,
      params: body.params,
    };

    if (!request.method) {
      this.logger.warn(`[#${reqId}] missing method`);
      return res.status(400).json({
        jsonrpc: '2.0',
        id: null,
        error: { code: JSONRPC_ERRORS.INVALID_REQUEST, message: 'Missing method' },
      });
    }

    // ── Session ──
    const existingSessionId = this.extractSessionId(req);
    let sessionId = existingSessionId;

    if (sessionId) {
      const existing = this.sessionService.get(sessionId);
      if (!existing) {
        this.logger.warn(`[#${reqId}] session ${sessionId.slice(0,8)}... expired/missing`);
        if (request.method !== 'initialize') {
          return res.status(400).json({
            jsonrpc: '2.0',
            id: request.id || null,
            error: {
              code: JSONRPC_ERRORS.INVALID_REQUEST,
              message: 'Session expired. Re-initialize first.',
            },
          });
        }
        sessionId = undefined;
      } else if (existing.userId !== userId) {
        this.logger.warn(
          `[#${reqId}] session user mismatch: session.owner=${existing.userId.slice(0,8)}... req.user=${userId.slice(0,8)}...`,
        );
        return res.status(403).json({
          jsonrpc: '2.0',
          id: request.id || null,
          error: {
            code: JSONRPC_ERRORS.INVALID_REQUEST,
            message: 'Session does not belong to this user.',
          },
        });
      }
    }

    // ── Handle ──
    try {
      // Log tool calls with params summary
      if (request.method === 'tools/call') {
        const toolName = request.params?.name || '?';
        const argKeys = request.params?.arguments
          ? Object.keys(request.params.arguments).join(', ')
          : 'none';
        this.logger.log(`[#${reqId}] tools/call → ${toolName}(${argKeys})`);
      }

      const result = await this.mcpServerService.handleRequest(
        request,
        sessionId,
        userId,
      );

      // ── Session lifecycle ──
      if (!sessionId && request.method === 'initialize' && result.sessionId !== undefined) {
        const session = this.sessionService.create(userId);
        sessionId = session.sessionId;
        this.logger.log(`[#${reqId}] new session: ${sessionId.slice(0, 8)}...`);
      } else if (sessionId && request.method === 'initialize') {
        this.sessionService.get(sessionId);
        this.logger.log(`[#${reqId}] re-initialize session: ${sessionId.slice(0, 8)}...`);
      }

      if (sessionId) {
        res.setHeader('Mcp-Session-Id', sessionId);
      }

      // ── Response ──
      const elapsed = Date.now() - startMs;
      if (!result.response) {
        // Notification
        this.logger.log(`[#${reqId}] → 202 notification (${elapsed}ms)`);
        return res.status(202).send();
      }

      // Log result summary
      if (result.response.error) {
        this.logger.error(
          `[#${reqId}] → ${result.response.error.code} ${result.response.error.message} (${elapsed}ms)`,
        );
      } else if (request.method === 'tools/list') {
        const toolCount = result.response.result?.tools?.length || 0;
        this.logger.log(`[#${reqId}] → 200 tools/list: ${toolCount} tools (${elapsed}ms)`);
      } else if (request.method === 'tools/call') {
        const isError = result.response.result?.isError;
        this.logger.log(
          `[#${reqId}] → 200 tools/call ${isError ? 'FAILED' : 'OK'} (${elapsed}ms)`,
        );
      } else {
        this.logger.log(`[#${reqId}] → 200 ${request.method} (${elapsed}ms)`);
      }

      return res.status(200).json(result.response);
    } catch (err: any) {
      const elapsed = Date.now() - startMs;
      this.logger.error(
        `[#${reqId}] INTERNAL ERROR ${request.method}: ${err.message} (${elapsed}ms)`,
        err.stack,
      );
      return res.status(500).json({
        jsonrpc: '2.0',
        id: request.id || null,
        error: {
          code: JSONRPC_ERRORS.INTERNAL_ERROR,
          message: err.message || 'Internal error',
        },
      });
    }
  }

  @Delete()
  async handleDelete(@Req() req: Request, @Res() res: Response) {
    const sessionId = this.extractSessionId(req);
    if (sessionId) {
      this.sessionService.delete(sessionId);
      this.logger.log(`[SESSION] terminated: ${sessionId.slice(0, 8)}...`);
    }
    return res.status(200).json({ result: 'ok' });
  }

  // ── Helpers ──

  private async authenticate(apiKey: string, reqId: number): Promise<string | null> {
    if (!apiKey) {
      this.logger.warn(`[#${reqId}] no Authorization header`);
      return null;
    }

    const setting = await this.prisma.settings.findFirst({
      where: { key: 'mcp_api_key', value: apiKey },
      select: { userId: true },
    });

    if (!setting?.userId) {
      this.logger.warn(
        `[#${reqId}] key not found in DB: ${maskKey(apiKey)} (len=${apiKey.length})`,
      );
      return null;
    }

    return setting.userId;
  }

  private extractSessionId(req: Request): string | undefined {
    const header =
      req.headers['mcp-session-id'] || req.headers['Mcp-Session-Id'];
    return (header as string)?.trim() || undefined;
  }
}
