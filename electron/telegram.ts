import { ipcMain, BrowserWindow } from 'electron';
import { getSetting, setSetting, getDb } from './database';
import OpenAI from 'openai';
import { getStoredKey } from './providers';
import { getOpenAIAccessToken } from './openai-oauth';

const BASE_URL = 'https://api.telegram.org/bot';

let pollingActive = false;
let pollingTimeout: ReturnType<typeof setTimeout> | null = null;
let lastUpdateId = 0;
let mainWin: BrowserWindow | null = null;
const knownChats = new Map<number, { id: number; title: string; type: string; username?: string }>();

// Pairing codes: code -> { sessionId, expiresAt }
const pendingPairCodes = new Map<string, { sessionId: string; expiresAt: number }>();

function generatePairCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

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
      if (update.message) {
        const chatId = update.message.chat.id;
        const text = update.message.text || '';
        const chatTitle = update.message.chat.title || update.message.chat.first_name || 'Unknown';

        // Track known chats
        knownChats.set(chatId, { id: chatId, title: chatTitle, type: update.message.chat.type, username: update.message.chat.username });

        if (mainWin && !mainWin.isDestroyed()) {
          mainWin.webContents.send('telegram:message', {
            id: update.message.message_id,
            chatId,
            chatTitle,
            chatType: update.message.chat.type,
            from: update.message.from ? {
              id: update.message.from.id,
              name: [update.message.from.first_name, update.message.from.last_name].filter(Boolean).join(' '),
              username: update.message.from.username,
            } : null,
            text,
            date: update.message.date,
          });
        }

        // Handle bot commands
        if (text.startsWith('/')) {
          const handled = await handleBotCommand(chatId, text);
          if (handled) continue;
        }

        // Auto-reply if pairing exists for this chat
        if (text) {
          await handleAutoReply(chatId, text);
        }
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

async function handleBotCommand(chatId: number, text: string): Promise<boolean> {
  const cmd = text.split(' ')[0].toLowerCase().replace(/@\w+$/, '');
  const db = getDb();

  if (cmd === '/start') {
    await telegramApi('sendMessage', {
      chat_id: chatId,
      text: '🤖 *JVOS Bot*\n\nComandos disponíveis:\n\n/sessions — Selecionar sessão ativa\n/status — Ver sessão vinculada\n/unpair — Desvincular sessão\n/help — Mostrar ajuda',
      parse_mode: 'Markdown',
    });
    return true;
  }

  if (cmd === '/help') {
    await telegramApi('sendMessage', {
      chat_id: chatId,
      text: '📋 *Comandos*\n\n/sessions — Lista sessões do JVOS para vincular\n/select\\_N — Seleciona sessão N da lista\n/status — Mostra sessão vinculada\n/unpair — Remove vínculo\n/start — Menu inicial',
      parse_mode: 'Markdown',
    });
    return true;
  }

  if (cmd === '/sessions') {
    if (!db) {
      await telegramApi('sendMessage', { chat_id: chatId, text: '⚠️ Banco de dados indisponível.' });
      return true;
    }
    const rows = db.exec('SELECT id, title FROM sessions ORDER BY updated_at DESC LIMIT 20');
    if (!rows.length || !rows[0].values.length) {
      await telegramApi('sendMessage', { chat_id: chatId, text: 'Nenhuma sessão encontrada.' });
      return true;
    }
    const sessionList = rows[0].values.map((r, i) => `${i + 1}. \`${(r[1] as string || 'Sem título').slice(0, 40)}\``).join('\n');
    await telegramApi('sendMessage', {
      chat_id: chatId,
      text: `📂 *Sessões disponíveis:*\n\n${sessionList}\n\nEnvie /select\\_N para vincular (ex: /select\\_1)`,
      parse_mode: 'Markdown',
    });
    // Store the session list in memory for this chat
    const sessionIds = rows[0].values.map(r => r[0] as string);
    knownChats.set(chatId, { ...knownChats.get(chatId)!, _sessionList: sessionIds } as any);
    return true;
  }

  if (cmd.startsWith('/select_') || cmd.startsWith('/select')) {
    const numStr = text.replace(/^\/select_?/i, '').trim();
    const num = parseInt(numStr, 10);
    if (!num || num < 1) {
      await telegramApi('sendMessage', { chat_id: chatId, text: '⚠️ Use /select\\_N (ex: /select\\_1)' });
      return true;
    }
    if (!db) {
      await telegramApi('sendMessage', { chat_id: chatId, text: '⚠️ Banco indisponível.' });
      return true;
    }
    // Get sessions again
    const rows = db.exec('SELECT id, title FROM sessions ORDER BY updated_at DESC LIMIT 20');
    if (!rows.length || !rows[0].values.length || num > rows[0].values.length) {
      await telegramApi('sendMessage', { chat_id: chatId, text: `⚠️ Sessão ${num} não existe. Use /sessions para ver a lista.` });
      return true;
    }
    const [sessionId, sessionTitle] = rows[0].values[num - 1] as [string, string];
    // Remove existing pairing for this chat
    db.run('DELETE FROM telegram_pairings WHERE chat_id = ?', [chatId]);
    // Create new pairing
    db.run('INSERT INTO telegram_pairings (chat_id, session_id, direction) VALUES (?, ?, ?)', [chatId, sessionId, 'both']);
    await telegramApi('sendMessage', {
      chat_id: chatId,
      text: `✅ Vinculado à sessão: *${(sessionTitle || 'Sem título').slice(0, 40)}*\n\nAgora suas mensagens serão processadas por essa sessão.`,
      parse_mode: 'Markdown',
    });
    // Notify renderer to reload pairings
    if (mainWin && !mainWin.isDestroyed()) {
      mainWin.webContents.send('telegram:pairing-updated');
    }
    return true;
  }

  if (cmd === '/status') {
    if (!db) {
      await telegramApi('sendMessage', { chat_id: chatId, text: '⚠️ Banco indisponível.' });
      return true;
    }
    const rows = db.exec('SELECT tp.session_id, tp.direction, s.title FROM telegram_pairings tp LEFT JOIN sessions s ON s.id = tp.session_id WHERE tp.chat_id = ?', [chatId]);
    if (!rows.length || !rows[0].values.length) {
      await telegramApi('sendMessage', { chat_id: chatId, text: '❌ Nenhuma sessão vinculada. Use /sessions para vincular.' });
      return true;
    }
    const [sid, dir, title] = rows[0].values[0] as [string, string, string];
    const dirLabel = dir === 'both' ? '↔ Bidirecional' : dir === 'tg-to-session' ? '→ Telegram → JVOS' : '← JVOS → Telegram';
    await telegramApi('sendMessage', {
      chat_id: chatId,
      text: `📎 *Sessão vinculada:*\n${(title || 'Sem título').slice(0, 40)}\n\nDireção: ${dirLabel}`,
      parse_mode: 'Markdown',
    });
    return true;
  }

  if (cmd === '/unpair') {
    if (!db) {
      await telegramApi('sendMessage', { chat_id: chatId, text: '⚠️ Banco indisponível.' });
      return true;
    }
    db.run('DELETE FROM telegram_pairings WHERE chat_id = ?', [chatId]);
    await telegramApi('sendMessage', { chat_id: chatId, text: '✅ Sessão desvinculada.' });
    if (mainWin && !mainWin.isDestroyed()) {
      mainWin.webContents.send('telegram:pairing-updated');
    }
    return true;
  }

  if (cmd === '/pair') {
    const code = text.replace(/^\/pair\s*/i, '').trim();
    if (!code || code.length !== 6) {
      await telegramApi('sendMessage', { chat_id: chatId, text: '⚠️ Use: /pair CODIGO (6 dígitos gerado no JVOS)' });
      return true;
    }
    const pending = pendingPairCodes.get(code);
    if (!pending || Date.now() > pending.expiresAt) {
      pendingPairCodes.delete(code);
      await telegramApi('sendMessage', { chat_id: chatId, text: '❌ Código inválido ou expirado. Gere um novo no JVOS.' });
      return true;
    }
    if (!db) {
      await telegramApi('sendMessage', { chat_id: chatId, text: '⚠️ Banco indisponível.' });
      return true;
    }
    // Create pairing
    db.run('DELETE FROM telegram_pairings WHERE chat_id = ?', [chatId]);
    const chatTitle = knownChats.get(chatId)?.title || 'Telegram';
    db.run('INSERT INTO telegram_pairings (chat_id, session_id, chat_title, direction) VALUES (?, ?, ?, ?)', [chatId, pending.sessionId, chatTitle, 'both']);
    pendingPairCodes.delete(code);
    // Get session title
    const sRows = db.exec('SELECT title FROM sessions WHERE id = ?', [pending.sessionId]);
    const sTitle = (sRows.length && sRows[0].values.length ? sRows[0].values[0][0] as string : 'Sessão') || 'Sessão';
    await telegramApi('sendMessage', {
      chat_id: chatId,
      text: `✅ Pareado com sucesso!\n\n📎 Sessão: *${sTitle.slice(0, 40)}*\n\nAgora suas mensagens serão processadas por essa sessão.`,
      parse_mode: 'Markdown',
    });
    if (mainWin && !mainWin.isDestroyed()) {
      mainWin.webContents.send('telegram:pairing-updated');
      mainWin.webContents.send('telegram:pair-success', { chatId, code });
    }
    return true;
  }

  return false;
}

async function handleAutoReply(chatId: number, userText: string) {
  const db = getDb();
  if (!db) return;

  // Check if this chat has a pairing
  const rows = db.exec('SELECT session_id, direction FROM telegram_pairings WHERE chat_id = ?', [chatId]);
  if (!rows.length || !rows[0].values.length) return;

  const [sessionId, direction] = rows[0].values[0] as [string, string];
  if (direction === 'session-to-tg') return; // Only outbound, don't auto-reply

  // Get conversation history from this session
  const msgRows = db.exec(
    'SELECT role, content FROM messages WHERE session_id = ? ORDER BY created_at DESC LIMIT 20',
    [sessionId]
  );
  const history: Array<{ role: string; content: string }> = [];
  if (msgRows.length && msgRows[0].values.length) {
    for (const r of msgRows[0].values.reverse()) {
      history.push({ role: r[0] as string, content: r[1] as string });
    }
  }

  // Add current user message
  history.push({ role: 'user', content: userText });

  // Save user message to session
  const userMsgId = `tg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  db.run('INSERT INTO messages (id, session_id, role, content) VALUES (?, ?, ?, ?)', [userMsgId, sessionId, 'user', userText]);
  db.run('UPDATE sessions SET updated_at = datetime("now") WHERE id = ?', [sessionId]);

  // Get LLM response
  try {
    const reply = await generateReply(history);
    if (reply) {
      // Save assistant reply to session
      const replyId = `tg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      db.run('INSERT INTO messages (id, session_id, role, content) VALUES (?, ?, ?, ?)', [replyId, sessionId, 'assistant', reply]);
      db.run('UPDATE sessions SET updated_at = datetime("now") WHERE id = ?', [sessionId]);

      // Send reply to Telegram (fallback to plain text if Markdown fails)
      try {
        await telegramApi('sendMessage', {
          chat_id: chatId,
          text: reply,
          parse_mode: 'Markdown',
        });
      } catch {
        await telegramApi('sendMessage', {
          chat_id: chatId,
          text: reply,
        });
      }

      // Notify renderer
      if (mainWin && !mainWin.isDestroyed()) {
        mainWin.webContents.send('telegram:message', {
          id: Date.now(),
          chatId,
          chatTitle: '',
          chatType: 'private',
          from: null,
          text: reply,
          date: Math.floor(Date.now() / 1000),
        });
      }
    }
  } catch (err: any) {
    // Send error to Telegram so user knows something failed
    try {
      await telegramApi('sendMessage', {
        chat_id: chatId,
        text: `⚠️ Erro ao processar: ${err.message}`,
      });
    } catch {}
  }
}

