import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Unified timezone-aware date parsing and formatting service.
 *
 * Core principle: DB stores UTC. All input date strings without explicit
 * timezone suffixes are interpreted as the user's local time and converted
 * to UTC. All output dates include timezone context so the AI and frontend
 * can display them correctly.
 */
@Injectable()
export class TimeZoneNormalizer {
  constructor(private prisma: PrismaService) {}

  // ── Public API ──────────────────────────────────────────────────

  /**
   * Fetch a user's timezone from DB. Falls back to UTC.
   */
  async getUserTimezone(userId: string): Promise<string> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { timezone: true },
      });
      return user?.timezone || 'UTC';
    } catch {
      return 'UTC';
    }
  }

  /**
   * Parse a date string according to the user's timezone.
   *
   * Rules:
   * - "YYYY-MM-DD"           → user's calendar date at midnight, returned as UTC
   * - "YYYY-MM-DDTHH:mm:ssZ" or "...+HH:MM" → explicit TZ, parsed directly
   * - "YYYY-MM-DDTHH:mm:ss"  (no suffix)    → user's local time, returned as UTC
   * - anything else          → native Date.parse, then user-TZ adjustment
   * - invalid                → null
   */
  parseUserDate(input: string, userTimezone: string): Date | null {
    if (!input || typeof input !== 'string') return null;
    const v = input.trim();
    if (!v) return null;

    // ── Explicit timezone suffix → native parse ──
    if (this.hasExplicitTZ(v)) {
      const d = new Date(v);
      return isNaN(d.getTime()) ? null : d;
    }

    // ── Date-only: YYYY-MM-DD ──
    const dateOnly = v.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (dateOnly) {
      return this.calendarDateToUTC(
        +dateOnly[1], +dateOnly[2], +dateOnly[3],
        userTimezone,
      );
    }

    // ── Datetime without timezone: YYYY-MM-DDTHH:mm[:ss[.SSS]] ──
    const dt = v.match(
      /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?$/,
    );
    if (dt) {
      return this.localTimeToUTC(
        +dt[1], +dt[2], +dt[3],
        +dt[4], +dt[5],
        dt[6] ? +dt[6] : 0,
        dt[7] ? +dt[7].padEnd(3, '0') : 0,
        userTimezone,
      );
    }

    // ── Fallback: native parse then adjust ──
    const naive = new Date(v);
    if (isNaN(naive.getTime())) return null;
    return this.serverLocalToUTC(naive, userTimezone);
  }

  /**
   * Format a UTC Date as an ISO-like string in the user's timezone.
   * The result has NO timezone suffix (the AI is told to pass dates without suffix).
   */
  formatForLLM(date: Date | null, userTimezone: string): string | null {
    if (!date) return null;
    try {
      return new Intl.DateTimeFormat('sv-SE', {
        timeZone: userTimezone,
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
        hour12: false,
      }).format(date).replace(' ', 'T');
    } catch {
      return date.toISOString();
    }
  }

  /**
   * Get the current time formatted for the user's timezone (used in system prompt).
   */
  getCurrentTimeFormatted(userTimezone: string): string {
    try {
      return new Intl.DateTimeFormat('zh-CN', {
        timeZone: userTimezone,
        year: 'numeric', month: '2-digit', day: '2-digit',
        weekday: 'long', hour: '2-digit', minute: '2-digit',
        second: '2-digit', hour12: false,
      }).format(new Date());
    } catch {
      return new Date().toISOString();
    }
  }

  /**
   * Get the UTC offset in minutes for a given timezone at a given UTC instant.
   * Positive = ahead of UTC (e.g., +480 for Asia/Shanghai).
   */
  getOffsetMinutes(utcMs: number, timezone: string): number {
    const date = new Date(utcMs);
    const utcEpoch = this.formatToEpoch(date, 'UTC');
    const tzEpoch = this.formatToEpoch(date, timezone);
    return (tzEpoch - utcEpoch) / 60000;
  }

  // ── Internal helpers ────────────────────────────────────────────

  /**
   * Check if the string has an explicit timezone indicator.
   */
  private hasExplicitTZ(v: string): boolean {
    return /[Zz]$/.test(v) || /[+-]\d{2}:\d{2}$/.test(v);
  }

  /**
   * Convert a calendar date (YYYY, MM, DD) at midnight in user's TZ to a UTC Date.
   *
   * Uses Intl.DateTimeFormat to resolve the correct offset for that calendar date,
   * handling DST transitions correctly.
   */
  private calendarDateToUTC(
    year: number, month: number, day: number,
    timezone: string,
  ): Date {
    const refUTC = Date.UTC(year, month - 1, day, 0, 0, 0, 0);
    const offsetMin = this.getOffsetMinutes(refUTC, timezone);
    return new Date(refUTC - offsetMin * 60000);
  }

  /**
   * Convert a datetime specified as user's local time to UTC.
   *
   * Two-pass to handle DST transitions: first pass with the same date at midnight,
   * second pass (if time component present) uses the result from pass 1 to get
   * a more accurate offset.
   */
  private localTimeToUTC(
    year: number, month: number, day: number,
    hour: number, minute: number, second: number, ms: number,
    timezone: string,
  ): Date {
    // Build as UTC epoch, then subtract offset at that instant
    const refUTC = Date.UTC(year, month - 1, day, hour, minute, second, ms);

    // Pass 1: get approximate offset using midnight of the same date
    const midnightUTC = Date.UTC(year, month - 1, day, 0, 0, 0, 0);
    const offset1 = this.getOffsetMinutes(midnightUTC, timezone);
    const approxUTC = refUTC - offset1 * 60000;

    // Pass 2: refine with offset at the approximate time (handles DST)
    const offset2 = this.getOffsetMinutes(approxUTC, timezone);
    return new Date(refUTC - offset2 * 60000);
  }

  /**
   * Convert a Date that was parsed as server-local-time to UTC,
   * reinterpreting its components as user-timezone time.
   */
  private serverLocalToUTC(serverDate: Date, timezone: string): Date {
    return this.localTimeToUTC(
      serverDate.getFullYear(),
      serverDate.getMonth() + 1,
      serverDate.getDate(),
      serverDate.getHours(),
      serverDate.getMinutes(),
      serverDate.getSeconds(),
      serverDate.getMilliseconds(),
      timezone,
    );
  }

  /**
   * Format a Date in a given timezone and return the epoch milliseconds
   * of the formatted components (as if they were UTC).
   */
  private formatToEpoch(date: Date, timezone: string): number {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      hour12: false,
    }).formatToParts(date);

    const v: Record<string, number> = {};
    for (const p of parts) {
      if (p.type !== 'literal') v[p.type] = parseInt(p.value, 10);
    }

    return Date.UTC(
      v.year, (v.month || 1) - 1, v.day || 1,
      v.hour || 0, v.minute || 0, v.second || 0,
    );
  }
}
