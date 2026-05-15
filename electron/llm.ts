import { ipcMain, safeStorage, BrowserWindow, app } from 'electron';
import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import { getStoredKey } from './providers';
import { getOpenAIAccessToken } from './openai-oauth';
import { getBuiltinTools, executeBuiltinTool } from './tools';
import { getSetting, getPreferences, getMemories } from './database';

let clients: Record<string, OpenAI> = {};
let usingOAuth = false;

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

const RESPONSES_MODELS = ['codex-mini-latest', 'codex-mini', 'o3-mini', 'o4-mini', 'o3', 'o1', 'o1-mini', 'gpt-4.1', 'gpt-4.1-mini', 'gpt-4.1-nano'];

function isResponsesModel(model: string): boolean {
  if (usingOAuth) return true;
  return RESPONSES_MODELS.some((m) => model.startsWith(m));
}

function resolveProvider(model: string): { providerId: string; baseUrl?: string; api?: string } {
  if (model.includes('/')) return { providerId: 'openrouter', baseUrl: 'https://openrouter.ai/api/v1', api: 'chat-completions' };
  if (model.startsWith('claude')) return { providerId: 'anthropic', api: 'anthropic-messages' };
  if (model.startsWith('gemini')) return { providerId: 'google', api: 'google-generative' };
  return { providerId: 'openai' };
}

function buildEnrichedPrompt(basePrompt: string): string {
  const prefs = getPreferences();
  const memories = getMemories(15);
  let enriched = basePrompt;

  const prefEntries = Object.entries(prefs).filter(([, v]) => v.trim());
  if (prefEntries.length > 0) {
    enriched += '\n\n## User Preferences\n';
    for (const [k, v] of prefEntries) {
      enriched += `- ${k}: ${v}\n`;
    }
  }

  if (memories.length > 0) {
    enriched += '\n\n## Workspace Memories\n';
    for (const m of memories) {
      enriched += `- [${m.category}] ${m.content}\n`;
    }
  }

  return enriched;
}

// --- Anthropic Native Streaming ---
async function streamAnthropic(
  messages: Array<{ role: string; content: string }>,
  model: string,
  tools: any[],
  win: BrowserWindow | null,
  maxIterations = 10
) {
  const apiKey = getStoredKey('anthropic');
  if (!apiKey) throw new Error('API key não configurada para Anthropic. Vá em Configurações > Providers.');

  const systemPrompt = buildEnrichedPrompt(getSetting('system_prompt') || 'You are a helpful assistant with access to tools.');
  let currentMessages = messages.map((m) => ({
    role: m.role === 'system' ? 'user' : m.role as 'user' | 'assistant',
    content: m.content,
  }));

  for (let iteration = 0; iteration < maxIterations; iteration++) {
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
  maxIterations = 10
) {
  const apiKey = getStoredKey('google');
  if (!apiKey) throw new Error('API key não configurada para Google. Vá em Configurações > Providers.');

  let contents = messages.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));

  for (let iteration = 0; iteration < maxIterations; iteration++) {
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

    const systemPrompt = getSetting('system_prompt');
    if (systemPrompt) {
      body.systemInstruction = { parts: [{ text: buildEnrichedPrompt(systemPrompt) }] };
    } else {
      const enriched = buildEnrichedPrompt('You are a helpful assistant.');
      if (enriched !== 'You are a helpful assistant.') {
        body.systemInstruction = { parts: [{ text: enriched }] };
      }
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${apiKey}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
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
  ipcMain.handle('llm:stream', async (_event, messages, model, tools?: any[]) => {
    const selectedModel = model || 'gpt-4.1-mini';
    const { providerId, baseUrl, api } = resolveProvider(selectedModel);

    const win = BrowserWindow.getFocusedWindow();
    const builtinTools = getBuiltinTools();
    const externalTools = (tools || []).filter((t: any) => t && t.name);
    const allTools = [...builtinTools, ...externalTools];

    try {
      if (api === 'anthropic-messages') {
        await streamAnthropic(messages, selectedModel, allTools, win);
      } else if (api === 'google-generative') {
        await streamGoogle(messages, selectedModel, allTools, win);
      } else {
        const client = getClient(providerId, baseUrl);
        if (!client) {
          return { error: `API key não configurada para ${providerId}. Vá em Configurações > Providers.` };
        }
        if (isResponsesModel(selectedModel)) {
          await streamWithToolLoop(client, messages, selectedModel, allTools, win);
        } else {
          await streamChatCompletions(client, messages, selectedModel, allTools, win);
        }
      }
      return { success: true };
    } catch (err: unknown) {
      const error = err as Error;
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
    maxIterations = 10
  ) {
    const effectiveModel = usingOAuth ? 'gpt-5.5' : selectedModel;
    let input: any[] = messages.map((m) => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: m.content,
    }));

    for (let iteration = 0; iteration < maxIterations; iteration++) {
      const params: any = { model: effectiveModel, input, stream: true };
      if (usingOAuth) {
        const customPrompt = getSetting('system_prompt') || 'You are a helpful assistant with access to tools. Use tools to read/write files, run commands, browse the web, and create documents. Files are stored in ~/Documents/AdOS/. Always use tools when the user asks to create files, search the web, or run commands.';
        params.instructions = buildEnrichedPrompt(customPrompt);
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

      if (pendingToolCalls.length === 0) {
        if (win) win.webContents.send('llm:stream-end');
        return;
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
    maxIterations = 10
  ) {
    let currentMessages: any[] = messages.map((m) => ({
      role: m.role as 'user' | 'assistant' | 'system',
      content: m.content,
    }));

    if (!currentMessages.some((m: any) => m.role === 'system')) {
      const base = getSetting('system_prompt') || 'You are a helpful assistant.';
      currentMessages.unshift({ role: 'system', content: buildEnrichedPrompt(base) });
    } else {
      const sysIdx = currentMessages.findIndex((m: any) => m.role === 'system');
      currentMessages[sysIdx].content = buildEnrichedPrompt(currentMessages[sysIdx].content);
    }

    for (let iteration = 0; iteration < maxIterations; iteration++) {
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

        const url = `https://generativelanguage.googleapis.com/v1beta/models/${selectedModel}:generateContent?key=${apiKey}`;
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
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
            const customPrompt = getSetting('system_prompt');
            chatParams.instructions = customPrompt || 'You are a helpful assistant.';
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
}
