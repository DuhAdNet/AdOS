import { ipcMain, BrowserWindow } from 'electron';

let browserWin: BrowserWindow | null = null;
let mainWindow: BrowserWindow | null = null;
let browserVisible = false;

export function registerBrowserHandlers(win: BrowserWindow) {
  mainWindow = win;

  function createBrowserWindow(url: string) {
    const mainBounds = mainWindow!.getBounds();
    const width = Math.min(1000, mainBounds.width - 50);
    const height = Math.min(700, mainBounds.height - 50);

    browserWin = new BrowserWindow({
      width,
      height,
      x: mainBounds.x + Math.floor((mainBounds.width - width) / 2),
      y: mainBounds.y + Math.floor((mainBounds.height - height) / 2),
      parent: mainWindow!,
      frame: true,
      resizable: true,
      movable: true,
      minimizable: false,
      maximizable: true,
      skipTaskbar: true,
      backgroundColor: '#1a1a2e',
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
      },
    });

    browserWin.loadURL(url);
    browserVisible = true;

    browserWin.on('closed', () => {
      browserWin = null;
      browserVisible = false;
      mainWindow?.webContents.send('browser:state-changed', { open: false, visible: false, url: '' });
    });

    mainWindow!.webContents.send('browser:state-changed', { open: true, visible: true, url });
  }

  ipcMain.handle('browser:open', async (_event, url: string) => {
    if (!mainWindow) return { error: 'Janela principal não encontrada' };
    try {
      if (browserWin && !browserWin.isDestroyed()) {
        browserWin.loadURL(url);
        browserWin.show();
      } else {
        createBrowserWindow(url);
      }
      browserVisible = true;
      return { success: true, url };
    } catch (err: unknown) {
      return { error: (err as Error).message };
    }
  });

  ipcMain.handle('browser:navigate', async (_event, url: string) => {
    if (!browserWin || browserWin.isDestroyed()) return { error: 'Browser não está aberto' };
    browserWin.loadURL(url);
    return { success: true };
  });

  ipcMain.handle('browser:back', async () => {
    if (!browserWin || browserWin.isDestroyed()) return { error: 'Browser não está aberto' };
    if (browserWin.webContents.canGoBack()) browserWin.webContents.goBack();
    return { success: true };
  });

  ipcMain.handle('browser:forward', async () => {
    if (!browserWin || browserWin.isDestroyed()) return { error: 'Browser não está aberto' };
    if (browserWin.webContents.canGoForward()) browserWin.webContents.goForward();
    return { success: true };
  });

  ipcMain.handle('browser:reload', async () => {
    if (!browserWin || browserWin.isDestroyed()) return { error: 'Browser não está aberto' };
    browserWin.webContents.reload();
    return { success: true };
  });

  ipcMain.handle('browser:screenshot', async () => {
    if (!browserWin || browserWin.isDestroyed()) return { error: 'Browser não está aberto' };
    try {
      const image = await browserWin.webContents.capturePage();
      return { image: image.toPNG().toString('base64') };
    } catch (err: unknown) {
      return { error: (err as Error).message };
    }
  });

  ipcMain.handle('browser:get-url', async () => {
    if (!browserWin || browserWin.isDestroyed()) return { url: '' };
    return { url: browserWin.webContents.getURL() };
  });

  ipcMain.handle('browser:get-title', async () => {
    if (!browserWin || browserWin.isDestroyed()) return { title: '' };
    return { title: browserWin.webContents.getTitle() };
  });

  ipcMain.handle('browser:execute-js', async (_event, code: string) => {
    if (!browserWin || browserWin.isDestroyed()) return { error: 'Browser não está aberto' };
    try {
      const result = await browserWin.webContents.executeJavaScript(code);
      return { result };
    } catch (err: unknown) {
      return { error: (err as Error).message };
    }
  });

  ipcMain.handle('browser:close', async () => {
    if (browserWin && !browserWin.isDestroyed()) {
      browserWin.close();
      browserWin = null;
    }
    browserVisible = false;
    return { success: true };
  });

  ipcMain.handle('browser:hide', async () => {
    if (browserWin && !browserWin.isDestroyed()) {
      browserWin.hide();
      browserVisible = false;
      mainWindow?.webContents.send('browser:state-changed', { open: true, visible: false, url: browserWin.webContents.getURL() });
    }
    return { success: true };
  });

  ipcMain.handle('browser:show', async () => {
    if (browserWin && !browserWin.isDestroyed()) {
      browserWin.show();
      browserVisible = true;
      mainWindow?.webContents.send('browser:state-changed', { open: true, visible: true, url: browserWin.webContents.getURL() });
    }
    return { success: true };
  });

  ipcMain.handle('browser:is-open', () => {
    return { open: browserWin !== null && !browserWin.isDestroyed(), visible: browserVisible };
  });

  ipcMain.handle('browser:resize', async (_event, bounds: { x: number; y: number; width: number; height: number }) => {
    if (browserWin && !browserWin.isDestroyed()) {
      browserWin.setBounds(bounds);
    }
    return { success: true };
  });
}

export async function openBrowserUrl(url: string): Promise<void> {
  if (!mainWindow) return;
  if (browserWin && !browserWin.isDestroyed()) {
    browserWin.loadURL(url);
    browserWin.show();
  } else {
    const mainBounds = mainWindow.getBounds();
    const width = Math.min(1000, mainBounds.width - 50);
    const height = Math.min(700, mainBounds.height - 50);

    browserWin = new BrowserWindow({
      width,
      height,
      x: mainBounds.x + Math.floor((mainBounds.width - width) / 2),
      y: mainBounds.y + Math.floor((mainBounds.height - height) / 2),
      parent: mainWindow,
      frame: true,
      resizable: true,
      movable: true,
      minimizable: false,
      maximizable: true,
      skipTaskbar: true,
      backgroundColor: '#1a1a2e',
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
      },
    });

    browserWin.loadURL(url);

    browserWin.on('closed', () => {
      browserWin = null;
      browserVisible = false;
      mainWindow?.webContents.send('browser:state-changed', { open: false, visible: false, url: '' });
    });
  }
  browserVisible = true;
  mainWindow.webContents.send('browser:state-changed', { open: true, visible: true, url });
}

export async function getBrowserTitle(): Promise<string> {
  if (!browserWin || browserWin.isDestroyed()) return '';
  return browserWin.webContents.getTitle();
}

export async function getBrowserText(): Promise<string> {
  if (!browserWin || browserWin.isDestroyed()) return '';
  try {
    return await browserWin.webContents.executeJavaScript('document.body.innerText.slice(0, 8000)');
  } catch {
    return '';
  }
}

export function getBrowserView(): BrowserWindow | null {
  if (!browserWin || browserWin.isDestroyed()) return null;
  return browserWin;
}
