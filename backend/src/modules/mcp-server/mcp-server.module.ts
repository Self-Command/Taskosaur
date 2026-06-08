import { Module } from '@nestjs/common';
import { McpServerController } from './mcp-server.controller';
import { McpServerService } from './mcp-server.service';
import { McpSessionService } from './mcp-session.service';
import { McpToolsModule } from '../mcp-tools/mcp-tools.module';
import { PrismaModule } from '../../prisma/prisma.module';
import { SettingsModule } from '../settings/settings.module';

@Module({
  imports: [McpToolsModule, PrismaModule, SettingsModule],
  controllers: [McpServerController],
  providers: [McpServerService, McpSessionService],
})
export class McpServerModule {}
