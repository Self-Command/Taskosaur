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
import { diskStorage } from 'multer';
import { extname } from 'path';
import * as fs from 'fs';

@Controller('tasks')
export class TaskReminderController {
  private readonly logger = new Logger(TaskReminderController.name);
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get(':taskId/start-reminder')
  async startPage(
    @Param('taskId') taskId: string,
    @Query('userId') userId: string,
    @Res() res: Response,
  ) {
    const t = await this.getFullTask(taskId);
    if (!t) return res.send(resultHtml('任务未找到', false));
    if (t.startDate && Date.now() > new Date(t.startDate).getTime())
      return res.send(resultHtml('⏰ 已超过开始时间，无法打卡', false));
    if (t.completedAt) return res.send(resultHtml('任务已完成，无法重复打卡', false));
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
    if (!t) return res.send(resultHtml('任务未找到', false));
    if (t.dueDate && Date.now() > new Date(t.dueDate).getTime())
      return res.send(resultHtml('⏰ 已超过截止时间，无法打卡', false));
    if (t.completedAt) return res.send(resultHtml('任务已完成，无法重复打卡', false));
    return res.send(checkinHtml(t, userId, 'complete-reminder'));
  }

  @Public()
  @Post(':taskId/checkin')
  @UseInterceptors(
    FileInterceptor('photo', {
      storage: diskStorage({
        destination: (_, __, cb) => {
          const d = './uploads/checkin';
          if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
          cb(null, d);
        },
        filename: (_, file, cb) =>
          cb(null, Date.now() + '-' + Math.round(Math.random() * 1e9) + extname(file.originalname)),
      }),
      limits: { fileSize: 10 * 1024 * 1024 },
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
        projectId: true,
        startDate: true,
        dueDate: true,
        completedAt: true,
      },
    });
    if (!task) return res.send(resultHtml('任务未找到', false));
    if (
      type === 'start-reminder' &&
      task.startDate &&
      Date.now() > new Date(task.startDate).getTime()
    )
      return res.send(resultHtml('⏰ 已超时', false));
    if (
      type === 'complete-reminder' &&
      task.dueDate &&
      Date.now() > new Date(task.dueDate).getTime()
    )
      return res.send(resultHtml('⏰ 已超时', false));

