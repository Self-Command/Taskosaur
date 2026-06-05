/**
 * Resolve an avatar path to a full URL.
 * - Absolute URLs (http/https) are returned as-is
 * - Paths starting with "/" are returned as-is (already absolute from domain root)
 * - Falsy values return null
 * - Otherwise, the path is treated as a filename and prefixed with API base URL + /uploads/
 */
export function resolveAvatarUrl(avatar?: string | null): string | null {
  if (!avatar) return null;
  if (/^https?:\/\//.test(avatar)) return avatar;
  if (avatar.startsWith("/")) return avatar;
  const base = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3000/api";
  return `${base}/uploads/${avatar}`;
}
