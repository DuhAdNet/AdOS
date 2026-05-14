import { ipcMain, BrowserWindow, session as electronSession } from 'electron';

const CHATGPT_URL = 'https://chatgpt.com';
const PARTITION = 'persist:chatgpt';

let chatgptWindow: BrowserWindow | null = null;

function getChatGPTSession() {
  return electronSession.fromPartition(PARTITION);
}

export function registerChatGPTAuthHandlers() {
  ipcMain.handle('chatgpt:open', async (_event, mainWinBounds?: { x: number; y: number; width: number; height: number }) => {
    if (chatgptWindow && !chatgptWindow.isDestroyed()) {
      chatgptWindow.focus();
      return { success: true };
    }

    chatgptWindow = new BrowserWindow({
      width: 900,
      height: 700,
      title: 'ChatGPT',
      webPreferences: {
        partition: PARTITION,
        contextIsolation: true,
        nodeIntegration: false,
      },
    });

    chatgptWindow.loadURL(CHATGPT_URL);

    chatgptWindow.on('closed', () => {
      chatgptWindow = null;
    });

    return { success: true };
  });

  ipcMain.handle('chatgpt:check-session', async () => {
    const cookies = await getChatGPTSession().cookies.get({ domain: '.chatgpt.com' });
    const hasSession = cookies.some((c) => c.name.includes('session') || c.name === '__Secure-next-auth.session-token');
    return { authenticated: hasSession || cookies.length > 3 };
  });

  ipcMain.handle('chatgpt:logout', async () => {
    if (chatgptWindow && !chatgptWindow.isDestroyed()) {
      chatgptWindow.close();
      chatgptWindow = null;
    }
    await getChatGPTSession().clearStorageData();
    return { success: true };
  });

  ipcMain.handle('chatgpt:close', async () => {
    if (chatgptWindow && !chatgptWindow.isDestroyed()) {
      chatgptWindow.close();
      chatgptWindow = null;
    }
    return { success: true };
  });

  ipcMain.handle('chatgpt:send-message', async (_event, message: string) => {
    if (!chatgptWindow || chatgptWindow.isDestroyed()) {
      chatgptWindow = new BrowserWindow({
        width: 900,
        height: 700,
        title: 'ChatGPT',
        webPreferences: {
          partition: PARTITION,
          contextIsolation: true,
          nodeIntegration: false,
        },
      });
      chatgptWindow.loadURL(CHATGPT_URL);
      chatgptWindow.on('closed', () => { chatgptWindow = null; });

      chatgptWindow.webContents.on('did-finish-load', () => {
        injectMessage(message);
      });
    } else {
      chatgptWindow.focus();
      injectMessage(message);
    }
    return { success: true };
  });
}

function injectMessage(message: string) {
  if (!chatgptWindow || chatgptWindow.isDestroyed()) return;
  const escaped = message.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$/g, '\\$');
  chatgptWindow.webContents.executeJavaScript(`
    (async () => {
      await new Promise(r => setTimeout(r, 1500));
      const el = document.querySelector('#prompt-textarea');
      if (el) {
        el.focus();
        el.innerHTML = '<p>${escaped}</p>';
        el.dispatchEvent(new Event('input', { bubbles: true }));
        await new Promise(r => setTimeout(r, 300));
        const btn = document.querySelector('[data-testid="send-button"]');
        if (btn) btn.click();
      }
    })();
  `);
}
