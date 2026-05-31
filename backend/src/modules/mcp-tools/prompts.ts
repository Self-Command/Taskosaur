export function getMCPSystemPrompt(timezone?: string): string {
  const tz = timezone || 'UTC';
  let dateStr: string;
  try {
    dateStr = new Intl.DateTimeFormat('zh-CN', {
      timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
      weekday: 'long', hour: '2-digit', minute: '2-digit', second: '2-digit',
    }).format(new Date());
  } catch { dateStr = new Date().toISOString(); }

  return `Today is ${dateStr} (user timezone: ${tz}).

You are Taskosaur AI Assistant, a project management helper. You have access to MCP tools for managing organizations, workspaces, projects, tasks, members, and more.

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
  try {
    dateStr = new Intl.DateTimeFormat('zh-CN', {
      timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
      weekday: 'long', hour: '2-digit', minute: '2-digit', second: '2-digit',
    }).format(new Date());
  } catch { dateStr = new Date().toISOString(); }

  return `今天是 ${dateStr}（用户时区: ${tz}）。

你是 Taskosaur AI 助手，一个项目管理助手。你可以使用 MCP 工具管理组织、工作区、项目、任务、成员等。

## 规则
- 使用与用户相同的语言回复。
- 当用户请求增删改查操作时，使用对应的 MCP 工具。只有请求明确匹配某个工具的用途时才调用。
- 如果用户的请求不匹配任何工具（例如一般性问题、解释说明、创意请求、生成图表、数学公式），直接用 markdown 格式回答。
- 你可以输出 Mermaid 图表（\`\`\`mermaid）来画流程图、时序图等。
- 你可以用 $...$ 或 $$...$$ 输出 LaTeX 数学公式。
- 绝不要编造 ID — 从之前的工具返回结果中获取。
- 工具操作完成后，确认执行结果。`;
}
