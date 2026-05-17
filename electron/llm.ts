import { ipcMain, safeStorage, BrowserWindow, app, net } from 'electron';
import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import { getStoredKey } from './providers';
import { getOpenAIAccessToken } from './openai-oauth';
import { getBuiltinTools, executeBuiltinTool } from './tools';
import { getSetting, getPreferences, getMemories, getDb } from './database';
import { autoExtractMemory } from './auto-memory';
import { getFallbackModel } from './jvossys-bridge';

const DEFAULT_SYSTEM_PROMPT = `You are JVOS, a desktop AI operating system that helps the user manage everything from one place.

## Identity
- You are the user's Chief of Staff — proactive, organized, execution-focused
- You run inside an Electron desktop app with native system access
- You have tools for files, browser, commands, web search, skills, workflows, and automations
- You can create and manage the entire system via tools

## Response Protocol
1. Analyze what the user actually needs
2. If it requires action → use tools immediately (don't describe what you would do)
3. If it's a question → answer directly and concisely
4. Always respond in the same language as the user

## Response Style
- Concise by default (2-5 sentences for simple questions)
- Structured format only when content genuinely benefits from it
- Never repeat the question back, never pad with filler
- When given files/docs, extract key insights — don't summarize everything
- Match the user's energy: casual question → casual answer; formal request → structured response

## Attachments
When the user attaches files, analyze their content and respond to the user's question about them. Do not echo file contents back.

## Tool Usage
When the task requires action, use tools directly:
- **Files**: read_file, write_file, list_directory, create_directory
- **System**: run_command (shell commands, scripts, installations)
- **Browser**: open_browser, search_web, browser_click, browser_type, browser_get_elements
- **Create**: create_skill, create_workflow, create_automation, add_mcp_server
- **Memory**: save_memory (store important context for future conversations)
- **Query**: list_skills, list_workflows, list_automations

## Admin Capabilities
You can manage the system directly:
- **create_skill**: Custom slash-command skills (name, slug, description, instructions)
- **create_workflow**: Multi-step workflows invokable via @slug
- **create_automation**: Schedule recurring tasks (daily/weekly/cron) that run skills or prompts
- **add_mcp_server**: Register external MCP servers (stdio or SSE transport)
- **save_memory**: Persist important context for future conversations

When asked to create any of these → guide briefly if needed, then execute. Don't just describe.

## Context Awareness
Your prompt is enriched with User Preferences and Workspace Memories automatically.
Use this context to personalize responses without asking for info you already have.
If you learn something important during the conversation, use save_memory to persist it.`;

let clients: Record<string, OpenAI> = {};
let usingOAuth = false;
let currentAbortController: AbortController | null = null;

function getClient(providerId: string, baseUrl?: string): OpenAI | null {
  if (providerId === 'openai') {
    const oauthToken = getOpenAIAccessToken();
    if (oauthToken) {
      usingOAuth = true;
      return new OpenAI({
        apiKey: oauthToken,
        baseURL: 'https://chatgpt.com/backend-api/codex',
        defaultHeaders: {
          'x-codex-client-version': '0.1.0',
        },
      });
    }
  }
  usingOAuth = false;

  const apiKey = getStoredKey(providerId);
  if (!apiKey) return null;

  const cacheKey = `${providerId}:${baseUrl || 'default'}`;
  if (!clients[cacheKey]) {
    const config: any = { apiKey };
    if (baseUrl) config.baseURL = baseUrl;
    clients[cacheKey] = new OpenAI(config);
  }
  return clients[cacheKey];
}

const RESPONSES_MODELS = ['gpt-5.5', 'codex-mini-latest', 'codex-mini', 'o3-mini', 'o4-mini', 'o3', 'o1', 'o1-mini', 'gpt-4.1', 'gpt-4.1-mini', 'gpt-4.1-nano'];

