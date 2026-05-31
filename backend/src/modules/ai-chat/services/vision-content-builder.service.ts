import { Injectable } from '@nestjs/common';
import * as fs from 'node:fs';
import { FileUploadService, FileAttachment } from './file-upload.service';

// Ported from OpenAI Chat Widget: file_data base64 + mime_type pattern
// Ported from Chat Any File: getInlineFileData → InlineDataPart pattern

@Injectable()
export class VisionContentBuilder {
  constructor(private readonly fileService: FileUploadService) {}

  /**
   * Build message content for vision-capable providers.
   * Returns plain text when no images are attached.
   */
  build(text: string, attachments: FileAttachment[], provider: 'openai' | 'anthropic' | 'google'): any {
    const images = attachments.filter((a) => this.fileService.isImageMime(a.mimeType));
    if (images.length === 0) return text;

    const parts: any[] = provider === 'google' ? [{ text }] : [{ type: 'text', text }];

    for (const img of images) {
      const fp = this.fileService.storagePath(img.url);
      if (!fs.existsSync(fp)) continue;
      const b64 = this.fileService.imageBase64(fp);

      if (provider === 'openai') {
        parts.push({ type: 'image_url', image_url: { url: `data:${img.mimeType};base64,${b64}` } });
      } else if (provider === 'anthropic') {
        parts.push({ type: 'image', source: { type: 'base64', media_type: img.mimeType, data: b64 } });
      } else {
        parts.push({ inlineData: { mimeType: img.mimeType, data: b64 } });
      }
    }

    return provider === 'google' ? parts : parts;
  }
}
