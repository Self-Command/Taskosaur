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

    // 清理该任务所有旧提醒，避免更新日期后旧 job 仍然触发
    try {
      const delayed = await q.getDelayed();
      for (const job of delayed) {
        if (job.name === `start-${task.id}` || job.name === `due-${task.id}`) {
          await job.remove();
        }
      }
    } catch (_) {
      // 忽略清理失败
    }

    if (startDate) {
      const delayMs = startDate.getTime() - MINUTES * 60000 - Date.now();
      // 未来时间才调度，delay 最小为 0（10 分钟内立即推送）
      if (startDate.getTime() > Date.now()) {
        const delay = Math.max(0, delayMs);
        this.logger.log(`Start reminder for "${task.title}" in ${Math.round(delay / 60000)}min`);
        await q.add(
          `start-${task.id}`,
          {
            type: 'start',
            taskId: task.id,
            title: task.title,
            priority: task.priority,
            userId,
          },
          { delay, removeOnComplete: true, removeOnFail: 100 },
        );
      }
    }
    if (dueDate) {
      const delayMs = dueDate.getTime() - MINUTES * 60000 - Date.now();
      if (dueDate.getTime() > Date.now()) {
        const delay = Math.max(0, delayMs);
        this.logger.log(`Due reminder for "${task.title}" in ${Math.round(delay / 60000)}min`);
        await q.add(
          `due-${task.id}`,
          {
            type: 'due',
            taskId: task.id,
            title: task.title,
            priority: task.priority,
            userId,
          },
          { delay, removeOnComplete: true, removeOnFail: 100 },
        );
      }
    }
  }
}
