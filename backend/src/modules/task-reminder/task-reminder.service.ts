import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import { SettingsService } from '../settings/settings.service';

const QUEUE = 'task-reminders';
const DEFAULT_START_MINUTES = 10;
const DEFAULT_DUE_MINUTES = 10;

@Injectable()
export class TaskReminderService {
  private readonly logger = new Logger(TaskReminderService.name);
  private queue: Queue | null = null;

  constructor(
    private readonly configService: ConfigService,
    private readonly settingsService: SettingsService,
  ) {}

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

  async cancelTaskReminders(taskId: string) {
    const q = this.getQueue();
    try {
      const delayed = await q.getDelayed();
      for (const job of delayed) {
        if (job.name === `start-${taskId}` || job.name === `due-${taskId}`) {
          await job.remove();
          this.logger.log(`Cancelled ${job.name} for task ${taskId}`);
        }
      }
    } catch (e: any) {
      this.logger.warn(`Failed to cancel reminders for task ${taskId}: ${e.message}`);
    }
  }

  async schedule(task: any) {
    const q = this.getQueue();
    const userId = task.createdBy || '';
    const startDate = task.startDate ? new Date(task.startDate) : null;
    const dueDate = task.dueDate ? new Date(task.dueDate) : null;

    // Read user-configured reminder lead minutes (fallback to default 10)
    const startMinutes = this.resolveMinutes(
      await this.settingsService.get('reminder_start_minutes', userId),
      DEFAULT_START_MINUTES,
    );
    const dueMinutes = this.resolveMinutes(
      await this.settingsService.get('reminder_due_minutes', userId),
      DEFAULT_DUE_MINUTES,
    );

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
      const delayMs = startDate.getTime() - startMinutes * 60000 - Date.now();
      if (startDate.getTime() > Date.now()) {
        const delay = Math.max(0, delayMs);
        this.logger.log(
          `Start reminder for "${task.title}" in ${Math.round(delay / 60000)}min (lead: ${startMinutes}min)`,
        );
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
      const delayMs = dueDate.getTime() - dueMinutes * 60000 - Date.now();
      if (dueDate.getTime() > Date.now()) {
        const delay = Math.max(0, delayMs);
        this.logger.log(
          `Due reminder for "${task.title}" in ${Math.round(delay / 60000)}min (lead: ${dueMinutes}min)`,
        );
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

  private resolveMinutes(value: string | null, fallback: number): number {
    if (!value) return fallback;
    const n = parseInt(value, 10);
    if (!Number.isFinite(n) || n < 0) return fallback;
    return n;
  }
}
