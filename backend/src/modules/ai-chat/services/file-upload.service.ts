import { Injectable } from '@nestjs/common';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as crypto from 'node:crypto';

// Ported from: https://github.com/luixaviles/chat-any-file
//   libs/api/src/lib/file-chat/shared/services/file-handler.service.ts
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');

// Ported from: https://github.com/ExploitEngineer/OpenAI-chat-widget
//   src/server.ts — multer.memoryStorage() + buffer.toString("base64")

const UPLOAD_DIR = path.resolve(process.cwd(), 'uploads', 'chat');
const MAX_TEXT_LEN = 50000;

const IMAGE_MIMES = new Set([
  'image/png', 'image/jpeg', 'image/gif', 'image/webp',
]);

const CODE_EXTS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.py', '.java', '.go', '.rs', '.rb',
  '.c', '.cpp', '.h', '.cs', '.swift', '.kt', '.sql', '.sh', '.yaml',
  '.yml', '.xml', '.html', '.css', '.scss', '.less', '.toml', '.ini',
]);

const TEXT_MIMES = new Set([
  'text/plain', 'text/markdown', 'text/csv', 'text/html',
  'application/json', 'application/xml',
]);

export interface FileAttachment {
  name: string;
  url: string;
  mimeType: string;
  size: number;
  extractedText?: string;
}

@Injectable()
export class FileUploadService {
  isImageMime(mime: string): boolean { return IMAGE_MIMES.has(mime); }

  storagePath(url: string): string {
    return path.join(UPLOAD_DIR, decodeURIComponent(path.basename(url)));
  }

  imageBase64(filePath: string): string {
    return fs.readFileSync(filePath).toString('base64');
  }

  async process(file: Express.Multer.File): Promise<FileAttachment> {
    const id = crypto.randomUUID();
    const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
    const ext = path.extname(originalName).toLowerCase();
    const storageName = `${id}${ext}`;
    const filePath = path.join(UPLOAD_DIR, storageName);

    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    fs.writeFileSync(filePath, file.buffer);

    const mime = file.mimetype;
    const isImage = IMAGE_MIMES.has(mime);
    const isCode = CODE_EXTS.has(ext);
    const isText = TEXT_MIMES.has(mime) || mime.startsWith('text/') || isCode;

    let extractedText: string | undefined;
    if (!isImage) {
      try {
        if (mime === 'application/pdf') {
          extractedText = await this.parsePdf(file.buffer);
        } else if (mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
          || ext === '.docx') {
          extractedText = await this.parseDocx(file.buffer);
        } else if (isText || isCode) {
          extractedText = file.buffer.toString('utf8').slice(0, MAX_TEXT_LEN);
        }
      } catch (err: any) {
        console.error('[FileUpload] Extraction failed for ' + originalName + ': ' + (err?.message || err));
      }
    }

    return {
      name: originalName,
      url: `/api/uploads/chat/${encodeURIComponent(storageName)}`,
      mimeType: isCode ? 'text/plain' : mime,
      size: file.size,
      extractedText,
    };
  }

  private async parsePdf(buffer: Buffer): Promise<string> {
    const r = await pdfParse(buffer);
    return (r?.text || '').trim().slice(0, MAX_TEXT_LEN);
  }

  private async parseDocx(buffer: Buffer): Promise<string> {
    const r = await mammoth.extractRawText({ buffer });
    return (r?.value || '').trim().slice(0, MAX_TEXT_LEN);
  }
}
