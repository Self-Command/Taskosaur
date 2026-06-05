import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Worker, Job } from 'bullmq';
import { PrismaService } from '../../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';

const QUEUE = 'task-reminders';
const DEFAULT_PUSHGO_URL = 'https://gateway.pushgo.cn/message';

@Injectable()
export class TaskReminderWorker implements OnModuleInit {
  private readonly logger = new Logger(TaskReminderWorker.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly settingsService: SettingsService,
  ) {}

  async onModuleInit() {
    const worker = new Worker(
      QUEUE,
      async (job: Job) => {
        const { type, taskId, priority, userId } = job.data;

        const task = await this.prisma.task.findUnique({
          where: { id: taskId },
          select: {
            id: true,
            title: true,
            slug: true,
            completedAt: true,
            isArchived: true,
            priority: true,
            startDate: true,
            dueDate: true,
            description: true,
            type: true,
            storyPoints: true,
            project: { select: { name: true, archive: true } },
            sprint: { select: { name: true } },
            assignees: { select: { user: { select: { firstName: true, lastName: true } } } },
            reporters: { select: { user: { select: { firstName: true, lastName: true } } } },
            status: { select: { name: true, category: true } },
            _count: { select: { childTasks: true, comments: true, attachments: true } },
          },
        });

        // ── Universal guards: drop silently, job is stale ──
        if (!task) return;
        if (task.completedAt) return;
        if (task.status?.category === 'DONE') return;
        if (task.isArchived) return;
        if (task.project?.archive) return;

        // ── Start reminder: task must still be TODO ──
        if (type === 'start' && task.status?.category !== 'TODO') return;

        // ── Due reminder: task must be TODO or IN_PROGRESS ──
        if (
          type === 'due' &&
          task.status?.category !== 'TODO' &&
          task.status?.category !== 'IN_PROGRESS'
        )
          return;

        // 从数据库读取用户设置（前端设置页面可修改）
        const channelId = await this.getUserSetting(userId, 'pushgo_channel_id');
        const channelPwd = await this.getUserSetting(userId, 'pushgo_channel_password');
        const gatewayUrl = await this.getUserSetting(userId, 'pushgo_gateway_url');
        if (!channelId || !channelPwd) {
          this.logger.warn(`User ${userId} has no PushGo config`);
          return;
        }

        const user = await this.prisma.user.findUnique({
          where: { id: userId },
          select: { timezone: true },
        });
        const tz = user?.timezone || 'Asia/Shanghai';
        const fmt = (d: any) => (d ? new Date(d).toLocaleString('zh-CN', { timeZone: tz }) : 'N/A');
        const joinNames = (arr: any[]) =>
          arr
            ?.map((a) => `${a.user?.firstName || ''} ${a.user?.lastName || ''}`.trim())
            .filter(Boolean)
            .join(', ') || '未分配';

        const action = type === 'start' ? 'start-reminder' : 'complete-reminder';
        const apiBase =
          this.configService.get('BACKEND_URL') ||
          this.configService.get('FRONTEND_URL') ||
          'http://localhost:3000';
        const callbackUrl = `${apiBase}/api/tasks/${task.id}/${action}?userId=${userId}`;

        const priorityLabel: Record<string, string> = {
          LOWEST: '最低',
          LOW: '低',
          MEDIUM: '中',
          HIGH: '高',
          HIGHEST: '最高',
        };
        const isStart = type === 'start';
        const title = isStart ? `⏰ ${task.title}` : `✅ ${task.title}`;
        const timeLabel = isStart ? '开始时间' : '截止时间';
        const timeValue = isStart ? fmt(task.startDate) : fmt(task.dueDate);
        const lines = [
          `📋 ${task.project?.name || '-'} · ${task.slug}`,
          `优先级: ${priorityLabel[task.priority] || task.priority}  状态: ${task.status?.name || '-'}`,
          `执行: ${joinNames(task.assignees)}`,
          `⏱ ${timeLabel}: ${timeValue}`,
          task.description
            ? task.description.length > 120
              ? task.description.slice(0, 120) + '...'
              : task.description
            : '',
        ].filter(Boolean);
        lines.push('');
        lines.push(type === 'start' ? '👆 点击开始处理' : '👆 点击标记完成');

        const body = lines.join('\n');
        const severity = 'critical';

        try {
          const ttl = Date.now() + 24 * 60 * 60 * 1000; // 24h TTL — prevent stale message pile-up
          const pushgoUrl = gatewayUrl || DEFAULT_PUSHGO_URL;
          const res = await fetch(pushgoUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              channel_id: channelId,
              password: channelPwd,
              title,
              body,
              severity,
              url: callbackUrl,
              ttl,
            }),
          });
          const json = await res.json();
          if (json?.success) this.logger.log(`PushGo sent: ${type} "${title}"`);
          else this.logger.error(`PushGo failed: ${JSON.stringify(json)}`);
        } catch (err: any) {
          this.logger.error(`PushGo error: ${err.message}`);
        }
      },
      {
        connection: {
          host: this.configService.get('REDIS_HOST') || 'localhost',
          port: parseInt(this.configService.get('REDIS_PORT') || '6379', 10),
          password: this.configService.get('REDIS_PASSWORD') || undefined,
        },
      },
    );

    worker.on('completed', (j) => this.logger.log(`Completed: ${j.data.type} "${j.data.title}"`));
    worker.on('failed', (j, err) => this.logger.error(`Failed: ${err.message}`));
    this.logger.log('Worker started');
  }

  private async getUserSetting(userId: string, key: string): Promise<string | null> {
    // 通过 SettingsService 读取，自动处理加密字段解密
    return this.settingsService.get(key, userId);
  }
}
