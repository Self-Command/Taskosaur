import { Injectable, Logger } from '@nestjs/common';
import { McpToolsService } from '../mcp-tools/mcp-tools.service';
import { ToolExecutionPipeline } from '../mcp-tools/pipeline/tool-execution-pipeline';
import { McpSessionService } from './mcp-session.service';
import { SettingsService } from '../settings/settings.service';
import {
  JsonRpcRequest,
  JsonRpcResponse,
  JsonRpcError,
  MCPToolDefinition,
  JSONRPC_ERRORS,
} from './types';

@Injectable()
export class McpServerService {
  private readonly logger = new Logger(McpServerService.name);

  constructor(
    private readonly mcpToolsService: McpToolsService,
    private readonly toolPipeline: ToolExecutionPipeline,
    private readonly sessionService: McpSessionService,
    private readonly settingsService: SettingsService,
  ) {}

  /**
   * Handle a JSON-RPC request and return a response.
   * Returns null for notifications (no response expected).
   */
  async handleRequest(
    request: JsonRpcRequest,
    sessionId: string | undefined,
    userId: string,
  ): Promise<{ response?: JsonRpcResponse; sessionId?: string }> {
    const { method, id, params } = request;

    try {
      switch (method) {
        case 'initialize':
          return this.handleInitialize(id, params);
        case 'notifications/initialized':
          // Notification — no response
          this.logger.log(`Session ${sessionId} initialized`);
          return {};

        case 'tools/list':
          return { response: this.handleListTools(id) };

        case 'tools/call':
          return {
            response: await this.handleToolCall(id, params, userId),
          };

        case 'ping':
          return { response: this.buildResponse(id, {}) };

        default:
          return {
            response: this.buildError(
              id,
              JSONRPC_ERRORS.METHOD_NOT_FOUND,
              `Method not found: ${method}`,
            ),
          };
      }
    } catch (err: any) {
      this.logger.error(`Error handling ${method}: ${err.message}`);
      return {
        response: this.buildError(
          id,
          JSONRPC_ERRORS.INTERNAL_ERROR,
          err.message || 'Internal error',
        ),
      };
    }
  }

  // ── initialize ──

  private handleInitialize(
    id: number | string | undefined,
    params: any,
  ): { response: JsonRpcResponse; sessionId: string } {
    const clientInfo = params?.clientInfo || {};
    this.logger.log(
      `Initialize from ${clientInfo.name || 'unknown'} v${clientInfo.version || '?'}`,
    );

    return {
      sessionId: '', // filled by controller after session creation
      response: this.buildResponse(id, {
        protocolVersion: '2025-03-26',
        capabilities: { tools: {} },
        serverInfo: {
          name: 'Taskosaur MCP Server',
          version: '1.0.0',
        },
      }),
    };
  }

  // ── tools/list ──

  private handleListTools(id: number | string | undefined): JsonRpcResponse {
    const defs = this.mcpToolsService.getToolDefinitions();
    const tools: MCPToolDefinition[] = defs.map((d) => ({
      name: d.name,
      description: d.description,
      inputSchema: {
        type: 'object' as const,
        properties: d.input_schema.properties || {},
        required: d.input_schema.required || [],
      },
    }));
    return this.buildResponse(id, { tools });
  }

  // ── tools/call ──

  private async handleToolCall(
    id: number | string | undefined,
    params: any,
    userId: string,
  ): Promise<JsonRpcResponse> {
    const toolName = params?.name;
    const toolArgs = params?.arguments || {};

    if (!toolName) {
      return this.buildError(id, JSONRPC_ERRORS.INVALID_PARAMS, 'Missing tool name');
    }

    // Auto-fill default workspace/project context for query tools when omitted.
    // This saves the AI from chaining discoverability calls just to find a scope.
    const contextTools = new Set([
      'list_tasks', 'list_projects', 'list_task_comments', 'list_sprints',
      'list_labels', 'list_time_entries', 'list_task_dependencies',
      'list_task_statuses', 'list_project_members', 'create_task',
      'batch_create_tasks', 'smart_query', 'list_task_attachments',
      'get_project_inbox', 'get_project', 'list_custom_fields',
    ]);
    if (contextTools.has(toolName) && !toolArgs.workspaceId && !toolArgs.projectId) {
      const defaultWs = await this.settingsService.get('mcp_default_workspace', userId);
      const defaultProj = await this.settingsService.get('mcp_default_project', userId);
      // Only auto-fill when the tool doesn't already have its own scope params
      if (defaultWs && !toolArgs.workspaceId && !toolArgs.organizationId) {
        toolArgs.workspaceId = defaultWs;
      }
      if (defaultProj && !toolArgs.projectId) {
        toolArgs.projectId = defaultProj;
      }
    }

    this.logger.log(`Tool call: ${toolName} (userId=${userId})`);

    try {
      const result = await this.toolPipeline.execute(
        toolName,
        toolArgs,
        userId,
        () => this.mcpToolsService.executeTool(toolName, toolArgs, userId),
        `mcp_${Date.now()}`,
      );

      const isError = result?.success === false;
      const text = JSON.stringify(result, null, 2);

      return this.buildResponse(id, {
        content: [{ type: 'text', text }],
        isError,
      });
    } catch (err: any) {
      return this.buildResponse(id, {
        content: [{ type: 'text', text: `Tool execution failed: ${err.message}` }],
        isError: true,
      });
    }
  }

  // ── Helpers ──

  private buildResponse(id: number | string | undefined, result: any): JsonRpcResponse {
    return { jsonrpc: '2.0', id, result };
  }

  private buildError(
    id: number | string | undefined,
    code: number,
    message: string,
    data?: any,
  ): JsonRpcResponse {
    const error: JsonRpcError = { code, message };
    if (data) error.data = data;
    return { jsonrpc: '2.0', id, error };
  }
}
