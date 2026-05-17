import { ipcMain, BrowserWindow, session } from 'electron';

const browserWindows = new Map<string, BrowserWindow>();
const urlHistory = new Map<string, string[]>();
let mainWindow: BrowserWindow | null = null;

export function registerBrowserHandlers(win: BrowserWindow) {
  mainWindow = win;

  function createBrowserWindow(sessionId: string, url: string) {
    const mainBounds = mainWindow!.getBounds();
    const width = Math.min(1000, mainBounds.width - 50);
    const height = Math.min(700, mainBounds.height - 50);
    const offset = browserWindows.size * 30;

    const bw = new BrowserWindow({
      width,
      height,
      x: mainBounds.x + Math.floor((mainBounds.width - width) / 2) + offset,
      y: mainBounds.y + Math.floor((mainBounds.height - height) / 2) + offset,
      frame: true,
      resizable: true,
      movable: true,
      minimizable: true,
      maximizable: true,
      skipTaskbar: false,
      backgroundColor: '#1a1a2e',
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
      },
    });

    bw.loadURL(url);
    browserWindows.set(sessionId, bw);

    // F4: Track URL history
    if (!urlHistory.has(sessionId)) urlHistory.set(sessionId, []);
    const hist = urlHistory.get(sessionId)!;
    hist.push(url);
    if (hist.length > 50) hist.shift();

    bw.webContents.on('did-navigate', (_e, navUrl) => {
      const h = urlHistory.get(sessionId);
      if (h && h[h.length - 1] !== navUrl) { h.push(navUrl); if (h.length > 50) h.shift(); }
      mainWindow?.webContents.send('browser:state-changed', { sessionId, open: true, visible: true, url: navUrl });
    });

    bw.webContents.on('did-navigate-in-page', (_e, navUrl) => {
      const h = urlHistory.get(sessionId);
      if (h && h[h.length - 1] !== navUrl) { h.push(navUrl); if (h.length > 50) h.shift(); }
    });

    bw.on('closed', () => {
      browserWindows.delete(sessionId);
      mainWindow?.webContents.send('browser:state-changed', { sessionId, open: false, visible: false, url: '' });
    });

    bw.on('minimize', () => {
      bw.restore();
      bw.hide();
      mainWindow?.webContents.send('browser:state-changed', { sessionId, open: true, visible: false, url: bw.webContents.getURL() });
    });

    bw.on('restore', () => {
      mainWindow?.webContents.send('browser:state-changed', { sessionId, open: true, visible: true, url: bw.webContents.getURL() });
    });

    mainWindow!.webContents.send('browser:state-changed', { sessionId, open: true, visible: true, url });
    return bw;
  }

  function getOrCreate(sessionId: string, url: string): BrowserWindow {
    const existing = browserWindows.get(sessionId);
    if (existing && !existing.isDestroyed()) {
      existing.loadURL(url);
      existing.show();
      return existing;
    }
    return createBrowserWindow(sessionId, url);
  }

  function getWin(sessionId: string): BrowserWindow | null {
    const bw = browserWindows.get(sessionId);
    if (bw && !bw.isDestroyed()) return bw;
    return null;
  }

  ipcMain.handle('browser:open', async (_event, url: string, sessionId?: string) => {
    if (!mainWindow) return { error: 'Janela principal não encontrada' };
    const sid = sessionId || 'default';
    try {
      getOrCreate(sid, url);
      return { success: true, url };
    } catch (err: unknown) {
      return { error: (err as Error).message };
    }
  });

  ipcMain.handle('browser:navigate', async (_event, url: string, sessionId?: string) => {
    const bw = getWin(sessionId || 'default');
    if (!bw) return { error: 'Browser não está aberto' };
    bw.loadURL(url);
    return { success: true };
  });

  ipcMain.handle('browser:back', async (_event, sessionId?: string) => {
    const bw = getWin(sessionId || 'default');
    if (!bw) return { error: 'Browser não está aberto' };
    if (bw.webContents.canGoBack()) bw.webContents.goBack();
    return { success: true };
  });

  ipcMain.handle('browser:forward', async (_event, sessionId?: string) => {
    const bw = getWin(sessionId || 'default');
    if (!bw) return { error: 'Browser não está aberto' };
    if (bw.webContents.canGoForward()) bw.webContents.goForward();
    return { success: true };
  });

  ipcMain.handle('browser:reload', async (_event, sessionId?: string) => {
    const bw = getWin(sessionId || 'default');
    if (!bw) return { error: 'Browser não está aberto' };
    bw.webContents.reload();
    return { success: true };
  });

  ipcMain.handle('browser:screenshot', async (_event, sessionId?: string) => {
    const bw = getWin(sessionId || 'default');
    if (!bw) return { error: 'Browser não está aberto' };
    try {
      const image = await bw.webContents.capturePage();
      return { image: image.toPNG().toString('base64') };
    } catch (err: unknown) {
      return { error: (err as Error).message };
    }
  });

  ipcMain.handle('browser:get-url', async (_event, sessionId?: string) => {
    const bw = getWin(sessionId || 'default');
    if (!bw) return { url: '' };
    return { url: bw.webContents.getURL() };
  });

  ipcMain.handle('browser:get-title', async (_event, sessionId?: string) => {
    const bw = getWin(sessionId || 'default');
    if (!bw) return { title: '' };
    return { title: bw.webContents.getTitle() };
  });

  ipcMain.handle('browser:execute-js', async (_event, code: string, sessionId?: string) => {
    const bw = getWin(sessionId || 'default');
    if (!bw) return { error: 'Browser não está aberto' };
    try {
      const result = await bw.webContents.executeJavaScript(code);
      return { result };
    } catch (err: unknown) {
      return { error: (err as Error).message };
    }
  });

  ipcMain.handle('browser:close', async (_event, sessionId?: string) => {
    const bw = getWin(sessionId || 'default');
    if (bw) {
      bw.close();
      browserWindows.delete(sessionId || 'default');
    }
    return { success: true };
  });

  ipcMain.handle('browser:hide', async (_event, sessionId?: string) => {
    let bw = getWin(sessionId || 'default');
    let resolvedId = sessionId || 'default';
    if (!bw) {
      for (const [id, win] of browserWindows) {
        if (win && !win.isDestroyed()) { bw = win; resolvedId = id; break; }
      }
    }
    if (bw) {
      bw.hide();
      mainWindow?.webContents.send('browser:state-changed', { sessionId: resolvedId, open: true, visible: false, url: bw.webContents.getURL() });
    }
    return { success: true };
  });

  ipcMain.handle('browser:show', async (_event, sessionId?: string) => {
    let bw = getWin(sessionId || 'default');
    let resolvedId = sessionId || 'default';
    if (!bw) {
      for (const [id, win] of browserWindows) {
        if (win && !win.isDestroyed()) { bw = win; resolvedId = id; break; }
      }
    }
    if (bw) {
      bw.show();
      if (bw.isMinimized()) bw.restore();
      bw.focus();
      mainWindow?.webContents.send('browser:state-changed', { sessionId: resolvedId, open: true, visible: true, url: bw.webContents.getURL() });
    }
    return { success: true };
  });

  ipcMain.handle('browser:is-open', (_event, sessionId?: string) => {
    const bw = getWin(sessionId || 'default');
    return { open: bw !== null, visible: bw ? !bw.isMinimized() : false };
  });

  ipcMain.handle('browser:resize', async (_event, bounds: { x: number; y: number; width: number; height: number }, sessionId?: string) => {
    const bw = getWin(sessionId || 'default');
    if (bw) bw.setBounds(bounds);
    return { success: true };
  });

  // F4: URL history per session
  ipcMain.handle('browser:history', async (_event, sessionId?: string) => {
    const hist = urlHistory.get(sessionId || 'default');
    return { history: hist || [] };
  });

  // F2: Screenshot and return as base64 for chat insertion
  ipcMain.handle('browser:screenshot-to-chat', async (_event, sessionId?: string) => {
    const bw = getWin(sessionId || 'default');
    if (!bw) return { error: 'Browser não está aberto' };
    try {
      const image = await bw.webContents.capturePage();
      const base64 = image.toPNG().toString('base64');
      return { image: base64, mimeType: 'image/png', url: bw.webContents.getURL() };
    } catch (err: unknown) {
      return { error: (err as Error).message };
    }
  });

  // F3: Get selected text from browser
  ipcMain.handle('browser:get-selection', async (_event, sessionId?: string) => {
    const bw = getWin(sessionId || 'default');
    if (!bw) return { text: '' };
    try {
      const text = await bw.webContents.executeJavaScript('window.getSelection()?.toString() || ""');
      return { text };
    } catch {
      return { text: '' };
    }
  });

  // F6: Picture-in-picture (small always-on-top window)
  ipcMain.handle('browser:pip', async (_event, sessionId?: string) => {
    const bw = getWin(sessionId || 'default');
    if (!bw) return { error: 'Browser não está aberto' };
    const isOnTop = bw.isAlwaysOnTop();
    if (isOnTop) {
      bw.setAlwaysOnTop(false);
      const mainBounds = mainWindow!.getBounds();
      bw.setBounds({ width: Math.min(1000, mainBounds.width - 50), height: Math.min(700, mainBounds.height - 50), x: mainBounds.x + 25, y: mainBounds.y + 25 });
    } else {
      bw.setAlwaysOnTop(true, 'floating');
      bw.setBounds({ width: 420, height: 320, x: bw.getBounds().x, y: bw.getBounds().y });
    }
    return { pip: !isOnTop };
  });

  // F7: Cookie/session persistence — uses default partition so cookies persist naturally
  // No extra handler needed; BrowserWindow already shares the default session partition.
}

