import { Module, OnModuleInit } from '@nestjs/common';
import { ToolExecutionPipeline } from './tool-execution-pipeline';
import { EntityWriteLockGuard } from './guards/entity-write-lock.guard';
import { EmptyParamsGuard } from './guards/empty-params.guard';
import { WriteVerificationGuard } from './guards/write-verification.guard';
import { AuditLogGuard } from './guards/audit-log.guard';
import { McpVerificationService } from '../mcp-verification.service';
import { PrismaModule } from '../../../prisma/prisma.module';
import { TimeZoneModule } from '../../timezone/timezone.module';

@Module({
  imports: [PrismaModule, TimeZoneModule],
  providers: [
    ToolExecutionPipeline,
    EntityWriteLockGuard,
    EmptyParamsGuard,
    WriteVerificationGuard,
    AuditLogGuard,
    McpVerificationService,
  ],
  exports: [ToolExecutionPipeline],
})
export class PipelineModule implements OnModuleInit {
  constructor(
    private readonly pipeline: ToolExecutionPipeline,
    private readonly entityLock: EntityWriteLockGuard,
    private readonly emptyParams: EmptyParamsGuard,
    private readonly writeVerify: WriteVerificationGuard,
    private readonly auditLog: AuditLogGuard,
  ) {}

  onModuleInit() {
    // Register guards in execution order (lower priority = earlier)
    this.pipeline.register(this.entityLock); // priority 10
    this.pipeline.register(this.emptyParams); // priority 20
    this.pipeline.register(this.writeVerify); // priority 10 (post)
    this.pipeline.register(this.auditLog); // priority 100 (post)
  }
}
