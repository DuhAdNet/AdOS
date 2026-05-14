import { ipcMain } from 'electron';
import { safeStorage } from 'electron';
import OpenAI from 'openai';

let openaiClient: OpenAI | null = null;

function getOpenAIClient(apiKey: string): OpenAI {
  if (!openaiClient) {
    openaiClient = new OpenAI({ apiKey });
  }
  return openaiClient;
}

export function registerLLMHandlers() {
  ipcMain.handle('llm:chat', async (_event, messages, _model) => {
    const encryptedKey = getStoredKey('openai');
    if (!encryptedKey) {
      return { error: 'API key não configurada. Vá em Settings.' };
    }

    const apiKey = safeStorage.decryptString(Buffer.from(encryptedKey, 'base64'));
    const client = getOpenAIClient(apiKey);

    try {
      const response = await client.chat.completions.create({
        model: 'gpt-4o',
        messages: messages.map((m: { role: string; content: string }) => ({
          role: m.role as 'user' | 'assistant' | 'system',
          content: m.content,
        })),
      });

      return { content: response.choices[0]?.message?.content || '' };
    } catch (err: unknown) {
      const error = err as Error;
      return { error: error.message };
    }
  });
}

function getStoredKey(_provider: string): string | null {
  // TODO: read from SQLite or electron-store
  return null;
}
