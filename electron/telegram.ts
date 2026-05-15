import { ipcMain, BrowserWindow } from 'electron';
import { getSetting, setSetting } from './database';

const BASE_URL = 'https://api.telegram.org/bot';

let pollingActive = false;
let pollingTimeout: ReturnType<typeof setTimeout> | null = null;
let lastUpdateId = 0;
let mainWin: BrowserWindow | null = null;

function getToken(): string {
  const token = getSetting('telegram_bot_token');
  if (!token) throw new Error('Telegram bot token not configured');
  return token;
}

async function telegramApi(method: string, body?: any): Promise<any> {
  const token = getToken();
  const res = await fetch(`${BASE_URL}${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!data.ok) throw new Error(data.description || `Telegram API error: ${method}`);
  return data.result;
}

async function pollUpdates() {
  if (!pollingActive) return;
  try {
    const updates = await telegramApi('getUpdates', {
      offset: lastUpdateId + 1,
      timeout: 30,
      allowed_updates: ['message'],
    });

    for (const update of updates) {
      lastUpdateId = update.update_id;
      if (update.message && mainWin && !mainWin.isDestroyed()) {
        mainWin.webContents.send('telegram:message', {
          id: update.message.message_id,
          chatId: update.message.chat.id,
          chatTitle: update.message.chat.title || update.message.chat.first_name || 'Unknown',
          chatType: update.message.chat.type,
          from: update.message.from ? {
            id: update.message.from.id,
            name: [update.message.from.first_name, update.message.from.last_name].filter(Boolean).join(' '),
            username: update.message.from.username,
          } : null,
          text: update.message.text || '',
          date: update.message.date,
        });
      }
    }
  } catch (err: any) {
    if (pollingActive && mainWin && !mainWin.isDestroyed()) {
      mainWin.webContents.send('telegram:error', err.message);
    }
  }

  if (pollingActive) {
    pollingTimeout = setTimeout(pollUpdates, 1000);
  }
}

export function registerTelegramHandlers(win: BrowserWindow) {
  mainWin = win;

  ipcMain.handle('telegram:set-token', async (_event, token: string) => {
    try {
      const res = await fetch(`${BASE_URL}${token}/getMe`, { method: 'POST' });
      const data = await res.json();
      if (!data.ok) return { error: 'Token inválido: ' + (data.description || 'bot não encontrado') };
      setSetting('telegram_bot_token', token);
      return { success: true, bot: data.result };
    } catch (err: any) {
      return { error: err.message };
    }
  });

  ipcMain.handle('telegram:get-token', async () => {
    const token = getSetting('telegram_bot_token');
    return { hasToken: !!token, token: token ? `${token.slice(0, 8)}...${token.slice(-4)}` : null };
  });

  ipcMain.handle('telegram:remove-token', async () => {
    setSetting('telegram_bot_token', '');
    if (pollingActive) {
      pollingActive = false;
      if (pollingTimeout) clearTimeout(pollingTimeout);
    }
    return { success: true };
  });

  ipcMain.handle('telegram:get-me', async () => {
    try {
      const result = await telegramApi('getMe');
      return { success: true, bot: result };
    } catch (err: any) {
      return { error: err.message };
    }
  });

  ipcMain.handle('telegram:send', async (_event, chatId: number | string, text: string, parseMode?: string) => {
    try {
      const result = await telegramApi('sendMessage', {
        chat_id: chatId,
        text,
        parse_mode: parseMode || 'Markdown',
      });
      return { success: true, messageId: result.message_id };
    } catch (err: any) {
      return { error: err.message };
    }
  });

  ipcMain.handle('telegram:send-photo', async (_event, chatId: number | string, photoUrl: string, caption?: string) => {
    try {
      const result = await telegramApi('sendPhoto', {
        chat_id: chatId,
        photo: photoUrl,
        caption,
        parse_mode: 'Markdown',
      });
      return { success: true, messageId: result.message_id };
    } catch (err: any) {
      return { error: err.message };
    }
  });

  ipcMain.handle('telegram:send-document', async (_event, chatId: number | string, documentUrl: string, caption?: string) => {
    try {
      const result = await telegramApi('sendDocument', {
        chat_id: chatId,
        document: documentUrl,
        caption,
        parse_mode: 'Markdown',
      });
      return { success: true, messageId: result.message_id };
    } catch (err: any) {
      return { error: err.message };
    }
  });

  ipcMain.handle('telegram:get-chats', async () => {
    try {
      const updates = await telegramApi('getUpdates', { limit: 100 });
      const chats = new Map<number, any>();
      for (const u of updates) {
        const chat = u.message?.chat;
        if (chat && !chats.has(chat.id)) {
          chats.set(chat.id, {
            id: chat.id,
            title: chat.title || chat.first_name || 'Unknown',
            type: chat.type,
            username: chat.username,
          });
        }
      }
      return { success: true, chats: Array.from(chats.values()) };
    } catch (err: any) {
      return { error: err.message };
    }
  });

  ipcMain.handle('telegram:start-polling', async () => {
    if (pollingActive) return { success: true, status: 'already running' };
    try {
      getToken();
      pollingActive = true;
      pollUpdates();
      return { success: true, status: 'started' };
    } catch (err: any) {
      return { error: err.message };
    }
  });

  ipcMain.handle('telegram:stop-polling', async () => {
    pollingActive = false;
    if (pollingTimeout) {
      clearTimeout(pollingTimeout);
      pollingTimeout = null;
    }
    return { success: true, status: 'stopped' };
  });

  ipcMain.handle('telegram:polling-status', async () => {
    return { active: pollingActive };
  });

  ipcMain.handle('telegram:set-webhook', async (_event, url: string) => {
    try {
      const result = await telegramApi('setWebhook', { url });
      return { success: true, result };
    } catch (err: any) {
      return { error: err.message };
    }
  });

  ipcMain.handle('telegram:delete-webhook', async () => {
    try {
      const result = await telegramApi('deleteWebhook');
      return { success: true, result };
    } catch (err: any) {
      return { error: err.message };
    }
  });

  ipcMain.handle('telegram:get-webhook-info', async () => {
    try {
      const result = await telegramApi('getWebhookInfo');
      return { success: true, info: result };
    } catch (err: any) {
      return { error: err.message };
    }
  });
}
