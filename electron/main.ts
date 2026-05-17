import { app, BrowserWindow, ipcMain, session, systemPreferences, shell } from 'electron';
import path from 'path';
import { registerBrowserHandlers } from './browser';
import { registerLLMHandlers } from './llm';
import { registerMcpHandlers } from './mcp-manager';
import { registerProviderHandlers } from './providers';
import { registerChatGPTAuthHandlers } from './chatgpt-auth';
import { registerOpenAIOAuthHandlers } from './openai-oauth';
import { initDatabase, registerDatabaseHandlers } from './database';
import { registerToolHandlers, setDocumentsRoot } from './tools';
import { registerOAuthHandlers } from './oauth';
import { registerIntegrationHandlers } from './integrations';
import { registerAgentHandlers } from './agents';
import { registerTelegramHandlers } from './telegram';
import { getSetting, getDb } from './database';
import { startScheduler } from './scheduler';
import { registerActionsEngineHandlers, initActionsSchema } from './actions-engine';
import { registerListenerHandlers, initListenersSchema, startListeners } from './listeners';

app.disableHardwareAcceleration();
app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('disable-software-rasterizer');

let mainWindow: BrowserWindow | null = null;

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    frame: false,
    titleBarStyle: 'hidden',
    backgroundColor: '#0b0f1a',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, '../index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Grant microphone/camera permissions for voice input
  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    const allowed = ['media', 'mediaKeySystem', 'clipboard-read', 'clipboard-sanitized-write'];
    callback(allowed.includes(permission));
  });
  session.defaultSession.setPermissionCheckHandler((_webContents, permission) => {
    const allowed = ['media', 'mediaKeySystem', 'clipboard-read', 'clipboard-sanitized-write'];
    return allowed.includes(permission);
  });

  // On macOS, request microphone access at OS level
  if (process.platform === 'darwin') {
    systemPreferences.askForMediaAccess('microphone').catch(() => {});
  }

  await initDatabase();
  registerDatabaseHandlers();

  const customPath = getSetting('documents_path');
  if (customPath) setDocumentsRoot(customPath);

  registerBrowserHandlers(mainWindow);
  registerLLMHandlers();
  registerMcpHandlers();
  registerProviderHandlers();
  registerChatGPTAuthHandlers();
  registerOpenAIOAuthHandlers();
  registerToolHandlers();
  registerOAuthHandlers();
  registerIntegrationHandlers();
  registerAgentHandlers();
  registerTelegramHandlers(mainWindow);
  initActionsSchema();
  initListenersSchema();
  registerActionsEngineHandlers(mainWindow);
  registerListenerHandlers(mainWindow);
  startScheduler(getDb(), mainWindow);
  startListeners(mainWindow);
}

app.on('ready', createWindow);

app.on('window-all-closed', () => {
  app.quit();
});

ipcMain.handle('window:minimize', () => mainWindow?.minimize());
ipcMain.handle('window:maximize', () => {
  if (mainWindow?.isMaximized()) {
    mainWindow.unmaximize();
  } else {
    mainWindow?.maximize();
  }
});
ipcMain.handle('window:close', () => mainWindow?.close());
ipcMain.handle('shell:open-external', (_event, url: string) => {
  shell.openExternal(url);
});
