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
  },
  settings: {
    get: (key: string) => ipcRenderer.invoke('settings:get', key),
    set: (key: string, value: unknown) => ipcRenderer.invoke('settings:set', key, value),
  },
  browser: {
    open: (url: string) => ipcRenderer.invoke('browser:open', url),
    screenshot: () => ipcRenderer.invoke('browser:screenshot'),
    close: () => ipcRenderer.invoke('browser:close'),
  },
});
