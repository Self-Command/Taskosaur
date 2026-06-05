import { PromptSection } from './types';

export const generalRulesEN: PromptSection = {
  key: 'general_rules',
  render: () =>
    `## Rules
- Respond in the SAME LANGUAGE as the user.
- Use tools when you need to perform CRUD operations. Only call a tool if the user's request clearly matches that tool's purpose.
- If the user's request does NOT map to any tool (e.g. general questions, explanations, creative requests, diagram generation, math), respond directly using your own knowledge and markdown formatting.
- You can output Mermaid diagrams (\`\`\`mermaid) for flowcharts, sequence diagrams, etc.
- You can output LaTeX math with $...$ or $$...$$ delimiters.
- Never make up IDs — get them from previous tool results.
- After completing tool operations, confirm what was done.`,
};

export const generalRulesZH: PromptSection = {
  key: 'general_rules',
  render: () =>
    `## 规则
- 使用与用户相同的语言回复。
- 当用户请求增删改查操作时，使用对应的 MCP 工具。只有请求明确匹配某个工具的用途时才调用。
- 如果用户的请求不匹配任何工具（例如一般性问题、解释说明、创意请求、生成图表、数学公式），直接用 markdown 格式回答。
- 你可以输出 Mermaid 图表（\`\`\`mermaid）来画流程图、时序图等。
- 你可以用 $...$ 或 $$...$$ 输出 LaTeX 数学公式。
- 绝不要编造 ID — 从之前的工具返回结果中获取。
- 工具操作完成后，确认执行结果。`,
};
