import { Module } from '@nestjs/common';
import { OpenAICompatController } from './openai-compat.controller';
import { AiChatModule } from '../ai-chat/ai-chat.module';
import { McpToolsModule } from '../mcp-tools/mcp-tools.module';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [AiChatModule, McpToolsModule, PrismaModule],
  controllers: [OpenAICompatController],
})
export class OpenAICompatModule {}
