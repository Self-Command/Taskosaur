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
import { extname, basename } from 'path';
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
    if (t.completedAt) return res.send(resultHtml('任务已完成', false));
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
    if (t.completedAt) return res.send(resultHtml('任务已完成', false));
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
        startDate: true,
        dueDate: true,
        completedAt: true,
      },
    });
    if (!task) return res.send(resultHtml('任务未找到', false));

    console.log(`[CHECKIN] task=${taskId} photo=${!!photo} size=${photo?.size} name=${photo?.originalname}`);
    if (photo) {
      const diskFileName = basename(photo.path);
      await this.prisma.taskAttachment.create({
        data: {
          taskId,
          fileName: photo.originalname,
          filePath: photo.path.replace(/\\/g, '/'),
          mimeType: photo.mimetype,
          fileSize: photo.size,
          url: `/checkin/${diskFileName}`,
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
    const now = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
    const photoName = photo?.originalname || '';
    const photoSize = photo ? (photo.size / 1024 / 1024).toFixed(1) + 'MB' : '';
    // 读取照片为 base64 用于预览
    let photoDataUrl = '';
    if (photo && fs.existsSync(photo.path)) {
      const buf = fs.readFileSync(photo.path);
      photoDataUrl = `data:${photo.mimetype};base64,${buf.toString('base64')}`;
    }
    return res.send(detailHtml(
      cat === 'IN_PROGRESS' ? '已开始处理' : '已完成',
      task.slug, task.title || '任务', now, photoName, photoSize, photoDataUrl,
    ));
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

function detailHtml(
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
    .header h1{font-size:22px;font-weight:700;letter-spacing:-.3px;margin-bottom:4px}
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
          <h1>打卡成功</h1>
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
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function resultHtml(msg: string, ok: boolean) {
  return `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;background:linear-gradient(135deg,${ok ? '#f0fdf4 0%,#ecfdf5 50%,#f8fafc' : '#fef2f2 0%,#fff5f5 50%,#f8fafc'} 100%);padding:24px}
    .card{text-align:center;padding:40px 32px;border-radius:20px;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.04),0 8px 32px rgba(0,0,0,.08);max-width:360px;width:100%}
    .icon-wrap{width:64px;height:64px;border-radius:50%;background:${ok ? '#ecfdf5' : '#fef2f2'};display:inline-flex;align-items:center;justify-content:center;margin-bottom:16px}
    .icon-wrap svg{width:32px;height:32px;color:${ok ? '#059669' : '#ef4444'}}
    .text{font-size:17px;font-weight:600;color:#1e293b;margin-bottom:4px}
    .sub{font-size:13px;color:#94a3b8}
    </style></head><body><div class="card">
    <div class="icon-wrap">${ok
      ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>'
      : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>'
    }</div>
    <div class="text">${escHtml(msg)}</div>
    <div class="sub">${ok ? '操作成功' : '请稍后重试'}</div>
    </div></body></html>`;
}

function checkinHtml(t: any, userId: string, type: string) {
  const label = type === 'start-reminder' ? '开始处理' : '标记完成';
  const btnLabel = type === 'start-reminder' ? '确认开始处理' : '确认标记完成';
  const priorityColor =
    t.priority === 'HIGHEST' || t.priority === 'HIGH' ? '#ef4444' :
    t.priority === 'MEDIUM' ? '#f59e0b' : '#6b7280';
  const desc = t.description
    ? t.description.length > 200
      ? t.description.slice(0, 200) + '...'
      : t.description
    : '无';
  return `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
    <title>${label} - ${escHtml(t.title)}</title>
    <style>
      *{margin:0;padding:0;box-sizing:border-box}
      body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif;background:linear-gradient(180deg,#f8fafc 0%,#f1f5f9 100%);min-height:100vh;padding:16px;padding-bottom:40px}
      .wrap{max-width:420px;margin:0 auto}
      .header{text-align:center;padding:20px 0 8px}
      .header .badge{display:inline-block;background:#eff6ff;color:#3b82f6;font-size:12px;font-weight:600;padding:4px 12px;border-radius:20px;margin-bottom:8px}
      .header h1{font-size:18px;color:#1e293b;font-weight:700;margin-bottom:4px}
      .header .slug{font-size:13px;color:#94a3b8}
      .card{background:#fff;border-radius:16px;padding:20px;margin-bottom:12px;box-shadow:0 1px 3px rgba(0,0,0,.04),0 2px 12px rgba(0,0,0,.04)}
      .card-header{display:flex;align-items:center;gap:8px;margin-bottom:14px}
      .card-header .dot{width:8px;height:8px;border-radius:50%;background:#3b82f6}
      .card-header h2{font-size:14px;font-weight:600;color:#1e293b}
      .info-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px 16px}
      .info-item{display:flex;flex-direction:column;gap:2px}
      .info-item .lbl{font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:.3px}
      .info-item .val{font-size:13px;color:#334155;font-weight:500}
      .desc-box{background:#f8fafc;border-radius:10px;padding:14px;margin-top:12px;font-size:13px;color:#475569;line-height:1.7}
      .photo-section{margin-bottom:12px}
      .photo-section .section-title{font-size:14px;font-weight:600;color:#1e293b;margin-bottom:10px;display:flex;align-items:center;gap:6px}
      .photo-area{border:2px dashed #cbd5e1;border-radius:14px;padding:44px 20px;text-align:center;cursor:pointer;transition:all .15s;background:#fafbfc}
      .photo-area:active{background:#f1f5f9;border-color:#94a3b8}
      .photo-area .camera-icon{width:48px;height:48px;border-radius:50%;background:#eff6ff;display:inline-flex;align-items:center;justify-content:center;margin-bottom:10px}
      .photo-area .camera-icon svg{width:24px;height:24px;color:#3b82f6}
      .photo-area .hint{font-size:14px;color:#64748b;font-weight:500}
      .photo-area .sub-hint{font-size:12px;color:#94a3b8;margin-top:4px}
      .photo-preview-wrap{display:none;position:relative}
      .photo-preview-wrap.active{display:block}
      .photo-preview-img{width:100%;max-height:320px;object-fit:cover;border-radius:14px;display:block;box-shadow:0 2px 8px rgba(0,0,0,.08)}
      .photo-info{display:flex;align-items:center;justify-content:space-between;margin-top:8px;font-size:12px;color:#64748b}
      .photo-info .file-meta{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .photo-info .retake-btn{flex-shrink:0;margin-left:12px;padding:4px 12px;border:1px solid #e2e8f0;border-radius:8px;background:#fff;color:#64748b;font-size:12px;cursor:pointer}
      .photo-info .retake-btn:active{background:#f1f5f9}
      .hidden{display:none!important}
      .btn{width:100%;padding:16px;border:none;border-radius:14px;font-size:16px;font-weight:600;cursor:pointer;transition:all .15s;letter-spacing:.2px}
      .btn-primary{background:linear-gradient(135deg,#2563eb 0%,#1d4ed8 100%);color:#fff;margin-top:8px;box-shadow:0 2px 8px rgba(37,99,235,.3)}
      .btn-primary:active{transform:scale(.98);box-shadow:0 1px 4px rgba(37,99,235,.2)}
      .btn-secondary{background:#fff;color:#64748b;border:1.5px solid #e2e8f0;margin-top:10px}
      .btn-secondary:active{background:#f8fafc}
      .status-bar{text-align:center;padding:8px;font-size:12px;color:#94a3b8}
      .priority-badge{display:inline-block;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:600}
    </style></head><body>
    <div class="wrap">
      <div class="header">
        <div class="badge">${label}</div>
        <h1>${escHtml(t.title)}</h1>
        <div class="slug">${escHtml(t.slug)}</div>
      </div>
      <div class="card">
        <div class="card-header"><div class="dot"></div><h2>任务信息</h2></div>
        <div class="info-grid">
          <div class="info-item"><span class="lbl">类型</span><span class="val">${escHtml(t.type || '-')}</span></div>
          <div class="info-item"><span class="lbl">优先级</span><span class="val"><span class="priority-badge" style="background:${priorityColor}15;color:${priorityColor}">${t.priority || '-'}</span></span></div>
          <div class="info-item"><span class="lbl">状态</span><span class="val">${escHtml(t.status?.name || '-')}</span></div>
          <div class="info-item"><span class="lbl">项目</span><span class="val">${escHtml(t.project?.name || '-')}</span></div>
          <div class="info-item"><span class="lbl">迭代</span><span class="val">${escHtml(t.sprint?.name || '-')}</span></div>
          <div class="info-item"><span class="lbl">预估</span><span class="val">${t.storyPoints ?? '-'} SP</span></div>
          <div class="info-item"><span class="lbl">开始时间</span><span class="val">${fmt(t.startDate)}</span></div>
          <div class="info-item"><span class="lbl">截止时间</span><span class="val">${fmt(t.dueDate)}</span></div>
          <div class="info-item"><span class="lbl">执行人</span><span class="val">${escHtml(names(t.assignees))}</span></div>
          <div class="info-item"><span class="lbl">报告人</span><span class="val">${escHtml(names(t.reporters))}</span></div>
        </div>
        <div class="desc-box">${escHtml(desc)}</div>
      </div>
      <div class="card photo-section">
        <div class="section-title">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
          拍照打卡
        </div>
        <div class="photo-area" id="photoArea" onclick="document.getElementById('pf').click()">
          <div class="camera-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg></div>
          <div class="hint">点击拍照或选择照片</div>
          <div class="sub-hint">支持 JPG、PNG，最大 50MB</div>
        </div>
        <div class="photo-preview-wrap" id="previewWrap">
          <img id="pv" class="photo-preview-img" alt="打卡照片预览">
          <div class="photo-info">
            <span class="file-meta" id="fileMeta"></span>
            <button type="button" class="retake-btn" onclick="retake()">重新选择</button>
          </div>
        </div>
      </div>
      <form id="cf" action="/api/tasks/${t.id}/checkin?userId=${userId}&type=${type}" method="POST" enctype="multipart/form-data">
      <input type="file" id="pf" name="photo" accept="image/*" capture="environment" style="position:absolute;opacity:0;pointer-events:none" onchange="onPhotoSelected(this)">
      <button type="submit" class="btn btn-primary" id="sb">${btnLabel}</button>
      </form>
      <button class="btn btn-secondary" id="skipBtn" onclick="skipAndSubmit()">跳过拍照，直接提交</button>
      <div class="status-bar" id="st"></div>
    </div>
    <script>
      function onPhotoSelected(input){
        var f=input.files[0];
        if(!f)return;
        if(f.size>52428800){alert('文件超过50MB限制');input.value='';return;}
        var img=document.getElementById('pv');
        img.src=URL.createObjectURL(f);
        document.getElementById('photoArea').classList.add('hidden');
        document.getElementById('previewWrap').classList.add('active');
        var size=f.size>1048576?(f.size/1048576).toFixed(1)+'MB':(f.size/1024).toFixed(0)+'KB';
        document.getElementById('fileMeta').textContent=f.name+' · '+size;
        document.getElementById('st').textContent='照片已就绪';
      }
      function retake(){
        var pf=document.getElementById('pf');
        pf.value='';
        document.getElementById('pv').src='';
        document.getElementById('photoArea').classList.remove('hidden');
        document.getElementById('previewWrap').classList.remove('active');
        document.getElementById('st').textContent='';
        pf.click();
      }
      function skipAndSubmit(){
        document.getElementById('pf').value='';
        document.getElementById('pv').src='';
        document.getElementById('photoArea').classList.remove('hidden');
        document.getElementById('previewWrap').classList.remove('active');
        document.getElementById('cf').submit();
      }
      document.getElementById('cf').onsubmit=function(){
        var b=document.getElementById('sb');
        b.textContent='提交中...';b.style.opacity='.7';b.disabled=true;
        document.getElementById('skipBtn').disabled=true;
        document.getElementById('st').innerHTML='<span style="display:inline-block;animation:pulse 1.2s infinite">⏳</span> 正在上传照片，请勿关闭页面...';
      };
    </script>
    <style>
      @keyframes pulse{0%,100%{opacity:.4}50%{opacity:1}}
    </style></body></html>`;
}
