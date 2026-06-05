import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Logger,
  Res,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { Public } from '../auth/decorators/public.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { TaskReminderService } from './task-reminder.service';
import { diskStorage } from 'multer';
import { extname, basename } from 'path';
import * as path from 'path';
import * as fs from 'fs';

const CHECKIN_WINDOW_HOURS = 24; // check-in link valid for 24h after deadline
const CHECKIN_WAITLIST = ['TODO', 'IN_PROGRESS']; // statuses allowed to complete-reminder

@Controller('tasks')
export class TaskReminderController {
  private readonly logger = new Logger(TaskReminderController.name);
  private readonly uploadDir: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly reminderService: TaskReminderService,
  ) {
    this.uploadDir = this.configService.get('UPLOAD_DEST', './uploads');
  }

  @Public()
  @Get(':taskId/start-reminder')
  async startPage(
    @Param('taskId') taskId: string,
    @Query('userId') userId: string,
    @Res() res: Response,
  ) {
    const t = await this.getFullTask(taskId);
    if (!t) return res.send(resultHtml('任务未找到', false, '请确认链接是否正确'));

    if (t.isArchived) return res.send(resultHtml('任务已归档', false, '该任务已被归档，无法打卡'));
    if (t.project?.archive) return res.send(resultHtml('项目已归档', false, '所属项目已被归档，无法打卡'));

    if (t.completedAt) return res.send(resultHtml('任务已完成', true, '该任务已在 ' + fmt(t.completedAt) + ' 完成'));

    // Must be TODO to start
    if (t.status?.category !== 'TODO') {
      const msg = t.status?.category === 'IN_PROGRESS'
        ? '任务已处于进行中状态，无需重复打卡'
        : '开始打卡要求任务状态为待办，当前状态：' + (t.status?.name || t.status?.category || '-');
      const ok = t.status?.category === 'IN_PROGRESS';
      return res.send(ok
        ? alreadyHtml('开始任务打卡已完成', t.slug, t.title, msg)
        : resultHtml('任务状态不正确', false, msg));
    }

    if (t.startDate) {
      const deadline = new Date(t.startDate);
      deadline.setHours(deadline.getHours() + CHECKIN_WINDOW_HOURS);
      if (Date.now() > deadline.getTime()) {
        return res.send(resultHtml('打卡已超时', false, '开始时间 ' + fmt(t.startDate) + '，已超过' + CHECKIN_WINDOW_HOURS + '小时'));
      }
    }

    return res.send(checkinHtml(t, userId, 'start-reminder'));
  }

  @Public()
  @Get(':taskId/complete-reminder')
  async completePage(
    @Param('taskId') taskId: string,
    @Query('userId') userId: string,
    @Res() res: Response,
  ) {
    const t = await this.getFullTask(taskId);
    if (!t) return res.send(resultHtml('任务未找到', false, '请确认链接是否正确'));

    if (t.isArchived) return res.send(resultHtml('任务已归档', false, '该任务已被归档，无法打卡'));
    if (t.project?.archive) return res.send(resultHtml('项目已归档', false, '所属项目已被归档，无法打卡'));

    if (t.completedAt) {
      return res.send(alreadyHtml('结束任务打卡已完成', t.slug, t.title, '任务已于 ' + fmt(t.completedAt) + ' 完成'));
    }

    if (t.status?.category === 'DONE') {
      return res.send(alreadyHtml('结束任务打卡已完成', t.slug, t.title, '任务已完成，无需重复打卡'));
    }

    // Must be TODO or IN_PROGRESS to complete
    if (!CHECKIN_WAITLIST.includes(t.status?.category || '')) {
      return res.send(resultHtml('任务状态不正确', false, '结束打卡要求任务状态为待办或进行中，当前状态：' + (t.status?.name || t.status?.category || '-')));
    }

    if (t.dueDate) {
      const deadline = new Date(t.dueDate);
      deadline.setHours(deadline.getHours() + CHECKIN_WINDOW_HOURS);
      if (Date.now() > deadline.getTime()) {
        return res.send(resultHtml('打卡已超时', false, '截止时间 ' + fmt(t.dueDate) + '，已超过' + CHECKIN_WINDOW_HOURS + '小时'));
      }
    }

    return res.send(checkinHtml(t, userId, 'complete-reminder'));
  }

  @Public()
  @Post(':taskId/checkin')
  @UseInterceptors(
    FileInterceptor('photo', {
      storage: diskStorage({
        destination: (_, __, cb) => {
          const base = process.env['UPLOAD_DEST'] || './uploads';
          const d = path.join(base, 'checkin');
          if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
          cb(null, d);
        },
        filename: (_, file, cb) =>
          cb(null, Date.now() + '-' + Math.round(Math.random() * 1e9) + extname(file.originalname)),
      }),
      limits: { fileSize: 50 * 1024 * 1024, fieldSize: 10 * 1024 * 1024 },
    }),
  )
  async submitCheckin(
    @Param('taskId') taskId: string,
    @Query('userId') userId: string,
    @Query('type') type: string,
    @UploadedFile() photo: Express.Multer.File,
    @Res() res: Response,
  ) {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      select: {
        id: true,
        slug: true,
        title: true,
        projectId: true,
        isArchived: true,
        startDate: true,
        dueDate: true,
        completedAt: true,
        project: { select: { archive: true } },
        status: { select: { category: true, name: true } },
      },
    });
    if (!task) return res.send(resultHtml('任务未找到', false, '请确认链接是否正确'));

    if (task.isArchived) return res.send(resultHtml('任务已归档', false, '无法提交'));
    if (task.project?.archive) return res.send(resultHtml('项目已归档', false, '无法提交'));

    // ── Server-side guard: already completed ──
    if (task.completedAt) {
      return res.send(alreadyHtml('结束任务打卡已完成', task.slug, task.title, '任务已于 ' + fmt(task.completedAt) + ' 完成'));
    }

    // ── Server-side guard: correct status for this action ──
    if (type === 'start-reminder' && task.status?.category !== 'TODO') {
      const isInProgress = task.status?.category === 'IN_PROGRESS';
      return res.send(isInProgress
        ? alreadyHtml('开始任务打卡已完成', task.slug, task.title, '任务已处于进行中状态，无需重复打卡')
        : resultHtml('任务状态不正确', false, '开始打卡要求任务状态为待办，当前状态：' + (task.status?.name || '-')));
    }
    if (type === 'complete-reminder' && !CHECKIN_WAITLIST.includes(task.status?.category || '')) {
      const isDone = task.status?.category === 'DONE';
      return res.send(isDone
        ? alreadyHtml('结束任务打卡已完成', task.slug, task.title, '任务已完成，无需重复打卡')
        : resultHtml('任务状态不正确', false, '结束打卡要求任务状态为待办或进行中，当前状态：' + (task.status?.name || '-')));
    }

    // ── Server-side guard: timeout ──
    if (type === 'start-reminder' && task.startDate) {
      const deadline = new Date(task.startDate);
      deadline.setHours(deadline.getHours() + CHECKIN_WINDOW_HOURS);
      if (Date.now() > deadline.getTime()) {
        return res.send(resultHtml('打卡已超时', false, '开始时间 ' + fmt(task.startDate) + '，已超过' + CHECKIN_WINDOW_HOURS + '小时'));
      }
    }
    if (type === 'complete-reminder' && task.dueDate) {
      const deadline = new Date(task.dueDate);
      deadline.setHours(deadline.getHours() + CHECKIN_WINDOW_HOURS);
      if (Date.now() > deadline.getTime()) {
        return res.send(resultHtml('打卡已超时', false, '截止时间 ' + fmt(task.dueDate) + '，已超过' + CHECKIN_WINDOW_HOURS + '小时'));
      }
    }

    console.log(
      `[CHECKIN] task=${taskId} photo=${!!photo} size=${photo?.size} name=${photo?.originalname}`,
    );
    if (photo) {
      const safeName = Buffer.from(photo.originalname, 'latin1').toString('utf8');
      const diskFileName = basename(photo.path);
      const relPath = `checkin/${diskFileName}`;
      await this.prisma.taskAttachment.create({
        data: {
          taskId,
          fileName: safeName,
          filePath: photo.path.replace(/\\/g, '/'),
          mimeType: photo.mimetype,
          fileSize: photo.size,
          url: `/${relPath}`,
          storageKey: relPath,
          createdBy: userId,
        },
      });
    }
    const cat = type === 'start-reminder' ? 'IN_PROGRESS' : 'DONE';
    const st = await this.prisma.taskStatus.findFirst({
      where: { workflow: { Project: { some: { id: task.projectId } } }, category: cat },
    });
    if (st) {
      const data: any = { statusId: st.id, updatedBy: userId };
      if (cat === 'DONE') data.completedAt = new Date();
      await this.prisma.task.update({ where: { id: taskId }, data });

      // Cancel all pending reminders for this task when completed
      if (cat === 'DONE') {
        this.reminderService.cancelTaskReminders(taskId).catch(() => {});
      }
    }
    const now = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
    const photoName = photo?.originalname || '';
    const photoSize = photo ? (photo.size / 1024 / 1024).toFixed(1) + 'MB' : '';
    let photoDataUrl = '';
    if (photo && fs.existsSync(photo.path)) {
      const buf = fs.readFileSync(photo.path);
      photoDataUrl = `data:${photo.mimetype};base64,${buf.toString('base64')}`;
    }
    const checkinLabel = type === 'start-reminder' ? '开始任务打卡成功' : '结束任务打卡成功';
    return res.send(
      detailHtml(
        checkinLabel,
        cat === 'IN_PROGRESS' ? '已开始处理' : '已完成',
        task.slug,
        task.title || '任务',
        now,
        photoName,
        photoSize,
        photoDataUrl,
      ),
    );
  }

  private async getFullTask(taskId: string) {
    return this.prisma.task.findUnique({
      where: { id: taskId },
      select: {
        id: true,
        slug: true,
        title: true,
        priority: true,
        type: true,
        description: true,
        storyPoints: true,
        startDate: true,
        dueDate: true,
        completedAt: true,
        isArchived: true,
        project: { select: { name: true, archive: true } },
        sprint: { select: { name: true } },
        status: { select: { name: true, category: true } },
        assignees: { select: { user: { select: { firstName: true, lastName: true } } } },
        reporters: { select: { user: { select: { firstName: true, lastName: true } } } },
        _count: { select: { childTasks: true, comments: true, attachments: true } },
      },
    });
  }
}

