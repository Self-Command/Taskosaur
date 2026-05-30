import { Module } from '@nestjs/common';
import { McpToolsService } from './mcp-tools.service';
import { McpToolsController } from './mcp-tools.controller';
import { ToolExecutor } from './tool-executor';
import { McpLoggerService } from './mcp-logger.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { SettingsModule } from '../settings/settings.module';
import { GatewayModule } from '../../gateway/gateway.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [PrismaModule, SettingsModule, GatewayModule, UsersModule],
  controllers: [McpToolsController],
  providers: [McpToolsService, ToolExecutor, McpLoggerService],
  exports: [McpToolsService, McpLoggerService],
})
export class McpToolsModule {}
