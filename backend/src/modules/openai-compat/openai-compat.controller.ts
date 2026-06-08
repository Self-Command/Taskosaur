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
 * These markers (### 🔧, ✅/❌, JSON code blocks) are sent to ChatBox for UX
 * but must be stripped before sending conversation history back to the AI.
 * Otherwise the AI imitates them instead of calling real tools.
 *
 * NOTE: Since the OpenAI compat endpoint now uses DB-persisted conversation history
 * (not ChatBox's flattened text), this is primarily used to clean up any residual
 * content that ChatBox sends back in its own history messages.
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

/**
 * Extract a human-readable one-line summary from a tool execution result.
 * ChatBox users see this instead of raw JSON blocks — no structured data
 * that could cause the AI to imitate tool calls.
 */
function toolResultSummary(toolName: string, result: any): string {
  if (!result) return '完成';
  if (result.message) return result.message;
  if (result.success === false) return '失败: ' + (result.error || '未知错误');
  // Create operations
  if (result.task) {
    const id = result.task.slug || result.task.title || '';
    return `任务已创建: ${id}`;
  }
  if (result.project) {
    const id = result.project.name || result.project.slug || '';
    return `项目已创建: ${id}`;
  }
  if (result.workspace) {
    const id = result.workspace.name || '';
    return `工作区已创建: ${id}`;
  }
  // Update operations
  if (toolName === 'update_task' && result.task) return '任务已更新';
  if (toolName === 'update_project') return '项目已更新';
  // Delete operations
  if (toolName === 'delete_task') return '任务已删除';
  if (toolName === 'delete_project') return '项目已删除';
  // List / query operations
  if (result.count !== undefined && result.total !== undefined) {
    return `查询到 ${result.total} 条记录`;
  }
  if (result.count !== undefined) return `共 ${result.count} 项`;
  // Navigation
  if (result.path) return `导航: ${result.path}`;
  // Fallback: brief generic success
  if (result.success) return '完成';
  return '完成';
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

      // ── Auth ──
      const authHeader = req.headers.authorization || '';
      const apiKey = authHeader.replace('Bearer ', '').trim();
      if (!apiKey) return res.status(401).json({ error: { message: 'Missing API key' } });

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

      // ── Resolve config ──
      const config = await (this.aiChatService as any).resolveChatConfig(userId);
      const tools = this.mcpToolsService.getOpenAITools();
      const chatId = 'chatcmpl-' + Date.now();
      this.mcpLogger.setTraceId(chatId);
      const created = Math.floor(Date.now() / 1000);

      // ── Find or create DB conversation for cross-request context ──
      const conversation = await this.aiChatService.findOrCreateOpenAICompatConversation(userId);

      // ── Load structured history from DB (with proper tool_calls + tool messages) ──
      const dbHistory = await this.aiChatService.loadHistoryMessages(conversation.id);

      // ── Build AI messages ──
      // Strategy: we IGNORE ChatBox's flattened user/assistant history (unreliable —
      // tool results were flattened to text and stripped of structured data).
      // Instead we reconstruct context from DB, and only take the LAST user message
      // from ChatBox as the new input.
      const allMsgs: any[] = [];

      // 1. Full system prompt (same as sidebar AI)
      allMsgs.push({ role: 'system', content: await this.promptBuilder.build(userId) });

      // 2. Preserve caller system messages that aren't ChatBox tool descriptions
      const callerSystemMsgs = (messages || []).filter((m: any) => {
        return (
          m.role === 'system' &&
          !/web_search|parse_link|function call|tool.*call|available functions/i.test(
            m.content || '',
          )
        );
      });
      for (const sm of callerSystemMsgs) allMsgs.push(sm);

      // 3. Time context
      allMsgs.push({
        role: 'system',
        content: `Today is ${new Intl.DateTimeFormat('zh-CN', { timeZone: tz, dateStyle: 'full', timeStyle: 'short' }).format(new Date())} (${tz}). Current user ID: ${userId}.`,
      });

      // 4. Page context from request
      if (body.organizationId || body.workspaceId || body.projectId) {
        const ctxParts: string[] = [];
        if (body.organizationId) ctxParts.push('organizationId: ' + body.organizationId);
        if (body.workspaceId) ctxParts.push('workspaceId: ' + body.workspaceId);
        if (body.projectId) ctxParts.push('projectId: ' + body.projectId);
        allMsgs.push({ role: 'system', content: '[Current page: ' + ctxParts.join(', ') + ']' });
      }

      // 5. DB-reconstructed history (structured tool_calls + tool messages)
      for (const h of dbHistory) allMsgs.push(h);

      // 6. Only the LAST user message from ChatBox (ignore all previous flattened history)
      const lastUserMsg = [...(messages || [])].reverse().find((m: any) => m.role === 'user');
      const userContent = lastUserMsg
        ? typeof lastUserMsg.content === 'string'
          ? lastUserMsg.content
          : JSON.stringify(lastUserMsg.content)
        : '';
      if (userContent) {
        allMsgs.push({ role: 'user', content: userContent });
      }

      // ── SSE emit helpers ──
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

        // ── Web search detection ──
        const clientTools = body.tools || [];
        const hasWebSearch = clientTools.some((t: any) => {
          return (
            (t && t.function && t.function.name === 'web_search') || (t && t.type === 'web_search')
          );
        });
        const isSearchQuery =
          hasWebSearch && !/^(列出|创建|删除|更新|修改|查看|给我|帮我|显示|打开)/.test(userContent);
        const doSearch = !!(body.enableWebSearch || body.enable_web_search || isSearchQuery);

        // ── Non-blocking background search ──
        if (doSearch) {
          emitText('\n\n🔍 搜索: ' + userContent.slice(0, 40) + '\n');
          self.webSearchService
            .search(userContent, userId)
            .then((results: any) => {
              if (results && results.length > 0) {
                let tbl = '| # | 来源 |\n|---|------|\n';
                for (let i = 0; i < results.length; i++) {
                  tbl +=
                    '| ' + (i + 1) + ' | [' + results[i].title + '](' + results[i].url + ') |\n';
                }
                (allMsgs as any)._searchMsg = {
                  role: 'system',
                  content: self.webSearchService.formatSystemMessage(results),
                };
                (allMsgs as any)._searchTable = tbl;
                (allMsgs as any)._searchReady = true;
              }
            })
            .catch(() => {});
        }

        // ── Tool execution loop ──
        // Structured tool_calls + tool messages are pushed into allMsgs for AI context.
        // ChatBox only sees human-readable summaries (no JSON blocks).
        const toolExecutions: Array<{ tool: string; params: any; result: any }> = [];
        let finalResponseText = '';

        try {
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
                  tools: tools.length > 0 ? tools : undefined,
                  stream: true,
                  max_completion_tokens: 2000,
                }),
              },
              FETCH_TIMEOUT_MS,
            );

            if (!apiRes.ok) {
              const errText = await apiRes.text().catch(() => '');
              this.logger.error('AI API ' + apiRes.status + ': ' + errText.slice(0, 200));
              emitText('\nAPI error ' + apiRes.status + '.\n');
              emitDone();
              break;
            }

            // ── Parse SSE stream ──
            const reader = apiRes.body.getReader();
            const decoder = new TextDecoder();
            let buf = '';
            let fullContent = '';
            let fullReasoning = '';
            let hasToolCalls = false;
            const toolAcc: Map<number, { id: string; name: string; args: string }> = new Map();
            let lastDataTime = Date.now();
            const hbTimer = setInterval(() => {
              if (Date.now() - lastDataTime >= 10000) {
                emitText('\n'); // keepalive
              }
            }, 10000);

            while (true) {
              const chunk = await this.readStreamChunk(reader);
              if (chunk.done) break;
              buf += decoder.decode(chunk.value, { stream: true });
              const lines = buf.split('\n');
              buf = lines.pop() || '';

              for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed || !trimmed.startsWith('data: ')) continue;
                const json = trimmed.slice(6);
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
                    emitText(delta.reasoning_content);
                    lastDataTime = Date.now();
                  }
                  if (delta.tool_calls) {
                    hasToolCalls = true;
                    for (const tc of delta.tool_calls) {
                      const idx = tc.index != null ? tc.index : 0;
                      if (!toolAcc.has(idx)) toolAcc.set(idx, { id: '', name: '', args: '' });
                      const a = toolAcc.get(idx)!;
                      if (tc.id) a.id = tc.id;
                      if (tc.function && tc.function.name) a.name += tc.function.name;
                      if (tc.function && tc.function.arguments) a.args += tc.function.arguments;
                    }
                  }
                } catch {}
              }
            }
            clearInterval(hbTimer);

            // ── No tool calls → LLM gave final answer ──
            if (!hasToolCalls) {
              finalResponseText = fullContent || '';
              // Hallucination guard: detect AI confirming mutations without calling tools
              const mutationPattern =
                /(已(创建|更新|删除|修改|添加|移除)|created|updated|deleted|modified|added|removed)/i;
              const writeIntentPattern =
                /(创建|更新|删除|修改|添加|移除|create|update|delete|modify|add|remove)/i;
              const hasWriteIntent = writeIntentPattern.test(
                typeof userContent === 'string' ? userContent : '',
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
            for (const tc of tcList) {
              const toolName = tc.name;
              if (!toolName) continue;

              emitText('\n\n### 🔧 ' + toolName.replace(/_/g, ' ') + '\n');

              try {
                const params = JSON.parse(tc.args || '{}');
                const result = await self.toolPipeline.execute(
                  toolName,
                  params,
                  userId,
                  () => self.mcpToolsService.executeTool(toolName, params, userId),
                  chatId,
                );

                // Emit human-readable summary — NO JSON blocks
                emitText('✅ ' + toolResultSummary(toolName, result) + '\n');

                if (toolName === 'navigate' && result && result.path) {
                  emitText('🔗 [打开页面](' + result.path + ')\n');
                }

                toolExecutions.push({ tool: toolName, params, result });

                // Push structured messages for AI context (this is the fix):
                // assistant with tool_calls + tool role message with full JSON result
                const assistantMsg: any = {
                  role: 'assistant',
                  tool_calls: [
                    {
                      id: tc.id,
                      type: 'function',
                      function: { name: toolName, arguments: tc.args },
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
                emitText('❌ ' + (err.message || String(err)) + '\n');
                const errAssistantMsg: any = {
                  role: 'assistant',
                  tool_calls: [
                    {
                      id: tc.id,
                      type: 'function',
                      function: { name: toolName, arguments: tc.args },
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

          // ── Persist conversation to DB for cross-request context ──
          // Fire-and-forget — don't block the SSE response
          if (userContent) {
            const cleanText =
              finalResponseText || toolExecutions.map((te) => te.tool).join(', ') + ' completed.';
            this.aiChatService
              .saveOpenAICompatRound(conversation.id, userContent, cleanText, toolExecutions)
              .catch((dbErr: any) =>
                this.logger.error('Failed to save OpenAI compat round: ' + dbErr.message),
              );
          }

          res.write('data: [DONE]\n\n');
        } catch (err: any) {
          emitText('Error: ' + (err.message || String(err)));
          emitDone();
          res.write('data: [DONE]\n\n');
        }
        res.end();
      } else {
        // ── Non-streaming path ──
        // Same architectural approach: ignore ChatBox history, use DB+current user message
        const result = await this.processNonStreaming(allMsgs, tools, userId, config);

        // Persist round
        if (userContent) {
          this.aiChatService
            .saveOpenAICompatRound(conversation.id, userContent, result, undefined)
            .catch((dbErr: any) =>
              this.logger.error('Failed to save OpenAI compat round: ' + dbErr.message),
            );
        }

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
