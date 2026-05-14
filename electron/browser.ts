import { ipcMain, BrowserWindow, WebContentsView } from 'electron';

let browserView: WebContentsView | null = null;
let mainWindow: BrowserWindow | null = null;
let browserVisible = false;

export function registerBrowserHandlers(win: BrowserWindow) {
  mainWindow = win;

  ipcMain.handle('browser:open', async (_event, url: string) => {
    if (!mainWindow) return { error: 'Janela principal não encontrada' };

    try {
      if (browserView) {
        browserView.webContents.loadURL(url);
      } else {
        browserView = new WebContentsView({
          webPreferences: {
            contextIsolation: true,
            nodeIntegration: false,
          },
        });

        mainWindow.contentView.addChildView(browserView);
        browserView.webContents.loadURL(url);
      }

      browserVisible = true;
      resizeBrowserView();
      mainWindow.webContents.send('browser:state-changed', { open: true, visible: true, url });

      return { success: true, url };
    } catch (err: unknown) {
      const error = err as Error;
      return { error: error.message };
    }
  });

  ipcMain.handle('browser:navigate', async (_event, url: string) => {
    if (!browserView) return { error: 'Browser não está aberto' };
    browserView.webContents.loadURL(url);
    return { success: true };
  });

  ipcMain.handle('browser:back', async () => {
    if (!browserView) return { error: 'Browser não está aberto' };
    if (browserView.webContents.canGoBack()) {
      browserView.webContents.goBack();
    }
    return { success: true };
  });

  ipcMain.handle('browser:forward', async () => {
    if (!browserView) return { error: 'Browser não está aberto' };
    if (browserView.webContents.canGoForward()) {
      browserView.webContents.goForward();
    }
    return { success: true };
  });

  ipcMain.handle('browser:reload', async () => {
    if (!browserView) return { error: 'Browser não está aberto' };
    browserView.webContents.reload();
    return { success: true };
  });

  ipcMain.handle('browser:screenshot', async () => {
    if (!browserView) return { error: 'Browser não está aberto' };

    try {
      const image = await browserView.webContents.capturePage();
      return { image: image.toPNG().toString('base64') };
    } catch (err: unknown) {
      const error = err as Error;
      return { error: error.message };
    }
  });

  ipcMain.handle('browser:get-url', async () => {
    if (!browserView) return { url: '' };
    return { url: browserView.webContents.getURL() };
  });

  ipcMain.handle('browser:get-title', async () => {
    if (!browserView) return { title: '' };
    return { title: browserView.webContents.getTitle() };
  });

  ipcMain.handle('browser:execute-js', async (_event, code: string) => {
    if (!browserView) return { error: 'Browser não está aberto' };
    try {
      const result = await browserView.webContents.executeJavaScript(code);
      return { result };
    } catch (err: unknown) {
      const error = err as Error;
      return { error: error.message };
    }
  });

  ipcMain.handle('browser:close', async () => {
    if (browserView && mainWindow) {
      mainWindow.contentView.removeChildView(browserView);
      browserView.webContents.close();
      browserView = null;
      browserVisible = false;
    }
    return { success: true };
  });

  ipcMain.handle('browser:hide', async () => {
    if (browserView && mainWindow) {
      browserView.setBounds({ x: 0, y: 0, width: 0, height: 0 });
      browserVisible = false;
    }
    return { success: true };
  });

  ipcMain.handle('browser:show', async () => {
    if (browserView && mainWindow) {
      browserVisible = true;
      resizeBrowserView();
    }
    return { success: true };
  });

  ipcMain.handle('browser:is-open', () => {
    return { open: browserView !== null, visible: browserVisible };
  });

  ipcMain.handle('browser:resize', async (_event, bounds: { x: number; y: number; width: number; height: number }) => {
    if (browserView) {
      browserView.setBounds(bounds);
    }
    return { success: true };
  });

  mainWindow.on('resize', () => {
    if (browserVisible) resizeBrowserView();
  });
}

function resizeBrowserView() {
  if (!browserView || !mainWindow) return;
  const { width, height } = mainWindow.getContentBounds();
  const modalWidth = Math.min(900, width - 100);
  const modalHeight = Math.min(600, height - 100);
  const x = Math.floor((width - modalWidth) / 2);
  const y = Math.floor((height - modalHeight) / 2) + 40;
  browserView.setBounds({
    x,
    y,
    width: modalWidth,
    height: modalHeight - 40,
  });
}

export async function openBrowserUrl(url: string): Promise<void> {
  if (!mainWindow) return;
  if (browserView) {
    browserView.webContents.loadURL(url);
  } else {
    const { WebContentsView: WCV } = require('electron');
    browserView = new WCV({
      webPreferences: { contextIsolation: true, nodeIntegration: false },
    });
    mainWindow.contentView.addChildView(browserView!);
    browserView!.webContents.loadURL(url);
  }
  browserVisible = true;
  resizeBrowserView();
  mainWindow.webContents.send('browser:state-changed', { open: true, visible: true, url });
}

export async function getBrowserTitle(): Promise<string> {
  if (!browserView) return '';
  return browserView.webContents.getTitle();
}

export async function getBrowserText(): Promise<string> {
  if (!browserView) return '';
  try {
    return await browserView.webContents.executeJavaScript('document.body.innerText.slice(0, 8000)');
  } catch {
    return '';
  }
}

export function getBrowserView(): WebContentsView | null {
  return browserView;
}
