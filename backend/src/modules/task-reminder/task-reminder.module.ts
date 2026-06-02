import { Module } from '@nestjs/common';
import { TaskReminderService } from './task-reminder.service';
import { TaskReminderWorker } from './task-reminder.worker';
import { TaskReminderController } from './task-reminder.controller';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [TaskReminderController],
  providers: [TaskReminderService, TaskReminderWorker],
  exports: [TaskReminderService],
})
export class TaskReminderModule {}