function convertContentForOpenAI(content: any): any {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return content;
  return content.map((block: any) => {
    if (block.type === 'image' && block.source?.type === 'base64') {
      return {
        type: 'input_image',
        image_url: `data:${block.source.media_type || 'image/png'};base64,${block.source.data}`,
      };
    }
    if (block.type === 'text') {
      return { type: 'input_text', text: block.text };
    }
    return block;
  });
}

function convertContentForChatCompletions(content: any): any {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return content;
  return content.map((block: any) => {
    if (block.type === 'image' && block.source?.type === 'base64') {
      return {
        type: 'image_url',
        image_url: { url: `data:${block.source.media_type || 'image/png'};base64,${block.source.data}` },
      };
    }
    if (block.type === 'text') {
      return { type: 'text', text: block.text };
    }
    return block;
  });
}

function convertContentToGoogleParts(content: any): any[] {
  if (typeof content === 'string') return [{ text: content }];
  if (!Array.isArray(content)) return [{ text: String(content) }];
  return content.map((block: any) => {
    if (block.type === 'image' && block.source?.type === 'base64') {
      return { inlineData: { mimeType: block.source.media_type || 'image/png', data: block.source.data } };
    }
    if (block.type === 'text') {
      return { text: block.text };
    }
    return { text: JSON.stringify(block) };
  });
}

function isResponsesModel(model: string): boolean {
  if (usingOAuth) return true;
  return RESPONSES_MODELS.some((m) => model.startsWith(m));
}

function resolveProvider(model: string): { providerId: string; baseUrl?: string; api?: string } {
  if (model.includes('/')) return { providerId: 'openrouter', baseUrl: 'https://openrouter.ai/api/v1', api: 'chat-completions' };
  if (model.startsWith('claude')) return { providerId: 'anthropic', api: 'anthropic-messages' };
  if (model.startsWith('gemini')) return { providerId: 'google', api: 'google-generative' };
  if (model.startsWith('llama') || model.startsWith('mixtral') || model.startsWith('whisper')) return { providerId: 'groq', baseUrl: 'https://api.groq.com/openai/v1', api: 'chat-completions' };
  return { providerId: 'openai' };
}

function getContextSnapshot(): { skills: string[]; automations: string[]; recentSessions: string[]; labels: string[] } {
  const db = getDb();
  if (!db) return { skills: [], automations: [], recentSessions: [], labels: [] };
  try {
    const skillRows = db.exec('SELECT name FROM skills LIMIT 10');
    const skills = skillRows.length ? skillRows[0].values.map((r: any[]) => r[0] as string) : [];

    const autoRows = db.exec("SELECT name FROM automations WHERE enabled = 1 LIMIT 8");
    const automations = autoRows.length ? autoRows[0].values.map((r: any[]) => r[0] as string) : [];

    const sessRows = db.exec("SELECT title FROM sessions ORDER BY updated_at DESC LIMIT 5");
    const recentSessions = sessRows.length ? sessRows[0].values.map((r: any[]) => r[0] as string) : [];

    const labelRows = db.exec('SELECT name FROM labels LIMIT 10');
    const labels = labelRows.length ? labelRows[0].values.map((r: any[]) => r[0] as string) : [];

    return { skills, automations, recentSessions, labels };
  } catch { return { skills: [], automations: [], recentSessions: [], labels: [] }; }
}

