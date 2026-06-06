import { Controller, Get, Post, Body, Req, Res, Logger } from '@nestjs/common';
import { Request, Response } from 'express';
import { Public } from '../auth/decorators/public.decorator';
import { AiChatService } from '../ai-chat/ai-chat.service';
import { McpToolsService } from '../mcp-tools/mcp-tools.service';
import { ToolExecutionPipeline } from '../mcp-tools/pipeline/tool-execution-pipeline';
import { McpLoggerService } from '../mcp-tools/mcp-logger.service';
import { PrismaService } from '../../prisma/prisma.service';
import { WebSearchService } from '../ai-chat/services/web-search.service';
import { PromptBuilder } from '../prompt/prompt-builder.service';

const FETCH_TIMEOUT_MS = 300000;

/**
 * Remove tool execution debug markers from assistant content.
 * These markers (### 🔧, ✅/❌, JSON code blocks) are sent to Chatbox for UX
 * but must be stripped before sending conversation history back to the AI.
 * Otherwise the AI imitates them instead of calling real tools.
 */
function sanitizeAssistantContent(content: string): string {
  if (!content) return content;
  return (
    content
      // Remove tool execution header: "\n\n---\n### 🔧 ..." or "\n\n---\n### 🔧 执行 N 个工具\n"
      .replace(/\n*---\n### 🔧[^\n]*\n/g, '\n')
      // Remove progress line: "🔄 tool_name...\n"
      .replace(/\n🔄 [^\n]+\n/g, '\n')
      // Remove result block: "✅/❌ tool_name\n```json\n...\n```\n"
      .replace(/\n[✅❌] [^\n]+\n```(?:json\b[^\n]*\n)?[\s\S]*?\n```\n?/g, '\n')
      // Remove navigate link: "🔗 [打开页面](...)\n"
      .replace(/\n🔗 \[打开页面\]\([^)]+\)\n?/g, '\n')
      // Collapse multiple blank lines
      .replace(/\n{3,}/g, '\n\n')
      .trim()
  );
}

@Controller('v1')
export class OpenAICompatController {
  private readonly logger = new Logger(OpenAICompatController.name);

  constructor(
    private readonly aiChatService: AiChatService,
    private readonly mcpToolsService: McpToolsService,
    private readonly toolPipeline: ToolExecutionPipeline,
    private readonly mcpLogger: McpLoggerService,
    private readonly prisma: PrismaService,
    private readonly webSearchService: WebSearchService,
    private readonly promptBuilder: PromptBuilder,
  ) {}

  @Public()
  @Get('models')
  models(@Req() req: Request) {
    this.logger.log(`[models] ${req.ip}`);
    return {
      object: 'list',
      data: [{ id: 'taskosaur', object: 'model', created: Date.now(), owned_by: 'taskosaur' }],
    };
  }

