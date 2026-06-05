import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PromptRegistry } from './prompt-registry.service';
import { TimeZoneNormalizer } from '../timezone/timezone-normalizer.service';
import { PromptContext } from './sections';

@Injectable()
export class PromptBuilder {
  constructor(
    private prisma: PrismaService,
    private registry: PromptRegistry,
    private tzNormalizer: TimeZoneNormalizer,
  ) {}

  /**
   * Build a complete system prompt for a user.
   * Language is detected from user.language; timezone from user.timezone.
   * Sections are composed in order; missing translations fall back to English.
   */
  async build(userId: string): Promise<string> {
    // ── 1. Fetch user profile ──
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { language: true, timezone: true },
    });
    const locale = user?.language || 'en';
    const timezone = user?.timezone || 'UTC';

    // ── 2. Resolve locale config ──
    const cfg = this.registry.getLocaleConfig(locale);

    // ── 3. Format current time in user's locale + TZ ──
    const { dateStr, offsetStr } = this.buildDateTime(cfg.date_locale, timezone);

    // ── 4. Build context ──
    const ctx: PromptContext = {
      timezone,
      locale,
      dateLocale: cfg.date_locale,
      dateStr,
      offsetStr,
    };

    // ── 5. Compose sections ──
    const parts: string[] = [];
    for (const key of this.registry.getSectionKeys()) {
      const section = this.registry.get(key, locale);
      const rendered = section.render(ctx);
      if (rendered) parts.push(rendered);
    }

    return parts.join('\n\n');
  }

  // ── Helpers ──────────────────────────────────────────────────

  private buildDateTime(
    dateLocale: string,
    timezone: string,
  ): { dateStr: string; offsetStr: string } {
    let dateStr: string;
    let offsetStr = 'UTC';

    try {
      dateStr = new Intl.DateTimeFormat(dateLocale, {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        weekday: 'long',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      }).format(new Date());

      // Compute UTC offset
      const now = new Date();
      const fmt = (tz: string) => {
        const p = new Intl.DateTimeFormat('en-US', {
          timeZone: tz,
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        }).formatToParts(now);
        const v: Record<string, number> = {};
        for (const part of p) {
          if (part.type !== 'literal') v[part.type] = parseInt(part.value, 10);
        }
        return Date.UTC(v.year, (v.month || 1) - 1, v.day || 1, v.hour || 0, v.minute || 0);
      };
      const offsetMin = Math.round((fmt(timezone) - fmt('UTC')) / 60000);
      const sign = offsetMin >= 0 ? '+' : '-';
      const absH = Math.floor(Math.abs(offsetMin) / 60);
      const absM = Math.abs(offsetMin) % 60;
      offsetStr = `UTC${sign}${String(absH).padStart(2, '0')}:${String(absM).padStart(2, '0')}`;
    } catch {
      dateStr = new Date().toISOString();
    }

    return { dateStr, offsetStr };
  }
}
