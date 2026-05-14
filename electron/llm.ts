import { ipcMain, safeStorage, BrowserWindow, app } from 'electron';
import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import { getStoredKey } from './providers';
import { getOpenAIAccessToken } from './openai-oauth';
import { getBuiltinTools, executeBuiltinTool } from './tools';
import { getSetting } from './database';

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
  if (usingOAuth) return true; // OAuth uses chatgpt.com backend which only supports Responses API
  return RESPONSES_MODELS.some((m) => model.startsWith(m));
}

function resolveProvider(model: string): { providerId: string; baseUrl?: string } {
  if (model.includes('/')) return { providerId: 'openrouter', baseUrl: 'https://openrouter.ai/api/v1' };
  if (model.startsWith('claude')) return { providerId: 'anthropic' };
  if (model.startsWith('gemini')) return { providerId: 'google' };
  return { providerId: 'openai' };
}

export function registerLLMHandlers() {
  ipcMain.handle('llm:stream', async (_event, messages, model, tools?: any[]) => {
    const selectedModel = model || 'gpt-4.1-mini';
    const { providerId, baseUrl } = resolveProvider(selectedModel);
    const client = getClient(providerId, baseUrl);
    if (!client) {
      return { error: `API key não configurada para ${providerId}. Vá em Configurações > Providers.` };
    }

    const win = BrowserWindow.getFocusedWindow();
    const builtinTools = getBuiltinTools();
    const externalTools = (tools || []).filter((t: any) => t && t.name);
    const allTools = [...builtinTools, ...externalTools];

    try {
      if (isResponsesModel(selectedModel)) {
        await streamWithToolLoop(client, messages, selectedModel, allTools, win);
      } else {
        await streamChatCompletions(client, messages, selectedModel, allTools, win);
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
        const customPrompt = getSetting('system_prompt');
        params.instructions = customPrompt || 'You are a helpful assistant with access to tools. Use tools to read/write files, run commands, browse the web, and create documents. Files are stored in ~/Documents/AdOS/. Always use tools when the user asks to create files, search the web, or run commands.';
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
        // Capture call_id and name when the function_call item is first added
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

      // Execute tool calls and feed results back
      for (const tc of pendingToolCalls) {
        let args: Record<string, any> = {};
        try { args = JSON.parse(tc.arguments); } catch {}

        if (win) win.webContents.send('llm:tool-call', { name: tc.name, arguments: tc.arguments, call_id: tc.call_id });

        const result = await executeBuiltinTool(tc.name, args);

        // Add tool call + result to input for next iteration
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
    win: BrowserWindow | null
  ) {
    const params: any = {
      model: selectedModel,
      messages: messages.map((m) => ({
        role: m.role as 'user' | 'assistant' | 'system',
        content: m.content,
      })),
      stream: true,
    };

    if (tools.length > 0) {
      params.tools = tools.map((t) => ({
        type: 'function' as const,
        function: { name: t.name, description: t.description, parameters: t.inputSchema },
      }));
    }

    const stream = await (client.chat.completions.create(params) as any);

    for await (const chunk of stream as any) {
      const content = chunk.choices?.[0]?.delta?.content || '';
      if (content && win) win.webContents.send('llm:stream-chunk', content);
    }

    if (win) win.webContents.send('llm:stream-end');
  }

  ipcMain.handle('llm:chat', async (_event, messages, model) => {
    const selectedModel = model || 'gpt-4.1-mini';
    const { providerId, baseUrl } = resolveProvider(selectedModel);
    const client = getClient(providerId, baseUrl);
    if (!client) {
      return { error: `API key não configurada para ${providerId}.` };
    }

    try {
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
