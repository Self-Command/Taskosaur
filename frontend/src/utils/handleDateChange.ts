export function formatDateForApi(dateValue: string, opts?: { endOfDay?: boolean }): string | null {
  if (!dateValue) return null;

  if (dateValue.includes('T')) {
    const date = new Date(dateValue);
    if (isNaN(date.getTime())) return null;
    return date.toISOString();
  }

  const [year, month, day] = dateValue.split('-');
  const y = parseInt(year), m = parseInt(month) - 1, d = parseInt(day);
  const date = opts?.endOfDay
    ? new Date(Date.UTC(y, m, d, 23, 59, 59))
    : new Date(Date.UTC(y, m, d, 0, 0, 0));
  if (isNaN(date.getTime())) return null;
  return date.toISOString();
}

export function getTodayDate(): string {
  const today = new Date();

  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const dd = String(today.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}