async function generateReply(messages: Array<{ role: string; content: string }>): Promise<string> {
  const defaultModel = getSetting('default_model') || 'gpt-4.1-mini';
  const systemMsg = 'You are a helpful assistant responding via Telegram. Keep responses concise. Respond in the same language as the user.';

  const cleanMessages = messages
    .filter(m => m.role === 'user' || m.role === 'assistant')
    .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }));

  if (cleanMessages.length === 0) {
    throw new Error('Nenhuma mensagem para processar');
  }

  const errors: string[] = [];

  // 0. Try OAuth (same provider as JVOS chat sessions)
  const oauthToken = getOpenAIAccessToken();
  if (oauthToken) {
    try {
      const client = new OpenAI({
        apiKey: oauthToken,
        baseURL: 'https://chatgpt.com/backend-api/codex',
        defaultHeaders: { 'x-codex-client-version': '0.1.0' },
      });
      const response = await client.chat.completions.create({
        model: 'gpt-4.1-mini',
        messages: [
          { role: 'system', content: systemMsg },
          ...cleanMessages,
        ],
      });
      return response.choices[0]?.message?.content || '';
    } catch (err: any) {
      errors.push(`OAuth: ${err.status || ''} ${err.message || err}`);
    }
  }

  // 1. Try OpenAI API key
  const openaiKey = getStoredKey('openai');
  if (openaiKey) {
    try {
      const client = new OpenAI({ apiKey: openaiKey });
      let model = defaultModel;
      if (model.startsWith('o3') || model.startsWith('o4') || !model.startsWith('gpt')) {
        model = 'gpt-4.1-mini';
      }
      const response = await client.chat.completions.create({
        model,
        messages: [
          { role: 'system', content: systemMsg },
          ...cleanMessages,
        ],
      });
      return response.choices[0]?.message?.content || '';
    } catch (err: any) {
      errors.push(`OpenAI: ${err.status || ''} ${err.message || err}`);
    }
  }

  // 2. Try Anthropic
  const anthropicKey = getStoredKey('anthropic');
  if (anthropicKey) {
    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': anthropicKey, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6-20250514',
          max_tokens: 2048,
          system: systemMsg,
          messages: cleanMessages,
        }),
      });
      const data = await response.json();
      if (data.error) throw new Error(data.error.message || `HTTP ${response.status}`);
      const text = data.content?.[0]?.text;
      if (text) return text;
    } catch (err: any) {
      errors.push(`Anthropic: ${err.message || err}`);
    }
  }

  // 3. Try Google
  const googleKey = getStoredKey('google');
  if (googleKey) {
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${googleKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemMsg }] },
          contents: cleanMessages.map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })),
        }),
      });
      const data = await response.json();
      if (data.error) throw new Error(data.error.message || `HTTP ${response.status}`);
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) return text;
    } catch (err: any) {
      errors.push(`Google: ${err.message || err}`);
    }
  }

  if (errors.length > 0) {
    throw new Error(`Todas as APIs falharam:\n${errors.join('\n')}`);
  }
  throw new Error('Nenhuma API key configurada. Adicione uma chave em Configurações > Provedores (OpenAI, Anthropic ou Google).');
}

