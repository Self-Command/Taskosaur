import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';

const QUEUE = 'task-reminders';
const MINUTES = 10;

@Injectable()
export class TaskReminderService {
  private readonly logger = new Logger(TaskReminderService.name);
  private queue: Queue | null = null;

  constructor(private readonly configService: ConfigService) {}

  private getQueue(): Queue {
    if (!this.queue) {
      this.queue = new Queue(QUEUE, {
        connection: {
          host: this.configService.get('REDIS_HOST') || 'localhost',
          port: parseInt(this.configService.get('REDIS_PORT') || '6379', 10),
          password: this.configService.get('REDIS_PASSWORD') || undefined,
        },
      });
    }
    return this.queue;
  }

  async schedule(task: any) {
    const q = this.getQueue();
    const userId = task.createdBy || '';
    const startDate = task.startDate ? new Date(task.startDate) : null;
    const dueDate = task.dueDate ? new Date(task.dueDate) : null;

    if (startDate) {
      const delayMs = Math.max(0, startDate.getTime() - MINUTES * 60000 - Date.now());
      this.logger.log(`Start reminder for "${task.title}" in ${Math.round(delayMs / 60000)}min`);
      await q.add(
        `start-${task.id}`,
        {
          type: 'start',
          taskId: task.id,
          title: task.title,
          priority: task.priority,
          userId,
        },
        { delay: delayMs, removeOnComplete: true, removeOnFail: 100 },
      );
    }
    if (dueDate) {
      const delayMs = Math.max(0, dueDate.getTime() - MINUTES * 60000 - Date.now());
      this.logger.log(`Due reminder for "${task.title}" in ${Math.round(delayMs / 60000)}min`);
      await q.add(
        `due-${task.id}`,
        {
          type: 'due',
          taskId: task.id,
          title: task.title,
          priority: task.priority,
          userId,
        },
        { delay: delayMs, removeOnComplete: true, removeOnFail: 100 },
      );
    }
  }
}
