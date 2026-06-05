import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { TimeZoneModule } from '../timezone/timezone.module';
import { PromptBuilder } from './prompt-builder.service';
import { PromptRegistry } from './prompt-registry.service';

@Module({
  imports: [PrismaModule, TimeZoneModule],
  providers: [PromptRegistry, PromptBuilder],
  exports: [PromptBuilder],
})
export class PromptModule {}
