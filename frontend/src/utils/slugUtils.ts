import { pinyin } from 'pinyin-pro';

/**
 * Extracts the UUID from a string that might contain a slug suffix.
 * A UUID is 36 characters long.
 * Example: "123e4567-e89b-12d3-a456-426614174000-my-task-slug" -> "123e4567-e89b-12d3-a456-426614174000"
 */
export const extractUuid = (id: string | undefined | null): string | null => {
  if (!id) return null;

  // UUIDs are 36 characters long (32 hex digits + 4 hyphens)
  // If the ID is longer than 36 chars and starts with a UUID pattern, extract it.
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
  const match = id.match(uuidPattern);

  if (match) {
    return match[0];
  }

  // Fallback: if it doesn't look like a UUID at start, just return the ID (might be invalid or legacy)
  return id;
};

/**
 * Generates a URL-friendly slug from arbitrary text.
 * Chinese characters are auto-converted to pinyin (via pinyin-pro).
 * Mixed Chinese+English text preserves English portions correctly.
 * Returns empty string only if text is entirely unconvertible.
 */
const CHINESE_SEGMENT_RE = /([一-鿿㐀-䶿]+)/g;
const SLUG_CLEAN_RE = /[^\w\-]+/g;
const MULTI_DASH_RE = /-{2,}/g;
const EDGE_DASH_RE = /^-+|-+$/g;

function toPinyin(chineseText: string): string {
  try {
    return (pinyin(chineseText, { toneType: 'none', type: 'array' }) as string[]).join(' ');
  } catch {
    return chineseText;
  }
}

export const generateSlug = (text: string): string => {
  if (!text) return '';

  // Split text into segments: Chinese portions get converted to pinyin,
  // non-Chinese portions are preserved as-is.
  const hasChinese = CHINESE_SEGMENT_RE.test(text);
  const processed = hasChinese
    ? text.replace(CHINESE_SEGMENT_RE, (match) => ' ' + toPinyin(match) + ' ')
    : text;

  return processed
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/&/g, '-and-')
    .replace(SLUG_CLEAN_RE, '')
    .replace(MULTI_DASH_RE, '-')
    .replace(EDGE_DASH_RE, '');
};
/**
 * Validates if a string is a safe slug (lowercase alphanumeric and hyphens only).
 * Prevents open redirect attacks via malicious workspace/project slugs.
 */
const SAFE_SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
export const isValidSlug = (slug: any): slug is string => {
  if (typeof slug !== 'string') return false;
  return slug.length > 0 && slug.length <= 100 && SAFE_SLUG_RE.test(slug);
};