function fmt(d: any) {
  return d ? new Date(d).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }) : '未设置';
}
function names(arr: any[]) {
  return (
    arr
      ?.map((a) => `${a.user?.firstName || ''} ${a.user?.lastName || ''}`.trim())
      .filter(Boolean)
      .join(', ') || '未分配'
  );
}

// ── "Already checked in" page — green success style with task info ──
function alreadyHtml(title: string, taskSlug: string, taskTitle: string, desc: string) {
  return `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif;background:linear-gradient(135deg,#f0fdf4 0%,#ecfdf5 50%,#f8fafc 100%);min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px}
    .wrap{width:100%;max-width:400px}
    .card{background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.04),0 4px 24px rgba(0,0,0,.08)}
    .header{background:linear-gradient(135deg,#059669 0%,#10b981 50%,#34d399 100%);padding:28px 24px 24px;text-align:center;color:#fff}
    .checkmark{width:56px;height:56px;border-radius:50%;background:rgba(255,255,255,.2);display:inline-flex;align-items:center;justify-content:center;margin-bottom:12px}
    .checkmark svg{width:32px;height:32px}
    .header h1{font-size:20px;font-weight:700;letter-spacing:-.3px;margin-bottom:4px}
    .header .subtitle{font-size:13px;opacity:.85;font-weight:400}
    .body{padding:20px 24px 24px}
    .info-group{background:#f9fafb;border-radius:12px;padding:16px}
    .info-row{display:flex;align-items:center;padding:6px 0;font-size:14px}
    .info-row+.info-row{border-top:1px solid #f3f4f6;margin-top:4px;padding-top:10px}
    .info-lbl{color:#9ca3af;flex-shrink:0;width:56px;font-size:13px}
    .info-val{color:#374151;font-weight:500;flex:1}
    .info-val.slug{color:#6b7280;font-weight:400;font-size:13px}
    .desc{text-align:center;color:#9ca3af;font-size:13px;margin-top:16px}
    .footer{text-align:center;padding:20px;font-size:12px;color:#d1d5db}
    </style></head><body>
    <div class="wrap">
      <div class="card">
        <div class="header">
          <div class="checkmark"><svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></div>
          <h1>${escHtml(title)}</h1>
          <div class="subtitle">无需重复操作</div>
        </div>
        <div class="body">
          <div class="info-group">
            <div class="info-row"><span class="info-lbl">任务</span><span class="info-val slug">${escHtml(taskSlug)}</span></div>
            <div class="info-row"><span class="info-lbl">标题</span><span class="info-val">${escHtml(taskTitle)}</span></div>
          </div>
          <div class="desc">${escHtml(desc)}</div>
        </div>
        <div class="footer">Taskosaur</div>
      </div>
    </div>
  </body></html>`;
}