export function registerTelegramHandlers(win: BrowserWindow) {
  mainWin = win;

  // Auto-start polling on app boot if token exists
  try {
    const existingToken = getSetting('telegram_bot_token');
    if (existingToken && !pollingActive) {
      // Delete webhook first to ensure polling works
      fetch(`${BASE_URL}${existingToken}/deleteWebhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ drop_pending_updates: false }),
      }).catch(() => {});
      pollingActive = true;
      pollUpdates();
    }
  } catch {}

  ipcMain.handle('telegram:set-token', async (_event, token: string) => {
    try {
      const res = await fetch(`${BASE_URL}${token}/getMe`, { method: 'POST' });
      const data = await res.json();
      if (!data.ok) return { error: 'Token inválido: ' + (data.description || 'bot não encontrado') };
      setSetting('telegram_bot_token', token);
      // Auto-start polling after token is set
      try { await fetch(`${BASE_URL}${token}/deleteWebhook`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ drop_pending_updates: false }) }); } catch {}
      if (!pollingActive) {
        pollingActive = true;
        pollUpdates();
      }
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
      // Return chats from memory (populated by polling)
      // Also check DB for chats from pairings
      if (knownChats.size === 0) {
        const db = getDb();
        if (db) {
          const rows = db.exec('SELECT DISTINCT chat_id, chat_title FROM telegram_pairings');
          if (rows.length && rows[0].values.length) {
            for (const r of rows[0].values) {
              const cid = r[0] as number;
              if (!knownChats.has(cid)) {
                knownChats.set(cid, { id: cid, title: r[1] as string || 'Unknown', type: 'private' });
              }
            }
          }
        }
      }
      return { success: true, chats: Array.from(knownChats.values()).map(c => ({ id: c.id, title: c.title, type: c.type, username: (c as any).username })) };
    } catch (err: any) {
      return { error: err.message };
    }
  });

  ipcMain.handle('telegram:start-polling', async () => {
    if (pollingActive) return { success: true, status: 'already running' };
    try {
      getToken();
      // Delete any existing webhook — Telegram blocks getUpdates when a webhook is set
      try { await telegramApi('deleteWebhook', { drop_pending_updates: false }); } catch {}
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

  ipcMain.handle('telegram:generate-pair-code', async (_event, sessionId: string) => {
    try {
      // Clean expired codes
      for (const [k, v] of pendingPairCodes.entries()) {
        if (Date.now() > v.expiresAt) pendingPairCodes.delete(k);
      }
      const code = generatePairCode();
      pendingPairCodes.set(code, { sessionId, expiresAt: Date.now() + 5 * 60 * 1000 }); // 5 min TTL
      const me = await telegramApi('getMe').catch(() => null);
      const botUsername = me?.username || 'jvos_bot';
      return { success: true, code, botUsername, expiresIn: 300 };
    } catch (err: any) {
      return { error: err.message };
    }
  });
}