function buildEnrichedPrompt(basePrompt: string): string {
  const prefs = getPreferences();
  const memories = getMemories(15);
  const ctx = getContextSnapshot();
  let enriched = basePrompt;

  // User identity and preferences
  const prefEntries = Object.entries(prefs).filter(([, v]) => v.trim());
  if (prefEntries.length > 0) {
    enriched += '\n\n## User Profile\n';
    for (const [k, v] of prefEntries) {
      enriched += `- ${k}: ${v}\n`;
    }
  }

  // Persistent memories — the user's knowledge base
  if (memories.length > 0) {
    enriched += '\n\n## Workspace Memories (persistent context)\n';
    enriched += 'These are facts the user saved. Use them proactively when relevant:\n';
    for (const m of memories) {
      enriched += `- [${m.category}] ${m.content}\n`;
    }
  }

  // Workspace state — what's available right now
  const hasContext = ctx.skills.length || ctx.automations.length || ctx.recentSessions.length || ctx.labels.length;
  if (hasContext) {
    enriched += '\n\n## Workspace State (live)\n';
    if (ctx.skills.length > 0) {
      enriched += `Skills available: ${ctx.skills.join(', ')}\n`;
    }
    if (ctx.automations.length > 0) {
      enriched += `Active automations: ${ctx.automations.join(', ')}\n`;
    }
    if (ctx.recentSessions.length > 0) {
      enriched += `Recent sessions: ${ctx.recentSessions.join(', ')}\n`;
    }
    if (ctx.labels.length > 0) {
      enriched += `Labels: ${ctx.labels.join(', ')}\n`;
    }
  }

  // Temporal context
  const now = new Date();
  const timeStr = now.toLocaleString('pt-BR', { timeZone: prefs.user_timezone || 'America/Sao_Paulo', weekday: 'long', hour: '2-digit', minute: '2-digit' });
  enriched += `\n\n## Current Context\n- Date/Time: ${timeStr}, ${now.toISOString().split('T')[0]}\n`;

  return enriched;
}

// --- Anthropic Native Streaming ---
async function streamAnthropic(
  messages: Array<{ role: string; content: any }>,
  model: string,
  tools: any[],
  win: BrowserWindow | null,
  maxIterations = 30,
  signal?: AbortSignal
) {
  const apiKey = getStoredKey('anthropic');
  if (!apiKey) throw new Error('API key não configurada para Anthropic. Vá em Configurações > Providers.');

  const systemPrompt = buildEnrichedPrompt(getSetting('system_prompt') || DEFAULT_SYSTEM_PROMPT);
  let currentMessages = messages.map((m) => ({
    role: m.role === 'system' ? 'user' : m.role as 'user' | 'assistant',
    content: m.content,
  }));

  for (let iteration = 0; iteration < maxIterations; iteration++) {
    if (signal?.aborted) break;

    const body: any = {
      model,
      max_tokens: 16000,
      system: systemPrompt,
      messages: currentMessages,
      stream: true,
    };

    if (tools.length > 0) {
      body.tools = tools.map((t) => ({
        name: t.name,
        description: t.description || '',
        input_schema: t.inputSchema || { type: 'object', properties: {} },
      }));
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
      signal,
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Anthropic API error ${response.status}: ${errText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response stream');

    const decoder = new TextDecoder();
    let buffer = '';
    let assistantText = '';
    const toolUses: Array<{ id: string; name: string; input: any }> = [];
    let currentToolUse: { id: string; name: string; inputJson: string } | null = null;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6);
        if (data === '[DONE]') continue;

        try {
          const event = JSON.parse(data);
          if (event.type === 'content_block_delta') {
            if (event.delta?.type === 'text_delta') {
              const text = event.delta.text || '';
              assistantText += text;
              if (text && win) win.webContents.send('llm:stream-chunk', text);
            } else if (event.delta?.type === 'input_json_delta') {
              if (currentToolUse) currentToolUse.inputJson += event.delta.partial_json || '';
            }
          } else if (event.type === 'content_block_start') {
            if (event.content_block?.type === 'tool_use') {
              currentToolUse = { id: event.content_block.id, name: event.content_block.name, inputJson: '' };
            }
          } else if (event.type === 'content_block_stop') {
            if (currentToolUse) {
              let input = {};
              try { input = JSON.parse(currentToolUse.inputJson); } catch {}
              toolUses.push({ id: currentToolUse.id, name: currentToolUse.name, input });
              currentToolUse = null;
            }
          }
        } catch {}
      }
    }

    if (toolUses.length === 0) {
      if (win) win.webContents.send('llm:stream-end');
      return;
    }

    // Build assistant message with tool_use blocks
    const assistantContent: any[] = [];
    if (assistantText) assistantContent.push({ type: 'text', text: assistantText });
    for (const tu of toolUses) {
      assistantContent.push({ type: 'tool_use', id: tu.id, name: tu.name, input: tu.input });
    }
    currentMessages.push({ role: 'assistant', content: assistantContent as any });

    // Execute tools and build tool_result message
    const toolResults: any[] = [];
    for (const tu of toolUses) {
      if (win) win.webContents.send('llm:tool-call', { name: tu.name, arguments: JSON.stringify(tu.input), call_id: tu.id });
      const result = await executeBuiltinTool(tu.name, tu.input);
      toolResults.push({ type: 'tool_result', tool_use_id: tu.id, content: result.slice(0, 20000) });
    }
    currentMessages.push({ role: 'user', content: toolResults as any });
  }

  if (win) win.webContents.send('llm:stream-end');
}

