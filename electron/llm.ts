import { ipcMain, safeStorage, BrowserWindow } from 'electron';
import OpenAI from 'openai';

let openaiClient: OpenAI | null = null;

function getOpenAIClient(apiKey: string): OpenAI {
  if (!openaiClient) {
    openaiClient = new OpenAI({ apiKey });
  }
  return openaiClient;
}

function getStoredKey(provider: string): string | null {
  try {
    const Store = require('electron-store');
    const store = new Store({ name: 'credentials' });
    const encrypted = store.get(`apiKey:${provider}`);
    if (!encrypted) return null;
    return safeStorage.decryptString(Buffer.from(encrypted, 'base64'));
  } catch {
    return null;
  }
}

const CODEX_MODELS = ['codex-mini-latest', 'codex-mini'];
const RESPONSES_MODELS = [...CODEX_MODELS, 'o3-mini', 'o1-mini', 'o1', 'o3'];

function isResponsesModel(model: string): boolean {
  return RESPONSES_MODELS.some(m => model.startsWith(m));
}

export function registerLLMHandlers() {
  ipcMain.handle('llm:chat', async (_event, messages, model) => {
    const apiKey = getStoredKey('openai');
    if (!apiKey) {
      return { error: 'API key não configurada. Vá em Configurações > API Keys.' };
    }

    const client = getOpenAIClient(apiKey);
    const selectedModel = model || 'codex-mini-latest';

    try {
      if (isResponsesModel(selectedModel)) {
        const input = messages.map((m: { role: string; content: string }) => ({
          role: m.role === 'assistant' ? 'assistant' : 'user',
          content: m.content,
        }));

        const response = await (client as any).responses.create({
          model: selectedModel,
          input,
        });

        const text = response.output_text || response.output?.map((o: any) => o.content?.map((c: any) => c.text).join('')).join('') || '';
        return { content: text };
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
      const error = err as Error;
      return { error: error.message };
    }
  });

  ipcMain.handle('llm:stream', async (_event, messages, model) => {
    const apiKey = getStoredKey('openai');
    if (!apiKey) {
      return { error: 'API key não configurada. Vá em Configurações > API Keys.' };
    }

    const client = getOpenAIClient(apiKey);
    const win = BrowserWindow.getFocusedWindow();
    const selectedModel = model || 'codex-mini-latest';

    try {
      if (isResponsesModel(selectedModel)) {
        const input = messages.map((m: { role: string; content: string }) => ({
          role: m.role === 'assistant' ? 'assistant' : 'user',
          content: m.content,
        }));

        const stream = await (client as any).responses.create({
          model: selectedModel,
          input,
          stream: true,
        });

        for await (const event of stream) {
          if (event.type === 'response.output_text.delta') {
            const delta = event.delta || '';
            if (delta && win) {
              win.webContents.send('llm:stream-chunk', delta);
            }
          }
        }

        if (win) {
          win.webContents.send('llm:stream-end');
        }
      } else {
        const stream = await client.chat.completions.create({
          model: selectedModel,
          messages: messages.map((m: { role: string; content: string }) => ({
            role: m.role as 'user' | 'assistant' | 'system',
            content: m.content,
          })),
          stream: true,
        });

        for await (const chunk of stream) {
          const content = chunk.choices[0]?.delta?.content || '';
          if (content && win) {
            win.webContents.send('llm:stream-chunk', content);
          }
        }

        if (win) {
          win.webContents.send('llm:stream-end');
        }
      }

      return { success: true };
    } catch (err: unknown) {
      const error = err as Error;
      if (win) {
        win.webContents.send('llm:stream-error', error.message);
      }
      return { error: error.message };
    }
  });

  ipcMain.handle('llm:save-key', (_event, provider: string, key: string) => {
    try {
      const encrypted = safeStorage.encryptString(key).toString('base64');
      const Store = require('electron-store');
      const store = new Store({ name: 'credentials' });
      store.set(`apiKey:${provider}`, encrypted);
      openaiClient = null;
      return { success: true };
    } catch (err: unknown) {
      const error = err as Error;
      return { error: error.message };
    }
  });

  ipcMain.handle('llm:test-key', async (_event, provider: string, key: string) => {
    if (provider === 'openai') {
      try {
        const client = new OpenAI({ apiKey: key });
        await client.models.list();
        return { success: true };
      } catch (err: unknown) {
        const error = err as Error;
        return { error: error.message };
      }
    }
    return { success: true };
  });

  ipcMain.handle('llm:has-key', (_event, provider: string) => {
    return getStoredKey(provider) !== null;
  });
}
