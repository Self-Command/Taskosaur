import { Module } from '@nestjs/common';
import { AiChatController } from './ai-chat.controller';
import { AiChatService } from './ai-chat.service';
import { SettingsModule } from '../settings/settings.module';
import { PrismaModule } from '../../prisma/prisma.module';
import { McpToolsModule } from '../mcp-tools/mcp-tools.module';

@Module({
  imports: [SettingsModule, PrismaModule, McpToolsModule],
  controllers: [AiChatController],
  providers: [AiChatService],
  exports: [AiChatService],
})
export class AiChatModule {}
