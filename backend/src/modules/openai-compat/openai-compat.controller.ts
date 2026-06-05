import { Controller, Get, Post, Body, Req, Res, Logger } from '@nestjs/common';
import { Request, Response } from 'express';
import { Public } from '../auth/decorators/public.decorator';
import { AiChatService } from '../ai-chat/ai-chat.service';
import { McpToolsService } from '../mcp-tools/mcp-tools.service';
import { PrismaService } from '../../prisma/prisma.service';
import { WebSearchService } from '../ai-chat/services/web-search.service';
import { getMCPSystemPrompt } from '../mcp-tools/prompts';

const FETCH_TIMEOUT_MS = 300000;

@Controller('v1')
export class OpenAICompatController {
  private readonly logger = new Logger(OpenAICompatController.name);

  constructor(
    private readonly aiChatService: AiChatService,
    private readonly mcpToolsService: McpToolsService,
    private readonly prisma: PrismaService,
    private readonly webSearchService: WebSearchService,
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
      const allMessages = [ctxMsg, ...messages.filter((m: any) => m.role === 'system'), ...messages.filter((m: any) => m.role !== 'system')];

      const config = await (this.aiChatService as any).resolveChatConfig(userId);
      const tools = this.mcpToolsService.getOpenAITools();
      const chatId = 'chatcmpl-' + Date.now();
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
        var self = this;
        res.status(200);
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache, no-transform');
        res.setHeader('Connection', 'keep-alive');
        res.flushHeaders();

        // ── Build full system prompt (like sidebar AI) ──
        var allMsgs: any[] = [];
        allMsgs.push({ role: 'system', content: getMCPSystemPrompt(tz) });
        // Preserve caller system messages
        var callerSystemMsgs = (body.messages || []).filter(function(m: any) { return m.role === 'system'; });
        for (var si = 0; si < callerSystemMsgs.length; si++) allMsgs.push(callerSystemMsgs[si]);
        // Add time context
        allMsgs.push({ role: 'system', content: 'Today is ' + new Intl.DateTimeFormat('zh-CN', { timeZone: tz, dateStyle: 'full', timeStyle: 'short' }).format(new Date()) + ' (' + tz + '). Current user ID: ' + userId + '.' });
        // Page context from request
        if (body.organizationId || body.workspaceId || body.projectId) {
          var ctxParts: string[] = [];
          if (body.organizationId) ctxParts.push('organizationId: ' + body.organizationId);
          if (body.workspaceId) ctxParts.push('workspaceId: ' + body.workspaceId);
          if (body.projectId) ctxParts.push('projectId: ' + body.projectId);
          allMsgs.push({ role: 'system', content: '[Current page: ' + ctxParts.join(', ') + ']' });
        }
        // User + assistant messages
        var convMsgs = (body.messages || []).filter(function(m: any) { return m.role !== 'system'; });
        for (var ci = 0; ci < convMsgs.length; ci++) allMsgs.push(convMsgs[ci]);

        // ── Web search detection ──
        var clientTools = (body.tools || []);
        var hasWebSearch = clientTools.some(function(t: any) { return (t && t.function && t.function.name === 'web_search') || (t && t.type === 'web_search'); });
        var userMsg = (body.messages || []).filter(function(m: any) { return m.role === 'user'; }).pop();
        var userText = (userMsg && typeof userMsg.content === 'string') ? userMsg.content : '';
        if (!userText && userMsg && (userMsg as any).content) userText = JSON.stringify((userMsg as any).content);
        var isSearchQuery = hasWebSearch && !/^(列出|创建|删除|更新|修改|查看|给我|帮我|显示|打开)/.test(userText);
        var doSearch = !!(body.enableWebSearch || body.enable_web_search || isSearchQuery);

        // ── Non-blocking background search ──
        if (doSearch) {
          emitText('\n\n🔍 搜索: ' + userText.slice(0, 40) + '\n');
          self.webSearchService.search(userText, userId).then(function(results: any) {
            if (results && results.length > 0) {
              var tbl = '| # | 来源 |\n|---|------|\n';
              results.forEach(function(r: any, i: number) { tbl += '| ' + (i+1) + ' | [' + r.title + '](' + r.url + ') |\n'; });
              (allMsgs as any)._searchMsg = { role: 'system', content: self.webSearchService.formatSystemMessage(results) };
              (allMsgs as any)._searchTable = tbl;
              (allMsgs as any)._searchReady = true;
            }
          }).catch(function() {});
        }

        // ── Inline guarded executor (like makeGuardedExecutor) ──
        var toolExecutions: any[] = [];
        var seenCalls = new Map<string, number>();
        var toolFailCount = new Map<string, number>();
        var blocked = false;
        var executeGuarded = async function(toolName: string, params: any, uid: string): Promise<any> {
          var isReadOnly = toolName.startsWith('list_') || toolName.startsWith('get_');
          if (isReadOnly) {
            var sk = JSON.stringify(params, Object.keys(params).sort());
            var key = toolName + '::' + sk;
            if (seenCalls.has(key)) {
              var times = (seenCalls.get(key) || 0) + 1;
              seenCalls.set(key, times);
              return { success: false, _guard: true, error: 'DUPLICATE BLOCKED: ' + toolName + ' already called ' + times + ' times with these exact params. You have the data — take ACTION.' };
            }
            seenCalls.set(key, 1);
          } else {
            seenCalls.clear();
          }
          // Fail-fast: same tool failed 2+ times this round → block
          var fc = toolFailCount.get(toolName) || 0;
          if (fc >= 2) {
            blocked = true;
            return { success: false, _guard: true, error: 'TOOL RETRY ABORTED: ' + toolName + ' already failed ' + fc + ' times. Do NOT retry. Use the error information and try a DIFFERENT approach.' };
          }
          var result = await self.mcpToolsService.executeTool(toolName, params, uid);
          if (result && result.success === false) {
            toolFailCount.set(toolName, fc + 1);
          }
          return result;
        };

        try {
          var allMsgsTools = tools; // outer scope tools
          for (var round = 0; round < 10; round++) {
            // Inject search results between rounds
            if ((allMsgs as any)._searchReady) {
              emitText((allMsgs as any)._searchTable + '\n');
              allMsgs.push((allMsgs as any)._searchMsg);
              delete (allMsgs as any)._searchReady;
              delete (allMsgs as any)._searchTable;
              delete (allMsgs as any)._searchMsg;
            }

            var apiRes: any = await this.fetchWithTimeout(
              config.apiUrl + '/chat/completions',
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + config.apiKey },
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
              var errText = await apiRes.text().catch(function() { return ''; });
              this.logger.error('AI API ' + apiRes.status + ': ' + errText.slice(0, 200));
              emitText('\nAPI error ' + apiRes.status + '.\n');
              emitDone();
              break;
            }

            // ── Parse SSE stream with heartbeat ──
            var reader = apiRes.body.getReader();
            var decoder = new TextDecoder();
            var buf = '';
            var fullContent = '';
            var fullReasoning = '';
            var hasToolCalls = false;
            var toolAcc: any = new Map();
            var lastDataTime = Date.now();
            var hbTimer = setInterval(function() {
              if (Date.now() - lastDataTime >= 10000) {
                emitText('\n'); // keepalive newline
              }
            }, 10000);

            while (true) {
              var chunk = await this.readStreamChunk(reader);
              if (chunk.done) break;
              buf += decoder.decode(chunk.value, { stream: true });
              var lines = buf.split('\n');
              buf = lines.pop() || '';

              for (var li = 0; li < lines.length; li++) {
                var line = lines[li].trim();
                if (!line || !line.startsWith('data: ')) continue;
                var json = line.slice(6);
                if (json === '[DONE]') break;
                try {
                  var parsed = JSON.parse(json);
                  var delta = parsed && parsed.choices && parsed.choices[0] && parsed.choices[0].delta;
                  if (!delta) continue;
                  if (delta.content) { fullContent += delta.content; emitText(delta.content); lastDataTime = Date.now(); }
                  if (delta.reasoning_content) {
                    fullReasoning += delta.reasoning_content;
                    emitText(delta.reasoning_content); // emit as text
                    lastDataTime = Date.now();
                  }
                  if (delta.tool_calls) {
                    hasToolCalls = true;
                    for (var ti = 0; ti < delta.tool_calls.length; ti++) {
                      var tc = delta.tool_calls[ti];
                      var idx = tc.index != null ? tc.index : 0;
                      if (!toolAcc.has(idx)) toolAcc.set(idx, { id: '', name: '', args: '' });
                      var a = toolAcc.get(idx);
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
              emitDone();
              break;
            }

            // ── Execute tools with guards ──
            var tcList = Array.from(toolAcc.values());
            if (tcList.length > 1) emitText('\n\n---\n### 🔧 执行 ' + tcList.length + ' 个工具\n');
            for (var tci = 0; tci < tcList.length; tci++) {
              var tc: any = tcList[tci];
              var toolName = tc.name.replace(/_/g, ' ');
              if (tcList.length > 1) emitText('\n🔄 ' + toolName + '...\n');
              else emitText('\n\n---\n### 🔧 ' + toolName + '\n');

              try {
                var params = JSON.parse(tc.args || '{}');
                var result = await executeGuarded(tc.name, params, userId);
                var ok = result && result.success !== false;
                var resultStr = JSON.stringify(result, null, 2);
                if (resultStr.length > 2000) resultStr = resultStr.slice(0, 2000) + '\n...';
                emitText((ok ? '✅' : '❌') + ' ' + toolName + '\n\`\`\`json\n' + resultStr + '\n\`\`\`\n');

                if (tc.name === 'navigate' && result && result.path) {
                  emitText('🔗 [打开页面](' + result.path + ')\n');
                }

                toolExecutions.push({ tool: tc.name, params: params, result: result });

                var assistantMsg: any = { role: 'assistant', tool_calls: [{ id: tc.id, type: 'function', function: { name: tc.name, arguments: tc.args } }] };
                if (fullContent) assistantMsg.content = fullContent;
                if (fullReasoning) assistantMsg.reasoning_content = fullReasoning;
                allMsgs.push(assistantMsg);
                allMsgs.push({ role: 'tool', content: JSON.stringify(result), tool_call_id: tc.id });

                if (blocked) break;
              } catch (err: any) {
                emitText('❌ ' + toolName + '\n\`\`\`\n' + (err.message || String(err)) + '\n\`\`\`\n');
                var errAssistantMsg: any = { role: 'assistant', tool_calls: [{ id: tc.id, type: 'function', function: { name: tc.name, arguments: tc.args } }] };
                if (fullContent) errAssistantMsg.content = fullContent;
                if (fullReasoning) errAssistantMsg.reasoning_content = fullReasoning;
                allMsgs.push(errAssistantMsg);
                allMsgs.push({ role: 'tool', content: JSON.stringify({ error: err.message || String(err) }), tool_call_id: tc.id });
              }
            }

            if (blocked) {
              var fallback = '';
              var actions = toolExecutions.filter(function(te: any) { return /^(create_|delete_|update_|add_|remove_|navigate)/.test(te.tool); });
              var queries = toolExecutions.filter(function(te: any) { return /^(list_|get_)/.test(te.tool); });
              if (actions.length > 0) {
                fallback = actions.map(function(te: any) { return te.result && te.result.message ? te.result.message : te.tool.replace(/_/g, ' ') + ' done'; }).filter(Boolean).join('\n');
              } else if (queries.length > 0) {
                var uniqueTools = Array.from(new Set(queries.map(function(te: any) { return te.tool; })));
                fallback = 'Executed ' + queries.length + ' read-only queries (' + uniqueTools.join(', ') + ') but took NO action. To complete the request, use: delete_task / update_task / create_task.';
              }
              if (fallback) emitText('\n\n' + fallback + '\n');
              emitDone();
              break;
            }
          }

          res.write('data: [DONE]\n\n');
        } catch (err: any) {
          emitText('Error: ' + (err.message || String(err)));
          emitDone();
          res.write('data: [DONE]\n\n');
        }
        res.end();      } else {
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
