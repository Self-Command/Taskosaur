import { Injectable } from '@nestjs/common';
import slugify from 'slugify';
import pinyin from 'pinyin';

const CHINESE_RE = /[一-鿿㐀-䶿]/;

@Injectable()
export class SlugService {
  /**
   * Generate a URL-safe slug from arbitrary text.
   * Chinese characters are auto-converted to pinyin before slugification.
   * Returns a timestamp-based fallback if the final slug is empty.
   */
  generateSlug(text: string, fallbackPrefix = 'item'): string {
    if (!text?.trim()) {
      return this.fallbackSlug(fallbackPrefix);
    }

    let processed = text;

    if (CHINESE_RE.test(text)) {
      const pinyinResult = pinyin(text, {
        style: pinyin.STYLE_NORMAL,
        heteronym: false,
      });
      processed = pinyinResult.map((item) => item[0]).join(' ');
      // Strip pinyin tone marks via NFKD decomposition (e.g. wǒ → wo)
      processed = processed.normalize('NFKD').replace(/\p{M}/gu, '');
    }

    const slug = slugify(processed, {
      lower: true,
      strict: true,
      trim: true,
    });

    if (!slug) {
      return this.fallbackSlug(fallbackPrefix);
    }

    return slug;
  }

  private fallbackSlug(prefix: string): string {
    const ts = Date.now().toString(36);
    return `${prefix}-${ts}`;
  }
}