export async function openBrowserUrl(url: string, sessionId?: string): Promise<void> {
  if (!mainWindow) return;
  const sid = sessionId || 'default';
  const existing = browserWindows.get(sid);
  if (existing && !existing.isDestroyed()) {
    existing.loadURL(url);
    existing.show();
  } else {
    const mainBounds = mainWindow.getBounds();
    const width = Math.min(1000, mainBounds.width - 50);
    const height = Math.min(700, mainBounds.height - 50);

    const bw = new BrowserWindow({
      width,
      height,
      x: mainBounds.x + Math.floor((mainBounds.width - width) / 2),
      y: mainBounds.y + Math.floor((mainBounds.height - height) / 2),
      frame: true,
      resizable: true,
      movable: true,
      minimizable: true,
      maximizable: true,
      skipTaskbar: false,
      backgroundColor: '#1a1a2e',
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
      },
    });

    bw.loadURL(url);
    browserWindows.set(sid, bw);

    bw.on('closed', () => {
      browserWindows.delete(sid);
      mainWindow?.webContents.send('browser:state-changed', { sessionId: sid, open: false, visible: false, url: '' });
    });
  }
  mainWindow.webContents.send('browser:state-changed', { sessionId: sid, open: true, visible: true, url });
}

export async function getBrowserTitle(sessionId?: string): Promise<string> {
  const bw = browserWindows.get(sessionId || 'default');
  if (!bw || bw.isDestroyed()) return '';
  return bw.webContents.getTitle();
}

export async function getBrowserText(sessionId?: string): Promise<string> {
  const bw = browserWindows.get(sessionId || 'default');
  if (!bw || bw.isDestroyed()) return '';
  try {
    return await bw.webContents.executeJavaScript('document.body.innerText.slice(0, 8000)');
  } catch {
    return '';
  }
}

export function getBrowserView(sessionId?: string): BrowserWindow | null {
  const bw = browserWindows.get(sessionId || 'default');
  if (!bw || bw.isDestroyed()) return null;
  return bw;
}
