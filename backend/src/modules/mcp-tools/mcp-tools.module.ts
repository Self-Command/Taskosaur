import { Module } from '@nestjs/common';
import { McpToolsService } from './mcp-tools.service';
import { ToolExecutor } from './tool-executor';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [McpToolsService, ToolExecutor],
  exports: [McpToolsService],
})
export class McpToolsModule {}