    if (photo) {
      await this.prisma.taskAttachment.create({
        data: {
          taskId,
          fileName: photo.originalname,
          filePath: photo.path,
          mimeType: photo.mimetype,
          fileSize: photo.size,
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
    }
    return res.send(resultHtml(cat === 'IN_PROGRESS' ? '✅ 已开始处理' : '✅ 已完成', true));
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
        project: { select: { name: true } },
        sprint: { select: { name: true } },
        status: { select: { name: true } },
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

function resultHtml(msg: string, ok: boolean) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>
    body{font-family:-apple-system,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:${ok ? '#f0fdf4' : '#fef2f2'}}
    .card{text-align:center;padding:40px;border-radius:16px;background:#fff;box-shadow:0 4px 24px rgba(0,0,0,.08)}
    .icon{font-size:48px;margin-bottom:16px}.text{font-size:18px;font-weight:600;color:#1a1a1a}
    </style></head><body><div class="card"><div class="icon">${ok ? '✅' : '❌'}</div><div class="text">${msg}</div></div></body></html>`;
}

function checkinHtml(t: any, userId: string, type: string) {
  const label = type === 'start-reminder' ? '开始处理' : '标记完成';
  const desc = t.description
    ? t.description.length > 200
      ? t.description.slice(0, 200) + '...'
      : t.description
    : '无';
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
    <title>${label} - ${t.title}</title>
    <style>
      *{margin:0;padding:0;box-sizing:border-box}
      body{font-family:-apple-system,sans-serif;background:#f5f5f5;min-height:100vh;padding:16px;padding-bottom:32px}
      .card{background:#fff;border-radius:16px;padding:20px;margin-bottom:12px;box-shadow:0 1px 4px rgba(0,0,0,.06)}
      .card h2{font-size:16px;margin-bottom:12px;color:#1a1a1a}
      .row{display:flex;justify-content:space-between;padding:6px 0;font-size:14px;color:#333;border-bottom:1px solid #f0f0f0}
      .row .lbl{color:#999;flex-shrink:0;margin-right:12px}
      .row .val{text-align:right;word-break:break-all}
      .desc{font-size:13px;color:#666;line-height:1.6;padding:8px 0}
      .priority-high{color:#ef4444;font-weight:600}
      .photo-area{border:2px dashed #ddd;border-radius:12px;padding:40px 20px;text-align:center;cursor:pointer}
      .photo-area:active{background:#f0f0f0;border-color:#999}
      .photo-preview{display:none;width:100%;max-height:300px;object-fit:cover;border-radius:12px;margin-top:8px}
      .btn{width:100%;padding:16px;border:none;border-radius:12px;font-size:17px;font-weight:600;cursor:pointer}
      .btn-primary{background:#2563eb;color:#fff;margin-top:8px}
      .btn-primary:active{background:#1d4ed8}
      .btn-secondary{background:#fff;color:#666;border:1px solid #ddd;margin-top:8px}
      .hidden{display:none}.loading{opacity:.6;pointer-events:none}
    </style></head><body>
    <div class="card"><h2>📋 ${t.slug}: ${t.title}</h2>
      <div class="row"><span class="lbl">类型</span><span class="val">${t.type}</span></div>
      <div class="row"><span class="lbl">优先级</span><span class="val priority-high">${t.priority}</span></div>
      <div class="row"><span class="lbl">状态</span><span class="val">${t.status?.name || '-'}</span></div>
      <div class="row"><span class="lbl">项目</span><span class="val">${t.project?.name || '-'}</span></div>
      <div class="row"><span class="lbl">迭代</span><span class="val">${t.sprint?.name || '-'}</span></div>
      <div class="row"><span class="lbl">开始</span><span class="val">${fmt(t.startDate)}</span></div>
      <div class="row"><span class="lbl">截止</span><span class="val">${fmt(t.dueDate)}</span></div>
      <div class="row"><span class="lbl">预估</span><span class="val">${t.storyPoints ?? '-'} SP</span></div>
      <div class="row"><span class="lbl">子任务</span><span class="val">${t._count.childTasks}</span></div>
      <div class="row"><span class="lbl">评论</span><span class="val">${t._count.comments}</span></div>
      <div class="row"><span class="lbl">附件</span><span class="val">${t._count.attachments}</span></div>
      <div class="row"><span class="lbl">执行人</span><span class="val">${names(t.assignees)}</span></div>
      <div class="row"><span class="lbl">报告人</span><span class="val">${names(t.reporters)}</span></div>
      ${t.description ? `<div class="desc">📝 ${desc}</div>` : ''}
    </div>
    <div class="card">
      <h2>📸 拍照打卡</h2>
      <div class="photo-area" onclick="document.getElementById('p').click()"><div style="font-size:40px">📷</div><div style="font-size:14px;color:#999;margin-top:4px">点击拍照或选择照片</div></div>
      <input type="file" id="p" accept="image/*" capture="environment" class="hidden" onchange="prev(this)">
      <img id="pv" class="photo-preview">
    </div>
    <button class="btn btn-primary" id="sb" onclick="go(false)">${label}</button>
    <button class="btn btn-secondary" onclick="go(true)">跳过拍照</button>
    <div style="text-align:center;padding:8px;font-size:13px;color:#666" id="st"></div>
    <script>
      let pf=null;
      function prev(e){const f=e.target.files[0];if(!f)return;pf=f;const i=document.getElementById('pv');i.src=URL.createObjectURL(f);i.style.display='block'}
      async function go(skip){if(skip)pf=null;const b=document.getElementById('sb');b.classList.add('loading');b.textContent='提交中...';
        const fd=new FormData();if(pf)fd.append('photo',pf);
        try{const r=await fetch('/api/tasks/${t.id}/checkin?userId=${userId}&type=${type}',{method:'POST',body:fd});document.body.innerHTML=await r.text()}
        catch(e){document.getElementById('st').textContent='网络错误';b.classList.remove('loading');b.textContent='${label}'}}
    </script></body></html>`;
}
