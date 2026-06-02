import { Controller, Get, Post, Body, Req, Res, Logger } from '@nestjs/common';
import { Request, Response } from 'express';
import { Public } from '../auth/decorators/public.decorator';
import { AiChatService } from '../ai-chat/ai-chat.service';
import { McpToolsService } from '../mcp-tools/mcp-tools.service';
import { PrismaService } from '../../prisma/prisma.service';

const FETCH_TIMEOUT_MS = 300000;

@Controller('v1')
export class OpenAICompatController {
  private readonly logger = new Logger(OpenAICompatController.name);

  constructor(
    private readonly aiChatService: AiChatService,
    private readonly mcpToolsService: McpToolsService,
    private readonly prisma: PrismaService,
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
      const userId = authHeader.replace('Bearer ', '').trim();
      if (!userId) return res.status(401).json({ error: { message: 'Missing API key' } });

      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      if (!user) return res.status(401).json({ error: { message: 'Invalid user ID' } });

      const tz = (user as any).timezone || 'UTC';
      const systemMsg = {
        role: 'system',
        content: `Today is ${new Intl.DateTimeFormat('zh-CN', { timeZone: tz, dateStyle: 'full', timeStyle: 'short' }).format(new Date())} (${tz}).`,
      };
      const allMessages = [systemMsg, ...messages.filter((m: any) => m.role !== 'system')];

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
        res.status(200);
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.flushHeaders();

        try {
          // Tool calling loop with real streaming
          const msgs = [...allMessages];
          for (let round = 0; round < 5; round++) {
            const apiRes: any = await this.fetchWithTimeout(
              `${config.apiUrl}/chat/completions`,
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${config.apiKey}`,
                },
                body: JSON.stringify({
                  model: config.model,
                  messages: msgs,
                  tools: tools.length > 0 ? tools : undefined,
                  stream: true,
                  max_completion_tokens: 2000,
                }),
              },
              FETCH_TIMEOUT_MS,
            );

            if (!apiRes.ok) {
              const errText = await apiRes.text().catch(() => '');
              this.logger.error(`AI API ${apiRes.status}: ${errText.slice(0, 200)}`);
              emitText(`\nAPI error ${apiRes.status}. Please try again.\n`);
              emitDone();
              break;
            }

            // Parse SSE stream from AI API
            const reader = apiRes.body.getReader();
            const decoder = new TextDecoder();
            let buf = '';
            let fullContent = '';
            let fullReasoning = '';
            let hasToolCalls = false;
            const toolAcc: Map<number, { id: string; name: string; args: string }> = new Map();

            while (true) {
              const { done, value } = await this.readStreamChunk(reader);
              if (done) break;
              buf += decoder.decode(value, { stream: true });
              const lines = buf.split('\n');
              buf = lines.pop() || '';

              for (const raw of lines) {
                const line = raw.trim();
                if (!line || !line.startsWith('data: ')) continue;
                const json = line.slice(6);
                if (json === '[DONE]') break;

                try {
                  const chunk = JSON.parse(json);
                  const delta = chunk?.choices?.[0]?.delta;
                  if (!delta) continue;

                  if (delta.content) {
                    fullContent += delta.content;
                    emitText(delta.content);
                  }

                  // Accumulate reasoning_content (DeepSeek requires it back)
                  if (delta.reasoning_content) {
                    fullReasoning += delta.reasoning_content;
                  }

                  if (delta.tool_calls) {
                    hasToolCalls = true;
                    for (const tc of delta.tool_calls) {
                      const idx = tc.index ?? 0;
                      if (!toolAcc.has(idx)) toolAcc.set(idx, { id: '', name: '', args: '' });
                      const a = toolAcc.get(idx)!;
                      if (tc.id) a.id = tc.id;
                      if (tc.function?.name) a.name += tc.function.name;
                      if (tc.function?.arguments) a.args += tc.function.arguments;
                    }
                  }
                } catch {}
              }
            }

            if (!hasToolCalls) {
              emitDone();
              break;
            }

            // Server-side MCP tool execution — emit status as text
            const toolCalls = Array.from(toolAcc.values());
            for (const tc of toolCalls) {
              emitText(`\n🔧 ${tc.name}...`);
              try {
                const params = JSON.parse(tc.args || '{}');
                const result = await this.mcpToolsService.executeTool(tc.name, params, userId);
                emitText(result?.success === false ? ' ❌\n' : ' ✅\n');
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
                msgs.push(assistantMsg);
                msgs.push({ role: 'tool', content: JSON.stringify(result), tool_call_id: tc.id });
              } catch (err: any) {
                emitText(' ❌\n');
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
                msgs.push(assistantMsg);
                msgs.push({
                  role: 'tool',
                  content: JSON.stringify({ error: err.message }),
                  tool_call_id: tc.id,
                });
              }
            }
          }

          res.write('data: [DONE]\n\n');
        } catch (err: any) {
          emitText(`Error: ${err.message}`);
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
