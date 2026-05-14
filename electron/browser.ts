import { ipcMain, BrowserWindow } from 'electron';
import { chromium, Browser, Page } from 'playwright-core';

let browser: Browser | null = null;
let page: Page | null = null;
let browserWindow: BrowserWindow | null = null;

export function registerBrowserHandlers() {
  ipcMain.handle('browser:open', async (_event, url: string) => {
    try {
      browser = await chromium.launch({
        headless: false,
        args: ['--disable-blink-features=AutomationControlled'],
      });

      const context = await browser.newContext({
        viewport: { width: 1280, height: 720 },
      });

      page = await context.newPage();
      await page.goto(url, { waitUntil: 'domcontentloaded' });

      return { success: true, url };
    } catch (err: unknown) {
      const error = err as Error;
      return { error: error.message };
    }
  });

  ipcMain.handle('browser:screenshot', async () => {
    if (!page) return { error: 'Nenhum browser aberto' };

    try {
      const buffer = await page.screenshot({ type: 'png' });
      return { image: buffer.toString('base64') };
    } catch (err: unknown) {
      const error = err as Error;
      return { error: error.message };
    }
  });

  ipcMain.handle('browser:close', async () => {
    if (browser) {
      await browser.close();
      browser = null;
      page = null;
    }
    if (browserWindow) {
      browserWindow.close();
      browserWindow = null;
    }
    return { success: true };
  });
}
