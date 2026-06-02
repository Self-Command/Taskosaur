export function formatDateForApi(dateValue: string): string | null {
  if (!dateValue) return null;

  // datetime-local format: YYYY-MM-DDTHH:MM or YYYY-MM-DDTHH:MM:SS
  if (dateValue.includes('T')) {
    const date = new Date(dateValue);
    if (isNaN(date.getTime())) return null;
    return date.toISOString();
  }

  // Date-only: YYYY-MM-DD — create at UTC midnight to prevent timezone shifts
  const [year, month, day] = dateValue.split('-');
  const date = new Date(Date.UTC(parseInt(year), parseInt(month) - 1, parseInt(day)));
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