// --- Google Generative AI Native Streaming ---
async function streamGoogle(
  messages: Array<{ role: string; content: string }>,
  model: string,
  tools: any[],
  win: BrowserWindow | null,
  maxIterations = 30,
  signal?: AbortSignal
) {
  const apiKey = getStoredKey('google');
  if (!apiKey) throw new Error('API key não configurada para Google. Vá em Configurações > Providers.');

  let contents = messages.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: convertContentToGoogleParts(m.content),
  }));

  for (let iteration = 0; iteration < maxIterations; iteration++) {
    if (signal?.aborted) break;

    const body: any = { contents, generationConfig: { maxOutputTokens: 65536 } };

    if (tools.length > 0) {
      body.tools = [{
        functionDeclarations: tools.map((t) => ({
          name: t.name,
          description: t.description || '',
          parameters: t.inputSchema || { type: 'object', properties: {} },
        })),
      }];
    }

    const systemPrompt = getSetting('system_prompt') || DEFAULT_SYSTEM_PROMPT;
    body.systemInstruction = { parts: [{ text: buildEnrichedPrompt(systemPrompt) }] };

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify(body),
      signal,
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Google API error ${response.status}: ${errText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response stream');

    const decoder = new TextDecoder();
    let buffer = '';
    let assistantText = '';
    const functionCalls: Array<{ name: string; args: any }> = [];

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6);
        try {
          const parsed = JSON.parse(data);
          const parts = parsed.candidates?.[0]?.content?.parts || [];
          for (const part of parts) {
            if (part.text) {
              assistantText += part.text;
              if (win) win.webContents.send('llm:stream-chunk', part.text);
            }
            if (part.functionCall) {
              functionCalls.push({ name: part.functionCall.name, args: part.functionCall.args || {} });
            }
          }
        } catch {}
      }
    }

    if (functionCalls.length === 0) {
      if (win) win.webContents.send('llm:stream-end');
      return;
    }

    // Add model response with function calls
    const modelParts: any[] = [];
    if (assistantText) modelParts.push({ text: assistantText });
    for (const fc of functionCalls) {
      modelParts.push({ functionCall: { name: fc.name, args: fc.args } });
    }
    contents.push({ role: 'model', parts: modelParts });

    // Execute tools and build function response
    const responseParts: any[] = [];
    for (const fc of functionCalls) {
      if (win) win.webContents.send('llm:tool-call', { name: fc.name, arguments: JSON.stringify(fc.args), call_id: fc.name });
      const result = await executeBuiltinTool(fc.name, fc.args);
      responseParts.push({ functionResponse: { name: fc.name, response: { result: result.slice(0, 20000) } } });
    }
    contents.push({ role: 'user', parts: responseParts });
  }

  if (win) win.webContents.send('llm:stream-end');
}

