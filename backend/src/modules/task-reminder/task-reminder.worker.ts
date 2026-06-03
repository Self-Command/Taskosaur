import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Worker, Job } from 'bullmq';
import { PrismaService } from '../../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';

const QUEUE = 'task-reminders';
const PUSHGO_URL = 'https://gateway.pushgo.cn/message';

const SEVERITY_MAP: Record<string, string> = {
  LOWEST: 'low',
  LOW: 'low',
  MEDIUM: 'normal',
  HIGH: 'high',
  HIGHEST: 'critical',
};

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
        const { type, taskId, title, priority, userId } = job.data;
        this.logger.log(`Processing: ${type} "${title}"`);

        const task = await this.prisma.task.findUnique({
          where: { id: taskId },
          select: {
            id: true,
            slug: true,
            completedAt: true,
            priority: true,
            startDate: true,
            dueDate: true,
            description: true,
            type: true,
            storyPoints: true,
            project: { select: { name: true } },
            sprint: { select: { name: true } },
            assignees: { select: { user: { select: { firstName: true, lastName: true } } } },
            reporters: { select: { user: { select: { firstName: true, lastName: true } } } },
            status: { select: { name: true, category: true } },
            _count: { select: { childTasks: true, comments: true, attachments: true } },
          },
        });
        if (!task || task.completedAt || task.status?.category === 'DONE') return;

        // 从数据库读取用户设置（前端设置页面可修改）
        const channelId = await this.getUserSetting(userId, 'pushgo_channel_id');
        const channelPwd = await this.getUserSetting(userId, 'pushgo_channel_password');
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
        const lines = [
          `📋 ${task.slug}`,
          `类型: ${task.type}  优先级: ${priorityLabel[task.priority] || task.priority}  状态: ${task.status?.name || '-'}`,
          `项目: ${task.project?.name || '-'}  迭代: ${task.sprint?.name || '-'}`,
          `开始时间: ${fmt(task.startDate)}  截止时间: ${fmt(task.dueDate)}`,
          `预估工时: ${task.storyPoints ?? '-'}人天  子任务: ${task._count.childTasks}  评论: ${task._count.comments}  附件: ${task._count.attachments}`,
          `执行人: ${joinNames(task.assignees)}`,
          `报告人: ${joinNames(task.reporters)}`,
        ];
        if (task.description) {
          const desc =
            task.description.length > 150
              ? task.description.slice(0, 150) + '...'
              : task.description;
          lines.push(`描述: ${desc}`);
        } else {
          lines.push('描述: 无');
        }
        lines.push('');
        lines.push(type === 'start' ? '👆 点击通知开始处理任务' : '👆 点击通知标记任务完成');

        const body = lines.join('\n');
        const severity = SEVERITY_MAP[task.priority] || 'info';

        try {
          const ttl = Date.now() + 24 * 60 * 60 * 1000; // 24h TTL — prevent stale message pile-up
          const res = await fetch(PUSHGO_URL, {
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
