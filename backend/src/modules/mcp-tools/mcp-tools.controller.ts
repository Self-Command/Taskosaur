import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { McpToolsService } from './mcp-tools.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '@prisma/client';

@ApiTags('MCP Tools')
@Controller('mcp-tools')
@UseGuards(JwtAuthGuard)
export class McpToolsController {
  constructor(private readonly mcpToolsService: McpToolsService) {}

  @Get('definitions')
  @ApiOperation({ summary: 'Get all MCP tool definitions' })
  @ApiResponse({ status: 200, description: 'List of tool definitions' })
  getDefinitions() {
    return this.mcpToolsService.getToolDefinitions();
  }

  @Post('execute')
  @ApiOperation({ summary: 'Execute an MCP tool' })
  @ApiResponse({ status: 200, description: 'Tool execution result' })
  async execute(
    @CurrentUser() user: User,
    @Body() body: { tool: string; params: Record<string, any> },
  ) {
    return this.mcpToolsService.executeTool(body.tool, body.params, user.id);
  }
}