// ── Success detail page after check-in submission ──
function detailHtml(
  checkinLabel: string,
  status: string,
  taskSlug: string,
  taskTitle: string,
  time: string,
  photoName: string,
  photoSize: string,
  photoDataUrl: string,
) {
  const photoBlock = photoDataUrl
    ? `<div class="photo-section">
        <div class="photo-label">📸 打卡照片</div>
        <img class="photo-thumb" src="${photoDataUrl}" alt="打卡照片" />
        <div class="photo-meta">${escHtml(photoName)} · ${escHtml(photoSize)}</div>
      </div>`
    : `<div class="photo-section photo-empty">
        <div class="photo-label">📸 打卡照片</div>
        <div class="photo-placeholder">
          <svg viewBox="0 0 64 64" fill="none"><rect x="8" y="16" width="48" height="36" rx="4" stroke="#d1d5db" stroke-width="2"/><circle cx="22" cy="30" r="5" stroke="#d1d5db" stroke-width="2"/><path d="M8 44l12-10 10 8 16-14 10 8v8a4 4 0 01-4 4H12a4 4 0 01-4-4v0z" stroke="#d1d5db" stroke-width="2"/></svg>
          <span>未上传照片</span>
        </div>
      </div>`;

  return `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif;background:linear-gradient(135deg,#f0f9ff 0%,#ecfdf5 50%,#f8fafc 100%);min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px}
    .wrap{width:100%;max-width:400px}
    .card{background:#fff;border-radius:20px;padding:0;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.04),0 4px 24px rgba(0,0,0,.08)}
    .header{background:linear-gradient(135deg,#059669 0%,#10b981 50%,#34d399 100%);padding:28px 24px 24px;text-align:center;color:#fff}
    .checkmark{width:56px;height:56px;border-radius:50%;background:rgba(255,255,255,.2);display:inline-flex;align-items:center;justify-content:center;margin-bottom:12px}
    .checkmark svg{width:32px;height:32px}
    .header h1{font-size:20px;font-weight:700;letter-spacing:-.3px;margin-bottom:4px}
    .header .subtitle{font-size:13px;opacity:.85;font-weight:400}
    .body{padding:20px 24px 24px}
    .info-group{background:#f9fafb;border-radius:12px;padding:16px;margin-bottom:16px}
    .info-row{display:flex;align-items:center;padding:6px 0;font-size:14px}
    .info-row+.info-row{border-top:1px solid #f3f4f6;margin-top:4px;padding-top:10px}
    .info-lbl{color:#9ca3af;flex-shrink:0;width:56px;font-size:13px}
    .info-val{color:#374151;font-weight:500;flex:1}
    .info-val.slug{color:#6b7280;font-weight:400;font-size:13px}
    .photo-section{margin-bottom:16px}
    .photo-label{font-size:14px;font-weight:600;color:#374151;margin-bottom:10px}
    .photo-thumb{width:100%;border-radius:12px;display:block;box-shadow:0 2px 8px rgba(0,0,0,.06)}
    .photo-meta{margin-top:8px;font-size:12px;color:#9ca3af;text-align:center}
    .photo-empty .photo-label{color:#d1d5db}
    .photo-placeholder{background:#f9fafb;border:2px dashed #e5e7eb;border-radius:12px;padding:32px;display:flex;flex-direction:column;align-items:center;gap:8px}
    .photo-placeholder svg{width:40px;height:40px;opacity:.3}
    .photo-placeholder span{font-size:13px;color:#d1d5db}
    .footer{text-align:center;padding:0 24px 24px}
    .footer .time{font-size:12px;color:#9ca3af}
    .divider{height:1px;background:#f3f4f6;margin:0 24px}
    </style></head><body>
    <div class="wrap">
      <div class="card">
        <div class="header">
          <div class="checkmark"><svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></div>
          <h1>${escHtml(checkinLabel)}</h1>
          <div class="subtitle">${escHtml(status)}</div>
        </div>
        <div class="body">
          <div class="info-group">
            <div class="info-row"><span class="info-lbl">任务</span><span class="info-val slug">${escHtml(taskSlug)}</span></div>
            <div class="info-row"><span class="info-lbl">标题</span><span class="info-val">${escHtml(taskTitle)}</span></div>
            <div class="info-row"><span class="info-lbl">状态</span><span class="info-val" style="color:#059669">${escHtml(status)}</span></div>
          </div>
          ${photoBlock}
        </div>
        <div class="divider"></div>
        <div class="footer"><span class="time">提交时间 ${escHtml(time)}</span></div>
      </div>
    </div>
  </body></html>`;
}

