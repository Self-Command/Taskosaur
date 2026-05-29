import { Injectable } from '@nestjs/common';
import { ToolExecutor } from './tool-executor';
import { getToolDefinitions, MCPToolDefinition } from './tool-definitions';

@Injectable()
export class McpToolsService {
  constructor(private toolExecutor: ToolExecutor) {}

  getToolDefinitions(): MCPToolDefinition[] {
    return getToolDefinitions();
  }

  async executeTool(toolName: string, params: Record<string, any>, userId: string): Promise<any> {
    return this.toolExecutor.execute(toolName, params, userId);
  }

  /**
   * Format tool definitions for OpenAI/OpenRouter-compatible providers
   */
  getOpenAITools(): any[] {
    return getToolDefinitions().map((tool) => ({
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.input_schema,
      },
    }));
  }

  /**
   * Format tool definitions for Anthropic provider
   */
  getAnthropicTools(): any[] {
    return getToolDefinitions().map((tool) => ({
      name: tool.name,
      description: tool.description,
      input_schema: tool.input_schema,
    }));
  }

  /**
   * Format tool definitions for Google Gemini provider
   */
  getGoogleFunctionDeclarations(): any[] {
    return getToolDefinitions().map((tool) => ({
      name: tool.name,
      description: tool.description,
      parameters: tool.input_schema,
    }));
  }
}
