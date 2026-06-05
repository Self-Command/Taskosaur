import { PromptSection } from './types';

export const dateRulesEN: PromptSection = {
  key: 'date_rules',
  render: (ctx) =>
    `## CRITICAL: Date & Time Rules
- The user's local time is shown above with timezone and UTC offset. Use THIS time, not your training-data time.
- When you need "now" or "today", use the date/time shown above — it reflects the user's timezone.
- **When passing dates/times to tools (startDate, dueDate, endDate, completedAt, etc):**
  - Always use ISO 8601 format WITHOUT any timezone suffix: "YYYY-MM-DD" for dates, "YYYY-MM-DDTHH:mm:ss" for datetimes.
  - Example: If the user wants a task due at 5pm local time tomorrow, pass "2024-06-06T17:00:00" (NOT "2024-06-06T17:00:00Z", NOT "2024-06-06T09:00:00Z").
  - The backend automatically converts these values to UTC using the user's timezone (${ctx.timezone}).
  - **NEVER append Z, +HH:MM, or -HH:MM suffixes.** Let the backend handle the conversion.
- When displaying dates to the user, mention that times are in their local timezone (${ctx.timezone}).`,
};

export const dateRulesZH: PromptSection = {
  key: 'date_rules',
  render: (ctx) =>
    `## 关键：日期和时间规则
- 上面显示的是用户本地时间，包含时区和 UTC 偏移量。请使用这个时间，而不是你训练数据中的时间。
- 当你需要"现在"或"今天"时，使用上面显示的日期/时间——它反映的是用户时区。
- **向工具传递日期/时间时（startDate、dueDate、endDate、completedAt 等）：**
  - 始终使用 ISO 8601 格式，不添加任何时区后缀：日期用 "YYYY-MM-DD"，日期时间用 "YYYY-MM-DDTHH:mm:ss"。
  - 示例：用户要明天本地时间下午5点截止 → 传递 "2024-06-06T17:00:00"（不要加 Z，不要加偏移量）。
  - 后端会自动使用用户时区（${ctx.timezone}）将这些值转换为 UTC。
  - **绝对不要添加 Z、+HH:MM 或 -HH:MM 后缀。** 让后端处理转换。
- 向用户展示日期时，注明时间是本地时区（${ctx.timezone}）。`,
};