function escHtml(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── Generic result page (error / timeout / info) ──
function resultHtml(msg: string, ok: boolean, subtitle?: string) {
  const subHtml = subtitle ? `<div class="sub">${escHtml(subtitle)}</div>` : '';
  return `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;background:linear-gradient(135deg,${ok ? '#f0fdf4 0%,#ecfdf5 50%,#f8fafc' : '#fef2f2 0%,#fff5f5 50%,#f8fafc'} 100%);padding:24px}
    .card{text-align:center;padding:40px 32px;border-radius:20px;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.04),0 8px 32px rgba(0,0,0,.08);max-width:360px;width:100%}
    .icon-wrap{width:64px;height:64px;border-radius:50%;background:${ok ? '#ecfdf5' : '#fef2f2'};display:inline-flex;align-items:center;justify-content:center;margin-bottom:16px}
    .icon-wrap svg{width:32px;height:32px;color:${ok ? '#059669' : '#ef4444'}}
    .text{font-size:17px;font-weight:600;color:#1e293b;margin-bottom:4px}
    .sub{font-size:13px;color:#94a3b8;margin-top:8px;line-height:1.5}
    </style></head><body><div class="card">
    <div class="icon-wrap">${
      ok
        ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>'
        : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>'
    }</div>
    <div class="text">${escHtml(msg)}</div>
    ${subHtml}
    </div></body></html>`;
}

// ── Check-in form page ──
function checkinHtml(t: any, userId: string, type: string) {
  const isStart = type === 'start-reminder';
  const badge = isStart ? '开始任务打卡' : '结束任务打卡';
  const btnLabel = isStart ? '确认开始任务' : '确认完成任务';
  const timeLabel = isStart ? '开始时间' : '截止时间';
  const timeValue = isStart ? fmt(t.startDate) : fmt(t.dueDate);
  const accent = isStart ? '#2563eb' : '#059669';
  const accentLight = isStart ? '#eff6ff' : '#ecfdf5';
  const priorityColor =
    t.priority === 'HIGHEST' || t.priority === 'HIGH'
      ? '#ef4444'
      : t.priority === 'MEDIUM'
        ? '#f59e0b'
        : '#6b7280';
  const desc = t.description
    ? t.description.length > 200
      ? t.description.slice(0, 200) + '...'
      : t.description
    : '无';
  return `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<title>${badge} - ${escHtml(t.title)}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;background:#f3f4f6;min-height:100vh;padding:16px;padding-bottom:32px}
.wrap{max-width:420px;margin:0 auto}
.header{text-align:center;padding:20px 0 14px}
.header .badge{display:inline-block;background:${accentLight};color:${accent};font-size:13px;font-weight:700;padding:6px 16px;border-radius:20px;margin-bottom:10px}
.header h1{font-size:18px;color:#1e293b;font-weight:700;margin-bottom:4px;padding:0 8px;word-break:break-all}
.header .slug{font-size:13px;color:#94a3b8}
.header .time-hint{display:inline-flex;align-items:center;gap:4px;margin-top:8px;font-size:12px;color:#64748b;background:#f1f5f9;padding:4px 12px;border-radius:12px}
.card{background:#fff;border-radius:16px;padding:18px;margin-bottom:12px;box-shadow:0 1px 2px rgba(0,0,0,.05)}
.card-hd{display:flex;align-items:center;gap:8px;margin-bottom:12px}
.card-hd .dot{width:7px;height:7px;border-radius:50%;background:${accent};flex-shrink:0}
.card-hd h2{font-size:14px;font-weight:600;color:#1e293b}
.grid2{display:grid;grid-template-columns:1fr 1fr;gap:6px 12px}
.grid2 .it{display:flex;flex-direction:column;gap:1px}
.grid2 .it .lbl{font-size:11px;color:#94a3b8;letter-spacing:.2px}
.grid2 .it .val{font-size:13px;color:#334155;font-weight:500}
.descr{background:#f8fafc;border-radius:10px;padding:12px;margin-top:10px;font-size:13px;color:#475569;line-height:1.6}
.badge-prio{display:inline-block;padding:2px 7px;border-radius:8px;font-size:11px;font-weight:600}
.btn{display:block;width:100%;padding:15px;border:none;border-radius:13px;font-size:16px;font-weight:600;cursor:pointer;text-align:center;-webkit-appearance:none}
.btn-go{background:${accent};color:#fff;margin-top:12px}
.btn-go:active{opacity:.85}
.btn-skip{background:#fff;color:#64748b;border:1.5px solid #e5e7eb;margin-top:10px}
.btn-skip:active{background:#f9fafb}
.stbar{text-align:center;padding:10px;font-size:12px;color:#94a3b8;min-height:36px}
/* upload */
.up-label{display:flex;flex-direction:column;align-items:center;justify-content:center;padding:32px 16px;border-radius:12px;cursor:pointer;background:#f8fafc;border:1px solid #e5e7eb}
.up-label input{display:none}
.up-label svg{margin-bottom:8px}
.up-label .t{font-size:14px;color:#4b5563;font-weight:500}
.up-label .s{font-size:12px;color:#9ca3af;margin-top:2px}
.up-preview{display:none;border-radius:12px;overflow:hidden}
.up-preview img{width:100%;max-height:300px;object-fit:contain;display:block;background:#f1f5f9;border-radius:12px}
.up-preview .bar{display:flex;align-items:center;justify-content:space-between;margin-top:8px;font-size:12px;color:#6b7280}
.up-preview .bar span{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.up-preview .bar button{flex-shrink:0;margin-left:10px;padding:5px 12px;border:1px solid #e5e7eb;border-radius:8px;background:#fff;color:#6b7280;font-size:12px;cursor:pointer}
.hide{display:none!important}
</style></head><body>
<div class="wrap">
  <div class="header">
    <div class="badge">${badge}</div>
    <h1>${escHtml(t.title)}</h1>
    <div class="slug">${escHtml(t.slug)}</div>
    <div class="time-hint">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
      ${timeLabel}：${timeValue}
    </div>
  </div>
  <div class="card">
    <div class="card-hd"><div class="dot"></div><h2>任务信息</h2></div>
    <div class="grid2">
      <div class="it"><span class="lbl">类型</span><span class="val">${escHtml(t.type || '-')}</span></div>
      <div class="it"><span class="lbl">优先级</span><span class="val"><span class="badge-prio" style="background:${priorityColor}15;color:${priorityColor}">${t.priority || '-'}</span></span></div>
      <div class="it"><span class="lbl">状态</span><span class="val">${escHtml(t.status?.name || '-')}</span></div>
      <div class="it"><span class="lbl">项目</span><span class="val">${escHtml(t.project?.name || '-')}</span></div>
      <div class="it"><span class="lbl">迭代</span><span class="val">${escHtml(t.sprint?.name || '-')}</span></div>
      <div class="it"><span class="lbl">预估</span><span class="val">${t.storyPoints ?? '-'} SP</span></div>
      <div class="it"><span class="lbl">开始时间</span><span class="val">${fmt(t.startDate)}</span></div>
      <div class="it"><span class="lbl">截止时间</span><span class="val">${fmt(t.dueDate)}</span></div>
      <div class="it"><span class="lbl">执行人</span><span class="val">${escHtml(names(t.assignees))}</span></div>
      <div class="it"><span class="lbl">报告人</span><span class="val">${escHtml(names(t.reporters))}</span></div>
    </div>
    <div class="descr">${escHtml(desc)}</div>
  </div>
  <form id="cf" action="/api/tasks/${t.id}/checkin?userId=${userId}&type=${type}" method="POST" enctype="multipart/form-data">
  <div class="card">
    <div class="card-hd"><div class="dot"></div><h2>拍照打卡</h2></div>
    <label class="up-label" id="upLabel">
      <input type="file" id="pf" name="photo" accept="image/*" capture="environment" onchange="onPhoto(this)">
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="${accent}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>
      <div class="t">点击拍照或选择照片</div>
      <div class="s">JPG / PNG，最大 50MB</div>
    </label>
    <div class="up-preview" id="upPreview">
      <img id="pv" alt="">
      <div class="bar">
        <span id="fileMeta"></span>
        <button type="button" id="retakeBtn" onclick="retake()">重选</button>
      </div>
    </div>
  </div>
  <button type="submit" class="btn btn-go" id="sb">${btnLabel}</button>
  </form>
  <button class="btn btn-skip" id="skipBtn" onclick="skip()">跳过拍照，直接提交</button>
  <div class="stbar" id="st"></div>
</div>
<script>
var pf=document.getElementById('pf');
var pv=document.getElementById('pv');
var upLabel=document.getElementById('upLabel');
var upPreview=document.getElementById('upPreview');
var fileMeta=document.getElementById('fileMeta');
var st=document.getElementById('st');
var sb=document.getElementById('sb');
var skipBtn=document.getElementById('skipBtn');
function onPhoto(input){
  var f=input.files[0];
  if(!f)return;
  if(f.size>52428800){alert('文件超过50MB限制');input.value='';return;}
  pv.src=URL.createObjectURL(f);
  upLabel.classList.add('hide');
  upPreview.classList.add('show');
  upPreview.style.display='block';
  var s=f.size>1048576?(f.size/1048576).toFixed(1)+'MB':(f.size/1024).toFixed(0)+'KB';
  fileMeta.textContent=f.name+' · '+s;
  st.textContent='照片已就绪';
}
function retake(){
  pf.value='';pv.src='';
  upLabel.classList.remove('hide');
  upPreview.classList.remove('show');
  upPreview.style.display='none';
  st.textContent='';
  pf.click();
}
function skip(){
  pf.value='';pv.src='';
  upLabel.classList.remove('hide');
  upPreview.classList.remove('show');
  upPreview.style.display='none';
  document.getElementById('cf').submit();
}
document.getElementById('cf').onsubmit=function(){
  sb.disabled=true;sb.style.opacity='.6';sb.textContent='提交中...';
  skipBtn.disabled=true;
  st.innerHTML='⏳ 正在上传，请稍候...';
};
</script>
</body></html>`;
}
