import { Module } from '@nestjs/common';
import { McpToolsService } from './mcp-tools.service';
import { McpToolsController } from './mcp-tools.controller';
import { ToolExecutor } from './tool-executor';
import { McpLoggerService } from './mcp-logger.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { SettingsModule } from '../settings/settings.module';
import { GatewayModule } from '../../gateway/gateway.module';
import { UsersModule } from '../users/users.module';
import { InvitationsModule } from '../invitations/invitations.module';
import { OrganizationsModule } from '../organizations/organizations.module';
import { OrganizationMembersModule } from '../organization-members/organization-members.module';
import { WorkspaceMembersModule } from '../workspace-members/workspace-members.module';
import { ProjectMembersModule } from '../project-members/project-members.module';

@Module({
  imports: [
    PrismaModule,
    SettingsModule,
    GatewayModule,
    UsersModule,
    InvitationsModule,
    OrganizationsModule,
    OrganizationMembersModule,
    WorkspaceMembersModule,
    ProjectMembersModule,
  ],
  controllers: [McpToolsController],
  providers: [McpToolsService, ToolExecutor, McpLoggerService],
  exports: [McpToolsService, McpLoggerService],
})
export class McpToolsModule {}