export function registerLLMHandlers() {
  ipcMain.handle('llm:stop', () => {
    if (currentAbortController) {
      currentAbortController.abort();
      currentAbortController = null;
    }
    return { success: true };
  });

  ipcMain.handle('llm:stream', async (_event, messages, model, tools?: any[]) => {
    const selectedModel = model || 'gpt-4.1-mini';
    const { providerId, baseUrl, api } = resolveProvider(selectedModel);

    const win = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0] || null;
    const builtinTools = getBuiltinTools();
    const externalTools = (tools || []).filter((t: any) => t && t.name);
    const allTools = [...builtinTools, ...externalTools];

    currentAbortController = new AbortController();
    const signal = currentAbortController.signal;

    try {
      if (api === 'anthropic-messages') {
        await streamAnthropic(messages, selectedModel, allTools, win, 30, signal);
      } else if (api === 'google-generative') {
        await streamGoogle(messages, selectedModel, allTools, win, 30, signal);
      } else {
        const client = getClient(providerId, baseUrl);
        if (!client) {
          return { error: `API key não configurada para ${providerId}. Vá em Configurações > Providers.` };
        }
        if (isResponsesModel(selectedModel)) {
          await streamWithToolLoop(client, messages, selectedModel, allTools, win, 30, signal);
        } else {
          await streamChatCompletions(client, messages, selectedModel, allTools, win, signal);
        }
      }
      currentAbortController = null;
      // Auto-memory: extract insights in background after successful conversations
      if (messages.length >= 4) {
        autoExtractMemory(messages).catch(() => {});
      }
      return { success: true };
    } catch (err: unknown) {
      currentAbortController = null;
      const error = err as Error;
      if (error.name === 'AbortError' || signal.aborted) {
        if (win) win.webContents.send('llm:stream-end');
        return { success: true, stopped: true };
      }
      // Fallback: try alternate model on failure
      const fallbackModel = getFallbackModel(selectedModel);
      if (fallbackModel && fallbackModel !== selectedModel) {
        try {
          const { providerId: fbProvider, baseUrl: fbUrl, api: fbApi } = resolveProvider(fallbackModel);
          if (win) win.webContents.send('llm:stream-chunk', `\n[usando modelo alternativo: ${fallbackModel}]\n`);
          if (fbApi === 'anthropic-messages') {
            await streamAnthropic(messages, fallbackModel, allTools, win, 30, signal);
          } else if (fbApi === 'google-generative') {
            await streamGoogle(messages, fallbackModel, allTools, win, 30, signal);
          } else {
            const fbClient = getClient(fbProvider, fbUrl);
            if (fbClient) {
              if (isResponsesModel(fallbackModel)) {
                await streamWithToolLoop(fbClient, messages, fallbackModel, allTools, win, 30, signal);
              } else {
                await streamChatCompletions(fbClient, messages, fallbackModel, allTools, win, signal);
              }
            }
          }
          return { success: true, fallback: fallbackModel };
        } catch {}
      }
      if (win) win.webContents.send('llm:stream-error', error.message);
      return { error: error.message };
    }
  });

  async function streamWithToolLoop(
    client: OpenAI,
    messages: Array<{ role: string; content: string }>,
    selectedModel: string,
    tools: any[],
    win: BrowserWindow | null,
    maxIterations = 30,
    signal?: AbortSignal
  ) {
    const effectiveModel = usingOAuth ? 'gpt-5.5' : selectedModel;
    let input: any[] = messages.map((m) => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: convertContentForOpenAI(m.content),
    }));

    for (let iteration = 0; iteration < maxIterations; iteration++) {
      if (signal?.aborted) break;

      const params: any = { model: effectiveModel, input, stream: true };
      const customPrompt = getSetting('system_prompt') || DEFAULT_SYSTEM_PROMPT;
      params.instructions = buildEnrichedPrompt(customPrompt);
      if (usingOAuth) {
        params.store = false;
      }
      if (tools.length > 0) {
        params.tools = tools.map((t) => ({
          type: 'function',
          name: t.name,
          description: t.description || '',
          parameters: t.inputSchema || { type: 'object', properties: {} },
        }));
      }

      const stream = await (client as any).responses.create(params);
      const pendingToolCalls: Array<{ call_id: string; name: string; arguments: string }> = [];
      const toolCallMap: Record<string, { call_id: string; name: string }> = {};

      for await (const event of stream) {
        if (signal?.aborted) break;
        if (event.type === 'response.output_text.delta') {
          const delta = event.delta || '';
          if (delta && win) {
            win.webContents.send('llm:stream-chunk', delta);
          }
        }
        if (event.type === 'response.output_item.added' && event.item?.type === 'function_call') {
          toolCallMap[event.item.id] = { call_id: event.item.call_id, name: event.item.name };
        }
        if (event.type === 'response.function_call_arguments.done') {
          const itemId = event.item_id || '';
          const mapped = toolCallMap[itemId];
          pendingToolCalls.push({
            call_id: mapped?.call_id || event.call_id || `call_${Date.now()}`,
            name: mapped?.name || event.name || '',
            arguments: event.arguments || '{}',
          });
        }
      }

      if (signal?.aborted) break;

      if (pendingToolCalls.length === 0) {
        if (win) win.webContents.send('llm:stream-end');
        return;
      }

      if (iteration === maxIterations - 1 && pendingToolCalls.length > 0) {
        if (win) win.webContents.send('llm:stream-chunk', '\n\n⚠️ Limite de ações atingido (30). Envie outra mensagem para continuar.');
      }

      for (const tc of pendingToolCalls) {
        let args: Record<string, any> = {};
        try { args = JSON.parse(tc.arguments); } catch {}

        if (win) win.webContents.send('llm:tool-call', { name: tc.name, arguments: tc.arguments, call_id: tc.call_id });

        const result = await executeBuiltinTool(tc.name, args);

        input.push({
          type: 'function_call',
          call_id: tc.call_id,
          name: tc.name,
          arguments: tc.arguments,
        });
        input.push({
          type: 'function_call_output',
          call_id: tc.call_id,
          output: result.slice(0, 20000),
        });
      }
    }

    if (win) win.webContents.send('llm:stream-end');
  }

  async function streamChatCompletions(
    client: OpenAI,
    messages: Array<{ role: string; content: string }>,
    selectedModel: string,
    tools: any[],
    win: BrowserWindow | null,
    signal?: AbortSignal,
    maxIterations = 30
  ) {
    let currentMessages: any[] = messages.map((m) => ({
      role: m.role as 'user' | 'assistant' | 'system',
      content: convertContentForChatCompletions(m.content),
    }));

    if (!currentMessages.some((m: any) => m.role === 'system')) {
      const base = getSetting('system_prompt') || DEFAULT_SYSTEM_PROMPT;
      currentMessages.unshift({ role: 'system', content: buildEnrichedPrompt(base) });
    } else {
      const sysIdx = currentMessages.findIndex((m: any) => m.role === 'system');
      currentMessages[sysIdx].content = buildEnrichedPrompt(currentMessages[sysIdx].content);
    }

    for (let iteration = 0; iteration < maxIterations; iteration++) {
      if (signal?.aborted) break;

      const params: any = {
        model: selectedModel,
        messages: currentMessages,
        stream: true,
      };

      if (tools.length > 0) {
        params.tools = tools.map((t) => ({
          type: 'function' as const,
          function: { name: t.name, description: t.description, parameters: t.inputSchema },
        }));
      }

      const stream = await (client.chat.completions.create(params) as any);

      let assistantContent = '';
      const toolCalls: Array<{ id: string; name: string; arguments: string }> = [];
      const toolCallBuffers: Record<number, { id: string; name: string; args: string }> = {};

      for await (const chunk of stream as any) {
        if (signal?.aborted) break;
        const delta = chunk.choices?.[0]?.delta;
        if (!delta) continue;

        if (delta.content) {
          assistantContent += delta.content;
          if (win) win.webContents.send('llm:stream-chunk', delta.content);
        }

        if (delta.tool_calls) {
          for (const tc of delta.tool_calls) {
            const idx = tc.index;
            if (!toolCallBuffers[idx]) {
              toolCallBuffers[idx] = { id: tc.id || '', name: tc.function?.name || '', args: '' };
            }
            if (tc.function?.name) toolCallBuffers[idx].name = tc.function.name;
            if (tc.id) toolCallBuffers[idx].id = tc.id;
            if (tc.function?.arguments) toolCallBuffers[idx].args += tc.function.arguments;
          }
        }
      }

      // Finalize tool calls from buffers
      for (const key of Object.keys(toolCallBuffers).sort((a, b) => Number(a) - Number(b))) {
        const buf = toolCallBuffers[Number(key)];
        if (buf.name) toolCalls.push({ id: buf.id, name: buf.name, arguments: buf.args });
      }

      if (toolCalls.length === 0) {
        if (win) win.webContents.send('llm:stream-end');
        return;
      }

      // Add assistant message with tool_calls
      currentMessages.push({
        role: 'assistant',
        content: assistantContent || null,
        tool_calls: toolCalls.map((tc) => ({
          id: tc.id,
          type: 'function',
          function: { name: tc.name, arguments: tc.arguments },
        })),
      });

      // Execute tools and add results
      for (const tc of toolCalls) {
        let args: Record<string, any> = {};
        try { args = JSON.parse(tc.arguments); } catch {}

        if (win) win.webContents.send('llm:tool-call', { name: tc.name, arguments: tc.arguments, call_id: tc.id });

        const result = await executeBuiltinTool(tc.name, args);

        currentMessages.push({
          role: 'tool',
          tool_call_id: tc.id,
          content: result.slice(0, 20000),
        });
      }
    }

    if (win) win.webContents.send('llm:stream-end');
  }

  ipcMain.handle('llm:chat', async (_event, messages, model) => {
    const selectedModel = model || 'gpt-4.1-mini';
    const { providerId, baseUrl, api } = resolveProvider(selectedModel);

    try {
      if (api === 'anthropic-messages') {
        const apiKey = getStoredKey('anthropic');
        if (!apiKey) return { error: 'API key não configurada para Anthropic.' };

        const response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: selectedModel,
            max_tokens: 16000,
            messages: messages.map((m: { role: string; content: string }) => ({
              role: m.role === 'system' ? 'user' : m.role,
              content: m.content,
            })),
          }),
        });

        if (!response.ok) {
          const errText = await response.text();
          return { error: `Anthropic error ${response.status}: ${errText}` };
        }

        const data = await response.json();
        const text = data.content?.map((c: any) => c.text || '').join('') || '';
        return { content: text };

      } else if (api === 'google-generative') {
        const apiKey = getStoredKey('google');
        if (!apiKey) return { error: 'API key não configurada para Google.' };

        const contents = messages.map((m: { role: string; content: string }) => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.content }],
        }));

        const url = `https://generativelanguage.googleapis.com/v1beta/models/${selectedModel}:generateContent`;
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': apiKey,
          },
          body: JSON.stringify({ contents }),
        });

        if (!response.ok) {
          const errText = await response.text();
          return { error: `Google error ${response.status}: ${errText}` };
        }

        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.map((p: any) => p.text || '').join('') || '';
        return { content: text };

      } else {
        const client = getClient(providerId, baseUrl);
        if (!client) return { error: `API key não configurada para ${providerId}.` };

        if (isResponsesModel(selectedModel)) {
          const input = messages.map((m: { role: string; content: string }) => ({
            role: m.role === 'assistant' ? 'assistant' : 'user',
            content: m.content,
          }));
          const effectiveModel = usingOAuth ? 'gpt-5.5' : selectedModel;
          const chatParams: any = { model: effectiveModel, input };
          if (usingOAuth) {
            chatParams.instructions = getSetting('system_prompt') || DEFAULT_SYSTEM_PROMPT;
            chatParams.store = false;
          }
          const response = await (client as any).responses.create(chatParams);
          return { content: response.output_text || '' };
        } else {
          const response = await client.chat.completions.create({
            model: selectedModel,
            messages: messages.map((m: { role: string; content: string }) => ({
              role: m.role as 'user' | 'assistant' | 'system',
              content: m.content,
            })),
          });
          return { content: response.choices[0]?.message?.content || '' };
        }
      }
    } catch (err: unknown) {
      return { error: (err as Error).message };
    }
  });

  ipcMain.handle('llm:save-key', (_event, provider: string, key: string) => {
    try {
      const encrypted = safeStorage.encryptString(key).toString('base64');
      const credPath = path.join(app.getPath('userData'), 'credentials.json');
      let creds: Record<string, string> = {};
      try { creds = JSON.parse(fs.readFileSync(credPath, 'utf-8')); } catch {}
      creds[`apiKey:${provider}`] = encrypted;
      fs.writeFileSync(credPath, JSON.stringify(creds), 'utf-8');
      clients = {};
      return { success: true };
    } catch (err: unknown) {
      return { error: (err as Error).message };
    }
  });

  ipcMain.handle('llm:test-key', async (_event, provider: string, key: string) => {
    try {
      if (provider === 'openai' || provider === 'openrouter') {
        const config: any = { apiKey: key };
        if (provider === 'openrouter') config.baseURL = 'https://openrouter.ai/api/v1';
        const client = new OpenAI(config);
        await client.models.list();
      } else if (provider === 'anthropic') {
        const response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': key,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: 'claude-haiku-4-5',
            max_tokens: 1,
            messages: [{ role: 'user', content: 'hi' }],
          }),
        });
        if (!response.ok && response.status === 401) {
          throw new Error('Invalid API key');
        }
      } else if (provider === 'google') {
        const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${key}`;
        const response = await fetch(url);
        if (!response.ok) throw new Error('Invalid API key');
      }
      return { success: true };
    } catch (err: unknown) {
      return { error: (err as Error).message };
    }
  });

  ipcMain.handle('llm:has-key', (_event, provider: string) => {
    if (provider === 'openai' && getOpenAIAccessToken()) return true;
    return getStoredKey(provider) !== null;
  });

  ipcMain.handle('llm:transcribe', async (_event, audioBase64: string, mimeType: string) => {
    try {
      const ext = mimeType.includes('webm') ? 'webm' : mimeType.includes('mp4') ? 'mp4' : 'wav';
      const buffer = Buffer.from(audioBase64, 'base64');

      const groqKey = getStoredKey('groq');
      const openaiKey = getStoredKey('openai');
      const googleKey = getStoredKey('google');

      console.log('[transcribe] keys available:', { groq: !!groqKey, openai: !!openaiKey, google: !!googleKey });

      if (groqKey || openaiKey) {
        const key = groqKey || openaiKey!;
        const baseURL = groqKey ? 'https://api.groq.com/openai/v1' : undefined;
        const model = groqKey ? 'whisper-large-v3' : 'whisper-1';
        const client = new OpenAI({ apiKey: key, ...(baseURL ? { baseURL } : {}) });
        const { toFile } = require('openai');
        const file = await toFile(buffer, `audio.${ext}`, { type: mimeType });
        const response = await client.audio.transcriptions.create({
          model,
          file,
          language: 'pt',
        });
        return { text: response.text };
      }

      if (googleKey) {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${googleKey}`;
        const payload = JSON.stringify({
          contents: [{ parts: [
            { inlineData: { mimeType, data: audioBase64 } },
            { text: 'Transcreva este áudio em português brasileiro. Retorne APENAS o texto falado, sem explicações.' }
          ]}],
          generationConfig: { maxOutputTokens: 2048, temperature: 0 }
        });

        const response = await net.fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: payload,
        });

        if (!response.ok) {
          const errText = await response.text();
          console.error('[transcribe] Google error:', response.status, errText.slice(0, 200));
          return { error: `Google Gemini error ${response.status}` };
        }

        const result = await response.json();
        const text = (result as any)?.candidates?.[0]?.content?.parts?.[0]?.text || '';
        if (text) return { text: text.trim() };
        return { error: 'Gemini não retornou texto' };
      }

      return { error: 'Configure uma API key (Groq, OpenAI ou Google) em Configurações > Providers para usar voz.' };
    } catch (err: any) {
      console.error('[transcribe] error:', err);
      return { error: err.message || 'Transcription failed' };
    }
  });
}
