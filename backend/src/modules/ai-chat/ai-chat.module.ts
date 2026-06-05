import { Module } from '@nestjs/common';
import { AiChatController } from './ai-chat.controller';
import { AiChatService } from './ai-chat.service';
import { FileUploadService } from './services/file-upload.service';
import { VisionContentBuilder } from './services/vision-content-builder.service';
import { WebSearchService } from './services/web-search.service';
import { SettingsModule } from '../settings/settings.module';
import { PrismaModule } from '../../prisma/prisma.module';
import { McpToolsModule } from '../mcp-tools/mcp-tools.module';
import { PromptModule } from '../prompt/prompt.module';
@Module({
  imports: [SettingsModule, PrismaModule, McpToolsModule, PromptModule],
  controllers: [AiChatController],
  providers: [AiChatService, FileUploadService, VisionContentBuilder, WebSearchService],
  exports: [AiChatService, WebSearchService],
})
export class AiChatModule {}
