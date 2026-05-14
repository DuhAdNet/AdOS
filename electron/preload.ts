import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('ados', {
  window: {
    minimize: () => ipcRenderer.invoke('window:minimize'),
    maximize: () => ipcRenderer.invoke('window:maximize'),
    close: () => ipcRenderer.invoke('window:close'),
  },
  llm: {
    chat: (messages: Array<{ role: string; content: string }>, model: string) =>
      ipcRenderer.invoke('llm:chat', messages, model),
    stream: (messages: Array<{ role: string; content: string }>, model: string) =>
      ipcRenderer.invoke('llm:stream', messages, model),
    onStreamChunk: (callback: (chunk: string) => void) => {
      ipcRenderer.on('llm:stream-chunk', (_e, chunk) => callback(chunk));
    },
    onStreamEnd: (callback: () => void) => {
      ipcRenderer.on('llm:stream-end', () => callback());
    },
    onStreamError: (callback: (error: string) => void) => {
      ipcRenderer.on('llm:stream-error', (_e, error) => callback(error));
    },
    removeStreamListeners: () => {
      ipcRenderer.removeAllListeners('llm:stream-chunk');
      ipcRenderer.removeAllListeners('llm:stream-end');
      ipcRenderer.removeAllListeners('llm:stream-error');
    },
    saveKey: (provider: string, key: string) =>
      ipcRenderer.invoke('llm:save-key', provider, key),
    testKey: (provider: string, key: string) =>
      ipcRenderer.invoke('llm:test-key', provider, key),
    hasKey: (provider: string) =>
      ipcRenderer.invoke('llm:has-key', provider),
  },
  db: {
    createSession: (id: string, title: string) =>
      ipcRenderer.invoke('db:create-session', id, title),
    getSessions: () => ipcRenderer.invoke('db:get-sessions'),
    updateSessionTitle: (id: string, title: string) =>
      ipcRenderer.invoke('db:update-session-title', id, title),
    deleteSession: (id: string) => ipcRenderer.invoke('db:delete-session', id),
    addMessage: (id: string, sessionId: string, role: string, content: string) =>
      ipcRenderer.invoke('db:add-message', id, sessionId, role, content),
    getMessages: (sessionId: string) => ipcRenderer.invoke('db:get-messages', sessionId),
    getSetting: (key: string) => ipcRenderer.invoke('db:get-setting', key),
    setSetting: (key: string, value: string) => ipcRenderer.invoke('db:set-setting', key, value),
  },
  browser: {
    open: (url: string) => ipcRenderer.invoke('browser:open', url),
    navigate: (url: string) => ipcRenderer.invoke('browser:navigate', url),
    back: () => ipcRenderer.invoke('browser:back'),
    forward: () => ipcRenderer.invoke('browser:forward'),
    reload: () => ipcRenderer.invoke('browser:reload'),
    screenshot: () => ipcRenderer.invoke('browser:screenshot'),
    getUrl: () => ipcRenderer.invoke('browser:get-url'),
    getTitle: () => ipcRenderer.invoke('browser:get-title'),
    executeJs: (code: string) => ipcRenderer.invoke('browser:execute-js', code),
    close: () => ipcRenderer.invoke('browser:close'),
    resize: (bounds: { x: number; y: number; width: number; height: number }) =>
      ipcRenderer.invoke('browser:resize', bounds),
  },
});
