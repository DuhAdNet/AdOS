import { ipcMain, BrowserWindow, WebContentsView, webContents } from 'electron';

let browserView: WebContentsView | null = null;
let mainWindow: BrowserWindow | null = null;

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
        resizeBrowserView();
        browserView.webContents.loadURL(url);
      }

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
    }
    return { success: true };
  });

  ipcMain.handle('browser:resize', async (_event, bounds: { x: number; y: number; width: number; height: number }) => {
    if (browserView) {
      browserView.setBounds(bounds);
    }
    return { success: true };
  });

  mainWindow.on('resize', () => {
    resizeBrowserView();
  });
}

function resizeBrowserView() {
  if (!browserView || !mainWindow) return;
  const { width, height } = mainWindow.getContentBounds();
  // Browser takes right half (split view with chat on left)
  const sidebarWidth = 256;
  const chatWidth = Math.floor((width - sidebarWidth) / 2);
  browserView.setBounds({
    x: sidebarWidth + chatWidth,
    y: 32, // below title bar
    width: width - sidebarWidth - chatWidth,
    height: height - 32,
  });
}
