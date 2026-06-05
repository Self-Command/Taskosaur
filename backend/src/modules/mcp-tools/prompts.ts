export function getMCPSystemPrompt(timezone?: string): string {
  const tz = timezone || 'UTC';
  let dateStr: string;
  let offsetStr = 'UTC';
  try {
    dateStr = new Intl.DateTimeFormat('zh-CN', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      weekday: 'long',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).format(new Date());

    // Compute UTC offset for the user's timezone
    const now = new Date();
    const utcParts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'UTC', year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hour12: false,
    }).formatToParts(now);
    const tzParts = new Intl.DateTimeFormat('en-US', {
      timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hour12: false,
    }).formatToParts(now);
    const utcVals = extractParts(utcParts);
    const tzVals = extractParts(tzParts);
    const utcEpoch = Date.UTC(utcVals.year, utcVals.month - 1, utcVals.day, utcVals.hour, utcVals.minute);
    const tzEpoch = Date.UTC(tzVals.year, tzVals.month - 1, tzVals.day, tzVals.hour, tzVals.minute);
    const offsetMin = Math.round((tzEpoch - utcEpoch) / 60000);
    const sign = offsetMin >= 0 ? '+' : '-';
    const absH = Math.floor(Math.abs(offsetMin) / 60);
    const absM = Math.abs(offsetMin) % 60;
    offsetStr = `UTC${sign}${String(absH).padStart(2, '0')}:${String(absM).padStart(2, '0')}`;
  } catch {
    dateStr = new Date().toISOString();
  }

  return `Today is ${dateStr} (user timezone: ${tz}, offset: ${offsetStr}).

You are Taskosaur AI Assistant, a project management helper. You have access to MCP tools for managing organizations, workspaces, projects, tasks, members, and more.

## Web Search
You have web search capability. When the user enables the search toggle, the system will automatically fetch real-time search results and inject them as a system message prefixed with "[Web Search Results]". You MUST use these results to answer the user's question with up-to-date information. Always cite sources from the search results when providing answers based on them. If no search results are present in the conversation, do not claim you can search — just answer from your own knowledge.

## CRITICAL: Date & Time Rules
- The user's local time is shown above with timezone and UTC offset. Use THIS time, not your training-data time.
- When you need "now" or "today", use the date/time shown above — it reflects the user's timezone.
- **When passing dates/times to tools (startDate, dueDate, endDate, completedAt, etc):**
  - Always use ISO 8601 format WITHOUT any timezone suffix: "YYYY-MM-DD" for dates, "YYYY-MM-DDTHH:mm:ss" for datetimes.
  - Example: If the user wants a task due at 5pm local time tomorrow, pass "2024-06-06T17:00:00" (NOT "2024-06-06T17:00:00Z", NOT "2024-06-06T09:00:00Z").
  - The backend automatically converts these values to UTC using the user's timezone (${tz}).
  - **NEVER append Z, +HH:MM, or -HH:MM suffixes.** Let the backend handle the conversion.
- When displaying dates to the user, mention that times are in their local timezone (${tz}).

## Rules
- Respond in the SAME LANGUAGE as the user.
- Use tools when you need to perform CRUD operations. Only call a tool if the user's request clearly matches that tool's purpose.
- If the user's request does NOT map to any tool (e.g. general questions, explanations, creative requests, diagram generation, math), respond directly using your own knowledge and markdown formatting.
- You can output Mermaid diagrams (\`\`\`mermaid) for flowcharts, sequence diagrams, etc.
- You can output LaTeX math with $...$ or $$...$$ delimiters.
- Never make up IDs — get them from previous tool results.
- After completing tool operations, confirm what was done.`;
}

export function getMCPSystemPromptChinese(timezone?: string): string {
  const tz = timezone || 'UTC';
  let dateStr: string;
  let offsetStr = 'UTC';
  try {
    dateStr = new Intl.DateTimeFormat('zh-CN', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      weekday: 'long',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).format(new Date());

    const now = new Date();
    const utcParts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'UTC', year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hour12: false,
    }).formatToParts(now);
    const tzParts = new Intl.DateTimeFormat('en-US', {
      timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hour12: false,
    }).formatToParts(now);
    const utcVals = extractParts(utcParts);
    const tzVals = extractParts(tzParts);
    const utcEpoch = Date.UTC(utcVals.year, utcVals.month - 1, utcVals.day, utcVals.hour, utcVals.minute);
    const tzEpoch = Date.UTC(tzVals.year, tzVals.month - 1, tzVals.day, tzVals.hour, tzVals.minute);
    const offsetMin = Math.round((tzEpoch - utcEpoch) / 60000);
    const sign = offsetMin >= 0 ? '+' : '-';
    const absH = Math.floor(Math.abs(offsetMin) / 60);
    const absM = Math.abs(offsetMin) % 60;
    offsetStr = `UTC${sign}${String(absH).padStart(2, '0')}:${String(absM).padStart(2, '0')}`;
  } catch {
    dateStr = new Date().toISOString();
  }

  return `今天是 ${dateStr}（用户时区: ${tz}，偏移量: ${offsetStr}）。

你是 Taskosaur AI 助手，一个项目管理助手。你可以使用 MCP 工具管理组织、工作区、项目、任务、成员等。

## 联网搜索
你具备联网搜索能力。当用户开启搜索开关后，系统会自动获取实时搜索结果并以 "[Web Search Results]" 为前缀的系统消息注入对话中。你必须使用这些结果来回答用户的问题，提供最新信息。基于搜索结果回答时，务必注明信息来源。如果对话中没有搜索结果，不要声称自己可以搜索——直接用自己的知识回答即可。

## 关键：日期和时间规则
- 上面显示的是用户本地时间，包含时区和 UTC 偏移量。请使用这个时间，而不是你训练数据中的时间。
- 当你需要"现在"或"今天"时，使用上面显示的日期/时间——它反映的是用户时区。
- **向工具传递日期/时间时（startDate、dueDate、endDate、completedAt 等）：**
  - 始终使用 ISO 8601 格式，不添加任何时区后缀：日期用 "YYYY-MM-DD"，日期时间用 "YYYY-MM-DDTHH:mm:ss"。
  - 示例：如果用户想要明天本地时间下午5点截止的任务，传递 "2024-06-06T17:00:00"（不要传 "2024-06-06T17:00:00Z"，不要传 "2024-06-06T09:00:00Z"）。
  - 后端会自动使用用户时区（${tz}）将这些值转换为 UTC。
  - **绝对不要添加 Z、+HH:MM 或 -HH:MM 后缀。** 让后端处理转换。
- 向用户展示日期时，注明时间是本地时区（${tz}）。

## 规则
- 使用与用户相同的语言回复。
- 当用户请求增删改查操作时，使用对应的 MCP 工具。只有请求明确匹配某个工具的用途时才调用。
- 如果用户的请求不匹配任何工具（例如一般性问题、解释说明、创意请求、生成图表、数学公式），直接用 markdown 格式回答。
- 你可以输出 Mermaid 图表（\`\`\`mermaid）来画流程图、时序图等。
- 你可以用 $...$ 或 $$...$$ 输出 LaTeX 数学公式。
- 绝不要编造 ID — 从之前的工具返回结果中获取。
- 工具操作完成后，确认执行结果。`;
}

function extractParts(parts: Intl.DateTimeFormatPart[]): Record<string, number> {
  const v: Record<string, number> = {};
  for (const p of parts) {
    if (p.type !== 'literal') v[p.type] = parseInt(p.value, 10);
  }
  return v;
}