  @Public()
  @Post('chat/completions')
  async chatCompletions(@Body() body: any, @Req() req: Request, @Res() res: Response) {
    try {
      const { messages, stream } = body;

      const authHeader = req.headers.authorization || '';
      const apiKey = authHeader.replace('Bearer ', '').trim();
      if (!apiKey) return res.status(401).json({ error: { message: 'Missing API key' } });

      // 用 API Key 查 settings 表找到 userId
      const setting = await this.prisma.settings.findFirst({
        where: { key: 'user_api_key', value: apiKey },
        select: { userId: true },
      });
      const userId = setting?.userId;
      if (!userId)
        return res
          .status(401)
          .json({ error: { message: 'Invalid API key. Get your key from Settings page.' } });

      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      if (!user) return res.status(401).json({ error: { message: 'User not found' } });

      const tz = (user as any).timezone || 'UTC';
      const ctxMsg = {
        role: 'system',
        content: `Today is ${new Intl.DateTimeFormat('zh-CN', { timeZone: tz, dateStyle: 'full', timeStyle: 'short' }).format(new Date())} (${tz}). Current user ID: ${userId}.`,
      };
      // Preserve caller's system messages — they contain project context; just prepend timezone
      const allMessages = [
        ctxMsg,
        ...messages.filter((m: any) => m.role === 'system'),
        ...messages
          .filter((m: any) => m.role !== 'system')
          .map((m: any) => {
            if (m.role === 'assistant' && typeof m.content === 'string') {
              return { ...m, content: sanitizeAssistantContent(m.content) };
            }
            return m;
          }),
      ];

      const config = await (this.aiChatService as any).resolveChatConfig(userId);
      const tools = this.mcpToolsService.getOpenAITools();
      const chatId = 'chatcmpl-' + Date.now();
      this.mcpLogger.setTraceId(chatId);
      const created = Math.floor(Date.now() / 1000);

      const emitText = (text: string) => {
        res.write(
          `data: ${JSON.stringify({
            id: chatId,
            object: 'chat.completion.chunk',
            created,
            model: 'taskosaur',
            choices: [{ index: 0, delta: { content: text }, finish_reason: null }],
          })}\n\n`,
        );
      };
      const emitDone = () => {
        res.write(
          `data: ${JSON.stringify({
            id: chatId,
            object: 'chat.completion.chunk',
            created,
            model: 'taskosaur',
            choices: [{ index: 0, delta: {}, finish_reason: 'stop' }],
          })}\n\n`,
        );
      };

      if (stream) {
        const self = this;
        res.status(200);
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache, no-transform');
        res.setHeader('Connection', 'keep-alive');
        res.flushHeaders();

        // ── Build full system prompt (like sidebar AI) ──
        const allMsgs: any[] = [];
        allMsgs.push({ role: 'system', content: await this.promptBuilder.build(userId) });
        // Preserve caller system messages — but filter out ChatBox tool descriptions
        // ChatBox injects web_search/parse_link tool instructions that conflict with our MCP tools
        const callerSystemMsgs = (body.messages || []).filter(function (m: any) {
          return (
            m.role === 'system' &&
            !/web_search|parse_link|function call|tool.*call|available functions/i.test(
              m.content || '',
            )
          );
        });
        for (let si = 0; si < callerSystemMsgs.length; si++) allMsgs.push(callerSystemMsgs[si]);
        // Add time context
        allMsgs.push({
          role: 'system',
          content:
            'Today is ' +
            new Intl.DateTimeFormat('zh-CN', {
              timeZone: tz,
              dateStyle: 'full',
              timeStyle: 'short',
            }).format(new Date()) +
            ' (' +
            tz +
            '). Current user ID: ' +
            userId +
            '.',
        });
        // Page context from request
        if (body.organizationId || body.workspaceId || body.projectId) {
          const ctxParts: string[] = [];
          if (body.organizationId) ctxParts.push('organizationId: ' + body.organizationId);
          if (body.workspaceId) ctxParts.push('workspaceId: ' + body.workspaceId);
          if (body.projectId) ctxParts.push('projectId: ' + body.projectId);
          allMsgs.push({ role: 'system', content: '[Current page: ' + ctxParts.join(', ') + ']' });
        }
        // User + assistant messages — sanitize tool debug markers from history
        // so AI doesn't imitate them in subsequent rounds
        const convMsgs = (body.messages || []).filter(function (m: any) {
          return m.role !== 'system';
        });
        for (let ci = 0; ci < convMsgs.length; ci++) {
          const m = convMsgs[ci];
          if (m.role === 'assistant' && typeof m.content === 'string') {
            m.content = sanitizeAssistantContent(m.content);
          }
          allMsgs.push(m);
        }

        // ── Web search detection ──
        const clientTools = body.tools || [];
        const hasWebSearch = clientTools.some(function (t: any) {
          return (
            (t && t.function && t.function.name === 'web_search') || (t && t.type === 'web_search')
          );
        });
        const userMsg = (body.messages || [])
          .filter(function (m: any) {
            return m.role === 'user';
          })
          .pop();
        let userText = userMsg && typeof userMsg.content === 'string' ? userMsg.content : '';
        if (!userText && userMsg && userMsg.content) userText = JSON.stringify(userMsg.content);
        const isSearchQuery =
          hasWebSearch && !/^(列出|创建|删除|更新|修改|查看|给我|帮我|显示|打开)/.test(userText);
        const doSearch = !!(body.enableWebSearch || body.enable_web_search || isSearchQuery);

        // ── Non-blocking background search ──
        if (doSearch) {
          emitText('\n\n🔍 搜索: ' + userText.slice(0, 40) + '\n');
          self.webSearchService
            .search(userText, userId)
            .then(function (results: any) {
              if (results && results.length > 0) {
                let tbl = '| # | 来源 |\n|---|------|\n';
                results.forEach(function (r: any, i: number) {
                  tbl += '| ' + (i + 1) + ' | [' + r.title + '](' + r.url + ') |\n';
                });
                (allMsgs as any)._searchMsg = {
                  role: 'system',
                  content: self.webSearchService.formatSystemMessage(results),
                };
                (allMsgs as any)._searchTable = tbl;
                (allMsgs as any)._searchReady = true;
              }
            })
            .catch(function () {});
        }

        // ── Tool execution pipeline (shared with sidebar AI) ──
        const toolExecutions: any[] = [];

        try {
          const allMsgsTools = tools; // outer scope tools
          for (let round = 0; round < 10; round++) {
            // Inject search results between rounds
            if ((allMsgs as any)._searchReady) {
              emitText((allMsgs as any)._searchTable + '\n');
              allMsgs.push((allMsgs as any)._searchMsg);
              delete (allMsgs as any)._searchReady;
              delete (allMsgs as any)._searchTable;
              delete (allMsgs as any)._searchMsg;
            }

            const apiRes: any = await this.fetchWithTimeout(
              config.apiUrl + '/chat/completions',
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: 'Bearer ' + config.apiKey,
                },
                body: JSON.stringify({
                  model: config.model,
                  messages: allMsgs,
                  tools: allMsgsTools.length > 0 ? allMsgsTools : undefined,
                  stream: true,
                  max_completion_tokens: 2000,
                }),
              },
              FETCH_TIMEOUT_MS,
            );

            if (!apiRes.ok) {
              const errText = await apiRes.text().catch(function () {
                return '';
              });
              this.logger.error('AI API ' + apiRes.status + ': ' + errText.slice(0, 200));
              emitText('\nAPI error ' + apiRes.status + '.\n');
              emitDone();
              break;
            }

            // ── Parse SSE stream with heartbeat ──
            const reader = apiRes.body.getReader();
            const decoder = new TextDecoder();
            let buf = '';
            let fullContent = '';
            let fullReasoning = '';
            let hasToolCalls = false;
            const toolAcc: any = new Map();
            var lastDataTime = Date.now();
            const hbTimer = setInterval(function () {
              if (Date.now() - lastDataTime >= 10000) {
                emitText('\n'); // keepalive newline
              }
            }, 10000);

            while (true) {
              const chunk = await this.readStreamChunk(reader);
              if (chunk.done) break;
              buf += decoder.decode(chunk.value, { stream: true });
              const lines = buf.split('\n');
              buf = lines.pop() || '';

              for (let li = 0; li < lines.length; li++) {
                const line = lines[li].trim();
                if (!line || !line.startsWith('data: ')) continue;
                const json = line.slice(6);
                if (json === '[DONE]') break;
                try {
                  const parsed = JSON.parse(json);
                  const delta =
                    parsed && parsed.choices && parsed.choices[0] && parsed.choices[0].delta;
                  if (!delta) continue;
                  if (delta.content) {
                    fullContent += delta.content;
                    emitText(delta.content);
                    lastDataTime = Date.now();
                  }
                  if (delta.reasoning_content) {
                    fullReasoning += delta.reasoning_content;
                    emitText(delta.reasoning_content); // emit as text
                    lastDataTime = Date.now();
                  }
                  if (delta.tool_calls) {
                    hasToolCalls = true;
                    for (let ti = 0; ti < delta.tool_calls.length; ti++) {
                      var tc = delta.tool_calls[ti];
                      const idx = tc.index != null ? tc.index : 0;
                      if (!toolAcc.has(idx)) toolAcc.set(idx, { id: '', name: '', args: '' });
                      const a = toolAcc.get(idx);
                      if (tc.id) a.id = tc.id;
                      if (tc.function && tc.function.name) a.name += tc.function.name;
                      if (tc.function && tc.function.arguments) a.args += tc.function.arguments;
                    }
                  }
                } catch (e) {}
              }
            }
            clearInterval(hbTimer);

            // ── No tool calls → LLM gave final answer ──
            if (!hasToolCalls) {
              // Hallucination guard: detect AI confirming mutations without calling tools
              const mutationPattern =
                /(已(创建|更新|删除|修改|添加|移除)|created|updated|deleted|modified|added|removed)/i;
              const writeIntentPattern =
                /(创建|更新|删除|修改|添加|移除|create|update|delete|modify|add|remove)/i;
              const lastUserMsg = [...(body.messages || [])]
                .reverse()
                .find((m: any) => m.role === 'user');
              const hasWriteIntent =
                lastUserMsg &&
                writeIntentPattern.test(
                  typeof lastUserMsg.content === 'string' ? lastUserMsg.content : '',
                );
              if (
                mutationPattern.test(fullContent) &&
                hasWriteIntent &&
                toolExecutions.length === 0 &&
                round < 2
              ) {
                this.mcpLogger.logToolCall('_guard_retry', userId, {
                  reason: 'mutation confirmation without tool call detected',
                });
                allMsgs.push({
                  role: 'system',
                  content:
                    'CRITICAL: You confirmed a data change but did NOT call any MCP tool. You MUST call the appropriate tool (e.g. update_task, create_task, delete_task) to actually perform the change. Do NOT just say you did it — execute the tool first, then confirm based on the result.',
                });
                continue;
              }
              emitDone();
              break;
            }

            // ── Execute tools through pipeline ──
            const tcList = Array.from(toolAcc.values());
            if (tcList.length > 1) emitText('\n\n---\n### 🔧 执行 ' + tcList.length + ' 个工具\n');
            for (let tci = 0; tci < tcList.length; tci++) {
              var tc: any = tcList[tci];
              const toolName = tc.name.replace(/_/g, ' ');
              if (tcList.length > 1) emitText('\n🔄 ' + toolName + '...\n');
              else emitText('\n\n---\n### 🔧 ' + toolName + '\n');

              try {
                const params = JSON.parse(tc.args || '{}');
                const result = await self.toolPipeline.execute(
                  tc.name,
                  params,
                  userId,
                  () => self.mcpToolsService.executeTool(tc.name, params, userId),
                  chatId,
                );
                const ok = result && result.success !== false;
                let resultStr = JSON.stringify(result, null, 2);
                if (resultStr.length > 2000) resultStr = resultStr.slice(0, 2000) + '\n...';
                emitText(
                  (ok ? '✅' : '❌') + ' ' + toolName + '\n\`\`\`json\n' + resultStr + '\n\`\`\`\n',
                );

                if (tc.name === 'navigate' && result && result.path) {
                  emitText('🔗 [打开页面](' + result.path + ')\n');
                }

                toolExecutions.push({ tool: tc.name, params: params, result: result });

                const assistantMsg: any = {
                  role: 'assistant',
                  tool_calls: [
                    {
                      id: tc.id,
                      type: 'function',
                      function: { name: tc.name, arguments: tc.args },
                    },
                  ],
                };
                if (fullContent) assistantMsg.content = fullContent;
                if (fullReasoning) assistantMsg.reasoning_content = fullReasoning;
                allMsgs.push(assistantMsg);
                allMsgs.push({
                  role: 'tool',
                  content: JSON.stringify(result),
                  tool_call_id: tc.id,
                });
              } catch (err: any) {
                emitText(
                  '❌ ' + toolName + '\n\`\`\`\n' + (err.message || String(err)) + '\n\`\`\`\n',
                );
                const errAssistantMsg: any = {
                  role: 'assistant',
                  tool_calls: [
                    {
                      id: tc.id,
                      type: 'function',
                      function: { name: tc.name, arguments: tc.args },
                    },
                  ],
                };
                if (fullContent) errAssistantMsg.content = fullContent;
                if (fullReasoning) errAssistantMsg.reasoning_content = fullReasoning;
                allMsgs.push(errAssistantMsg);
                allMsgs.push({
                  role: 'tool',
                  content: JSON.stringify({ error: err.message || String(err) }),
                  tool_call_id: tc.id,
                });
              }
            }
          }

          res.write('data: [DONE]\n\n');
        } catch (err: any) {
          emitText('Error: ' + (err.message || String(err)));
          emitDone();
          res.write('data: [DONE]\n\n');
        }
        res.end();
      } else {
        // Non-streaming
        const result = await this.processNonStreaming(allMessages, tools, userId, config);
        return res.status(200).json({
          id: chatId,
          object: 'chat.completion',
          created,
          model: 'taskosaur',
          choices: [
            { index: 0, message: { role: 'assistant', content: result }, finish_reason: 'stop' },
          ],
          usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
        });
      }
    } catch (err: any) {
      return res.status(500).json({ error: { message: err.message } });
    }
  }

  private async processNonStreaming(
    messages: any[],
    tools: any[],
    userId: string,
    config: any,
  ): Promise<string> {
    const msgs = [...messages];
    for (let round = 0; round < 5; round++) {
      const apiRes = await fetch(`${config.apiUrl}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.apiKey}` },
        body: JSON.stringify({
          model: config.model,
          max_tokens: 4096,
          messages: msgs,
          tools: tools.length > 0 ? tools : undefined,
        }),
      });
      if (!apiRes.ok) return `API error: ${apiRes.status}`;
      const json = await apiRes.json();
      const msg = json.choices?.[0]?.message;
      if (!msg) return 'No response.';
      if (msg.tool_calls?.length > 0) {
        msgs.push(msg);
        for (const tc of msg.tool_calls) {
          try {
            const params = JSON.parse(tc.function.arguments || '{}');
            const result = await this.mcpToolsService.executeTool(tc.function.name, params, userId);
            msgs.push({ role: 'tool', content: JSON.stringify(result), tool_call_id: tc.id });
          } catch (err: any) {
            msgs.push({
              role: 'tool',
              content: JSON.stringify({ error: err.message }),
              tool_call_id: tc.id,
            });
          }
        }
        continue;
      }
      return msg.content || 'Done.';
    }
    return 'Max tool calls reached.';
  }

  private async fetchWithTimeout(url: string, options: any, timeoutMs: number): Promise<any> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(url, { ...options, signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }
  }

  private async readStreamChunk(
    reader: ReadableStreamDefaultReader<Uint8Array>,
  ): Promise<{ done: boolean; value?: Uint8Array }> {
    try {
      const result = await reader.read();
      return result;
    } catch (err: any) {
      this.logger.error(`Stream read error: ${err.message}`);
      return { done: true };
    }
  }
}
